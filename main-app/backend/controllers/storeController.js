const logger = require('../config/logger');
const { query, getConnection } = require('../config/database');
const { logAction } = require('../services/auditService');

let storeColumnsEnsured = false;
async function ensureStoreColumns() {
  if (storeColumnsEnsured) return;
  storeColumnsEnsured = true;
  try {
    // Create stores table if it doesn't exist (older tenants may not have it)
    await query(`
      CREATE TABLE IF NOT EXISTS stores (
        store_id   INT PRIMARY KEY AUTO_INCREMENT,
        store_name VARCHAR(200) NOT NULL,
        store_code VARCHAR(20)  NOT NULL UNIQUE,
        address    TEXT,
        phone      VARCHAR(20),
        email      VARCHAR(100),
        manager_id INT,
        monthly_charge DECIMAL(10,2) DEFAULT 0.00,
        is_active  TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_store_active (is_active),
        INDEX idx_store_code   (store_code)
      )
    `);
    // Seed a default store if table was just created and is empty
    await query(`
      INSERT IGNORE INTO stores (store_id, store_name, store_code, is_active)
      VALUES (1, 'Main Store', 'MAIN', 1)
    `);
    // Add columns that may be missing on older schemas
    await query(`ALTER TABLE stores ADD COLUMN IF NOT EXISTS monthly_charge DECIMAL(10,2) DEFAULT 0.00`);
    await query(`ALTER TABLE users  ADD COLUMN IF NOT EXISTS branch_id INT NULL`);
    await query(`ALTER TABLE sales  ADD COLUMN IF NOT EXISTS branch_id INT NULL`);
    await query(`ALTER TABLE staff  ADD COLUMN IF NOT EXISTS branch_id INT NULL`);
  } catch (e) { /* safe to ignore */ }
}

exports.getAll = async (req, res) => {
  try {
    await ensureStoreColumns();
    const stores = await query('SELECT s.store_id, s.store_name, s.store_code, s.address, s.phone, s.email, s.manager_id, s.monthly_charge, COALESCE(s.is_active, 1) as is_active, s.created_at, s.updated_at, u.name as manager_name FROM stores s LEFT JOIN users u ON s.manager_id = u.user_id ORDER BY s.store_name');
    res.json({ data: stores });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.create = async (req, res) => {
  try {
    await ensureStoreColumns();
    const { store_name, store_code, address, phone, email, manager_id, monthly_charge } = req.body;
    if (!store_name || !store_code) return res.status(400).json({ message: 'Name and code required' });

    const result = await query(
      'INSERT INTO stores (store_name, store_code, address, phone, email, manager_id, monthly_charge) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [store_name, store_code, address || null, phone || null, email || null, manager_id || null, monthly_charge || 0]
    );

    await logAction(req.user.user_id, req.user.name, 'STORE_CREATED', 'store', result.insertId, { store_name, monthly_charge }, req.ip);
    res.status(201).json({ message: 'Store created', store_id: result.insertId });
  } catch (err) {
    logger.error(err);
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Store code already exists' });
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getById = async (req, res) => {
  try {
    await ensureStoreColumns();
    const [store] = await query(
      'SELECT s.*, u.name as manager_name FROM stores s LEFT JOIN users u ON s.manager_id = u.user_id WHERE s.store_id = ?',
      [req.params.id]
    );
    if (!store) return res.status(404).json({ message: 'Store not found' });
    res.json(store);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.update = async (req, res) => {
  try {
    await ensureStoreColumns();
    const { id } = req.params;
    const { store_name, store_code, address, phone, email, manager_id, is_active, monthly_charge } = req.body;
    if (!store_name || !store_code) return res.status(400).json({ message: 'Name and code are required' });

    const [existing] = await query('SELECT store_id FROM stores WHERE store_id = ?', [id]);
    if (!existing) return res.status(404).json({ message: 'Store not found' });

    await query(
      'UPDATE stores SET store_name=?, store_code=?, address=?, phone=?, email=?, manager_id=?, is_active=?, monthly_charge=? WHERE store_id=?',
      [store_name, store_code, address || null, phone || null, email || null, manager_id || null, is_active !== undefined ? is_active : 1, monthly_charge || 0, id]
    );

    await logAction(req.user.user_id, req.user.name, 'STORE_UPDATED', 'store', id, { store_name }, req.ip);
    res.json({ message: 'Store updated successfully' });
  } catch (err) {
    logger.error(err);
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Store code already exists' });
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deleteStore = async (req, res) => {
  try {
    await ensureStoreColumns();
    const { id } = req.params;
    const [store] = await query('SELECT store_name FROM stores WHERE store_id = ?', [id]);
    if (!store) return res.status(404).json({ message: 'Store not found' });

    // Check if store has inventory
    const [inv] = await query('SELECT COUNT(*) as cnt FROM store_inventory WHERE store_id = ?', [id]);
    if (inv.cnt > 0) {
      return res.status(400).json({ message: 'Cannot delete store with inventory. Transfer stock first.' });
    }

    await query('DELETE FROM stores WHERE store_id = ?', [id]);
    await logAction(req.user.user_id, req.user.name, 'STORE_DELETED', 'store', id, { store_name: store.store_name }, req.ip);
    res.json({ message: 'Store deleted successfully' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Consolidated Branch Summary (Admin only) ---
exports.getConsolidatedSummary = async (req, res) => {
  try {
    if (req.user.role_name !== 'Admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const today = new Date().toISOString().split('T')[0];

    const summary = await query(`
      SELECT
        s.store_id,
        s.store_name,
        s.store_code,
        s.monthly_charge,
        s.is_active,
        u.name AS manager_name,
        COALESCE(today_sales.sale_count, 0)    AS today_sale_count,
        COALESCE(today_sales.today_revenue, 0)  AS today_revenue,
        COALESCE(month_sales.month_revenue, 0)  AS month_revenue,
        COALESCE(staff_count.total_staff, 0)    AS total_staff,
        COALESCE(user_count.total_users, 0)     AS total_users
      FROM stores s
      LEFT JOIN users u ON s.manager_id = u.user_id
      LEFT JOIN (
        SELECT branch_id,
               COUNT(*) AS sale_count,
               COALESCE(SUM(net_amount), 0) AS today_revenue
        FROM sales
        WHERE DATE(sale_date) = ? AND status = 'completed'
        GROUP BY branch_id
      ) today_sales ON today_sales.branch_id = s.store_id
      LEFT JOIN (
        SELECT branch_id,
               COALESCE(SUM(net_amount), 0) AS month_revenue
        FROM sales
        WHERE MONTH(sale_date) = MONTH(CURDATE())
          AND YEAR(sale_date) = YEAR(CURDATE())
          AND status = 'completed'
        GROUP BY branch_id
      ) month_sales ON month_sales.branch_id = s.store_id
      LEFT JOIN (
        SELECT branch_id, COUNT(*) AS total_users
        FROM users
        WHERE is_active = 1
        GROUP BY branch_id
      ) user_count ON user_count.branch_id = s.store_id
      WHERE s.is_active = 1
      ORDER BY s.store_name
    `, [today]);

    // Overall totals
    const totals = summary.reduce((acc, branch) => {
      acc.today_revenue  += Number(branch.today_revenue);
      acc.month_revenue  += Number(branch.month_revenue);
      acc.today_sales    += Number(branch.today_sale_count);
      acc.total_users    += Number(branch.total_users);
      acc.monthly_charges += Number(branch.monthly_charge);
      return acc;
    }, { today_revenue: 0, month_revenue: 0, today_sales: 0, total_users: 0, monthly_charges: 0 });

    res.json({ data: summary, totals });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.transferStock = async (req, res) => {
  const conn = await getConnection();
  try {
    const { from_store_id, to_store_id, product_id, quantity, notes } = req.body;
    if (!from_store_id || !to_store_id || !product_id || !quantity) return res.status(400).json({ message: 'All fields required' });

    await conn.beginTransaction();

    const [fromStock] = await conn.query('SELECT available_stock FROM store_inventory WHERE store_id = ? AND product_id = ? FOR UPDATE', [from_store_id, product_id]);
    if (!fromStock || fromStock.available_stock < quantity) {
      await conn.rollback();
      return res.status(400).json({ message: 'Insufficient stock' });
    }

    await conn.query('UPDATE store_inventory SET available_stock = available_stock - ? WHERE store_id = ? AND product_id = ?', [quantity, from_store_id, product_id]);
    await conn.query('INSERT INTO store_inventory (store_id, product_id, available_stock) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE available_stock = available_stock + ?', [to_store_id, product_id, quantity, quantity]);
    await conn.query('INSERT INTO stock_transfers (from_store_id, to_store_id, product_id, quantity, status, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)', [from_store_id, to_store_id, product_id, quantity, 'completed', notes || null, req.user.user_id]);

    await conn.commit();
    await logAction(req.user.user_id, req.user.name, 'STOCK_TRANSFERRED', 'stock_transfer', product_id, { from_store_id, to_store_id, quantity }, req.ip);
    res.json({ message: 'Stock transferred' });
  } catch (err) {
    await conn.rollback();
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
};
