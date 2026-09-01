// =============================================================
// fbrController.js - FBR POS Integration (Federal Board of Revenue)
// Handles FBR API settings, token retrieval, invoice posting,
// retry for failed invoices, and log viewing.
// FBR API docs: https://esp.fbr.gov.pk (sandbox) / https://gw.fbr.gov.pk (live)
// Used by: /api/fbr routes
// =============================================================

const https = require('https');
const { query } = require('../config/database');
const logger = require('../config/logger');
const { logAction } = require('../services/auditService');

// ----------------------------------------------------------------
// FBR API endpoints
// ----------------------------------------------------------------
const FBR_TOKEN_URL      = 'https://gw.fbr.gov.pk/imsp/v1/api/Login/GetToken';
const FBR_INVOICE_LIVE   = 'https://gw.fbr.gov.pk/imsp/v1/api/Live/PostInvoiceV2';
const FBR_INVOICE_SANDBOX = 'https://esp.fbr.gov.pk/esb/v1/api/Sandbox/PostInvoiceV2';

// ----------------------------------------------------------------
// Internal helpers
// ----------------------------------------------------------------

/**
 * Ensure all FBR columns exist in store_settings and required tables exist.
 * Idempotent — called at the top of every exported function.
 */
// FBR schema (store_settings + sales columns) is now ensured by Migration v19.
// The fbr_invoices table still needs to be created on first use since it's
// not part of the base schema.sql and may not be in all tenant DBs.
let _schemaDone = false;
async function ensureFbrSchema() {
  if (_schemaDone) return;
  _schemaDone = true;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS fbr_invoices (
        fbr_log_id     INT PRIMARY KEY AUTO_INCREMENT,
        sale_id        INT NULL,
        fbr_invoice_no VARCHAR(100) NULL,
        fbr_status     ENUM('pending','sent','failed','retry') NOT NULL DEFAULT 'pending',
        fbr_response   TEXT NULL,
        fbr_error      TEXT NULL,
        attempt_count  INT DEFAULT 0,
        last_attempt   DATETIME NULL,
        created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (e) {
    logger.warn('[fbrController] fbr_invoices table warning:', e.message);
  }
}

/**
 * Generic HTTPS POST helper.
 * Returns { statusCode, body } where body is parsed JSON or raw string.
 */
function httpsPost(urlString, payload, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(urlString);
    const postData = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + (urlObj.search || ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        ...extraHeaders,
      },
    };

    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        let body;
        try { body = JSON.parse(raw); } catch { body = raw; }
        resolve({ statusCode: res.statusCode, body });
      });
    });

    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('FBR API request timed out after 20 s')); });
    req.write(postData);
    req.end();
  });
}

/**
 * Obtain a short-lived FBR bearer token.
 * @param {string} username
 * @param {string} password  Plain-text password (NOT hashed — FBR expects plaintext)
 * @param {number} posid
 * @returns {string} token
 * @throws  Error if token retrieval fails
 */
async function getFbrToken(username, password, posid) {
  const { statusCode, body } = await httpsPost(FBR_TOKEN_URL, {
    UserName: username,
    Password: password,
    POSID: Number(posid),
  });

  if (statusCode !== 200) {
    const msg = (typeof body === 'object' ? body?.Message || JSON.stringify(body) : body) || `HTTP ${statusCode}`;
    throw new Error(`FBR token error: ${msg}`);
  }

  // FBR returns the token as a plain string or as { Token: "..." }
  if (typeof body === 'string' && body.length > 0) return body.trim();
  if (body?.Token)  return body.Token;
  if (body?.token)  return body.token;

  throw new Error('FBR token not found in response');
}

/**
 * Map sale payment_method to FBR PaymentMode integer.
 * 1 = cash, 2 = card, 3 = online
 */
function paymentModeCode(method) {
  const m = (method || '').toLowerCase();
  if (m === 'card')   return 2;
  if (m === 'online') return 3;
  return 1; // default: cash
}

/**
 * Build the FBR invoice payload from a sale row and its items.
 */
function buildFbrPayload(sale, items, posid, ntn) {
  const totalQty    = items.reduce((s, i) => s + Number(i.quantity || 0), 0);
  const totalSale   = parseFloat(sale.subtotal || sale.total_amount || 0);
  const taxAmount   = parseFloat(sale.tax_amount || 0);
  const discount    = parseFloat(sale.discount || 0);
  const totalBill   = parseFloat(sale.total_amount || 0);
  const saleDate    = sale.created_at
    ? new Date(sale.created_at).toISOString().replace('T', ' ').substring(0, 19)
    : new Date().toISOString().replace('T', ' ').substring(0, 19);

  return {
    InvoiceNumber:    sale.invoice_no || String(sale.sale_id),
    POSID:            Number(posid),
    DateTime:         saleDate,
    BuyerNTN:         '',
    BuyerCNIC:        '',
    BuyerName:        sale.customer_name || 'Walk-in Customer',
    BuyerPhoneNumber: sale.customer_phone || '',
    TotalBillAmount:  totalBill,
    TotalQuantity:    totalQty,
    TotalSaleValue:   totalSale,
    Discount:         discount,
    FurtherTax:       0,
    TaxChargeable:    taxAmount,
    PaymentMode:      paymentModeCode(sale.payment_method),
    Items: items.map((item) => ({
      ItemCode:    String(item.product_id || 0),
      ItemName:    item.product_name || 'Item',
      Quantity:    Number(item.quantity || 0),
      PCTCode:     '',
      TaxRate:     Number(item.tax_percent || 0),
      SaleValue:   parseFloat(item.subtotal || (item.quantity * item.unit_price) || 0),
      Discount:    parseFloat(item.discount || 0),
      FurtherTax:  0,
      TaxChargeable: parseFloat(item.tax_amount || 0),
      TotalAmount:   parseFloat(item.total || (item.quantity * item.unit_price) || 0),
      InvoiceType:   1,
      RefUSIN:       null,
    })),
  };
}

// ----------------------------------------------------------------
// Controller functions
// ----------------------------------------------------------------

/**
 * GET /api/fbr/settings
 * Returns FBR settings from store_settings (password masked).
 */
exports.getSettings = async (req, res) => {
  try {
    await ensureFbrSchema();

    const rows = await query(
      `SELECT fbr_enabled, fbr_posid, fbr_username,
              fbr_password, fbr_mode, fbr_ntn
         FROM store_settings WHERE setting_id = 1`
    );

    if (!rows.length) {
      return res.json({
        fbr_enabled: false,
        fbr_posid: '',
        fbr_username: '',
        fbr_password: '',
        fbr_mode: 'sandbox',
        fbr_ntn: '',
      });
    }

    const row = rows[0];

    // Mask password
    const maskedPassword = row.fbr_password ? '••••••••' : '';

    res.json({
      fbr_enabled:   !!row.fbr_enabled,
      fbr_posid:     row.fbr_posid || '',
      fbr_username:  row.fbr_username || '',
      fbr_password:  maskedPassword,
      fbr_mode:      row.fbr_mode || 'sandbox',
      fbr_ntn:       row.fbr_ntn || '',
    });
  } catch (err) {
    logger.error('[fbrController] getSettings error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * PUT /api/fbr/settings
 * Saves FBR settings. Stores password as plaintext (FBR API requires it for token calls).
 * Skips password update if placeholder value is submitted.
 */
exports.saveSettings = async (req, res) => {
  try {
    await ensureFbrSchema();

    const {
      fbr_enabled,
      fbr_posid,
      fbr_username,
      fbr_password,
      fbr_mode,
      fbr_ntn,
    } = req.body;

    // Update non-sensitive fields
    await query(
      `UPDATE store_settings
          SET fbr_enabled  = ?,
              fbr_posid    = ?,
              fbr_username = ?,
              fbr_mode     = ?,
              fbr_ntn      = ?
        WHERE setting_id   = 1`,
      [
        fbr_enabled ? 1 : 0,
        fbr_posid  || null,
        fbr_username || null,
        ['sandbox', 'live'].includes(fbr_mode) ? fbr_mode : 'sandbox',
        fbr_ntn || null,
      ]
    );

    // Only update password if a real (non-placeholder) value is provided
    if (fbr_password && fbr_password !== '••••••••') {
      // Store plaintext — FBR token endpoint requires the real password
      await query(
        `UPDATE store_settings SET fbr_password = ? WHERE setting_id = 1`,
        [fbr_password]
      );
    }

    await logAction(
      req.user.user_id, req.user.name,
      'FBR_SETTINGS_UPDATED', 'store_settings', 1,
      { fbr_enabled, fbr_posid, fbr_username, fbr_mode, fbr_ntn },
      req.ip
    );

    res.json({ message: 'FBR settings saved successfully' });
  } catch (err) {
    logger.error('[fbrController] saveSettings error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * POST /api/fbr/test
 * Calls FBR token endpoint with stored credentials.
 * Returns { ok, message }.
 */
exports.testConnection = async (req, res) => {
  try {
    await ensureFbrSchema();

    const rows = await query(
      `SELECT fbr_posid, fbr_username, fbr_password
         FROM store_settings WHERE setting_id = 1`
    );

    if (!rows.length || !rows[0].fbr_username || !rows[0].fbr_password || !rows[0].fbr_posid) {
      return res.status(400).json({ ok: false, message: 'FBR credentials not configured. Save settings first.' });
    }

    const { fbr_posid, fbr_username, fbr_password } = rows[0];

    try {
      const token = await getFbrToken(fbr_username, fbr_password, fbr_posid);
      if (token) {
        return res.json({ ok: true, message: 'FBR connection successful. Token obtained.' });
      }
      res.status(400).json({ ok: false, message: 'FBR returned an empty token' });
    } catch (apiErr) {
      logger.warn('[fbrController] testConnection failed:', apiErr.message);
      res.status(400).json({ ok: false, message: apiErr.message });
    }
  } catch (err) {
    logger.error('[fbrController] testConnection error:', err);
    res.status(500).json({ ok: false, message: 'Server error' });
  }
};

/**
 * POST /api/fbr/post-invoice
 * Body: { sale_id }
 * Fetches sale + items, obtains FBR token, posts invoice to FBR, updates DB.
 * Returns { ok, fbr_invoice_no, message }.
 */
exports.postInvoice = async (req, res) => {
  try {
    await ensureFbrSchema();

    const { sale_id } = req.body;
    if (!sale_id) return res.status(400).json({ message: 'sale_id is required' });

    // --- 1. Load FBR settings ---
    const settingsRows = await query(
      `SELECT fbr_enabled, fbr_posid, fbr_username, fbr_password, fbr_mode, fbr_ntn
         FROM store_settings WHERE setting_id = 1`
    );

    if (!settingsRows.length) return res.status(500).json({ message: 'Store settings not found' });

    const cfg = settingsRows[0];
    if (!cfg.fbr_enabled)  return res.status(400).json({ message: 'FBR integration is not enabled' });
    if (!cfg.fbr_username || !cfg.fbr_password || !cfg.fbr_posid) {
      return res.status(400).json({ message: 'FBR credentials are not fully configured' });
    }

    // --- 2. Fetch sale ---
    const saleRows = await query(
      `SELECT s.*, u.name AS cashier_name
         FROM sales s
         LEFT JOIN users u ON s.user_id = u.user_id
        WHERE s.sale_id = ?`,
      [sale_id]
    );
    if (!saleRows.length) return res.status(404).json({ message: `Sale #${sale_id} not found` });
    const sale = saleRows[0];

    // --- 3. Fetch sale items ---
    const items = await query(
      `SELECT sd.*, p.product_name
         FROM sale_details sd
         LEFT JOIN products p ON sd.product_id = p.product_id
        WHERE sd.sale_id = ?`,
      [sale_id]
    );

    // --- 4. Mark as pending ---
    await query(
      `UPDATE sales SET fbr_status = 'pending' WHERE sale_id = ?`,
      [sale_id]
    ).catch(() => {});

    // --- 5. Get FBR token ---
    let token;
    try {
      token = await getFbrToken(cfg.fbr_username, cfg.fbr_password, cfg.fbr_posid);
    } catch (tokenErr) {
      logger.error('[fbrController] postInvoice token error:', tokenErr);
      await query(`UPDATE sales SET fbr_status = 'failed' WHERE sale_id = ?`, [sale_id]).catch(() => {});
      await _logFbrInvoice(sale_id, null, 'failed', null, tokenErr.message, 1);
      return res.status(502).json({ ok: false, message: `FBR token error: ${tokenErr.message}` });
    }

    // --- 6. Build and POST FBR payload ---
    const fbrPayload = buildFbrPayload(sale, items, cfg.fbr_posid, cfg.fbr_ntn);
    const invoiceUrl = cfg.fbr_mode === 'live' ? FBR_INVOICE_LIVE : FBR_INVOICE_SANDBOX;

    let fbrInvoiceNo = null;
    let sendStatus   = 'failed';
    let fbrError     = null;
    let rawResponse  = null;

    try {
      const { statusCode, body } = await httpsPost(invoiceUrl, fbrPayload, {
        Authorization: `Bearer ${token}`,
      });

      rawResponse = typeof body === 'string' ? body : JSON.stringify(body);

      if (statusCode >= 200 && statusCode < 300) {
        // FBR returns InvoiceNumber or USTIN in the response
        fbrInvoiceNo = body?.InvoiceNumber || body?.USTIN || body?.invoiceNumber || null;
        sendStatus   = 'sent';
      } else {
        fbrError = body?.Message || body?.message || `HTTP ${statusCode}`;
        logger.warn('[fbrController] postInvoice FBR API error:', body);
      }
    } catch (apiErr) {
      fbrError = apiErr.message;
      logger.error('[fbrController] postInvoice API call failed:', apiErr);
    }

    // --- 7. Update sales table ---
    if (sendStatus === 'sent') {
      await query(
        `UPDATE sales
            SET fbr_invoice_no = ?,
                fbr_status     = 'sent',
                fbr_synced_at  = NOW()
          WHERE sale_id = ?`,
        [fbrInvoiceNo, sale_id]
      ).catch((e) => logger.warn('[fbrController] sales update warning:', e.message));
    } else {
      await query(
        `UPDATE sales SET fbr_status = 'failed' WHERE sale_id = ?`,
        [sale_id]
      ).catch(() => {});
    }

    // --- 8. Insert into fbr_invoices ---
    await _logFbrInvoice(sale_id, fbrInvoiceNo, sendStatus, rawResponse, fbrError, 1);

    // --- 9. Audit log ---
    await logAction(
      req.user.user_id, req.user.name,
      'FBR_INVOICE_POSTED', 'sales', sale_id,
      { fbr_invoice_no: fbrInvoiceNo, fbr_status: sendStatus },
      req.ip
    );

    if (sendStatus === 'sent') {
      return res.json({ ok: true, fbr_invoice_no: fbrInvoiceNo, message: 'Invoice posted to FBR successfully' });
    }

    res.status(502).json({ ok: false, fbr_invoice_no: null, message: fbrError || 'Failed to post invoice to FBR' });
  } catch (err) {
    logger.error('[fbrController] postInvoice error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * POST /api/fbr/retry-failed
 * Retries all sales where fbr_status = 'failed' and attempt_count < 5.
 */
exports.retryFailed = async (req, res) => {
  try {
    await ensureFbrSchema();

    // Load FBR settings once
    const settingsRows = await query(
      `SELECT fbr_enabled, fbr_posid, fbr_username, fbr_password, fbr_mode, fbr_ntn
         FROM store_settings WHERE setting_id = 1`
    );
    if (!settingsRows.length || !settingsRows[0].fbr_enabled) {
      return res.status(400).json({ message: 'FBR integration is not enabled' });
    }
    const cfg = settingsRows[0];
    if (!cfg.fbr_username || !cfg.fbr_password || !cfg.fbr_posid) {
      return res.status(400).json({ message: 'FBR credentials are not fully configured' });
    }

    // Get failed sales that still have remaining attempts
    const failedSales = await query(
      `SELECT s.sale_id
         FROM sales s
         LEFT JOIN (
           SELECT sale_id, SUM(attempt_count) AS total_attempts
             FROM fbr_invoices
            GROUP BY sale_id
         ) fi ON fi.sale_id = s.sale_id
        WHERE s.fbr_status = 'failed'
          AND COALESCE(fi.total_attempts, 0) < 5`
    ).catch(() => []);

    if (!failedSales.length) {
      return res.json({ message: 'No failed invoices eligible for retry', retried: 0, succeeded: 0 });
    }

    // Get a fresh token before iterating
    let token;
    try {
      token = await getFbrToken(cfg.fbr_username, cfg.fbr_password, cfg.fbr_posid);
    } catch (tokenErr) {
      return res.status(502).json({ message: `FBR token error: ${tokenErr.message}`, retried: 0, succeeded: 0 });
    }

    const invoiceUrl = cfg.fbr_mode === 'live' ? FBR_INVOICE_LIVE : FBR_INVOICE_SANDBOX;
    let succeeded = 0;
    let retried   = 0;

    for (const { sale_id } of failedSales) {
      retried++;
      try {
        // Fetch sale + items
        const saleRows = await query(
          `SELECT s.*, u.name AS cashier_name
             FROM sales s
             LEFT JOIN users u ON s.user_id = u.user_id
            WHERE s.sale_id = ?`,
          [sale_id]
        );
        if (!saleRows.length) continue;
        const sale = saleRows[0];

        const items = await query(
          `SELECT sd.*, p.product_name
             FROM sale_details sd
             LEFT JOIN products p ON sd.product_id = p.product_id
            WHERE sd.sale_id = ?`,
          [sale_id]
        );

        const fbrPayload = buildFbrPayload(sale, items, cfg.fbr_posid, cfg.fbr_ntn);

        // Current attempt count for this sale
        const logRows = await query(
          `SELECT COALESCE(SUM(attempt_count), 0) AS total FROM fbr_invoices WHERE sale_id = ?`,
          [sale_id]
        ).catch(() => [{ total: 0 }]);
        const currentAttempts = Number(logRows[0]?.total || 0);

        const { statusCode, body } = await httpsPost(invoiceUrl, fbrPayload, {
          Authorization: `Bearer ${token}`,
        });

        const rawResponse = typeof body === 'string' ? body : JSON.stringify(body);

        if (statusCode >= 200 && statusCode < 300) {
          const fbrInvoiceNo = body?.InvoiceNumber || body?.USTIN || body?.invoiceNumber || null;
          await query(
            `UPDATE sales
                SET fbr_invoice_no = ?,
                    fbr_status     = 'sent',
                    fbr_synced_at  = NOW()
              WHERE sale_id = ?`,
            [fbrInvoiceNo, sale_id]
          ).catch(() => {});
          await _logFbrInvoice(sale_id, fbrInvoiceNo, 'sent', rawResponse, null, currentAttempts + 1);
          succeeded++;
        } else {
          const fbrError = body?.Message || body?.message || `HTTP ${statusCode}`;
          await _logFbrInvoice(sale_id, null, 'retry', rawResponse, fbrError, currentAttempts + 1);
        }
      } catch (saleErr) {
        logger.warn(`[fbrController] retryFailed error for sale_id ${sale_id}:`, saleErr.message);
        await _logFbrInvoice(sale_id, null, 'retry', null, saleErr.message, 1);
      }
    }

    await logAction(
      req.user.user_id, req.user.name,
      'FBR_RETRY_FAILED', 'sales', null,
      { retried, succeeded },
      req.ip
    );

    res.json({ message: `Retry complete: ${succeeded} of ${retried} invoices sent`, retried, succeeded });
  } catch (err) {
    logger.error('[fbrController] retryFailed error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * GET /api/fbr/logs?page=1&limit=20
 * Returns paginated fbr_invoices with basic sale info.
 */
exports.getLogs = async (req, res) => {
  try {
    await ensureFbrSchema();

    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const [countRow] = await query(`SELECT COUNT(*) AS total FROM fbr_invoices`);
    const total = countRow?.total || 0;

    const logs = await query(
      `SELECT fi.*,
              s.invoice_number, s.total_amount, s.payment_method,
              s.created_at AS sale_date,
              u.name AS cashier_name
         FROM fbr_invoices fi
         LEFT JOIN sales s  ON fi.sale_id = s.sale_id
         LEFT JOIN users u  ON s.user_id  = u.user_id
        ORDER BY fi.created_at DESC
        LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    res.json({
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    logger.error('[fbrController] getLogs error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ----------------------------------------------------------------
// Internal helper — insert/update fbr_invoices log row
// ----------------------------------------------------------------
async function _logFbrInvoice(sale_id, fbrInvoiceNo, status, response, errorMsg, attemptCount) {
  try {
    await query(
      `INSERT INTO fbr_invoices
         (sale_id, fbr_invoice_no, fbr_status, fbr_response, fbr_error, attempt_count, last_attempt, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        sale_id      || null,
        fbrInvoiceNo || null,
        status,
        response     || null,
        errorMsg     || null,
        attemptCount || 1,
      ]
    );
  } catch (e) {
    logger.warn('[fbrController] _logFbrInvoice warning:', e.message);
  }
}
