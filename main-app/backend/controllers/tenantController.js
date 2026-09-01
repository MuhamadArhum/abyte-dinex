// =============================================================
// tenantController.js - Company Config API (Single-Tenant)
//
// Phase 4: Super-admin tenant CRUD removed. All config now served
// from store_settings in the single local DB.
// =============================================================

const logger = require('../config/logger');
const { query } = require('../config/database');

const DEFAULTS = {
  company_name:         'AByte ERP',
  logo_url:             null,
  primary_color:        '#10b981',
  currency_symbol:      'Rs.',
  currency_code:        'PKR',
  timezone:             'Asia/Karachi',
  tax_name:             'GST',
  tax_rate:             0,
  ntn:                  null,
  strn:                 null,
  is_tax_exempt:        false,
  receipt_header:       null,
  receipt_footer:       'Thank you for shopping!',
  show_tax_on_receipt:  true,
  show_logo_on_receipt: true,
  show_ntn_on_receipt:  true,
};

// GET /api/tenants/config
exports.getConfig = async (req, res) => {
  try {
    const rows = await query('SELECT * FROM store_settings WHERE setting_id = 1 LIMIT 1');
    const cfg  = rows.length > 0 ? rows[0] : {};

    res.json({
      company_name:         cfg.company_name         ?? DEFAULTS.company_name,
      logo_url:             cfg.logo_url             ?? DEFAULTS.logo_url,
      primary_color:        cfg.primary_color        ?? DEFAULTS.primary_color,
      currency_symbol:      cfg.currency_symbol      ?? DEFAULTS.currency_symbol,
      currency_code:        cfg.currency_code        ?? DEFAULTS.currency_code,
      timezone:             cfg.timezone             ?? DEFAULTS.timezone,
      tax_name:             cfg.tax_name             ?? DEFAULTS.tax_name,
      tax_rate:             Number(cfg.tax_rate      ?? DEFAULTS.tax_rate),
      ntn:                  cfg.ntn                  ?? DEFAULTS.ntn,
      strn:                 cfg.strn                 ?? DEFAULTS.strn,
      is_tax_exempt:        Boolean(cfg.is_tax_exempt ?? DEFAULTS.is_tax_exempt),
      receipt_header:       cfg.receipt_header       ?? DEFAULTS.receipt_header,
      receipt_footer:       cfg.receipt_footer       ?? DEFAULTS.receipt_footer,
      show_tax_on_receipt:  Boolean(cfg.show_tax_on_receipt  ?? DEFAULTS.show_tax_on_receipt),
      show_logo_on_receipt: Boolean(cfg.show_logo_on_receipt ?? DEFAULTS.show_logo_on_receipt),
      show_ntn_on_receipt:  Boolean(cfg.show_ntn_on_receipt  ?? DEFAULTS.show_ntn_on_receipt),
      // Single-tenant: no plan/modules gating
      plan:            'enterprise',
      modules_allowed: [],
      modules_enabled: [],
    });
  } catch (err) {
    logger.error('getConfig error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/tenants/config
exports.updateConfig = async (req, res) => {
  try {
    const {
      company_name, logo_url, primary_color, currency_symbol, currency_code, timezone,
      tax_name, tax_rate, ntn, strn, is_tax_exempt,
      receipt_header, receipt_footer,
      show_tax_on_receipt, show_logo_on_receipt, show_ntn_on_receipt,
    } = req.body;

    const fields = [];
    const vals   = [];
    const set = (col, val) => { if (val !== undefined) { fields.push(`${col} = ?`); vals.push(val); } };

    set('company_name',   company_name);
    set('logo_url',       logo_url);
    set('primary_color',  primary_color);
    set('currency_symbol', currency_symbol);
    set('currency_code',  currency_code);
    set('timezone',       timezone);
    set('tax_name',       tax_name);
    set('tax_rate',       tax_rate !== undefined ? Number(tax_rate) : undefined);
    set('ntn',            ntn);
    set('strn',           strn);
    set('is_tax_exempt',  is_tax_exempt !== undefined ? (is_tax_exempt ? 1 : 0) : undefined);
    set('receipt_header', receipt_header);
    set('receipt_footer', receipt_footer);
    set('show_tax_on_receipt',  show_tax_on_receipt  !== undefined ? (show_tax_on_receipt  ? 1 : 0) : undefined);
    set('show_logo_on_receipt', show_logo_on_receipt !== undefined ? (show_logo_on_receipt ? 1 : 0) : undefined);
    set('show_ntn_on_receipt',  show_ntn_on_receipt  !== undefined ? (show_ntn_on_receipt  ? 1 : 0) : undefined);

    if (fields.length === 0) return res.status(400).json({ message: 'Nothing to update' });

    await query(`UPDATE store_settings SET ${fields.join(', ')} WHERE setting_id = 1`, vals);

    res.json({ message: 'Config updated successfully' });
  } catch (err) {
    logger.error('updateConfig error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/tenants/config/public
// Public branding endpoint — returns company name, logo, primary color.
exports.getPublicConfig = async (req, res) => {
  try {
    const rows = await query('SELECT company_name, logo_url, primary_color FROM store_settings WHERE setting_id = 1 LIMIT 1');
    const cfg  = rows.length > 0 ? rows[0] : {};

    res.json({
      company_name:  cfg.company_name  || DEFAULTS.company_name,
      logo_url:      cfg.logo_url      || DEFAULTS.logo_url,
      primary_color: cfg.primary_color || DEFAULTS.primary_color,
    });
  } catch (err) {
    logger.error('getPublicConfig error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
