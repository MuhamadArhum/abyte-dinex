// =============================================================
// salesController.js - Sales/Billing Controller
// Handles creating new sales (POS checkout) and viewing sale history.
// This is the core of the POS system - processes cart items into sales.
// Uses database TRANSACTIONS to ensure data consistency.
// Used by: /api/sales routes
// =============================================================

const logger = require('../config/logger');
const { getConnection, query } = require('../config/database');  // DB helpers (getConnection for transactions)
const { logAction } = require('../services/auditService');

// Ensure tables that are JOIN-ed in sales queries exist — tracked per tenant DB
const _schemaDone = new Set();
async function ensureSalesSchema(db) {
  if (_schemaDone.has(db)) return;
  _schemaDone.add(db);
  const stmts = [
    `CREATE TABLE IF NOT EXISTS restaurant_tables (
      table_id   INT PRIMARY KEY AUTO_INCREMENT,
      table_name VARCHAR(50) NOT NULL,
      floor      VARCHAR(50) DEFAULT 'Main',
      capacity   INT DEFAULT 4,
      status     ENUM('available','occupied') DEFAULT 'available',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS deliveries (
      delivery_id      INT PRIMARY KEY AUTO_INCREMENT,
      delivery_number  VARCHAR(30) NULL,
      sale_id          INT NULL,
      customer_id      INT NULL,
      delivery_address TEXT NULL,
      delivery_city    VARCHAR(100) DEFAULT '',
      delivery_phone   VARCHAR(30) DEFAULT '',
      rider_name       VARCHAR(100) DEFAULT '',
      rider_phone      VARCHAR(30) DEFAULT '',
      status           VARCHAR(30) DEFAULT 'pending',
      delivery_charges DECIMAL(10,2) DEFAULT 0,
      estimated_delivery DATETIME NULL,
      notes            TEXT NULL,
      created_by       INT NULL,
      branch_id        INT NULL,
      created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE sales ADD COLUMN IF NOT EXISTS note TEXT NULL`,
    `ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_name VARCHAR(150) NULL`,
    `ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(30) NULL`,
    `ALTER TABLE sales ADD COLUMN IF NOT EXISTS tax_percent DECIMAL(5,2) DEFAULT 0`,
    `ALTER TABLE sales ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(10,2) DEFAULT 0`,
    `ALTER TABLE sales ADD COLUMN IF NOT EXISTS additional_charges_percent DECIMAL(5,2) DEFAULT 0`,
    `ALTER TABLE sales ADD COLUMN IF NOT EXISTS additional_charges_amount DECIMAL(10,2) DEFAULT 0`,
    `ALTER TABLE sales ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10,2) DEFAULT 0`,
    `ALTER TABLE sales ADD COLUMN IF NOT EXISTS discount DECIMAL(10,2) DEFAULT 0`,
    `ALTER TABLE sale_details ADD COLUMN IF NOT EXISTS note TEXT NULL`,
    `ALTER TABLE sale_details ADD COLUMN IF NOT EXISTS variant_id INT NULL`,
    `ALTER TABLE sale_details ADD COLUMN IF NOT EXISTS variant_name VARCHAR(100) NULL`,
    `ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS delivery_charges DECIMAL(10,2) DEFAULT 0`,
    `ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS notes TEXT NULL`,
    `ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS delivery_number VARCHAR(30) NULL`,
  ];
  for (const sql of stmts) {
    try { await query(sql); } catch (e) {
      if (!e.message?.includes('Duplicate column') && !e.message?.includes('already exists')) {
        logger.warn('[salesController] schema fix warning:', e.message);
      }
    }
  }
}

// Helper: Round to 2 decimal places for currency
const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

// Helper: Validate stock for all cart items in 2 batch SELECTs (instead of N per-item FOR UPDATEs).
// Items are locked in sorted ID order to prevent deadlocks.
// Returns null on success, or an error message string if any item is short.
async function batchValidateStock(conn, items) {
  // Aggregate required quantities (same product/variant may appear multiple times)
  const reqProduct = new Map();
  const reqVariant = new Map();
  for (const item of items) {
    if (item.variant_id) {
      reqVariant.set(item.variant_id, (reqVariant.get(item.variant_id) || 0) + item.quantity);
    } else {
      reqProduct.set(item.product_id, (reqProduct.get(item.product_id) || 0) + item.quantity);
    }
  }

  if (reqVariant.size > 0) {
    const ids = [...reqVariant.keys()].sort((a, b) => a - b);
    const rows = await conn.query(
      `SELECT variant_id, available_stock FROM variant_inventory WHERE variant_id IN (${ids.map(() => '?').join(',')}) FOR UPDATE`,
      ids
    );
    const stockMap = new Map(rows.map(r => [r.variant_id, r.available_stock]));
    for (const [vid, qty] of reqVariant) {
      if ((stockMap.get(vid) ?? 0) < qty) return `Insufficient stock for variant ID ${vid}`;
    }
  }

  if (reqProduct.size > 0) {
    const ids = [...reqProduct.keys()].sort((a, b) => a - b);
    const rows = await conn.query(
      `SELECT product_id, available_stock FROM inventory WHERE product_id IN (${ids.map(() => '?').join(',')}) FOR UPDATE`,
      ids
    );
    const stockMap = new Map(rows.map(r => [r.product_id, r.available_stock]));
    for (const [pid, qty] of reqProduct) {
      if ((stockMap.get(pid) ?? 0) < qty) return `Insufficient stock for product ID ${pid}`;
    }
  }

  return null; // all good
}

// Helper: Update stock for all items in 4 batch queries (instead of 4×N per-item queries).
// sign = '+' to restore (delete/refund), sign = '-' to deduct (create/complete).
async function batchUpdateStock(conn, items, sign) {
  const byProduct = new Map();
  const byVariant = new Map();
  for (const item of items) {
    if (item.variant_id) {
      byVariant.set(item.variant_id, (byVariant.get(item.variant_id) || 0) + item.quantity);
    } else {
      byProduct.set(item.product_id, (byProduct.get(item.product_id) || 0) + item.quantity);
    }
  }

  if (byProduct.size > 0) {
    const entries = [...byProduct.entries()];
    const caseSql  = entries.map(() => 'WHEN ? THEN ?').join(' ');
    const caseParams = entries.flatMap(([id, qty]) => [id, qty]);
    const inPh = entries.map(() => '?').join(',');
    const ids   = entries.map(([id]) => id);
    await conn.query(
      `UPDATE inventory SET available_stock = available_stock ${sign} (CASE product_id ${caseSql} END) WHERE product_id IN (${inPh})`,
      [...caseParams, ...ids]
    );
    await conn.query(
      `UPDATE products SET stock_quantity = stock_quantity ${sign} (CASE product_id ${caseSql} END) WHERE product_id IN (${inPh})`,
      [...caseParams, ...ids]
    );
  }

  if (byVariant.size > 0) {
    const entries = [...byVariant.entries()];
    const caseSql  = entries.map(() => 'WHEN ? THEN ?').join(' ');
    const caseParams = entries.flatMap(([id, qty]) => [id, qty]);
    const inPh = entries.map(() => '?').join(',');
    const ids   = entries.map(([id]) => id);
    await conn.query(
      `UPDATE variant_inventory SET available_stock = available_stock ${sign} (CASE variant_id ${caseSql} END) WHERE variant_id IN (${inPh})`,
      [...caseParams, ...ids]
    );
    await conn.query(
      `UPDATE product_variants SET stock_quantity = stock_quantity ${sign} (CASE variant_id ${caseSql} END) WHERE variant_id IN (${inPh})`,
      [...caseParams, ...ids]
    );
  }
}

// Helper: Validate and parse pagination params
const parsePagination = (page, limit) => {
  const pageNum = parseInt(page) || 1;
  const limitNum = Math.min(parseInt(limit) || 20, 100); // Max 100 per page
  return {
    page: Math.max(1, pageNum),
    limit: Math.max(1, limitNum),
    offset: (Math.max(1, pageNum) - 1) * Math.max(1, limitNum)
  };
};

// --- Create Sale (Checkout) ---
exports.createSale = async (req, res) => {
  let conn;  // Database connection for the transaction
  try {
    await ensureSalesSchema('');
    const {
      items,
      discount,
      customer_id,
      payment_method,
      amount_paid,
      status = 'completed', // 'completed' or 'pending'
      tax_percent = 0,
      additional_charges_percent = 0,
      note,
      applied_bundles = [], // Array of { bundle_id, bundle_name, discount_amount }
      is_credit,
      credit_due_date,
      table_id = null,
      order_type = 'on_spot',
      customer_name = null,
      customer_phone = null,
      covers = null,
    } = req.body;
    // items = array of { product_id, quantity, unit_price, variant_id, variant_name }

    // Validate that the cart has items
    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    // Validate credit sale requires named customer
    if (is_credit && (!customer_id || customer_id === 1)) {
      return res.status(400).json({ message: 'Credit sales require a named customer' });
    }
    if (is_credit && !credit_due_date) {
      return res.status(400).json({ message: 'Credit sales require a due date' });
    }

    // Validate tax/charges are within sensible bounds (B-017)
    const taxPctVal = parseFloat(tax_percent) || 0;
    const addPctVal = parseFloat(additional_charges_percent) || 0;
    if (taxPctVal < 0 || taxPctVal > 100) {
      return res.status(400).json({ message: 'Tax percent must be between 0 and 100' });
    }
    if (addPctVal < 0 || addPctVal > 100) {
      return res.status(400).json({ message: 'Additional charges percent must be between 0 and 100' });
    }

    // Validate each item has positive quantity and non-negative price
    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        return res.status(400).json({ message: `Item quantity must be a positive integer (got ${item.quantity})` });
      }
      if (typeof item.unit_price !== 'number' || item.unit_price < 0) {
        return res.status(400).json({ message: `Item unit price cannot be negative (got ${item.unit_price})` });
      }
    }

    // Get a dedicated connection for the transaction (not from the shared query helper)
    conn = await getConnection();
    await conn.beginTransaction();  // START TRANSACTION

    // Step 1: Validate stock for all items in 2 batch queries (skip for pending/KOT orders)
    if (status !== 'pending') {
      const stockErr = await batchValidateStock(conn, items);
      if (stockErr) {
        await conn.rollback();
        return res.status(400).json({ message: stockErr });
      }
    }

    // Step 2: Calculate sale totals
    const subtotal = round2(items.reduce((sum, item) => sum + round2(item.unit_price * item.quantity), 0));
    const discountAmt = round2(discount || 0);
    const bundleDiscountAmt = round2(applied_bundles.reduce((sum, bundle) => sum + (bundle.discount_amount || 0), 0));
    const taxAmt = round2(subtotal * (parseFloat(tax_percent) / 100));
    const additionalAmt = round2(subtotal * (parseFloat(additional_charges_percent) / 100));

    // Total Amount = Subtotal + Tax + Additional - Discount - Bundle
    const total_amount = round2(Math.max(0, subtotal + taxAmt + additionalAmt - discountAmt - bundleDiscountAmt));

    // Validate discount
    const maxAllowedTotal = subtotal + taxAmt + additionalAmt;
    if (discountAmt > maxAllowedTotal) {
      await conn.rollback();
      return res.status(400).json({ message: 'Discount cannot exceed total amount' });
    }

    const maxDiscountPercent = req.user.role_name === 'Cashier' ? 50 : 100;
    const discountPercent = subtotal > 0 ? (discountAmt / subtotal) * 100 : 0;
    if (discountPercent > maxDiscountPercent) {
      await conn.rollback();
      return res.status(400).json({ message: `Discount cannot exceed ${maxDiscountPercent}% of subtotal for your role` });
    }

    // Step 3: Always generate invoice_no; also generate token_no for pending orders
    let token_no = null;
    // Acquire a named lock so concurrent sales don't generate the same invoice number
    const lockKey = `invoice_gen_${'default'}`;
    await conn.query('SELECT GET_LOCK(?, 10) as locked', [lockKey]);
    let invoice_no;
    try {
      const invResult = await conn.query(
        `SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_no, 5) AS UNSIGNED)), 0) + 1 as next_inv
         FROM sales WHERE invoice_no IS NOT NULL`
      );
      invoice_no = `INV-${String(invResult[0].next_inv).padStart(5, '0')}`;
    } finally {
      await conn.query('SELECT RELEASE_LOCK(?)', [lockKey]);
    }

    if (status === 'pending') {
      // Token prefix by order type: DIN = dine_in, TA = takeaway, DL = delivery, WI = on_spot/walk_in
      const prefixMap = { dine_in: 'DIN', takeaway: 'TA', delivery: 'DL' };
      const prefix = prefixMap[order_type] || 'WI';

      const shiftRows = await conn.query(
        `SELECT opened_at FROM cash_registers WHERE status = 'open' ORDER BY register_id DESC LIMIT 1`
      );
      const shiftStart = shiftRows.length > 0 ? shiftRows[0].opened_at : new Date().toISOString().slice(0, 10);
      const tokenResult = await conn.query(
        `SELECT COALESCE(MAX(CAST(REPLACE(token_no, ?, '') AS UNSIGNED)), 0) + 1 as next_token
         FROM sales WHERE token_no LIKE ? AND sale_date >= ?`,
        [`${prefix}-`, `${prefix}-%`, shiftStart]
      );
      token_no = `${prefix}-${String(tokenResult[0].next_token).padStart(2, '0')}`;
    }

    // Step 4: Insert the sale header record
    const finalAmountPaid = is_credit ? 0 : (status === 'completed' ? (amount_paid || total_amount) : 0);

    const saleResult = await conn.query(
      `INSERT INTO sales (
        sub_total, total_amount, discount, bundle_discount, bundle_count, net_amount, user_id, customer_id,
        payment_method, amount_paid, status,
        tax_percent, tax_amount, additional_charges_percent, additional_charges_amount, note,
        token_no, invoice_no, table_id, order_type, branch_id, customer_name, customer_phone, covers
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        subtotal,
        total_amount,
        discountAmt,
        bundleDiscountAmt,
        applied_bundles.length,
        total_amount,
        req.user.user_id,
        customer_id || 1,
        payment_method || 'cash',
        finalAmountPaid,
        status,
        tax_percent,
        taxAmt,
        additional_charges_percent,
        additionalAmt,
        note || null,
        token_no,
        invoice_no,
        table_id || null,
        order_type || 'on_spot',
        null,
        customer_name || null,
        customer_phone || null,
        covers ? parseInt(covers) : null,
      ]
    );

    const sale_id = Number(saleResult.insertId);

    // Step 5: Bulk-insert all cart items in a single query; deduct stock in 4 batch queries
    const sdPh = items.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const sdVals = items.flatMap(item => [
      sale_id, item.product_id, item.variant_id || null, item.variant_name || null,
      item.quantity, item.unit_price, round2(item.unit_price * item.quantity), item.note || null,
    ]);
    await conn.query(
      `INSERT INTO sale_details (sale_id, product_id, variant_id, variant_name, quantity, unit_price, total_price, note) VALUES ${sdPh}`,
      sdVals
    );

    if (status !== 'pending') {
      await batchUpdateStock(conn, items, '-');
    }

    // Step 5b: Bulk-insert applied bundles
    if (applied_bundles && applied_bundles.length > 0) {
      const bPh = applied_bundles.map(() => '(?, ?, ?, ?)').join(', ');
      const bVals = applied_bundles.flatMap(b => [sale_id, b.bundle_id, b.bundle_name, round2(b.discount_amount)]);
      await conn.query(
        `INSERT INTO sale_bundles (sale_id, bundle_id, bundle_name, discount_amount) VALUES ${bPh}`,
        bVals
      );
    }

    // Step 6: Create credit sale record if credit payment (B-004: use balance_due + pending status)
    if (is_credit) {
      await conn.query(
        `INSERT INTO credit_sales (sale_id, customer_id, total_amount, paid_amount, balance_due, due_date, status)
         VALUES (?, ?, ?, 0, ?, ?, 'pending')`,
        [sale_id, customer_id, total_amount, total_amount, credit_due_date]
      );
    }

    // Update cash register inside the transaction (B-025)
    if (status === 'completed' && !is_credit) {
      const pm = payment_method || 'cash';
      const openRegister = await conn.query("SELECT register_id FROM cash_registers WHERE status = 'open' LIMIT 1");
      if (openRegister.length > 0) {
        if (pm === 'cash') {
          await conn.query('UPDATE cash_registers SET cash_sales_total = cash_sales_total + ? WHERE register_id = ?', [total_amount, openRegister[0].register_id]);
        } else if (pm === 'card') {
          await conn.query('UPDATE cash_registers SET card_sales_total = card_sales_total + ? WHERE register_id = ?', [total_amount, openRegister[0].register_id]);
        }
      }
    }

    await conn.commit();  // COMMIT TRANSACTION

    // Fetch the complete sale to return
    const newSale = await query('SELECT * FROM sales WHERE sale_id = ?', [sale_id]);
    const saleDetails = await query(
      `SELECT sd.*, p.product_name
       FROM sale_details sd
       JOIN products p ON sd.product_id = p.product_id
       WHERE sd.sale_id = ?`,
      [sale_id]
    );

    await logAction(req.user.user_id, req.user.name, 'SALE_CREATED', 'sale', sale_id, {
      total_amount, status, items_count: items.length,
      is_credit: is_credit || false
    }, req.ip);

    res.status(201).json({ ...newSale[0], items: saleDetails });

  } catch (error) {
    if (conn) await conn.rollback();
    logger.error('Create sale error:', error.message || error);
    const msg = error.code === 'ER_BAD_FIELD_ERROR'
      ? `DB column missing: ${error.sqlMessage} — run ensureSalesColumns migration`
      : error.code === 'ER_NO_SUCH_TABLE'
      ? `Table missing: ${error.sqlMessage}`
      : 'Failed to create sale';
    res.status(500).json({ message: msg });
  } finally {
    if (conn) conn.release();
  }
};

// --- Get Pending Sales ---
exports.getPending = async (req, res) => {
  try {
    await ensureSalesSchema('');
    const { page, limit, order_type, user_id, waiter } = req.query;

    // Map frontend 'on_spot' filter to include both 'on_spot' and NULL order_type rows
    let orderTypeClause = '';
    const filterParams = [];
    if (order_type && order_type !== 'all') {
      if (order_type === 'on_spot') {
        orderTypeClause = `AND (s.order_type = 'on_spot' OR s.order_type IS NULL OR s.order_type = '')`;
      } else {
        orderTypeClause = `AND s.order_type = ?`;
        filterParams.push(order_type);
      }
    }

    // Per-waiter filter: waiter=1 uses the token's own user_id; user_id param for admin overrides
    let userClause = '';
    if (waiter === '1') {
      userClause = ' AND s.user_id = ?';
      filterParams.push(req.user.user_id);
    } else if (user_id) {
      userClause = ' AND s.user_id = ?';
      filterParams.push(user_id);
    }

    // Always compute summary (filtered)
    const summaryResult = await query(
      `SELECT COUNT(*) as order_count, COALESCE(SUM(total_amount), 0) as total_amount
       FROM sales s WHERE status = 'pending'
       AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.sale_id = s.sale_id)
       ${orderTypeClause}${userClause}`,
      filterParams
    );
    const summary = {
      order_count: Number(summaryResult[0].order_count),
      total_amount: parseFloat(summaryResult[0].total_amount)
    };

    let sql = `
      SELECT s.*, u.name as cashier_name,
        rt.table_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.customer_id
      LEFT JOIN users u ON s.user_id = u.user_id
      LEFT JOIN restaurant_tables rt ON s.table_id = rt.table_id
      WHERE s.status = 'pending'
      AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.sale_id = s.sale_id)
      ${orderTypeClause}${userClause}
    `;
    const params = [...filterParams];

    if (page && limit) {
      const pg = parsePagination(page, limit);
      const total = summary.order_count;

      sql += ' ORDER BY s.sale_date DESC LIMIT ? OFFSET ?';
      params.push(pg.limit, pg.offset);

      const rows = await query(sql, params);
      return res.json({
        data: rows,
        pagination: { total, page: pg.page, limit: pg.limit, totalPages: Math.ceil(total / pg.limit) },
        summary
      });
    }

    sql += ' ORDER BY s.sale_date DESC';
    const sales = await query(sql, params);
    res.json({ data: sales, summary });
  } catch (error) {
    logger.error('Get pending sales error:', error);
    res.status(500).json({ message: 'Failed to fetch pending sales' });
  }
};

// --- Get users assignable to a pending sale (branch-scoped) ---
exports.getAssignableUsers = async (req, res) => {
  try {
    const sql = 'SELECT user_id, name, role_name FROM users WHERE is_active = 1 ORDER BY name ASC';
    const users = await query(sql);
    res.json(users);
  } catch (error) {
    logger.error('Get assignable users error:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
};

// --- Reassign a pending sale to a different user ---
exports.assignUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ message: 'user_id is required' });

    const sale = await query(`SELECT * FROM sales WHERE sale_id = ? AND status = "pending"`, [id]);
    if (sale.length === 0) return res.status(404).json({ message: 'Pending sale not found' });

    const userRows = await query('SELECT user_id, name FROM users WHERE user_id = ? AND is_active = 1', [user_id]);
    if (userRows.length === 0) return res.status(404).json({ message: 'User not found' });

    await query('UPDATE sales SET user_id = ? WHERE sale_id = ?', [user_id, id]);
    res.json({ message: 'User assigned', user_id: userRows[0].user_id, name: userRows[0].name });
  } catch (error) {
    logger.error('Assign user error:', error);
    res.status(500).json({ message: 'Failed to assign user' });
  }
};

// --- Complete a Pending Sale ---
// B-005: wrapped in transaction with FOR UPDATE lock to prevent race conditions
// B-011: total_amount recalculated server-side — client-sent value is ignored
exports.completeSale = async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    const { payment_method, amount_paid, discount, note, tax_percent, additional_charges_percent } = req.body;

    conn = await getConnection();
    await conn.beginTransaction();

    // Lock the sale row to prevent concurrent completions (FOR UPDATE)
    const sale = await conn.query('SELECT * FROM sales WHERE sale_id = ? AND status = "pending" FOR UPDATE', [id]);
    if (sale.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Pending sale not found' });
    }

    const invoice_no = sale[0].invoice_no;

    // Recalculate totals server-side — never trust client-sent total_amount (B-011)
    const subTotal = parseFloat(sale[0].sub_total) || 0;
    const finalTaxPercent = tax_percent !== undefined && tax_percent !== null ? parseFloat(tax_percent) : parseFloat(sale[0].tax_percent);
    const finalAdditionalPercent = additional_charges_percent !== undefined && additional_charges_percent !== null ? parseFloat(additional_charges_percent) : parseFloat(sale[0].additional_charges_percent);
    const finalDiscount = discount !== undefined && discount !== null ? parseFloat(discount) : parseFloat(sale[0].discount || 0);
    const bundleDiscount = parseFloat(sale[0].bundle_discount || 0);
    const finalTaxAmount = round2(subTotal * finalTaxPercent / 100);
    const finalAdditionalAmount = round2(subTotal * finalAdditionalPercent / 100);
    const serverTotal = round2(Math.max(0, subTotal + finalTaxAmount + finalAdditionalAmount - finalDiscount - bundleDiscount));
    const finalPaymentMethod = payment_method || 'cash';
    const finalAmountPaid = amount_paid !== undefined && amount_paid !== null ? parseFloat(amount_paid) : serverTotal;
    const finalNote = note !== undefined && note !== null ? note : (sale[0].note || null);

    // Update sale inside transaction
    await conn.query(
      `UPDATE sales SET
        status = "completed",
        payment_method = ?,
        amount_paid = ?,
        discount = ?,
        total_amount = ?,
        net_amount = ?,
        note = ?,
        tax_percent = ?,
        tax_amount = ?,
        additional_charges_percent = ?,
        additional_charges_amount = ?
       WHERE sale_id = ?`,
      [
        finalPaymentMethod,
        finalAmountPaid,
        finalDiscount,
        serverTotal,
        serverTotal,
        finalNote,
        finalTaxPercent,
        finalTaxAmount,
        finalAdditionalPercent,
        finalAdditionalAmount,
        id
      ]
    );

    // Deduct stock in 4 batch queries
    const saleItems = await conn.query('SELECT product_id, variant_id, quantity FROM sale_details WHERE sale_id = ?', [id]);
    await batchUpdateStock(conn, saleItems, '-');

    // Update cash register inside transaction (B-025)
    const openRegister = await conn.query("SELECT register_id FROM cash_registers WHERE status = 'open' LIMIT 1");
    if (openRegister.length > 0) {
      if (finalPaymentMethod === 'cash') {
        await conn.query('UPDATE cash_registers SET cash_sales_total = cash_sales_total + ? WHERE register_id = ?', [serverTotal, openRegister[0].register_id]);
      } else if (finalPaymentMethod === 'card') {
        await conn.query('UPDATE cash_registers SET card_sales_total = card_sales_total + ? WHERE register_id = ?', [serverTotal, openRegister[0].register_id]);
      }
    }

    await conn.commit();

    await logAction(req.user.user_id, req.user.name, 'SALE_COMPLETED', 'sale', id, { payment_method: finalPaymentMethod, invoice_no }, req.ip);

    res.json({ message: 'Sale completed successfully', sale_id: id, invoice_no });
  } catch (error) {
    if (conn) await conn.rollback();
    logger.error('Complete sale error:', error);
    res.status(500).json({ message: 'Failed to complete sale' });
  } finally {
    if (conn) conn.release();
  }
};

// --- Mark KOT as Printed ---
exports.markKotPrinted = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(`UPDATE sales SET kot_printed = 1 WHERE sale_id = ?`, [id]);
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Sale not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ message: 'Failed to update KOT status' });
  }
};

// --- Update Items of a Pending Sale (Edit mode) ---
exports.updateSaleItems = async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    const { items, total_amount, tax_percent, additional_charges_percent, customer_id } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'At least one item is required' });
    }

    conn = await getConnection();
    await conn.beginTransaction();

    // Validate items before touching DB
    for (const item of items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        await conn.rollback();
        return res.status(400).json({ message: `Item quantity must be a positive integer (got ${item.quantity})` });
      }
      if (typeof item.unit_price !== 'number' || item.unit_price < 0) {
        await conn.rollback();
        return res.status(400).json({ message: `Item unit price cannot be negative (got ${item.unit_price})` });
      }
    }

    const sale = await conn.query(`SELECT * FROM sales WHERE sale_id = ? AND status = "pending"`, [id]);
    if (sale.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Pending sale not found' });
    }

    // 1. Delete old sale_details (no stock restore — pending orders don't touch stock)
    await conn.query('DELETE FROM sale_details WHERE sale_id = ?', [id]);

    // 2. Bulk-insert new items (no stock deduction — deducted when cashier completes the order)
    const sdPh2  = items.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
    const sdVals2 = items.flatMap(item => {
      const unitPrice  = round2(parseFloat(item.unit_price));
      return [id, item.product_id, item.variant_id || null, item.variant_name || null, item.quantity, unitPrice, round2(unitPrice * item.quantity)];
    });
    await conn.query(
      `INSERT INTO sale_details (sale_id, product_id, variant_id, variant_name, quantity, unit_price, total_price) VALUES ${sdPh2}`,
      sdVals2
    );

    // 4. Update sale header
    const newSubTotal  = round2(items.reduce((sum, item) => sum + round2(parseFloat(item.unit_price) * item.quantity), 0));
    const newTaxPct    = tax_percent                !== undefined ? parseFloat(tax_percent)                : parseFloat(sale[0].tax_percent                || 0);
    const newAddPct    = additional_charges_percent !== undefined ? parseFloat(additional_charges_percent) : parseFloat(sale[0].additional_charges_percent || 0);
    const newTaxAmt    = round2(newSubTotal * newTaxPct / 100);
    const newAddAmt    = round2(newSubTotal * newAddPct / 100);
    const newTotal     = round2(parseFloat(total_amount) || (newSubTotal + newTaxAmt + newAddAmt));
    const updates = ['total_amount = ?', 'sub_total = ?', 'net_amount = ?', 'tax_amount = ?', 'additional_charges_amount = ?', 'tax_percent = ?', 'additional_charges_percent = ?'];
    const values  = [newTotal, newSubTotal, newTotal, newTaxAmt, newAddAmt, newTaxPct, newAddPct];
    if (customer_id !== undefined) { updates.push('customer_id = ?'); values.push(customer_id); }
    values.push(id);

    await conn.query(`UPDATE sales SET ${updates.join(', ')} WHERE sale_id = ?`, values);

    await conn.commit();

    await logAction(req.user.user_id, req.user.name, 'SALE_UPDATED', 'sale', id, { item_count: items.length, total_amount }, req.ip);

    const updated = await query('SELECT * FROM sales WHERE sale_id = ?', [id]);
    res.json({ message: 'Sale updated successfully', sale: updated[0] });
  } catch (error) {
    if (conn) await conn.rollback();
    logger.error('Update sale items error:', error);
    res.status(500).json({ message: 'Failed to update sale' });
  } finally {
    if (conn) conn.release();
  }
};

// --- Delete/Void Sale ---
exports.deleteSale = async (req, res) => {
  let conn;
  try {
    if (req.user.role_name !== 'Admin') {
      return res.status(403).json({ message: 'Only Admin can delete orders' });
    }

    const { id } = req.params;

    conn = await getConnection();
    await conn.beginTransaction();

    // Admins can delete any sale; non-admins are blocked above — no branch filter needed here
    const sale = await conn.query('SELECT status FROM sales WHERE sale_id = ?', [id]);
    if (sale.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Sale not found' });
    }

    // Restore stock in 4 batch queries
    const items = await conn.query('SELECT product_id, variant_id, quantity FROM sale_details WHERE sale_id = ?', [id]);
    await batchUpdateStock(conn, items, '+');

    // Delete records
    await conn.query('DELETE FROM sale_details WHERE sale_id = ?', [id]);
    await conn.query('DELETE FROM sales WHERE sale_id = ?', [id]);

    await conn.commit();

    await logAction(req.user.user_id, req.user.name, 'SALE_DELETED', 'sale', id, { previous_status: sale[0].status }, req.ip);

    res.json({ message: 'Sale deleted and stock restored' });
  } catch (error) {
    if (conn) await conn.rollback();
    logger.error('Delete sale error:', error);
    res.status(500).json({ message: 'Failed to delete sale' });
  } finally {
    if (conn) conn.release();
  }
};

// --- Sync Invoice to Tax Department ---
exports.syncTax = async (req, res) => {
  try {
    const { id } = req.params;
    try { await query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS is_synced TINYINT(1) DEFAULT 0`); } catch (_) {}
    try { await query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS synced_at DATETIME NULL`); } catch (_) {}

    const sale = await query('SELECT sale_id, status FROM sales WHERE sale_id = ?', [id]);
    if (sale.length === 0) return res.status(404).json({ message: 'Sale not found' });

    await query('UPDATE sales SET is_synced = 1, synced_at = NOW() WHERE sale_id = ?', [id]);
    await logAction(req.user.user_id, req.user.name, 'TAX_SYNCED', 'sale', parseInt(id), {}, req.ip);

    res.json({ message: 'Invoice synced to tax system', synced_at: new Date().toISOString() });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Get Today's Sales ---
exports.getToday = async (req, res) => {
  try {
    await ensureSalesSchema('');
    const today = new Date().toISOString().split('T')[0];
    const sales = await query(`
      SELECT s.*, u.name as cashier_name
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.user_id
      WHERE s.sale_date >= ? AND s.sale_date < DATE_ADD(?, INTERVAL 1 DAY)
        AND (s.status = 'completed' OR s.status = 'refunded')
      ORDER BY s.sale_date DESC
    `, [today, today]);
    res.json(sales);
  } catch (error) {
    logger.error('Get today sales error:', error);
    res.status(500).json({ message: 'Failed to fetch today sales' });
  }
};

// --- Get All Sales ---
exports.getAll = async (req, res) => {
  try {
    await ensureSalesSchema('');
    const {
      page, limit, search, status, date_from, date_to,
      order_type, shift_start, shift_end,
      cashier, user_id, table_id, is_synced,
    } = req.query;

    // Helper: append the same order_type / cashier / table / synced clauses to any SQL fragment
    const applyOrderTypeClause = (s, p) => {
      if (order_type && order_type !== 'all') {
        if (order_type === 'delivery') {
          s += ' AND EXISTS (SELECT 1 FROM deliveries dx WHERE dx.sale_id = s.sale_id)';
        } else if (order_type === 'walkin' || order_type === 'on_spot') {
          s += ` AND (s.order_type = 'on_spot' OR s.order_type IS NULL OR s.order_type = '')`;
        } else {
          // dine_in, takeaway
          s += ' AND s.order_type = ?';
          p.push(order_type);
        }
      }
      return [s, p];
    };

    const waiter = req.query.waiter;

    const applyCashierClause = (s, p) => {
      if (cashier && cashier.trim()) {
        s += ' AND u.name LIKE ?';
        p.push(`%${cashier.trim()}%`);
      }
      if (waiter === '1') {
        s += ' AND s.user_id = ?';
        p.push(req.user.user_id);
      } else if (user_id) {
        s += ' AND s.user_id = ?';
        p.push(user_id);
      }
      return [s, p];
    };

    const applyTableClause = (s, p) => {
      if (table_id) {
        s += ' AND s.table_id = ?';
        p.push(table_id);
      }
      return [s, p];
    };

    const applySyncedClause = (s, p) => {
      if (is_synced === '1' || is_synced === 'true') {
        s += ' AND s.is_synced = 1';
      } else if (is_synced === '0' || is_synced === 'false') {
        s += ' AND (s.is_synced = 0 OR s.is_synced IS NULL)';
      }
      return [s, p];
    };

    let sql = `
      SELECT s.*, u.name as cashier_name,
             COALESCE(d.delivery_charges, 0) AS delivery_charges
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.customer_id
      LEFT JOIN users u ON s.user_id = u.user_id
      LEFT JOIN deliveries d ON d.sale_id = s.sale_id
      WHERE 1=1
    `;
    let params = [];

    [sql, params] = applyOrderTypeClause(sql, params);
    [sql, params] = applyCashierClause(sql, params);
    [sql, params] = applyTableClause(sql, params);
    [sql, params] = applySyncedClause(sql, params);

    if (status) {
      if (status.includes(',')) {
        const statuses = status.split(',');
        sql += ` AND s.status IN (${statuses.map(() => '?').join(',')})`;
        params.push(...statuses);
      } else {
        sql += ' AND s.status = ?';
        params.push(status);
      }
    }

    // shift_start/shift_end = exact datetime filter (for shift-wise view)
    // takes priority over date_from/date_to when provided
    if (shift_start) { sql += ' AND s.sale_date >= ?'; params.push(shift_start); }
    else if (date_from) { sql += ' AND s.sale_date >= ?'; params.push(date_from); }
    if (shift_end)   { sql += ' AND s.sale_date <= ?'; params.push(shift_end); }
    else if (date_to) { sql += ' AND s.sale_date < DATE_ADD(?, INTERVAL 1 DAY)'; params.push(date_to); }

    if (search) {
      sql += ' AND (s.sale_id LIKE ? OR c.customer_name LIKE ? OR s.invoice_no LIKE ? OR s.token_no LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (page && limit) {
      const pg = parsePagination(page, limit);

      // Count + summary query for pagination
      let countSql = `
        SELECT COUNT(*) as total, COALESCE(SUM(s.total_amount), 0) as total_amount
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.customer_id
        LEFT JOIN users u ON s.user_id = u.user_id
        WHERE 1=1
      `;
      let countParams = [];

      [countSql, countParams] = applyOrderTypeClause(countSql, countParams);
      [countSql, countParams] = applyCashierClause(countSql, countParams);
      [countSql, countParams] = applyTableClause(countSql, countParams);
      [countSql, countParams] = applySyncedClause(countSql, countParams);

      if (status) {
        if (status.includes(',')) {
          const statuses = status.split(',');
          countSql += ` AND s.status IN (${statuses.map(() => '?').join(',')})`;
          countParams.push(...statuses);
        } else {
          countSql += ' AND s.status = ?';
          countParams.push(status);
        }
      }

      if (shift_start) { countSql += ' AND s.sale_date >= ?'; countParams.push(shift_start); }
      else if (date_from) { countSql += ' AND s.sale_date >= ?'; countParams.push(date_from); }
      if (shift_end)   { countSql += ' AND s.sale_date <= ?'; countParams.push(shift_end); }
      else if (date_to) { countSql += ' AND s.sale_date < DATE_ADD(?, INTERVAL 1 DAY)'; countParams.push(date_to); }

      if (search) {
        countSql += ' AND (s.sale_id LIKE ? OR c.customer_name LIKE ? OR s.invoice_no LIKE ? OR s.token_no LIKE ?)';
        countParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
      }

      const countResult = await query(countSql, countParams);
      const total = Number(countResult[0].total);
      const summary = {
        order_count: total,
        total_amount: parseFloat(countResult[0].total_amount)
      };

      sql += ' ORDER BY s.sale_date DESC LIMIT ? OFFSET ?';
      params.push(pg.limit, pg.offset);

      const rows = await query(sql, params);
      return res.json({
        data: rows,
        pagination: { total, page: pg.page, limit: pg.limit, totalPages: Math.ceil(total / pg.limit) },
        summary
      });
    }

    sql += ' ORDER BY s.sale_date DESC';
    const sales = await query(sql, params);
    res.json(sales);
  } catch (error) {
    logger.error('Get all sales error:', error);
    res.status(500).json({ message: 'Failed to fetch sales' });
  }
};

// --- Get Sale by ID ---
exports.getById = async (req, res) => {
  try {
    const sale = await query(`
      SELECT s.*, u.name as cashier_name,
             rt.table_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.customer_id
      LEFT JOIN users u ON s.user_id = u.user_id
      LEFT JOIN restaurant_tables rt ON s.table_id = rt.table_id
      WHERE s.sale_id = ?
    `, [req.params.id]);

    if (sale.length === 0) {
      return res.status(404).json({ message: 'Sale not found' });
    }

    const items = await query(`
      SELECT sd.*, p.product_name, p.barcode, p.category_id
      FROM sale_details sd
      JOIN products p ON sd.product_id = p.product_id
      WHERE sd.sale_id = ?
    `, [req.params.id]);

    res.json({ ...sale[0], items });
  } catch (error) {
    logger.error('Get sale error:', error);
    res.status(500).json({ message: 'Failed to fetch sale details' });
  }
};

// --- Refund Sale ---
exports.refundSale = async (req, res) => {
  let conn;
  try {
    const { id } = req.params;
    
    conn = await getConnection();
    await conn.beginTransaction();

    const sale = await conn.query(`SELECT status FROM sales WHERE sale_id = ? FOR UPDATE`, [id]);
    if (sale.length === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Sale not found' });
    }
    
    if (sale[0].status === 'refunded') {
      await conn.rollback();
      return res.status(400).json({ message: 'Sale is already refunded' });
    }

    // Restore stock in 4 batch queries
    const items = await conn.query('SELECT product_id, variant_id, quantity FROM sale_details WHERE sale_id = ?', [id]);
    await batchUpdateStock(conn, items, '+');

    // Update status
    await conn.query('UPDATE sales SET status = "refunded" WHERE sale_id = ?', [id]);

    await conn.commit();

    await logAction(req.user.user_id, req.user.name, 'SALE_REFUNDED', 'sale', id, {}, req.ip);

    res.json({ message: 'Sale refunded and stock restored' });
  } catch (error) {
    if (conn) await conn.rollback();
    logger.error('Refund sale error:', error);
    res.status(500).json({ message: 'Failed to refund sale' });
  } finally {
    if (conn) conn.release();
  }
};

exports.swapTable = async (req, res) => {
  try {
    const { id } = req.params;
    const { table_id } = req.body;

    const sale = await query(`SELECT sale_id FROM sales WHERE sale_id = ? AND status = "pending"`, [id]);
    if (!sale.length) return res.status(404).json({ message: 'Pending sale not found' });

    await query('UPDATE sales SET table_id = ? WHERE sale_id = ?', [table_id || null, id]);

    await logAction(req.user.user_id, req.user.name, 'SALE_TABLE_SWAPPED', 'sale', id, { table_id }, req.ip);

    res.json({ message: 'Table updated successfully' });
  } catch (error) {
    logger.error('Swap table error:', error);
    res.status(500).json({ message: 'Failed to update table' });
  }
};
