// =============================================================
// emailController.js - Email Service Controller
// Manages SMTP connection status, connection testing, and sending
// alerts/notifications.
// Used by: /api/email routes
// =============================================================

const logger = require('../config/logger');
const emailService = require('../services/emailService');

exports.getStatus = async (req, res) => {
  res.json({
    configured: emailService.isConfigured(),
    host: process.env.EMAIL_HOST || null,
    user: process.env.EMAIL_USER ? process.env.EMAIL_USER.replace(/(.{2})(.+)(@.+)/, '$1***$3') : null,
  });
};

exports.testConnection = async (req, res) => {
  try {
    await emailService.testConnection();
    res.json({ ok: true, message: 'Email connection successful' });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
};

exports.sendTest = async (req, res) => {
  try {
    const { to } = req.body;
    if (!to) return res.status(400).json({ message: 'to email is required' });

    const { sendMail } = require('../services/emailService');
    await require('../services/emailService').sendLoginAlert({
      to,
      name: req.user.name,
      ip: req.ip,
      time: new Date().toLocaleString(),
    });

    res.json({ message: `Test email sent to ${to}` });
  } catch (err) {
    logger.error('Test email error:', err);
    res.status(500).json({ message: err.message });
  }
};

exports.sendInvoice = async (req, res) => {
  try {
    const { sale_id, email } = req.body;
    if (!sale_id) return res.status(400).json({ message: 'sale_id is required' });

    const { query } = require('../config/database');

    // Fetch sale with customer email
    const [sale] = await query(`
      SELECT s.*, u.name AS cashier_name, c.email AS customer_email,
             rt.table_name
      FROM sales s
      LEFT JOIN customers c  ON s.customer_id  = c.customer_id
      LEFT JOIN users u      ON s.user_id       = u.user_id
      LEFT JOIN restaurant_tables rt ON s.table_id = rt.table_id
      WHERE s.sale_id = ?
    `, [sale_id]);

    if (!sale) return res.status(404).json({ message: 'Sale not found' });

    const recipientEmail = (email || sale.customer_email || '').trim();
    if (!recipientEmail) {
      return res.status(400).json({ message: 'No email address provided and customer has no email on file' });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return res.status(400).json({ message: 'Invalid email address' });
    }

    const items = await query(`
      SELECT sd.*, p.product_name
      FROM sale_details sd
      JOIN products p ON sd.product_id = p.product_id
      WHERE sd.sale_id = ?
    `, [sale_id]);

    // Fetch store settings for branding
    const [settings] = await query('SELECT * FROM settings LIMIT 1').catch(() => [{}]);

    const result = await emailService.sendInvoiceEmail({
      to: recipientEmail,
      sale: { ...sale, items },
      storeSettings: settings || {},
    });

    if (result.skipped) {
      return res.status(503).json({ message: 'Email service is not configured. Please set up email in Settings.' });
    }

    const { logAction } = require('../services/auditService');
    await logAction(req.user.user_id, req.user.name, 'EMAIL_INVOICE', 'sales', sale_id, { to: recipientEmail }, req.ip).catch(() => {});

    res.json({ ok: true, message: `Invoice sent to ${recipientEmail}` });
  } catch (err) {
    logger.error('Send invoice email error:', { error: err.message });
    res.status(500).json({ message: err.message });
  }
};

exports.sendLowStockAlert = async (req, res) => {
  try {
    const { to } = req.body;
    const { query } = require('../config/database');

    const products = await query(`
      SELECT p.product_name, i.available_stock, p.reorder_level
      FROM inventory i
      JOIN products p ON i.product_id = p.product_id
      WHERE p.is_active = 1
        AND COALESCE(i.available_stock, 0) <= COALESCE(p.reorder_level, 10)
      ORDER BY i.available_stock ASC
      LIMIT 20
    `);

    if (products.length === 0) {
      return res.json({ message: 'No low stock products found' });
    }

    const adminEmail = to || req.user.email;
    await emailService.sendLowStockAlert({ to: adminEmail, products });
    res.json({ message: `Low stock alert sent to ${adminEmail} for ${products.length} products` });
  } catch (err) {
    logger.error('Low stock alert error:', err);
    res.status(500).json({ message: err.message });
  }
};
