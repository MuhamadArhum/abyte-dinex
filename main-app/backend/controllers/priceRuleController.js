const logger = require('../config/logger');
const { query, getConnection } = require('../config/database');
const { logAction } = require('../services/auditService');

const parsePagination = (page, limit) => {
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(Math.max(1, parseInt(limit) || 20), 100);
  return { page: p, limit: l, offset: (p - 1) * l };
};

const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

// GET /api/price-rules
exports.getAll = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);
    const { rule_type, is_active, search } = req.query;

    let where = 'WHERE 1=1';
    const params = [];

    if (rule_type) { where += ' AND pr.rule_type = ?'; params.push(rule_type); }
    if (is_active !== undefined) { where += ' AND pr.is_active = ?'; params.push(is_active); }
    if (search) { where += ' AND (pr.rule_name LIKE ? OR pr.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

    const [countResult] = await query(`SELECT COUNT(*) as total FROM price_rules pr ${where}`, params);

    const rows = await query(
      `SELECT pr.*, u.name AS created_by_name
       FROM price_rules pr
       LEFT JOIN users u ON pr.created_by = u.user_id
       ${where}
       ORDER BY pr.priority DESC, pr.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Get associated products/categories for each rule
    for (const rule of rows) {
      rule.products = await query(
        `SELECT prp.*, p.product_name, cat.name AS category_name
         FROM price_rule_products prp
         LEFT JOIN products p ON prp.product_id = p.product_id
         LEFT JOIN categories cat ON prp.category_id = cat.category_id
         WHERE prp.rule_id = ?`,
        [rule.rule_id]
      );
    }

    res.json({
      data: rows,
      pagination: { total: countResult.total, page, limit, totalPages: Math.ceil(countResult.total / limit) }
    });
  } catch (err) {
    logger.error('Get price rules error:', err);
    res.status(500).json({ message: 'Failed to fetch price rules' });
  }
};

// GET /api/price-rules/stats
exports.getStats = async (req, res) => {
  try {
    const [stats] = await query(
      `SELECT
         COUNT(CASE WHEN is_active = 1 AND NOW() BETWEEN start_date AND end_date THEN 1 END) AS active_count,
         COUNT(*) AS total_rules,
         COUNT(CASE WHEN is_active = 1 AND end_date < NOW() THEN 1 END) AS expired_count
       FROM price_rules`
    );

    const [usage] = await query(
      `SELECT COALESCE(SUM(discount_applied), 0) AS savings_this_month
       FROM price_rule_usage
       WHERE MONTH(applied_at) = MONTH(CURDATE()) AND YEAR(applied_at) = YEAR(CURDATE())`
    );

    res.json({ ...stats, savings_this_month: usage.savings_this_month });
  } catch (err) {
    logger.error('Get price rule stats error:', err);
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
};

// GET /api/price-rules/:id
exports.getById = async (req, res) => {
  try {
    const rules = await query(
      `SELECT pr.*, u.name AS created_by_name
       FROM price_rules pr LEFT JOIN users u ON pr.created_by = u.user_id
       WHERE pr.rule_id = ?`,
      [req.params.id]
    );
    if (rules.length === 0) return res.status(404).json({ message: 'Price rule not found' });

    const products = await query(
      `SELECT prp.*, p.product_name, cat.name AS category_name
       FROM price_rule_products prp
       LEFT JOIN products p ON prp.product_id = p.product_id
       LEFT JOIN categories cat ON prp.category_id = cat.category_id
       WHERE prp.rule_id = ?`,
      [req.params.id]
    );

    const usage = await query(
      `SELECT pru.*, s.sale_date FROM price_rule_usage pru
       LEFT JOIN sales s ON pru.sale_id = s.sale_id
       WHERE pru.rule_id = ? ORDER BY pru.applied_at DESC LIMIT 50`,
      [req.params.id]
    );

    res.json({ ...rules[0], products, usage_history: usage });
  } catch (err) {
    logger.error('Get price rule error:', err);
    res.status(500).json({ message: 'Failed to fetch price rule' });
  }
};

// POST /api/price-rules
exports.create = async (req, res) => {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();

    const { rule_name, rule_type, description, priority, start_date, end_date,
            min_quantity, buy_quantity, get_quantity, discount_type, discount_value,
            max_uses, applies_to, product_ids, category_ids } = req.body;

    if (!rule_name || !rule_type || !start_date || !end_date || !discount_value) {
      await conn.rollback();
      return res.status(400).json({ message: 'rule_name, rule_type, start_date, end_date, and discount_value are required' });
    }

    const result = await conn.query(
      `INSERT INTO price_rules (rule_name, rule_type, description, priority, start_date, end_date,
        min_quantity, buy_quantity, get_quantity, discount_type, discount_value, max_uses, applies_to, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [rule_name, rule_type, description || null, priority || 0, start_date, end_date,
       min_quantity || 1, buy_quantity || null, get_quantity || null, discount_type || 'percentage',
       discount_value, max_uses || null, applies_to || 'all', req.user.user_id]
    );

    const rule_id = Number(result.insertId);

    // Associate products
    if (product_ids && product_ids.length > 0) {
      for (const pid of product_ids) {
        await conn.query('INSERT INTO price_rule_products (rule_id, product_id) VALUES (?, ?)', [rule_id, pid]);
      }
    }

    // Associate categories
    if (category_ids && category_ids.length > 0) {
      for (const cid of category_ids) {
        await conn.query('INSERT INTO price_rule_products (rule_id, category_id) VALUES (?, ?)', [rule_id, cid]);
      }
    }

    await conn.commit();

    await logAction(req.user.user_id, req.user.name, 'PRICE_RULE_CREATED', 'price_rule', rule_id,
      { rule_name, rule_type, discount_type, discount_value }, req.ip);

    res.status(201).json({ message: 'Price rule created', rule_id });
  } catch (err) {
    await conn.rollback();
    logger.error('Create price rule error:', err);
    res.status(500).json({ message: 'Failed to create price rule' });
  } finally {
    conn.release();
  }
};

// PUT /api/price-rules/:id
exports.update = async (req, res) => {
  const conn = await getConnection();
  try {
    await conn.beginTransaction();
    const { id } = req.params;
    const { rule_name, rule_type, description, is_active, priority, start_date, end_date,
            min_quantity, buy_quantity, get_quantity, discount_type, discount_value,
            max_uses, applies_to, product_ids, category_ids } = req.body;

    const existing = await conn.query('SELECT * FROM price_rules WHERE rule_id = ?', [id]);
    if (existing.length === 0) { await conn.rollback(); return res.status(404).json({ message: 'Price rule not found' }); }

    await conn.query(
      `UPDATE price_rules SET rule_name = ?, rule_type = ?, description = ?, is_active = ?,
        priority = ?, start_date = ?, end_date = ?, min_quantity = ?, buy_quantity = ?,
        get_quantity = ?, discount_type = ?, discount_value = ?, max_uses = ?, applies_to = ?
       WHERE rule_id = ?`,
      [rule_name, rule_type, description || null, is_active !== undefined ? is_active : 1,
       priority || 0, start_date, end_date, min_quantity || 1, buy_quantity || null,
       get_quantity || null, discount_type || 'percentage', discount_value, max_uses || null,
       applies_to || 'all', id]
    );

    // Replace product/category associations
    await conn.query('DELETE FROM price_rule_products WHERE rule_id = ?', [id]);
    if (product_ids && product_ids.length > 0) {
      for (const pid of product_ids) {
        await conn.query('INSERT INTO price_rule_products (rule_id, product_id) VALUES (?, ?)', [id, pid]);
      }
    }
    if (category_ids && category_ids.length > 0) {
      for (const cid of category_ids) {
        await conn.query('INSERT INTO price_rule_products (rule_id, category_id) VALUES (?, ?)', [id, cid]);
      }
    }

    await conn.commit();

    await logAction(req.user.user_id, req.user.name, 'PRICE_RULE_UPDATED', 'price_rule', parseInt(id),
      { rule_name, rule_type }, req.ip);

    res.json({ message: 'Price rule updated' });
  } catch (err) {
    await conn.rollback();
    logger.error('Update price rule error:', err);
    res.status(500).json({ message: 'Failed to update price rule' });
  } finally {
    conn.release();
  }
};

// DELETE /api/price-rules/:id
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await query('SELECT * FROM price_rules WHERE rule_id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ message: 'Price rule not found' });

    // Check usage
    const [usage] = await query('SELECT COUNT(*) AS cnt FROM price_rule_usage WHERE rule_id = ?', [id]);
    if (usage.cnt > 0) {
      // Deactivate instead of delete
      await query('UPDATE price_rules SET is_active = 0 WHERE rule_id = ?', [id]);
      return res.json({ message: 'Price rule deactivated (has usage history)' });
    }

    await query('DELETE FROM price_rule_products WHERE rule_id = ?', [id]);
    await query('DELETE FROM price_rules WHERE rule_id = ?', [id]);

    await logAction(req.user.user_id, req.user.name, 'PRICE_RULE_DELETED', 'price_rule', parseInt(id),
      { rule_name: existing[0].rule_name }, req.ip);

    res.json({ message: 'Price rule deleted' });
  } catch (err) {
    logger.error('Delete price rule error:', err);
    res.status(500).json({ message: 'Failed to delete price rule' });
  }
};

// POST /api/price-rules/evaluate
// Given cart items, return applicable rules and discounts
exports.evaluate = async (req, res) => {
  try {
    const { items } = req.body; // [{ product_id, category_id, quantity, unit_price }]
    if (!items || items.length === 0) return res.json({ rules: [], total_discount: 0 });

    // Get all active rules within date range
    const activeRules = await query(
      `SELECT pr.* FROM price_rules pr
       WHERE pr.is_active = 1 AND NOW() BETWEEN pr.start_date AND pr.end_date
       AND (pr.max_uses IS NULL OR pr.used_count < pr.max_uses)
       ORDER BY pr.priority DESC`
    );

    const applicableRules = [];
    let totalDiscount = 0;

    for (const rule of activeRules) {
      // Get rule's associated products/categories
      const ruleProducts = await query(
        'SELECT product_id, category_id FROM price_rule_products WHERE rule_id = ?',
        [rule.rule_id]
      );

      const productIds = ruleProducts.filter(rp => rp.product_id).map(rp => rp.product_id);
      const categoryIds = ruleProducts.filter(rp => rp.category_id).map(rp => rp.category_id);

      // Find matching items
      let matchingItems;
      if (rule.applies_to === 'all') {
        matchingItems = items;
      } else if (rule.applies_to === 'product') {
        matchingItems = items.filter(item => productIds.includes(item.product_id));
      } else if (rule.applies_to === 'category') {
        matchingItems = items.filter(item => categoryIds.includes(item.category_id));
      } else {
        matchingItems = [];
      }

      if (matchingItems.length === 0) continue;

      let discount = 0;

      switch (rule.rule_type) {
        case 'quantity_discount': {
          for (const item of matchingItems) {
            if (item.quantity >= rule.min_quantity) {
              if (rule.discount_type === 'percentage') {
                discount += round2((item.unit_price * item.quantity) * (rule.discount_value / 100));
              } else {
                discount += round2(rule.discount_value);
              }
            }
          }
          break;
        }
        case 'buy_x_get_y': {
          for (const item of matchingItems) {
            if (item.quantity >= (rule.buy_quantity + rule.get_quantity)) {
              const freeItems = Math.floor(item.quantity / (rule.buy_quantity + rule.get_quantity)) * rule.get_quantity;
              discount += round2(freeItems * item.unit_price * (rule.discount_value / 100));
            }
          }
          break;
        }
        case 'time_based':
        case 'category_discount': {
          for (const item of matchingItems) {
            if (rule.discount_type === 'percentage') {
              discount += round2((item.unit_price * item.quantity) * (rule.discount_value / 100));
            } else {
              discount += round2(rule.discount_value);
            }
          }
          break;
        }
      }

      if (discount > 0) {
        applicableRules.push({
          rule_id: rule.rule_id,
          rule_name: rule.rule_name,
          rule_type: rule.rule_type,
          discount: round2(discount),
          description: rule.description
        });
        totalDiscount += discount;
      }
    }

    res.json({ rules: applicableRules, total_discount: round2(totalDiscount) });
  } catch (err) {
    logger.error('Evaluate price rules error:', err);
    res.status(500).json({ message: 'Failed to evaluate price rules' });
  }
};
