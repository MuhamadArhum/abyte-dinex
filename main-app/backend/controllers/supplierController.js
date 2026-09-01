const logger = require('../config/logger');
const { query, getConnection } = require('../config/database');
const { logAction } = require('../services/auditService');

// Helper functions
const parsePagination = (page, limit) => {
  const pageNum = parseInt(page) || 1;
  const limitNum = Math.min(parseInt(limit) || 20, 100);
  return {
    page: Math.max(1, pageNum),
    limit: Math.max(1, limitNum),
    offset: (Math.max(1, pageNum) - 1) * Math.max(1, limitNum)
  };
};

// Get all suppliers with pagination and search
exports.getAll = async (req, res) => {
  try {
    const { search = '', is_active, date_from, date_to } = req.query;
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);

    let sql = 'SELECT * FROM suppliers WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as total FROM suppliers WHERE 1=1';
    const params = [];
    const countParams = [];

    if (search) {
      sql += ' AND (supplier_name LIKE ? OR contact_person LIKE ? OR phone LIKE ? OR email LIKE ?)';
      countSql += ' AND (supplier_name LIKE ? OR contact_person LIKE ? OR phone LIKE ? OR email LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      countParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (is_active !== undefined) {
      sql += ' AND is_active = ?';
      countSql += ' AND is_active = ?';
      params.push(is_active);
      countParams.push(is_active);
    }

    if (date_from) {
      sql += ' AND DATE(created_at) >= ?';
      countSql += ' AND DATE(created_at) >= ?';
      params.push(date_from);
      countParams.push(date_from);
    }

    if (date_to) {
      sql += ' AND DATE(created_at) <= ?';
      countSql += ' AND DATE(created_at) <= ?';
      params.push(date_to);
      countParams.push(date_to);
    }

    sql += ' ORDER BY supplier_name ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [suppliers, [{ total }]] = await Promise.all([
      query(sql, params),
      query(countSql, countParams)
    ]);

    res.json({
      data: suppliers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    logger.error('Get suppliers error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get supplier by ID with payment history
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    const [suppliers] = await query('SELECT * FROM suppliers WHERE supplier_id = ?', [id]);
    if (!suppliers) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    // Get payment history
    const payments = await query(`
      SELECT sp.*, u.name as created_by_name
      FROM supplier_payments sp
      LEFT JOIN users u ON sp.created_by = u.user_id
      WHERE sp.supplier_id = ?
      ORDER BY sp.payment_date DESC
      LIMIT 50
    `, [id]);

    // Get total payments
    const [stats] = await query(`
      SELECT
        COUNT(*) as payment_count,
        COALESCE(SUM(amount), 0) as total_paid
      FROM supplier_payments
      WHERE supplier_id = ?
    `, [id]);

    res.json({
      supplier: suppliers,
      payments,
      stats: stats || { payment_count: 0, total_paid: 0 }
    });
  } catch (err) {
    logger.error('Get supplier by ID error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create new supplier
exports.create = async (req, res) => {
  try {
    const {
      supplier_name,
      contact_person,
      phone,
      email,
      address,
      tax_id,
      payment_terms
    } = req.body;

    if (!supplier_name || supplier_name.trim().length === 0) {
      return res.status(400).json({ message: 'Supplier name is required' });
    }

    // Check for duplicate supplier name
    const [existing] = await query('SELECT supplier_id FROM suppliers WHERE supplier_name = ?', [supplier_name]);
    if (existing) {
      return res.status(400).json({ message: 'Supplier with this name already exists' });
    }

    const result = await query(`
      INSERT INTO suppliers (
        supplier_name, contact_person, phone, email, address, tax_id, payment_terms
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [supplier_name, contact_person || null, phone || null, email || null, address || null, tax_id || null, payment_terms || null]);

    // Audit log
    await logAction(
      req.user.user_id,
      req.user.name,
      'SUPPLIER_CREATED',
      'supplier',
      result.insertId,
      { supplier_name },
      req.ip
    );

    res.status(201).json({
      message: 'Supplier created successfully',
      supplier_id: result.insertId
    });
  } catch (err) {
    logger.error('Create supplier error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Duplicate supplier name or email' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// Update supplier
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      supplier_name,
      contact_person,
      phone,
      email,
      address,
      tax_id,
      payment_terms,
      is_active
    } = req.body;

    if (!supplier_name || supplier_name.trim().length === 0) {
      return res.status(400).json({ message: 'Supplier name is required' });
    }

    // Check if supplier exists
    const [existing] = await query('SELECT * FROM suppliers WHERE supplier_id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    // Check for duplicate name (excluding current supplier)
    const [duplicate] = await query(
      'SELECT supplier_id FROM suppliers WHERE supplier_name = ? AND supplier_id != ?',
      [supplier_name, id]
    );
    if (duplicate) {
      return res.status(400).json({ message: 'Supplier with this name already exists' });
    }

    await query(`
      UPDATE suppliers SET
        supplier_name = ?,
        contact_person = ?,
        phone = ?,
        email = ?,
        address = ?,
        tax_id = ?,
        payment_terms = ?,
        is_active = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE supplier_id = ?
    `, [supplier_name, contact_person || null, phone || null, email || null, address || null, tax_id || null, payment_terms || null, is_active !== undefined ? is_active : 1, id]);

    // Audit log with old/new values
    await logAction(
      req.user.user_id,
      req.user.name,
      'SUPPLIER_UPDATED',
      'supplier',
      id,
      { supplier_name, is_active },
      req.ip,
      { supplier_name: existing.supplier_name, phone: existing.phone, email: existing.email, is_active: existing.is_active },
      { supplier_name, phone: phone || null, email: email || null, is_active: is_active !== undefined ? is_active : 1 }
    );

    res.json({ message: 'Supplier updated successfully' });
  } catch (err) {
    logger.error('Update supplier error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: 'Duplicate supplier name or email' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete (deactivate) supplier
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await query('SELECT supplier_name FROM suppliers WHERE supplier_id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    // Soft delete - set is_active to 0
    await query('UPDATE suppliers SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE supplier_id = ?', [id]);

    // Audit log
    await logAction(
      req.user.user_id,
      req.user.name,
      'SUPPLIER_DELETED',
      'supplier',
      id,
      { supplier_name: existing.supplier_name },
      req.ip
    );

    res.json({ message: 'Supplier deactivated successfully' });
  } catch (err) {
    logger.error('Delete supplier error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add payment for supplier
exports.addPayment = async (req, res) => {
  try {
    const { supplier_id } = req.params;
    const {
      amount,
      payment_date,
      payment_method,
      reference_number,
      notes,
      purchase_order_id
    } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Valid amount is required' });
    }

    if (!payment_date) {
      return res.status(400).json({ message: 'Payment date is required' });
    }

    // Check if supplier exists
    const [supplier] = await query('SELECT supplier_id, supplier_name FROM suppliers WHERE supplier_id = ?', [supplier_id]);
    if (!supplier) {
      return res.status(404).json({ message: 'Supplier not found' });
    }

    const result = await query(`
      INSERT INTO supplier_payments (
        supplier_id, purchase_order_id, amount, payment_date, payment_method, reference_number, notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [supplier_id, purchase_order_id || null, amount, payment_date, payment_method || 'cash', reference_number || null, notes || null, req.user.user_id]);

    // Audit log
    await logAction(
      req.user.user_id,
      req.user.name,
      'SUPPLIER_PAYMENT_ADDED',
      'supplier_payment',
      result.insertId,
      { supplier_name: supplier.supplier_name, amount, payment_date },
      req.ip
    );

    res.status(201).json({
      message: 'Payment recorded successfully',
      payment_id: result.insertId
    });
  } catch (err) {
    logger.error('Add payment error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get payments for a supplier
exports.getPayments = async (req, res) => {
  try {
    const { supplier_id } = req.params;
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);

    const [payments, [{ total }]] = await Promise.all([
      query(`
        SELECT sp.*, u.name as created_by_name
        FROM supplier_payments sp
        LEFT JOIN users u ON sp.created_by = u.user_id
        WHERE sp.supplier_id = ?
        ORDER BY sp.payment_date DESC, sp.created_at DESC
        LIMIT ? OFFSET ?
      `, [supplier_id, limit, offset]),
      query('SELECT COUNT(*) as total FROM supplier_payments WHERE supplier_id = ?', [supplier_id])
    ]);

    res.json({
      data: payments,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    logger.error('Get payments error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
