// emailService.js - Email notification service
// Requires: npm install nodemailer (in backend folder)
// Configure in .env: EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM

const logger = require('../config/logger');

let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch {
  logger.warn('[EmailService] nodemailer not installed. Run: npm install nodemailer');
}

let _transporter = null;
let _configKey = null;

const _makeConfigKey = () =>
  `${process.env.EMAIL_HOST}:${process.env.EMAIL_PORT}:${process.env.EMAIL_USER}`;

const getTransporter = () => {
  if (!nodemailer) return null;
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER) return null;

  const key = _makeConfigKey();
  if (_transporter && _configKey === key) return _transporter;

  _transporter = nodemailer.createTransport({
    host:             process.env.EMAIL_HOST,
    port:             parseInt(process.env.EMAIL_PORT || '587'),
    secure:           process.env.EMAIL_PORT === '465',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    connectionTimeout: 10000,
    greetingTimeout:   8000,
    socketTimeout:     15000,
  });
  _configKey = key;
  return _transporter;
};

const resetTransporter = () => { _transporter = null; _configKey = null; };

const RETRY_DELAYS = [1000, 3000];

const sendMail = exports.sendMail = async ({ to, subject, html, text }) => {
  const transporter = getTransporter();
  if (!transporter) {
    logger.warn('[EmailService] Email not configured — skipping send', { to, subject });
    return { skipped: true };
  }

  let lastErr;
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to,
        subject,
        html,
        text,
      });
      logger.info('[EmailService] Email sent', { to, subject, messageId: info.messageId });
      return info;
    } catch (err) {
      lastErr = err;
      if (attempt < RETRY_DELAYS.length) {
        logger.warn(`[EmailService] Send attempt ${attempt + 1} failed, retrying`, { to, error: err.message });
        await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
      }
    }
  }
  resetTransporter();
  throw lastErr;
};

// ── Notification templates ──────────────────────────────────────

exports.sendLowStockAlert = async ({ to, products }) => {
  const rows = products.map(p =>
    `<tr><td style="padding:6px 12px;border-bottom:1px solid #f0f0f0">${p.product_name}</td>
         <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;text-align:right;color:#dc2626">${p.available_stock}</td>
         <td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;text-align:right">${p.reorder_level || 10}</td></tr>`
  ).join('');

  return sendMail({
    to,
    subject: `⚠️ Low Stock Alert — ${products.length} product(s) need reordering`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#10b981;padding:20px;border-radius:8px 8px 0 0">
          <h2 style="color:white;margin:0">Low Stock Alert</h2>
        </div>
        <div style="background:#f9fafb;padding:20px;border-radius:0 0 8px 8px">
          <p style="color:#374151">${products.length} product(s) have fallen below reorder level:</p>
          <table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden">
            <thead><tr style="background:#f3f4f6">
              <th style="padding:8px 12px;text-align:left;color:#6b7280">Product</th>
              <th style="padding:8px 12px;text-align:right;color:#6b7280">Current</th>
              <th style="padding:8px 12px;text-align:right;color:#6b7280">Reorder At</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="color:#9ca3af;font-size:12px;margin-top:16px">AByte ERP — Automated Alert</p>
        </div>
      </div>`,
    text: `Low Stock Alert\n\n${products.map(p => `${p.product_name}: ${p.available_stock} units`).join('\n')}`,
  });
};

exports.sendSaleConfirmation = async ({ to, sale }) => {
  return sendMail({
    to,
    subject: `Sale Receipt — ${sale.sale_number || `#${sale.sale_id}`}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#10b981;padding:20px;border-radius:8px 8px 0 0">
          <h2 style="color:white;margin:0">Sale Confirmed</h2>
        </div>
        <div style="background:#f9fafb;padding:20px">
          <p><strong>Sale Number:</strong> ${sale.sale_number || sale.sale_id}</p>
          <p><strong>Amount:</strong> ${sale.net_amount}</p>
          <p><strong>Payment:</strong> ${sale.payment_method || 'Cash'}</p>
          <p><strong>Date:</strong> ${new Date(sale.sale_date).toLocaleString()}</p>
        </div>
      </div>`,
    text: `Sale Confirmed\nSale: ${sale.sale_number || sale.sale_id}\nAmount: ${sale.net_amount}`,
  });
};

exports.sendBackupNotification = async ({ to, filename, status, error }) => {
  const success = status === 'completed';
  return sendMail({
    to,
    subject: success ? `✅ Backup Created — ${filename}` : `❌ Backup Failed`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:${success ? '#10b981' : '#ef4444'};padding:20px;border-radius:8px 8px 0 0">
          <h2 style="color:white;margin:0">${success ? 'Backup Successful' : 'Backup Failed'}</h2>
        </div>
        <div style="background:#f9fafb;padding:20px">
          ${success
            ? `<p>Database backup created successfully.</p><p><strong>File:</strong> ${filename}</p>`
            : `<p>Backup failed with error:</p><pre style="background:#fee2e2;padding:12px;border-radius:4px">${error}</pre>`
          }
          <p style="color:#9ca3af;font-size:12px">AByte ERP — Automated Backup</p>
        </div>
      </div>`,
    text: success ? `Backup created: ${filename}` : `Backup failed: ${error}`,
  });
};

exports.sendLoginAlert = async ({ to, name, ip, time }) => {
  return sendMail({
    to,
    subject: '🔐 New Login to AByte ERP',
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#3b82f6;padding:20px;border-radius:8px 8px 0 0">
          <h2 style="color:white;margin:0">Login Detected</h2>
        </div>
        <div style="background:#f9fafb;padding:20px">
          <p>User <strong>${name}</strong> logged in to AByte ERP.</p>
          <p><strong>IP:</strong> ${ip || 'Unknown'}</p>
          <p><strong>Time:</strong> ${time || new Date().toLocaleString()}</p>
          <p style="color:#9ca3af;font-size:12px">If this was not you, please change your password immediately.</p>
        </div>
      </div>`,
    text: `Login alert: ${name} logged in from ${ip} at ${time}`,
  });
};

exports.sendInvoiceEmail = async ({ to, sale, storeSettings = {} }) => {
  const currency = storeSettings.currency_symbol || 'Rs.';
  const fmt = (n) => `${currency} ${parseFloat(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const itemRows = (sale.items || []).map(item => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${item.product_name || item.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center">${item.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right">${fmt(item.unit_price ?? item.price)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:right">${fmt((item.unit_price ?? item.price) * item.quantity)}</td>
    </tr>`).join('');

  const subtotal   = parseFloat(sale.total_amount || 0) - parseFloat(sale.tax_amount || 0) - parseFloat(sale.additional_charges_amount || 0) + parseFloat(sale.discount || 0);
  const discount   = parseFloat(sale.discount || 0);
  const tax        = parseFloat(sale.tax_amount || 0);
  const charges    = parseFloat(sale.additional_charges_amount || 0);
  const total      = parseFloat(sale.total_amount || 0);
  const amountPaid = parseFloat(sale.amount_paid || 0);
  const change     = amountPaid > total ? amountPaid - total : 0;

  const totalsRows = [
    { label: 'Subtotal', value: fmt(subtotal) },
    ...(discount > 0 ? [{ label: 'Discount', value: `-${fmt(discount)}`, color: '#16a34a' }] : []),
    ...(tax > 0      ? [{ label: `${storeSettings.tax_name || 'Tax'} (${sale.tax_percent || 0}%)`, value: fmt(tax) }] : []),
    ...(charges > 0  ? [{ label: 'Additional Charges', value: fmt(charges) }] : []),
  ].map(r => `
    <tr>
      <td colspan="3" style="padding:4px 12px;text-align:right;color:${r.color || '#6b7280'}">${r.label}</td>
      <td style="padding:4px 12px;text-align:right;color:${r.color || '#374151'}">${r.value}</td>
    </tr>`).join('');

  const storeName    = storeSettings.store_name    || storeSettings.company_name || 'AByte ERP';
  const storeAddress = storeSettings.address       || '';
  const storePhone   = storeSettings.phone         || '';
  const footerText   = storeSettings.receipt_footer || 'Thank you for your business!';
  const primaryColor = storeSettings.primary_color || '#10b981';
  const invoiceNo    = sale.invoice_no || `#${sale.sale_id}`;
  const saleDate     = sale.sale_date ? new Date(sale.sale_date).toLocaleString('en-PK') : new Date().toLocaleString('en-PK');

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Invoice ${invoiceNo}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif">
  <div style="max-width:620px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">

    <!-- Header -->
    <div style="background:${primaryColor};padding:28px 32px">
      <h1 style="color:#fff;margin:0;font-size:22px">${storeName}</h1>
      ${storeAddress ? `<p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:13px">${storeAddress}</p>` : ''}
      ${storePhone   ? `<p style="color:rgba(255,255,255,0.85);margin:2px 0 0;font-size:13px">📞 ${storePhone}</p>` : ''}
    </div>

    <!-- Invoice Meta -->
    <div style="padding:24px 32px;border-bottom:1px solid #f0f0f0;display:flex;justify-content:space-between">
      <div>
        <p style="margin:0;font-size:13px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px">Invoice</p>
        <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#111827">${invoiceNo}</p>
      </div>
      <div style="text-align:right">
        <p style="margin:0;font-size:13px;color:#9ca3af">Date</p>
        <p style="margin:4px 0 0;font-size:14px;color:#374151">${saleDate}</p>
        ${sale.cashier_name ? `<p style="margin:2px 0 0;font-size:12px;color:#9ca3af">Served by: ${sale.cashier_name}</p>` : ''}
      </div>
    </div>

    ${sale.customer_name ? `
    <!-- Customer -->
    <div style="padding:16px 32px;border-bottom:1px solid #f0f0f0;background:#fafafa">
      <p style="margin:0;font-size:12px;color:#9ca3af;text-transform:uppercase">Customer</p>
      <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#374151">${sale.customer_name}</p>
    </div>` : ''}

    <!-- Items Table -->
    <div style="padding:24px 32px">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:#f9fafb;border-bottom:2px solid #e5e7eb">
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase">Item</th>
            <th style="padding:10px 12px;text-align:center;font-size:12px;color:#6b7280;text-transform:uppercase">Qty</th>
            <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;text-transform:uppercase">Rate</th>
            <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;text-transform:uppercase">Amount</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
        <!-- Totals -->
        ${totalsRows}
        <tr style="border-top:2px solid #e5e7eb">
          <td colspan="3" style="padding:12px 12px;text-align:right;font-weight:700;font-size:15px;color:#111827">Total</td>
          <td style="padding:12px 12px;text-align:right;font-weight:700;font-size:15px;color:${primaryColor}">${fmt(total)}</td>
        </tr>
        ${amountPaid > 0 ? `
        <tr>
          <td colspan="3" style="padding:4px 12px;text-align:right;color:#6b7280">Paid (${sale.payment_method || 'Cash'})</td>
          <td style="padding:4px 12px;text-align:right;color:#6b7280">${fmt(amountPaid)}</td>
        </tr>
        ${change > 0 ? `
        <tr>
          <td colspan="3" style="padding:4px 12px;text-align:right;color:#6b7280">Change</td>
          <td style="padding:4px 12px;text-align:right;color:#6b7280">${fmt(change)}</td>
        </tr>` : ''}` : ''}
      </table>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #f0f0f0">
      <p style="margin:0;color:#6b7280;font-size:13px">${footerText}</p>
      <p style="margin:8px 0 0;color:#d1d5db;font-size:11px">Powered by AByte ERP</p>
    </div>
  </div>
</body>
</html>`;

  return sendMail({
    to,
    subject: `Invoice ${invoiceNo} — ${storeName}`,
    html,
    text: `Invoice ${invoiceNo}\n${storeName}\nDate: ${saleDate}\nTotal: ${fmt(total)}\n\n${(sale.items || []).map(i => `${i.product_name || i.name} x${i.quantity}`).join('\n')}\n\n${footerText}`,
  });
};

exports.sendPasswordReset = async ({ to, name, resetLink, companyName }) => {
  return sendMail({
    to,
    subject: `Password Reset — AByte ERP`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
        <div style="background:linear-gradient(135deg,#0f172a,#064e3b);padding:28px 32px;text-align:center">
          <img src="https://erp.abytesol.com/logo.png" alt="AByte ERP" style="width:56px;height:56px;object-fit:contain;background:#fff;border-radius:12px;padding:4px;margin-bottom:12px" />
          <h1 style="color:#10b981;margin:0;font-size:22px;font-weight:800;letter-spacing:-0.5px">AByte ERP</h1>
          <p style="color:#94a3b8;margin:4px 0 0;font-size:13px">Password Reset Request</p>
        </div>
        <div style="padding:32px">
          <p style="color:#1e293b;font-size:15px;margin:0 0 8px">Hi <strong>${name || 'User'}</strong>,</p>
          <p style="color:#475569;font-size:14px;margin:0 0 24px;line-height:1.6">
            We received a request to reset your password.
            Click the button below to set a new password. This link will expire in <strong>1 hour</strong>.
          </p>
          <div style="text-align:center;margin:28px 0">
            <a href="${resetLink}" style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;padding:13px 32px;border-radius:8px;font-weight:700;font-size:14px;letter-spacing:0.3px">
              Reset My Password
            </a>
          </div>
          <p style="color:#94a3b8;font-size:12px;text-align:center;margin:20px 0 0;line-height:1.6">
            If you did not request this, you can safely ignore this email.<br/>
            Your password will not be changed.
          </p>
          <hr style="border:none;border-top:1px solid #f1f5f9;margin:24px 0" />
          <p style="color:#cbd5e1;font-size:11px;text-align:center;margin:0">
            Or copy this link: <span style="color:#64748b;word-break:break-all">${resetLink}</span>
          </p>
        </div>
        <div style="background:#f8fafc;padding:16px 32px;text-align:center">
          <p style="color:#94a3b8;font-size:11px;margin:0">AByte ERP &nbsp;|&nbsp; Powered by AbyteSol</p>
        </div>
      </div>`,
    text: `Hi ${name || 'User'},\n\nReset your password:\n${resetLink}\n\nExpires in 1 hour. If you didn't request this, ignore this email.\n\nPowered by AbyteSol`,
  });
};

exports.testConnection = async () => {
  const transporter = getTransporter();
  if (!transporter) throw new Error('Email not configured. Set EMAIL_HOST, EMAIL_USER, EMAIL_PASS in .env');
  try {
    await transporter.verify();
    return { ok: true };
  } catch (err) {
    resetTransporter();
    throw err;
  }
};

exports.isConfigured = () => {
  return !!(process.env.EMAIL_HOST && process.env.EMAIL_USER);
};
