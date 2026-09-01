// =============================================================
// reportController.js - Reports Controller
// Generates sales and inventory reports for business insights.
// All reports are read-only (SELECT queries only).
// Only Admin and Manager roles can access these endpoints.
// Used by: /api/reports routes
// =============================================================

const logger = require('../config/logger');
const { query } = require('../config/database');  // Database query helper

// --- Daily Report ---
// Returns a summary of today's sales activity.
// Includes: total transactions, total sales, total discount, total revenue.
// COALESCE(value, 0) returns 0 instead of NULL when there are no sales today.
// Used on the Reports page "Daily" tab.
exports.dailyReport = async (req, res) => {
  try {
    const summary = await query(
      `SELECT
         COUNT(*) as total_transactions,
         COALESCE(SUM(total_amount), 0) as total_sales,
         COALESCE(SUM(discount), 0) as total_discount,
         COALESCE(SUM(net_amount), 0) as total_revenue
       FROM sales WHERE sale_date >= CURDATE() AND sale_date < DATE_ADD(CURDATE(), INTERVAL 1 DAY)`
    );
    res.json(summary[0]);  // Return single object (not array)
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Date Range Report ---
// Returns sales summary and daily breakdown for a specified date range.
// Query params: ?start_date=2024-01-01&end_date=2024-01-31
// Returns:
//   summary: { total_transactions, total_sales, total_discount, total_revenue, avg_transaction }
//   daily: [{ date, transactions, revenue }, ...] - one row per day
// Used on the Reports page "Date Range" tab.
exports.dateRangeReport = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    // Both dates are required
    if (!start_date || !end_date) {
      return res.status(400).json({ message: 'Start and end dates are required' });
    }

    // Overall summary for the date range
    const summary = await query(
      `SELECT
         COUNT(*) as total_transactions,
         COALESCE(SUM(total_amount), 0) as total_sales,
         COALESCE(SUM(discount), 0) as total_discount,
         COALESCE(SUM(net_amount), 0) as total_revenue,
         COALESCE(AVG(net_amount), 0) as avg_transaction
       FROM sales WHERE sale_date >= ? AND sale_date < DATE_ADD(?, INTERVAL 1 DAY)`,
      [start_date, end_date]
    );

    // Daily breakdown - GROUP BY date to show revenue per day
    const daily = await query(
      `SELECT
         DATE(sale_date) as date,
         COUNT(*) as transactions,
         SUM(net_amount) as revenue
       FROM sales WHERE sale_date >= ? AND sale_date < DATE_ADD(?, INTERVAL 1 DAY)
       GROUP BY DATE(sale_date) ORDER BY date`,
      [start_date, end_date]
    );

    res.json({ summary: summary[0], daily });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Product Sales Report ---
// Shows which products have been sold, how many, and their revenue contribution.
// Optionally filtered by date range (?start_date=...&end_date=...).
// Also calculates each product's percentage of total revenue.
// Used on the Reports page "Product" tab.
exports.productReport = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    // Build query: aggregate sale_details grouped by product
    let sql = `SELECT
         p.product_name,
         SUM(sd.quantity) as total_quantity,
         SUM(sd.total_price) as total_revenue
       FROM sale_details sd
       JOIN products p ON sd.product_id = p.product_id
       JOIN sales s ON sd.sale_id = s.sale_id
       WHERE 1=1`;
    const params = [];

    // Optional date range filter
    if (start_date && end_date) {
      sql += ' AND s.sale_date >= ? AND s.sale_date < DATE_ADD(?, INTERVAL 1 DAY)';
      params.push(start_date, end_date);
    }

    // Group by product and sort by highest revenue first
    sql += ' GROUP BY p.product_id, p.product_name ORDER BY total_revenue DESC';
    const rows = await query(sql, params);

    // Calculate each product's percentage of total revenue
    const totalRevenue = rows.reduce((sum, r) => sum + parseFloat(r.total_revenue), 0);
    const withPercentage = rows.map(r => ({
      ...r,
      percentage: totalRevenue > 0 ? ((parseFloat(r.total_revenue) / totalRevenue) * 100).toFixed(2) : 0,
    }));

    res.json({ data: withPercentage });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Inventory Report ---
// Returns a complete inventory snapshot with stock analysis.
// Includes: all products, low stock items (1-9), out of stock (0),
// total inventory value (price * stock for each product, summed).
// Used on the Reports page "Inventory" tab.
exports.inventoryReport = async (req, res) => {
  try {
    // Fetch all products with their stock levels and calculated stock value
    const all = await query(
      `SELECT p.product_name, p.price, i.available_stock, c.category_name,
              (p.price * i.available_stock) as stock_value
       FROM inventory i
       JOIN products p ON i.product_id = p.product_id
       LEFT JOIN categories c ON p.category_id = c.category_id
       WHERE 1=1
       ORDER BY p.product_name`
    );

    // Filter into categories in JavaScript (more readable than multiple SQL queries)
    const lowStock = all.filter(r => r.available_stock > 0 && r.available_stock < 10);
    const outOfStock = all.filter(r => r.available_stock === 0);

    // Calculate total value of all inventory (sum of price * stock for each product)
    const totalValue = all.reduce((sum, r) => sum + parseFloat(r.stock_value || 0), 0);

    // Return comprehensive inventory data
    res.json({
      products: all,                        // All products with stock info
      low_stock: lowStock,                  // Products with stock 1-9
      out_of_stock: outOfStock,             // Products with stock 0
      total_inventory_value: totalValue,    // Total Rs value of all stock
      total_products: all.length,           // Count of products
    });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// --- Dashboard Summary ---
// Returns today, yesterday, week, month revenue + order counts in a single DB query.
// Replaces 4 separate date-range API calls from the Dashboard page.
// GET /api/reports/dashboard?chart_start=YYYY-MM-DD
exports.dashboardSummary = async (req, res) => {
  try {
    const { chart_start } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const weekStart = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const monthStart = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    const [s] = await query(`
      SELECT
        COALESCE(SUM(CASE WHEN sale_date >= ? AND sale_date < DATE_ADD(?, INTERVAL 1 DAY) THEN net_amount ELSE 0 END), 0) as today_revenue,
        COALESCE(SUM(CASE WHEN sale_date >= ? AND sale_date < DATE_ADD(?, INTERVAL 1 DAY) THEN 1 ELSE 0 END), 0) as today_orders,
        COALESCE(SUM(CASE WHEN sale_date >= ? AND sale_date < DATE_ADD(?, INTERVAL 1 DAY) THEN net_amount ELSE 0 END), 0) as yesterday_revenue,
        COALESCE(SUM(CASE WHEN sale_date >= ? AND sale_date < DATE_ADD(?, INTERVAL 1 DAY) THEN 1 ELSE 0 END), 0) as yesterday_orders,
        COALESCE(SUM(CASE WHEN sale_date >= ? AND sale_date < DATE_ADD(?, INTERVAL 1 DAY) THEN net_amount ELSE 0 END), 0) as week_revenue,
        COALESCE(SUM(CASE WHEN sale_date >= ? AND sale_date < DATE_ADD(?, INTERVAL 1 DAY) THEN net_amount ELSE 0 END), 0) as month_revenue
      FROM sales
      WHERE status IN ('completed', 'refunded') AND sale_date >= ?
    `, [
      today, today,
      today, today,
      yesterday, yesterday,
      yesterday, yesterday,
      weekStart, today,
      monthStart, today,
      monthStart,
    ]);

    const chartRows = chart_start ? await query(`
      SELECT DATE(sale_date) as date, COUNT(*) as orders, COALESCE(SUM(net_amount), 0) as revenue
      FROM sales
      WHERE status IN ('completed', 'refunded') AND sale_date >= ? AND sale_date < DATE_ADD(?, INTERVAL 1 DAY)
      GROUP BY DATE(sale_date) ORDER BY date
    `, [chart_start, today]) : [];

    res.json({
      today_revenue: Number(s.today_revenue),
      today_orders: Number(s.today_orders),
      yesterday_revenue: Number(s.yesterday_revenue),
      yesterday_orders: Number(s.yesterday_orders),
      week_revenue: Number(s.week_revenue),
      month_revenue: Number(s.month_revenue),
      chart: chartRows
    });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};
