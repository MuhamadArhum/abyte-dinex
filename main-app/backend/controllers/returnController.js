const logger = require('../config/logger');
const { getConnection, query } = require('../config/database');
const { logAction } = require('../services/auditService');

exports.createReturn = async (req, res) => {
  let conn;
  try {
    const { sale_id, items, reason } = req.body;

    if (!sale_id || !items || items.length === 0) {
      return res.status(400).json({ message: 'Sale ID and items are required' });
    }
    if (!reason) {
      return res.status(400).json({ message: 'Return reason is required' });
    }

    conn = await getConnection();
    await conn.beginTransaction();

    // Validate original sale
    const sale = await conn.query('SELECT * FROM sales WHERE sale_id = ? FOR UPDATE', [sale_id]);
    if (sale.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Sale not found' });
    }
    if (sale[0].status !== 'completed') {
      await conn.rollback();
      return res.status(400).json({ message: 'Can only return completed sales' });
    }

    // Get original sale items
    const saleDetails = await conn.query('SELECT * FROM sale_details WHERE sale_id = ?', [sale_id]);

    // Get existing returns for this sale
    const existingReturns = await conn.query(
      `SELECT rd.product_id, SUM(rd.quantity) as total_returned
       FROM returns r
       JOIN return_details rd ON r.return_id = rd.return_id
       WHERE r.sale_id = ?
       GROUP BY rd.product_id`,
      [sale_id]
    );

    const returnedMap = {};
    for (const er of existingReturns) {
      returnedMap[er.product_id] = Number(er.total_returned);
    }

    // Validate each return item
    let totalRefund = 0;
    for (const item of items) {
      const original = saleDetails.find(sd => sd.product_id === item.product_id);
      if (!original) {
        await conn.rollback();
        return res.status(400).json({ message: `Product ${item.product_id} not found in this sale` });
      }

      const alreadyReturned = returnedMap[item.product_id] || 0;
      const maxReturnable = original.quantity - alreadyReturned;
      const returnQty = item.quantity || item.quantity_returned || 0;

      if (returnQty > maxReturnable) {
        await conn.rollback();
        return res.status(400).json({
          message: `Cannot return ${returnQty} of product ${item.product_id}. Max returnable: ${maxReturnable}`
        });
      }

      item.returnQty = returnQty;
      item.unit_price = parseFloat(original.unit_price);
      item.refund_price = item.unit_price * returnQty;
      totalRefund += item.refund_price;
    }

    const returnResult = await conn.query(
      'INSERT INTO returns (sale_id, user_id, reason, refund_amount) VALUES (?, ?, ?, ?)',
      [sale_id, req.user.user_id, reason, totalRefund]
    );

    const returnId = Number(returnResult.insertId);

    // Insert return details and restore stock
    for (const item of items) {
      await conn.query(
        'INSERT INTO return_details (return_id, product_id, quantity, refund_price) VALUES (?, ?, ?, ?)',
        [returnId, item.product_id, item.returnQty, item.refund_price]
      );

      await conn.query(
        'UPDATE inventory SET available_stock = available_stock + ? WHERE product_id = ?',
        [item.returnQty, item.product_id]
      );
      await conn.query(
        'UPDATE products SET stock_quantity = stock_quantity + ? WHERE product_id = ?',
        [item.returnQty, item.product_id]
      );
    }

    // Update cash register for refund
    const openRegister = await conn.query("SELECT register_id FROM cash_registers WHERE status = 'open' LIMIT 1");
    if (openRegister.length > 0) {
      await conn.query(
        'UPDATE cash_registers SET total_cash_out = total_cash_out + ? WHERE register_id = ?',
        [totalRefund, openRegister[0].register_id]
      );
    }

    await conn.commit();

    await logAction(req.user.user_id, req.user.name, 'RETURN_CREATED', 'return', returnId,
      { sale_id, reason, totalRefund, items_count: items.length }, req.ip);

    const newReturn = await query(
      `SELECT r.*, u.name as processed_by
       FROM returns r
       JOIN users u ON r.user_id = u.user_id
       WHERE r.return_id = ?`,
      [returnId]
    );

    const returnDetails = await query(
      'SELECT rd.*, p.product_name FROM return_details rd JOIN products p ON rd.product_id = p.product_id WHERE rd.return_id = ?',
      [returnId]
    );

    res.status(201).json({ ...newReturn[0], items: returnDetails });
  } catch (error) {
    if (conn) await conn.rollback();
    logger.error('Create return error:', error);
    res.status(500).json({ message: 'Failed to process return' });
  } finally {
    if (conn) conn.release();
  }
};

exports.getReturns = async (req, res) => {
  try {
    const { page = 1, limit = 50, date_start, date_end } = req.query;

    let sql = `SELECT r.*, u.name as processed_by, s.total_amount as original_sale_amount
               FROM returns r
               JOIN users u ON r.user_id = u.user_id
               JOIN sales s ON r.sale_id = s.sale_id
               WHERE 1=1`;
    const params = [];

    if (date_start) {
      sql += ' AND r.return_date >= ?';
      params.push(date_start);
    }
    if (date_end) {
      sql += ' AND r.return_date <= ?';
      params.push(date_end + ' 23:59:59');
    }

    sql += ' ORDER BY r.return_date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const countSql = `SELECT COUNT(*) as total FROM returns r WHERE 1=1` +
      (date_start ? ' AND r.return_date >= ?' : '') +
      (date_end ? ' AND r.return_date <= ?' : '');

    const countParams = [];
    if (date_start) countParams.push(date_start);
    if (date_end) countParams.push(date_end + ' 23:59:59');

    const countResult = await query(countSql, countParams);
    const total = Number(countResult[0].total);

    const returns = await query(sql, params);

    res.json({
      data: returns,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('Get returns error:', error);
    res.status(500).json({ message: 'Failed to fetch returns' });
  }
};

exports.getSaleForReturn = async (req, res) => {
  try {
    const { saleId } = req.params;

    const sale = await query(
      `SELECT s.*, c.customer_name, u.name as cashier_name
       FROM sales s
       LEFT JOIN customers c ON s.customer_id = c.customer_id
       LEFT JOIN users u ON s.user_id = u.user_id
       WHERE s.sale_id = ?`,
      [saleId]
    );

    if (sale.length === 0) {
      return res.status(404).json({ message: 'Sale not found' });
    }

    const items = await query(
      `SELECT sd.*, p.product_name, p.barcode
       FROM sale_details sd
       JOIN products p ON sd.product_id = p.product_id
       WHERE sd.sale_id = ?`,
      [saleId]
    );

    // Get already returned quantities
    const returned = await query(
      `SELECT rd.product_id, SUM(rd.quantity) as total_returned
       FROM returns r
       JOIN return_details rd ON r.return_id = rd.return_id
       WHERE r.sale_id = ?
       GROUP BY rd.product_id`,
      [saleId]
    );

    const returnedMap = {};
    for (const r of returned) {
      returnedMap[r.product_id] = Number(r.total_returned);
    }

    const itemsWithReturnable = items.map(item => ({
      ...item,
      already_returned: returnedMap[item.product_id] || 0,
      max_returnable: item.quantity - (returnedMap[item.product_id] || 0)
    }));

    res.json({ ...sale[0], items: itemsWithReturnable });
  } catch (error) {
    logger.error('Get sale for return error:', error);
    res.status(500).json({ message: 'Failed to fetch sale details' });
  }
};

exports.getReturnById = async (req, res) => {
  try {
    const returnRecord = await query(
      `SELECT r.*, u.name as processed_by
       FROM returns r
       JOIN users u ON r.user_id = u.user_id
       WHERE r.return_id = ?`,
      [req.params.id]
    );

    if (returnRecord.length === 0) {
      return res.status(404).json({ message: 'Return not found' });
    }

    const details = await query(
      `SELECT rd.*, p.product_name
       FROM return_details rd
       JOIN products p ON rd.product_id = p.product_id
       WHERE rd.return_id = ?`,
      [req.params.id]
    );

    res.json({ ...returnRecord[0], items: details });
  } catch (error) {
    logger.error('Get return error:', error);
    res.status(500).json({ message: 'Failed to fetch return details' });
  }
};
