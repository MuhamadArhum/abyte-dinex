// =============================================================
// creditSaleController.js - Credit Sales (Udhar) Controller
// Manages sales on credit, overdue tracking, and payment recording.
// Used by: /api/credit-sales routes
// =============================================================

const logger = require('../config/logger');
const { query, getConnection } = require('../config/database');
const { logAction } = require('../services/auditService');

const parsePagination = (page, limit) => {
  const pageNum = parseInt(page) || 1;
  const limitNum = Math.min(parseInt(limit) || 20, 100);
  return { page: Math.max(1, pageNum), limit: Math.max(1, limitNum), offset: (Math.max(1, pageNum) - 1) * Math.max(1, limitNum) };
};

// ============== CREDIT SALES ==============

exports.getAll = async (req, res) => {
  try {
    const { status, customer_id, overdue, search, date_from, date_to } = req.query;
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);

    let sql = `SELECT cs.*, c.customer_name as customer_name, c.phone_number as customer_phone,
               u.name as created_by_name, s.sale_date, s.total_amount as sale_total
               FROM credit_sales cs
               JOIN sales s ON cs.sale_id = s.sale_id
               JOIN customers c ON cs.customer_id = c.customer_id
               LEFT JOIN users u ON cs.created_by = u.user_id
               WHERE 1=1`;
    let countSql = `SELECT COUNT(*) as total FROM credit_sales cs
                    JOIN sales s ON cs.sale_id = s.sale_id
                    JOIN customers c ON cs.customer_id = c.customer_id
                    WHERE 1=1`;
    const params = [], countParams = [];

    if (status) {
      sql += ' AND cs.status = ?';
      countSql += ' AND cs.status = ?';
      params.push(status);
      countParams.push(status);
    }

    if (customer_id) {
      sql += ' AND cs.customer_id = ?';
      countSql += ' AND cs.customer_id = ?';
      params.push(customer_id);
      countParams.push(customer_id);
    }

    if (overdue) {
      sql += ' AND cs.due_date < CURDATE() AND cs.status != ?';
      countSql += ' AND cs.due_date < CURDATE() AND cs.status != ?';
      params.push('paid');
      countParams.push('paid');
    }

    if (search) {
      const pattern = `%${search}%`;
      sql += ' AND (CAST(cs.sale_id AS CHAR) LIKE ? OR c.customer_name LIKE ?)';
      countSql += ' AND (CAST(cs.sale_id AS CHAR) LIKE ? OR c.customer_name LIKE ?)';
      params.push(pattern, pattern);
      countParams.push(pattern, pattern);
    }

    if (date_from) {
      sql += ' AND DATE(cs.created_at) >= ?';
      countSql += ' AND DATE(cs.created_at) >= ?';
      params.push(date_from);
      countParams.push(date_from);
    }

    if (date_to) {
      sql += ' AND DATE(cs.created_at) <= ?';
      countSql += ' AND DATE(cs.created_at) <= ?';
      params.push(date_to);
      countParams.push(date_to);
    }

    sql += ' ORDER BY cs.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [creditSales, [{ total }]] = await Promise.all([
      query(sql, params),
      query(countSql, countParams)
    ]);

    res.json({ data: creditSales, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    const creditSales = await query(
      `SELECT cs.*, c.customer_name as customer_name, c.phone_number as customer_phone,
              u.name as created_by_name, s.sale_date, s.total_amount as sale_total
       FROM credit_sales cs
       JOIN sales s ON cs.sale_id = s.sale_id
       JOIN customers c ON cs.customer_id = c.customer_id
       LEFT JOIN users u ON cs.created_by = u.user_id
       WHERE cs.credit_sale_id = ?`,
      [id]
    );

    if (creditSales.length === 0) {
      return res.status(404).json({ message: 'Credit sale not found' });
    }

    const payments = await query(
      `SELECT cp.*, u.name as received_by_name
       FROM credit_payments cp
       LEFT JOIN users u ON cp.received_by = u.user_id
       WHERE cp.credit_sale_id = ?
       ORDER BY cp.payment_date DESC`,
      [id]
    );

    res.json({ data: { ...creditSales[0], payments } });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.create = async (req, res) => {
  try {
    const { sale_id, customer_id, total_amount, paid_amount, due_date } = req.body;

    if (!sale_id || !customer_id || !total_amount || !due_date) {
      return res.status(400).json({ message: 'sale_id, customer_id, total_amount, and due_date are required' });
    }

    if (customer_id === 1) {
      return res.status(400).json({ message: 'Walk-in customers cannot have credit sales' });
    }

    // Validate sale exists
    const sales = await query('SELECT sale_id, total_amount FROM sales WHERE sale_id = ?', [sale_id]);
    if (sales.length === 0) {
      return res.status(404).json({ message: 'Sale not found' });
    }

    // Validate customer exists
    const customers = await query('SELECT customer_id, customer_name FROM customers WHERE customer_id = ?', [customer_id]);
    if (customers.length === 0) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const paidAmt = parseFloat(paid_amount) || 0;
    const totalAmt = parseFloat(total_amount);
    const balanceDue = totalAmt - paidAmt;
    const status = paidAmt > 0 ? 'partial' : 'pending';

    const conn = await getConnection();
    try {
      await conn.beginTransaction();

      const result = await conn.query(
        `INSERT INTO credit_sales (sale_id, customer_id, total_amount, paid_amount, balance_due, due_date, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [sale_id, customer_id, totalAmt, paidAmt, balanceDue, due_date, status, req.user.user_id]
      );

      const creditSaleId = Number(result.insertId);

      if (paidAmt > 0) {
        await conn.query(
          `INSERT INTO credit_payments (credit_sale_id, amount, payment_method, notes, received_by)
           VALUES (?, ?, ?, ?, ?)`,
          [creditSaleId, paidAmt, 'cash', 'Initial payment', req.user.user_id]
        );
      }

      await conn.commit();

      await logAction(
        req.user.user_id, req.user.name, 'CREATE', 'credit_sale', creditSaleId,
        { sale_id, customer: customers[0].customer_name, total_amount: totalAmt, paid_amount: paidAmt, due_date },
        req.ip
      );

      res.status(201).json({ message: 'Credit sale created', credit_sale_id: creditSaleId });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.recordPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, payment_method, notes } = req.body;

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than 0' });
    }

    const conn = await getConnection();
    try {
      await conn.beginTransaction();

      const creditSales = await conn.query(
        'SELECT * FROM credit_sales WHERE credit_sale_id = ? FOR UPDATE',
        [id]
      );

      if (creditSales.length === 0) {
        await conn.rollback();
        return res.status(404).json({ message: 'Credit sale not found' });
      }

      const creditSale = creditSales[0];
      const paymentAmount = parseFloat(amount);

      if (paymentAmount > parseFloat(creditSale.balance_due)) {
        await conn.rollback();
        return res.status(400).json({ message: 'Payment amount exceeds balance due' });
      }

      await conn.query(
        `INSERT INTO credit_payments (credit_sale_id, amount, payment_method, notes, received_by)
         VALUES (?, ?, ?, ?, ?)`,
        [id, paymentAmount, payment_method || 'cash', notes || null, req.user.user_id]
      );

      const newPaidAmount = parseFloat(creditSale.paid_amount) + paymentAmount;
      const newBalanceDue = parseFloat(creditSale.balance_due) - paymentAmount;
      const newStatus = newBalanceDue <= 0 ? 'paid' : 'partial';

      await conn.query(
        `UPDATE credit_sales SET paid_amount = ?, balance_due = ?, status = ? WHERE credit_sale_id = ?`,
        [newPaidAmount, newBalanceDue, newStatus, id]
      );

      await conn.commit();

      await logAction(
        req.user.user_id, req.user.name, 'PAYMENT', 'credit_sale', parseInt(id),
        { amount: paymentAmount, payment_method: payment_method || 'cash', new_balance: newBalanceDue, new_status: newStatus },
        req.ip
      );

      res.json({ message: 'Payment recorded', paid_amount: newPaidAmount, balance_due: newBalanceDue, status: newStatus });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getCustomerBalance = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT
         COALESCE(SUM(CASE WHEN status != 'paid' THEN balance_due ELSE 0 END), 0) as total_outstanding,
         COUNT(*) as credit_sales_count,
         COALESCE(SUM(total_amount), 0) as total_credit_given
       FROM credit_sales
       WHERE customer_id = ?`,
      [id]
    );

    res.json({ data: result[0] });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getOverdue = async (req, res) => {
  try {
    const overdue = await query(
      `SELECT cs.*, c.customer_name as customer_name, c.phone_number as customer_phone
       FROM credit_sales cs
       JOIN customers c ON cs.customer_id = c.customer_id
       WHERE cs.due_date < CURDATE() AND cs.status IN ('pending', 'partial')
       ORDER BY cs.due_date ASC`
    );

    res.json({ data: overdue });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getStats = async (req, res) => {
  try {
    const [stats] = await query(
      `SELECT
         COALESCE(SUM(CASE WHEN status != 'paid' THEN balance_due ELSE 0 END), 0) as total_outstanding,
         COALESCE(SUM(CASE WHEN due_date < CURDATE() AND status IN ('pending', 'partial') THEN 1 ELSE 0 END), 0) as overdue_count,
         COALESCE(SUM(CASE WHEN status IN ('pending', 'partial') THEN 1 ELSE 0 END), 0) as active_count
       FROM credit_sales`
    );

    const [collected] = await query(
      `SELECT COALESCE(SUM(cp.amount), 0) as collected_this_month
       FROM credit_payments cp
       WHERE MONTH(cp.payment_date) = MONTH(CURDATE()) AND YEAR(cp.payment_date) = YEAR(CURDATE())`
    );

    res.json({
      total_outstanding: stats.total_outstanding,
      overdue_count: stats.overdue_count,
      active_count: stats.active_count,
      collected_this_month: collected.collected_this_month
    });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
