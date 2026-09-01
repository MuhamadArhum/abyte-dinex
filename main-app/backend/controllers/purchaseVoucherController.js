const logger = require('../config/logger');
const { query, getConnection } = require('../config/database');
const { logAction } = require('../services/auditService');

const pad = (n) => String(n).padStart(6, '0');

// Column migrations handled by migrationService.js at server startup

async function nextPVNumber() {
  const [last] = await query('SELECT pv_number FROM inv_purchase_vouchers ORDER BY pv_id DESC LIMIT 1');
  if (last?.pv_number) {
    const m = last.pv_number.match(/\d+$/);
    if (m) return `PV${pad(parseInt(m[0]) + 1)}`;
  }
  return `PV${pad(1)}`;
}

// ── Helper: reverse stock for a PV's items ────────────────────
async function reverseStockForPV(conn, pvId) {
  const items = await conn.query('SELECT * FROM inv_purchase_voucher_items WHERE pv_id = ?', [pvId]);
  for (const item of items) {
    await conn.query('UPDATE inventory SET available_stock = available_stock - ? WHERE product_id = ?', [item.quantity_received, item.product_id]);
    await conn.query('UPDATE products SET stock_quantity = stock_quantity - ? WHERE product_id = ?', [item.quantity_received, item.product_id]);
    await conn.query('DELETE FROM stock_layers WHERE pv_id = ? AND product_id = ?', [pvId, item.product_id]);
    // Recalculate weighted avg from remaining layers (B-020: skip update when no layers remain)
    const layers = await conn.query('SELECT qty_remaining, unit_cost FROM stock_layers WHERE product_id = ? AND qty_remaining > 0', [item.product_id]);
    const totalQty  = layers.reduce((s, l) => s + Number(l.qty_remaining), 0);
    const totalCost = layers.reduce((s, l) => s + Number(l.qty_remaining) * Number(l.unit_cost), 0);
    if (totalQty > 0) {
      const newAvg = totalCost / totalQty;
      await conn.query('UPDATE inventory SET avg_cost = ? WHERE product_id = ?', [newAvg, item.product_id]);
      await conn.query('UPDATE products SET cost_price = ? WHERE product_id = ?', [newAvg, item.product_id]);
    }
    // When totalQty = 0 (all stock reversed), preserve existing avg_cost — do not set to 0
  }
}

// ── Helper: apply stock for new items ────────────────────────
async function applyStockForItems(conn, pvId, items, voucher_date) {
  for (const item of items) {
    const newQty  = Number(item.quantity_received);
    const newCost = Number(item.unit_price);
    const totalPrice = newQty * newCost;

    await conn.query(
      'INSERT INTO inv_purchase_voucher_items (pv_id, product_id, quantity_received, unit_price, total_price) VALUES (?, ?, ?, ?, ?)',
      [pvId, item.product_id, newQty, newCost, totalPrice]
    );

    const [inv] = await conn.query('SELECT available_stock, avg_cost FROM inventory WHERE product_id = ?', [item.product_id]);
    const curQty = Number((inv || {}).available_stock || 0);
    const curAvg = Number((inv || {}).avg_cost || 0);
    const newAvg = (curQty + newQty) > 0
      ? (curQty * curAvg + newQty * newCost) / (curQty + newQty)
      : newCost;

    await conn.query('UPDATE inventory SET available_stock = available_stock + ?, avg_cost = ? WHERE product_id = ?', [newQty, newAvg, item.product_id]);
    await conn.query('UPDATE products SET stock_quantity = stock_quantity + ?, cost_price = ? WHERE product_id = ?', [newQty, newAvg, item.product_id]);
    await conn.query(
      'INSERT INTO stock_layers (product_id, pv_id, source_type, ref_date, qty_original, qty_remaining, unit_cost) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [item.product_id, pvId, 'purchase', voucher_date, newQty, newQty, newCost]
    );
  }
}

// GET all purchase vouchers
exports.getAll = async (req, res) => {
  try {
    const { from_date, to_date, po_id } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    let where = 'WHERE 1=1';
    const params = [];

    if (po_id)     { where += ' AND pv.po_id = ?';         params.push(po_id); }
    if (from_date) { where += ' AND pv.voucher_date >= ?'; params.push(from_date); }
    if (to_date)   { where += ' AND pv.voucher_date <= ?'; params.push(to_date); }

    const sql = `SELECT pv.*, u.name as created_by_name, po.po_number,
                   s.supplier_name,
                   COUNT(pvi.item_id) as item_count
                 FROM inv_purchase_vouchers pv
                 LEFT JOIN purchase_orders po ON pv.po_id = po.po_id
                 JOIN users u ON pv.created_by = u.user_id
                 LEFT JOIN suppliers s ON pv.supplier_id = s.supplier_id
                 LEFT JOIN inv_purchase_voucher_items pvi ON pv.pv_id = pvi.pv_id
                 ${where} GROUP BY pv.pv_id ORDER BY pv.voucher_date DESC, pv.created_at DESC
                 LIMIT ? OFFSET ?`;
    const countSql = `SELECT COUNT(*) as total FROM inv_purchase_vouchers pv ${where}`;

    const [rows, [{total}]] = await Promise.all([
      query(sql, [...params, limit, offset]),
      query(countSql, params)
    ]);
    res.json({ data: rows, pagination: { total: Number(total), page, limit, totalPages: Math.ceil(Number(total) / limit) } });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

// GET purchase voucher by ID
exports.getById = async (req, res) => {
  try {
    const [pv] = await query(
      `SELECT pv.*, u.name as created_by_name, po.po_number,
              COALESCE(s.supplier_name, pos.supplier_name) as supplier_name
       FROM inv_purchase_vouchers pv
       LEFT JOIN purchase_orders po ON pv.po_id = po.po_id
       LEFT JOIN suppliers s ON pv.supplier_id = s.supplier_id
       LEFT JOIN suppliers pos ON po.supplier_id = pos.supplier_id
       JOIN users u ON pv.created_by = u.user_id
       WHERE pv.pv_id = ?`, [req.params.id]
    );
    if (!pv) return res.status(404).json({ message: 'Purchase voucher not found' });
    const items = await query(
      `SELECT pvi.*, p.product_name, p.barcode
       FROM inv_purchase_voucher_items pvi
       JOIN products p ON pvi.product_id = p.product_id
       WHERE pvi.pv_id = ?`, [req.params.id]
    );
    res.json({ ...pv, items });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

// GET PO items for receiving (pre-fill purchase voucher from PO)
exports.getPOItems = async (req, res) => {
  try {
    const { po_id } = req.params;
    const items = await query(
      `SELECT poi.*, p.product_name, p.barcode, p.cost_price,
              poi.quantity_ordered - COALESCE(poi.quantity_received, 0) as pending_qty
       FROM purchase_order_items poi
       JOIN products p ON poi.product_id = p.product_id
       WHERE poi.po_id = ?`, [po_id]
    );
    res.json({ data: items });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

// CREATE purchase voucher
exports.create = async (req, res) => {
  const conn = await getConnection();
  try {
    const { po_id, voucher_date, notes, items, shipping_cost, extra_charges, other_charges, discount_percent, tax_percent, supplier_id } = req.body;
    if (!voucher_date || !items?.length) {
      return res.status(400).json({ message: 'voucher_date and items are required' });
    }

    await conn.beginTransaction();
    const pv_number = await nextPVNumber();

    const shipping        = Number(shipping_cost)    || 0;
    const extra           = Number(extra_charges)    || 0;
    const other           = Number(other_charges)    || 0;
    const disc_pct        = Number(discount_percent) || 0;
    const tax_pct         = Number(tax_percent)      || 0;
    const itemsTotal      = items.reduce((s, i) => s + Number(i.quantity_received) * Number(i.unit_price), 0);
    const subtotal        = itemsTotal + shipping + extra + other;
    const discount_amount = subtotal * disc_pct / 100;
    const taxable         = subtotal - discount_amount;
    const tax_amount      = taxable * tax_pct / 100;
    const total           = taxable + tax_amount;

    const result = await conn.query(
      'INSERT INTO inv_purchase_vouchers (pv_number, po_id, voucher_date, total_amount, shipping_cost, extra_charges, other_charges, discount_percent, discount_amount, tax_percent, tax_amount, notes, created_by, supplier_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [pv_number, po_id || null, voucher_date, total, shipping, extra, other, disc_pct, discount_amount, tax_pct, tax_amount, notes || null, req.user.user_id, supplier_id || null]
    );
    const pvId = Number(result.insertId);

    await applyStockForItems(conn, pvId, items, voucher_date);

    // If from PO, update quantity_received on PO items + mark PO received
    if (po_id) {
      for (const item of items) {
        await conn.query(
          'UPDATE purchase_order_items SET quantity_received = COALESCE(quantity_received, 0) + ? WHERE po_id = ? AND product_id = ?',
          [item.quantity_received, po_id, item.product_id]
        );
      }
      await conn.query("UPDATE purchase_orders SET status = 'received', received_date = ? WHERE po_id = ?", [voucher_date, po_id]);
    }

    await conn.commit();

    let po_number = null;
    if (po_id) {
      const [po] = await query('SELECT po_number FROM purchase_orders WHERE po_id = ?', [po_id]);
      po_number = po?.po_number;
    }
    await logAction(req.user.user_id, req.user.name, 'PURCHASE_VOUCHER_CREATED', 'inv_purchase_vouchers', pvId,
      { pv_number, total, po_id: po_id || null, po_number }, req.ip);

    res.status(201).json({ message: 'Purchase voucher created', pv_id: pvId, pv_number });
  } catch (err) {
    await conn.rollback();
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally { conn.release(); }
};

// UPDATE purchase voucher (reverses old stock, applies new)
exports.update = async (req, res) => {
  const conn = await getConnection();
  try {
    const { id } = req.params;
    const { voucher_date, notes, items, shipping_cost, extra_charges, other_charges, discount_percent, tax_percent, supplier_id } = req.body;
    if (!voucher_date || !items?.length) {
      return res.status(400).json({ message: 'voucher_date and items are required' });
    }

    const [pv] = await query('SELECT * FROM inv_purchase_vouchers WHERE pv_id = ?', [id]);
    if (!pv) return res.status(404).json({ message: 'Purchase voucher not found' });

    await conn.beginTransaction();

    await reverseStockForPV(conn, id);
    await conn.query('DELETE FROM inv_purchase_voucher_items WHERE pv_id = ?', [id]);

    const shipping        = Number(shipping_cost)    || 0;
    const extra           = Number(extra_charges)    || 0;
    const other           = Number(other_charges)    || 0;
    const disc_pct        = Number(discount_percent) || 0;
    const tax_pct         = Number(tax_percent)      || 0;
    const itemsTotal      = items.reduce((s, i) => s + Number(i.quantity_received) * Number(i.unit_price), 0);
    const subtotal        = itemsTotal + shipping + extra + other;
    const discount_amount = subtotal * disc_pct / 100;
    const taxable         = subtotal - discount_amount;
    const tax_amount      = taxable * tax_pct / 100;
    const total           = taxable + tax_amount;

    await conn.query(
      'UPDATE inv_purchase_vouchers SET voucher_date=?, total_amount=?, shipping_cost=?, extra_charges=?, other_charges=?, discount_percent=?, discount_amount=?, tax_percent=?, tax_amount=?, notes=?, supplier_id=? WHERE pv_id=?',
      [voucher_date, total, shipping, extra, other, disc_pct, discount_amount, tax_pct, tax_amount, notes || null, supplier_id || null, id]
    );

    await applyStockForItems(conn, parseInt(id), items, voucher_date);

    await conn.commit();
    await logAction(req.user.user_id, req.user.name, 'PURCHASE_VOUCHER_UPDATED', 'inv_purchase_vouchers', parseInt(id),
      { pv_number: pv.pv_number, total }, req.ip);

    res.json({ message: 'Purchase voucher updated', pv_number: pv.pv_number });
  } catch (err) {
    await conn.rollback();
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally { conn.release(); }
};

// DELETE purchase voucher (reverse stock)
exports.remove = async (req, res) => {
  const conn = await getConnection();
  try {
    const [pv] = await query('SELECT * FROM inv_purchase_vouchers WHERE pv_id = ?', [req.params.id]);
    if (!pv) return res.status(404).json({ message: 'Not found' });

    await conn.beginTransaction();
    await reverseStockForPV(conn, req.params.id);
    await conn.query('DELETE FROM inv_purchase_vouchers WHERE pv_id = ?', [req.params.id]);
    await conn.commit();

    await logAction(req.user.user_id, req.user.name, 'PURCHASE_VOUCHER_DELETED', 'inv_purchase_vouchers',
      parseInt(req.params.id), { pv_number: pv.pv_number }, req.ip);

    res.json({ message: 'Purchase voucher deleted and stock reversed' });
  } catch (err) {
    await conn.rollback();
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally { conn.release(); }
};
