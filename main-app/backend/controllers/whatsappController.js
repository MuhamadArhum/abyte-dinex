// =============================================================
// whatsappController.js - WhatsApp Invoice Sending via Green API
// Green API is a WhatsApp gateway — no Meta Business account needed.
// Docs: https://green-api.com/en/docs/
// Used by: /api/whatsapp routes
// =============================================================

const https = require('https');
const http  = require('http');
const { URL } = require('url');
const { query } = require('../config/database');
const logger = require('../config/logger');
const { logAction } = require('../services/auditService');
const { encrypt, decrypt } = require('../services/cryptoService');

// ----------------------------------------------------------------
// Schema bootstrap
// ----------------------------------------------------------------

let _schemaDone = false;
async function ensureWhatsAppSchema() {
  if (_schemaDone) return;
  _schemaDone = true;

  const alters = [
    `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS whatsapp_enabled     TINYINT(1)   DEFAULT 0`,
    `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS whatsapp_api_url     VARCHAR(255) NULL`,
    `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS whatsapp_id_instance VARCHAR(100) NULL`,
    `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS whatsapp_api_token   TEXT         NULL`,
  ];
  for (const sql of alters) {
    try { await query(sql); } catch (e) {
      if (!e.message?.includes('Duplicate column') && !e.message?.includes('already exists'))
        logger.warn('[whatsapp] schema alter warning:', e.message);
    }
  }

  try {
    await query(`
      CREATE TABLE IF NOT EXISTS whatsapp_logs (
        log_id    INT PRIMARY KEY AUTO_INCREMENT,
        sale_id   INT NULL,
        phone     VARCHAR(30)  NOT NULL,
        status    ENUM('sent','failed') NOT NULL,
        error_msg TEXT NULL,
        sent_at   DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (e) {
    logger.warn('[whatsapp] whatsapp_logs table warning:', e.message);
  }
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

// Pakistani number → "923001234567@c.us" format for Green API
function toGreenChatId(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  let normalized;
  if (digits.startsWith('0'))   normalized = '92' + digits.slice(1);
  else if (digits.startsWith('92')) normalized = digits;
  else normalized = '92' + digits;
  return normalized + '@c.us';
}

// Generic HTTP/HTTPS request helper
function makeRequest(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(urlStr);
    const lib     = parsed.protocol === 'https:' ? https : http;
    const reqOpts = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   options.method || 'GET',
      headers:  options.headers || {},
    };

    const req = lib.request(reqOpts, (res) => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        let body;
        try { body = JSON.parse(raw); } catch { body = raw; }
        resolve({ statusCode: res.statusCode, body });
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Request timed out')); });
    if (options.body) req.write(options.body);
    req.end();
  });
}

// Build the Green API base URL: https://{apiUrl}/waInstance{idInstance}
function greenBase(apiUrl, idInstance) {
  const base = apiUrl.replace(/\/$/, '');
  return `${base}/waInstance${idInstance}`;
}

// ----------------------------------------------------------------
// Controller: GET /api/whatsapp/settings
// ----------------------------------------------------------------
exports.getSettings = async (req, res) => {
  try {
    await ensureWhatsAppSchema();

    const rows = await query(
      `SELECT whatsapp_enabled, whatsapp_api_url, whatsapp_id_instance, whatsapp_api_token
         FROM store_settings WHERE setting_id = 1`
    );

    if (!rows.length) {
      return res.json({ whatsapp_enabled: false, whatsapp_api_url: '', whatsapp_id_instance: '', whatsapp_api_token: '' });
    }

    const row = rows[0];

    // Decrypt then mask token — never expose raw value to frontend
    let maskedToken = '';
    if (row.whatsapp_api_token) {
      const plain = decrypt(row.whatsapp_api_token);
      maskedToken = plain.length > 8 ? plain.slice(0, 4) + '***...' + plain.slice(-4) : '***';
    }

    res.json({
      whatsapp_enabled:      !!row.whatsapp_enabled,
      whatsapp_api_url:      row.whatsapp_api_url      || '',
      whatsapp_id_instance:  row.whatsapp_id_instance  || '',
      whatsapp_api_token:    maskedToken,
    });
  } catch (err) {
    logger.error('[whatsapp] getSettings error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ----------------------------------------------------------------
// Controller: PUT /api/whatsapp/settings
// ----------------------------------------------------------------
exports.saveSettings = async (req, res) => {
  try {
    await ensureWhatsAppSchema();

    const { whatsapp_enabled, whatsapp_api_url, whatsapp_id_instance, whatsapp_api_token } = req.body;

    await query(
      `UPDATE store_settings
          SET whatsapp_enabled    = ?,
              whatsapp_api_url    = ?,
              whatsapp_id_instance= ?
        WHERE setting_id = 1`,
      [whatsapp_enabled ? 1 : 0, whatsapp_api_url || null, whatsapp_id_instance || null]
    );

    // Only update token if a real (non-masked) value was supplied — encrypt before storing
    if (whatsapp_api_token && !whatsapp_api_token.includes('***')) {
      await query(
        `UPDATE store_settings SET whatsapp_api_token = ? WHERE setting_id = 1`,
        [encrypt(whatsapp_api_token)]
      );
    }

    await logAction(req.user.user_id, req.user.name, 'WHATSAPP_SETTINGS_UPDATED', 'store_settings', 1,
      { whatsapp_enabled, whatsapp_api_url, whatsapp_id_instance }, req.ip);

    res.json({ message: 'WhatsApp settings saved successfully' });
  } catch (err) {
    logger.error('[whatsapp] saveSettings error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ----------------------------------------------------------------
// Controller: POST /api/whatsapp/test
// Calls Green API getStateInstance to verify credentials
// ----------------------------------------------------------------
exports.testConnection = async (req, res) => {
  try {
    await ensureWhatsAppSchema();

    const rows = await query(
      `SELECT whatsapp_api_url, whatsapp_id_instance, whatsapp_api_token
         FROM store_settings WHERE setting_id = 1`
    );

    if (!rows.length || !rows[0].whatsapp_api_url || !rows[0].whatsapp_id_instance || !rows[0].whatsapp_api_token) {
      return res.status(400).json({ ok: false, message: 'API URL, Instance ID and Token are required. Save settings first.' });
    }

    const { whatsapp_api_url, whatsapp_id_instance } = rows[0];
    const whatsapp_api_token = decrypt(rows[0].whatsapp_api_token);

    const url = `${greenBase(whatsapp_api_url, whatsapp_id_instance)}/getStateInstance/${whatsapp_api_token}`;
    const { statusCode, body } = await makeRequest(url);

    if (statusCode === 200 && body?.stateInstance) {
      const state = body.stateInstance;
      if (state === 'authorized') {
        return res.json({ ok: true, message: `Connected! Instance ${whatsapp_id_instance} is authorized and ready.` });
      }
      return res.status(400).json({ ok: false, message: `Instance state: ${state}. Please authorize the instance on Green API dashboard.` });
    }

    logger.warn('[whatsapp] testConnection response:', body);
    res.status(400).json({ ok: false, message: body?.message || `HTTP ${statusCode} — check your credentials` });
  } catch (err) {
    logger.error('[whatsapp] testConnection error:', err);
    res.status(500).json({ ok: false, message: err.message || 'Connection test failed' });
  }
};

// ----------------------------------------------------------------
// Controller: POST /api/whatsapp/send-invoice
// Body: { sale_id, phone }
// ----------------------------------------------------------------
exports.sendInvoice = async (req, res) => {
  try {
    await ensureWhatsAppSchema();

    const { sale_id, phone } = req.body;
    if (!sale_id) return res.status(400).json({ message: 'sale_id is required' });
    if (!phone)   return res.status(400).json({ message: 'phone is required' });

    // 1. Load WhatsApp settings
    const settingsRows = await query(
      `SELECT whatsapp_enabled, whatsapp_api_url, whatsapp_id_instance, whatsapp_api_token, store_name, currency_symbol
         FROM store_settings WHERE setting_id = 1`
    );
    if (!settingsRows.length) return res.status(500).json({ message: 'Store settings not found' });

    const cfg = settingsRows[0];
    cfg.whatsapp_api_token = decrypt(cfg.whatsapp_api_token); // decrypt before use
    if (!cfg.whatsapp_enabled) return res.status(400).json({ message: 'WhatsApp is not enabled. Enable it in Settings → WhatsApp & FBR.' });
    if (!cfg.whatsapp_api_url || !cfg.whatsapp_id_instance || !cfg.whatsapp_api_token) {
      return res.status(400).json({ message: 'WhatsApp is not fully configured. Set API URL, Instance ID and Token in Settings.' });
    }

    // 2. Fetch sale
    const saleRows = await query(
      `SELECT s.*, u.name AS cashier_name
         FROM sales s LEFT JOIN users u ON s.user_id = u.user_id
        WHERE s.sale_id = ?`, [sale_id]
    );
    if (!saleRows.length) return res.status(404).json({ message: `Sale #${sale_id} not found` });
    const sale = saleRows[0];

    // 3. Fetch sale items
    const items = await query(
      `SELECT sd.quantity, sd.unit_price, COALESCE(p.product_name, sd.product_name, 'Item') AS product_name
         FROM sale_details sd LEFT JOIN products p ON sd.product_id = p.product_id
        WHERE sd.sale_id = ?`, [sale_id]
    );

    // 4. Build message text
    const currency   = cfg.currency_symbol || 'Rs.';
    const storeName  = cfg.store_name || 'AByte POS';
    const invoiceNo  = sale.invoice_no || String(sale_id);
    const total      = parseFloat(sale.total_amount || 0).toFixed(0);
    const saleDate   = sale.sale_date
      ? new Date(sale.sale_date).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })
      : new Date().toLocaleDateString('en-PK');

    const itemLines = items.map(i =>
      `  • ${i.product_name} x${i.quantity} — ${currency}${parseFloat(i.unit_price || 0).toFixed(0)}`
    ).join('\n');

    const message = [
      `🧾 *Invoice from ${storeName}*`,
      ``,
      `Invoice #: *${invoiceNo}*`,
      `Date: ${saleDate}`,
      ``,
      `*Items:*`,
      itemLines || '  (no items)',
      ``,
      `*Total: ${currency}${total}*`,
      ``,
      `Thank you for your business! 🙏`,
    ].join('\n');

    // 5. Normalize phone to Green API chatId format
    const chatId = toGreenChatId(phone);
    if (!chatId) return res.status(400).json({ message: 'Invalid phone number' });

    // 6. POST to Green API sendMessage
    const url     = `${greenBase(cfg.whatsapp_api_url, cfg.whatsapp_id_instance)}/sendMessage/${cfg.whatsapp_api_token}`;
    const payload = JSON.stringify({ chatId, message });

    let sendStatus = 'failed';
    let errorMsg   = null;

    try {
      const { statusCode, body } = await makeRequest(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        body: payload,
      });

      if (statusCode === 200 && body?.idMessage) {
        sendStatus = 'sent';
      } else {
        errorMsg = body?.message || body?.error || `HTTP ${statusCode}`;
        logger.warn('[whatsapp] sendInvoice Green API error:', body);
      }
    } catch (apiErr) {
      errorMsg = apiErr.message;
      logger.error('[whatsapp] sendInvoice API call failed:', apiErr);
    }

    // 7. Log result
    try {
      await query(
        `INSERT INTO whatsapp_logs (sale_id, phone, status, error_msg, sent_at) VALUES (?, ?, ?, ?, NOW())`,
        [sale_id, chatId, sendStatus, errorMsg]
      );
    } catch (logErr) {
      logger.warn('[whatsapp] Failed to insert log:', logErr.message);
    }

    await logAction(req.user.user_id, req.user.name, 'WHATSAPP_INVOICE_SENT', 'sales', sale_id,
      { phone: chatId, status: sendStatus, invoice_no: invoiceNo }, req.ip);

    if (sendStatus === 'sent') {
      return res.json({ ok: true, message: `Invoice sent via WhatsApp to ${phone}` });
    }

    res.status(502).json({ ok: false, message: errorMsg || 'Failed to send WhatsApp message' });
  } catch (err) {
    logger.error('[whatsapp] sendInvoice error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
