const logger = require('../config/logger');
const { query, getConnection } = require('../config/database');
const { logAction } = require('../services/auditService');

// GET all products with their opening stock
exports.getAll = async (req, res) => {
  try {
    const rows = await query(
      'SELECT p.product_id, p.product_name, p.product_type, p.cost_price,' +
      ' COALESCE(i.available_stock, 0) as current_stock,' +
      ' COALESCE(i.avg_cost, 0) as avg_cost,' +
      ' (SELECT COALESCE(SUM(quantity),0) FROM opening_stock_entries WHERE product_id = p.product_id) as opening_qty,' +
      ' (SELECT entry_date FROM opening_stock_entries WHERE product_id = p.product_id ORDER BY entry_id DESC LIMIT 1) as last_entry_date' +
      ' FROM products p' +
      ' LEFT JOIN inventory i ON p.product_id = i.product_id' +
      ' WHERE p.is_active = 1 ORDER BY p.product_name'
    );
    res.json({ data: rows.map(r => ({ ...r, current_stock: Number(r.current_stock), avg_cost: Number(r.avg_cost), opening_qty: Number(r.opening_qty) })) });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

// POST - save opening stock entries (bulk)
exports.save = async (req, res) => {
  const conn = await getConnection();
  try {
    const { entries, entry_date } = req.body;
    if (!entries || !entries.length) return res.status(400).json({ message: 'entries required' });
    const date = entry_date || new Date().toISOString().split('T')[0];

    await conn.beginTransaction();
    for (const entry of entries) {
      if (!entry.product_id || Number(entry.quantity) <= 0) continue;
      const qty  = Number(entry.quantity);
      const cost = Number(entry.unit_cost || 0);

      // Insert opening stock entry
      await conn.query(
        'INSERT INTO opening_stock_entries (product_id, quantity, unit_cost, entry_date, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        [entry.product_id, qty, cost, date, entry.notes || null, req.user.user_id]
      );

      // Weighted avg recalculation
      const [inv] = await conn.query('SELECT available_stock, avg_cost FROM inventory WHERE product_id = ?', [entry.product_id]);
      const curQty = Number((inv || {}).available_stock || 0);
      const curAvg = Number((inv || {}).avg_cost || 0);
      const newAvg = (curQty + qty) > 0 ? (curQty * curAvg + qty * cost) / (curQty + qty) : cost;

      // Upsert inventory
      await conn.query(
        'INSERT INTO inventory (product_id, available_stock, avg_cost) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE available_stock = available_stock + ?, avg_cost = ?',
        [entry.product_id, qty, newAvg, qty, newAvg]
      );
      await conn.query('UPDATE products SET stock_quantity = stock_quantity + ?, cost_price = ? WHERE product_id = ?', [qty, newAvg, entry.product_id]);

      // Add stock layer
      await conn.query(
        'INSERT INTO stock_layers (product_id, source_type, ref_date, qty_original, qty_remaining, unit_cost) VALUES (?, ?, ?, ?, ?, ?)',
        [entry.product_id, 'opening', date, qty, qty, cost]
      );
    }
    await conn.commit();
    await logAction(req.user.user_id, req.user.name, 'OPENING_STOCK_SAVED', 'opening_stock_entries', 0, { count: entries.length }, req.ip);
    res.status(201).json({ message: 'Opening stock saved', count: entries.length });
  } catch (err) {
    await conn.rollback();
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally { conn.release(); }
};

// GET history for a product
exports.getHistory = async (req, res) => {
  try {
    const rows = await query(
      'SELECT os.*, u.name as created_by_name, p.product_name FROM opening_stock_entries os' +
      ' JOIN products p ON os.product_id = p.product_id' +
      ' JOIN users u ON os.created_by = u.user_id' +
      ' ORDER BY os.created_at DESC LIMIT 100'
    );
    res.json({ data: rows });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};
