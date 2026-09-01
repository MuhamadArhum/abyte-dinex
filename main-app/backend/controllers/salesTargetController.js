const logger = require('../config/logger');
const { query, getConnection } = require('../config/database');
const { logAction } = require('../services/auditService');

const parsePagination = (page, limit) => {
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(Math.max(1, parseInt(limit) || 20), 100);
  return { page: p, limit: l, offset: (p - 1) * l };
};

const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

// GET /api/sales-targets
exports.getAll = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query.page, req.query.limit);
    const { user_id, target_type, is_active } = req.query;

    let where = 'WHERE 1=1';
    const params = [];

    if (user_id) { where += ' AND st.user_id = ?'; params.push(user_id); }
    if (target_type) { where += ' AND st.target_type = ?'; params.push(target_type); }
    if (is_active !== undefined) { where += ' AND st.is_active = ?'; params.push(is_active); }

    const [countResult] = await query(`SELECT COUNT(*) as total FROM sales_targets st ${where}`, params);

    const rows = await query(
      `SELECT st.*, u.name AS user_name, cb.name AS created_by_name
       FROM sales_targets st
       LEFT JOIN users u ON st.user_id = u.user_id
       LEFT JOIN users cb ON st.created_by = cb.user_id
       ${where}
       ORDER BY st.period_start DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Calculate actual achievement for each target
    for (const target of rows) {
      const [achievement] = await query(
        `SELECT COALESCE(SUM(net_amount), 0) AS actual_amount, COUNT(*) AS actual_orders
         FROM sales
         WHERE status = 'completed'
         AND sale_date BETWEEN ? AND ?
         ${target.user_id ? 'AND user_id = ?' : ''}`,
        target.user_id
          ? [target.period_start, target.period_end, target.user_id]
          : [target.period_start, target.period_end]
      );
      target.actual_amount = round2(parseFloat(achievement.actual_amount));
      target.actual_orders = achievement.actual_orders;
      target.achievement_percentage = target.target_amount > 0
        ? round2((target.actual_amount / parseFloat(target.target_amount)) * 100)
        : 0;
    }

    res.json({
      data: rows,
      pagination: { total: countResult.total, page, limit, totalPages: Math.ceil(countResult.total / limit) }
    });
  } catch (err) {
    logger.error('Get sales targets error:', err);
    res.status(500).json({ message: 'Failed to fetch sales targets' });
  }
};

// GET /api/sales-targets/stats
exports.getStats = async (req, res) => {
  try {
    // Get active targets for current period
    const targets = await query(
      `SELECT st.*, u.name AS user_name
       FROM sales_targets st
       LEFT JOIN users u ON st.user_id = u.user_id
       WHERE st.is_active = 1 AND CURDATE() BETWEEN st.period_start AND st.period_end`
    );

    let totalTarget = 0, totalAchieved = 0, topPerformer = null, lowestPerformer = null;

    for (const target of targets) {
      const [achievement] = await query(
        `SELECT COALESCE(SUM(net_amount), 0) AS actual_amount
         FROM sales WHERE status = 'completed' AND sale_date BETWEEN ? AND ?
         ${target.user_id ? 'AND user_id = ?' : ''}`,
        target.user_id
          ? [target.period_start, target.period_end, target.user_id]
          : [target.period_start, target.period_end]
      );

      const pct = parseFloat(target.target_amount) > 0
        ? round2((parseFloat(achievement.actual_amount) / parseFloat(target.target_amount)) * 100) : 0;

      totalTarget += parseFloat(target.target_amount);
      totalAchieved += parseFloat(achievement.actual_amount);

      if (target.user_id) {
        if (!topPerformer || pct > topPerformer.percentage) topPerformer = { name: target.user_name, percentage: pct };
        if (!lowestPerformer || pct < lowestPerformer.percentage) lowestPerformer = { name: target.user_name, percentage: pct };
      }
    }

    res.json({
      active_targets: targets.length,
      overall_achievement: totalTarget > 0 ? round2((totalAchieved / totalTarget) * 100) : 0,
      top_performer: topPerformer,
      lowest_performer: lowestPerformer
    });
  } catch (err) {
    logger.error('Get sales target stats error:', err);
    res.status(500).json({ message: 'Failed to fetch stats' });
  }
};

// GET /api/sales-targets/dashboard
exports.getDashboard = async (req, res) => {
  try {
    const targets = await query(
      `SELECT st.*, u.name AS user_name
       FROM sales_targets st
       LEFT JOIN users u ON st.user_id = u.user_id
       WHERE st.is_active = 1 AND CURDATE() BETWEEN st.period_start AND st.period_end
       ORDER BY st.target_amount DESC`
    );

    const dashboard = [];

    for (const target of targets) {
      const [achievement] = await query(
        `SELECT COALESCE(SUM(net_amount), 0) AS actual_amount, COUNT(*) AS actual_orders
         FROM sales WHERE status = 'completed' AND sale_date BETWEEN ? AND ?
         ${target.user_id ? 'AND user_id = ?' : ''}`,
        target.user_id
          ? [target.period_start, target.period_end, target.user_id]
          : [target.period_start, target.period_end]
      );

      dashboard.push({
        target_id: target.target_id,
        user_name: target.user_name || 'Store-Wide',
        target_type: target.target_type,
        target_amount: parseFloat(target.target_amount),
        target_orders: target.target_orders,
        actual_amount: round2(parseFloat(achievement.actual_amount)),
        actual_orders: achievement.actual_orders,
        achievement_percentage: parseFloat(target.target_amount) > 0
          ? round2((parseFloat(achievement.actual_amount) / parseFloat(target.target_amount)) * 100) : 0,
        period_start: target.period_start,
        period_end: target.period_end
      });
    }

    // Sort by achievement percentage descending
    dashboard.sort((a, b) => b.achievement_percentage - a.achievement_percentage);

    res.json(dashboard);
  } catch (err) {
    logger.error('Get dashboard error:', err);
    res.status(500).json({ message: 'Failed to fetch dashboard' });
  }
};

// GET /api/sales-targets/:id
exports.getById = async (req, res) => {
  try {
    const targets = await query(
      `SELECT st.*, u.name AS user_name, cb.name AS created_by_name
       FROM sales_targets st
       LEFT JOIN users u ON st.user_id = u.user_id
       LEFT JOIN users cb ON st.created_by = cb.user_id
       WHERE st.target_id = ?`,
      [req.params.id]
    );

    if (targets.length === 0) return res.status(404).json({ message: 'Target not found' });

    const target = targets[0];

    // Get daily achievements
    const [achievement] = await query(
      `SELECT COALESCE(SUM(net_amount), 0) AS actual_amount, COUNT(*) AS actual_orders
       FROM sales WHERE status = 'completed' AND sale_date BETWEEN ? AND ?
       ${target.user_id ? 'AND user_id = ?' : ''}`,
      target.user_id
        ? [target.period_start, target.period_end, target.user_id]
        : [target.period_start, target.period_end]
    );

    target.actual_amount = round2(parseFloat(achievement.actual_amount));
    target.actual_orders = achievement.actual_orders;
    target.achievement_percentage = parseFloat(target.target_amount) > 0
      ? round2((target.actual_amount / parseFloat(target.target_amount)) * 100) : 0;

    res.json(target);
  } catch (err) {
    logger.error('Get target error:', err);
    res.status(500).json({ message: 'Failed to fetch target' });
  }
};

// POST /api/sales-targets
exports.create = async (req, res) => {
  try {
    const { user_id, target_type, target_amount, target_orders, period_start, period_end } = req.body;

    if (!target_amount || !period_start || !period_end) {
      return res.status(400).json({ message: 'target_amount, period_start, and period_end are required' });
    }

    const result = await query(
      `INSERT INTO sales_targets (user_id, target_type, target_amount, target_orders, period_start, period_end, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user_id || null, target_type || 'monthly', target_amount, target_orders || null, period_start, period_end, req.user.user_id]
    );

    const target_id = Number(result.insertId);

    await logAction(req.user.user_id, req.user.name, 'TARGET_CREATED', 'sales_target', target_id,
      { user_id, target_type, target_amount, period_start, period_end }, req.ip);

    res.status(201).json({ message: 'Sales target created', target_id });
  } catch (err) {
    logger.error('Create sales target error:', err);
    res.status(500).json({ message: 'Failed to create target' });
  }
};

// PUT /api/sales-targets/:id
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id, target_type, target_amount, target_orders, period_start, period_end, is_active } = req.body;

    const existing = await query('SELECT * FROM sales_targets WHERE target_id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ message: 'Target not found' });

    await query(
      `UPDATE sales_targets SET user_id = ?, target_type = ?, target_amount = ?, target_orders = ?,
       period_start = ?, period_end = ?, is_active = ? WHERE target_id = ?`,
      [user_id || null, target_type || 'monthly', target_amount, target_orders || null,
       period_start, period_end, is_active !== undefined ? is_active : 1, id]
    );

    await logAction(req.user.user_id, req.user.name, 'TARGET_UPDATED', 'sales_target', parseInt(id),
      { target_amount, target_type }, req.ip);

    res.json({ message: 'Sales target updated' });
  } catch (err) {
    logger.error('Update sales target error:', err);
    res.status(500).json({ message: 'Failed to update target' });
  }
};

// DELETE /api/sales-targets/:id
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await query('SELECT * FROM sales_targets WHERE target_id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ message: 'Target not found' });

    await query('DELETE FROM target_achievements WHERE target_id = ?', [id]);
    await query('DELETE FROM sales_targets WHERE target_id = ?', [id]);

    await logAction(req.user.user_id, req.user.name, 'TARGET_DELETED', 'sales_target', parseInt(id), {}, req.ip);

    res.json({ message: 'Sales target deleted' });
  } catch (err) {
    logger.error('Delete sales target error:', err);
    res.status(500).json({ message: 'Failed to delete target' });
  }
};
