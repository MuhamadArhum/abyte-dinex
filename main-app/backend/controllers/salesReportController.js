const logger = require('../config/logger');
const { query } = require('../config/database');

exports.getSalesSummary = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const from = date_from || new Date().toISOString().split('T')[0];
    const to = date_to || new Date().toISOString().split('T')[0];
    const params = [from, to];

    const [summary] = await query(`
      SELECT
        COUNT(*) as total_orders,
        COALESCE(SUM(net_amount), 0) as total_sales,
        COALESCE(AVG(net_amount), 0) as avg_order,
        COALESCE(SUM(discount), 0) as total_discount,
        COALESCE(SUM(tax_amount), 0) as total_tax
      FROM sales
      WHERE status = 'completed' AND DATE(sale_date) BETWEEN ? AND ?
    `, params);

    res.json({
      total_orders: Number(summary.total_orders) || 0,
      total_sales: Number(summary.total_sales) || 0,
      avg_order: Number(summary.avg_order) || 0,
      total_discount: Number(summary.total_discount) || 0,
      total_tax: Number(summary.total_tax) || 0
    });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.getHourlySales = async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const params = [date];

    const rows = await query(`
      SELECT HOUR(sale_date) as hour, COUNT(*) as orders, COALESCE(SUM(net_amount), 0) as revenue
      FROM sales WHERE status = 'completed' AND DATE(sale_date) = ?
      GROUP BY HOUR(sale_date) ORDER BY hour
    `, params);

    const hourly = Array.from({ length: 24 }, (_, i) => {
      const found = rows.find(r => Number(r.hour) === i);
      return { hour: i, orders: found ? Number(found.orders) : 0, revenue: found ? Number(found.revenue) : 0 };
    });
    res.json({ data: hourly });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.getPaymentBreakdown = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const from = date_from || new Date().toISOString().split('T')[0];
    const to = date_to || new Date().toISOString().split('T')[0];
    const params = [from, to];

    const rows = await query(`
      SELECT payment_method, COUNT(*) as count, COALESCE(SUM(net_amount), 0) as total
      FROM sales WHERE status = 'completed' AND DATE(sale_date) BETWEEN ? AND ?
      GROUP BY payment_method ORDER BY total DESC
    `, params);

    const grandTotal = rows.reduce((s, r) => s + Number(r.total), 0);
    const data = rows.map(r => ({ method: r.payment_method, count: Number(r.count), total: Number(r.total), percentage: grandTotal > 0 ? Math.round((Number(r.total) / grandTotal) * 100) : 0 }));
    res.json({ data });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.getCashierPerformance = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const from = date_from || new Date().toISOString().split('T')[0];
    const to = date_to || new Date().toISOString().split('T')[0];
    const params = [from, to];

    const rows = await query(`
      SELECT s.user_id, u.name as cashier_name, COUNT(*) as order_count,
        COALESCE(SUM(s.net_amount), 0) as total_sales, COALESCE(AVG(s.net_amount), 0) as avg_sale
      FROM sales s JOIN users u ON s.user_id = u.user_id
      WHERE s.status = 'completed' AND DATE(s.sale_date) BETWEEN ? AND ?
      GROUP BY s.user_id ORDER BY total_sales DESC
    `, params);

    res.json({ data: rows.map(r => ({ ...r, total_sales: Number(r.total_sales), avg_sale: Number(r.avg_sale), order_count: Number(r.order_count) })) });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.getDailyTrend = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const from = date_from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const to = date_to || new Date().toISOString().split('T')[0];
    const params = [from, to];

    const rows = await query(`
      SELECT DATE(sale_date) as date, COUNT(*) as orders, COALESCE(SUM(net_amount), 0) as revenue
      FROM sales WHERE status = 'completed' AND DATE(sale_date) BETWEEN ? AND ?
      GROUP BY DATE(sale_date) ORDER BY date
    `, params);

    res.json({ data: rows.map(r => ({ date: r.date, orders: Number(r.orders), revenue: Number(r.revenue) })) });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.getTopCustomers = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const from = date_from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const to = date_to || new Date().toISOString().split('T')[0];
    const params = [from, to];

    const rows = await query(`
      SELECT s.customer_id, c.customer_name, COUNT(*) as order_count, COALESCE(SUM(s.net_amount), 0) as total_spent
      FROM sales s JOIN customers c ON s.customer_id = c.customer_id
      WHERE s.status = 'completed' AND DATE(s.sale_date) BETWEEN ? AND ?
      GROUP BY s.customer_id ORDER BY total_spent DESC LIMIT 15
    `, params);

    res.json({ data: rows.map(r => ({ ...r, total_spent: Number(r.total_spent), order_count: Number(r.order_count) })) });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.getSalesComparison = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const from = new Date(date_from || new Date().toISOString().split('T')[0]);
    const to = new Date(date_to || new Date().toISOString().split('T')[0]);
    const days = Math.max(1, Math.ceil((to - from) / 86400000) + 1);

    const prevFrom = new Date(from.getTime() - days * 86400000).toISOString().split('T')[0];
    const prevTo = new Date(from.getTime() - 86400000).toISOString().split('T')[0];

    const currentParams = ['completed', from.toISOString().split('T')[0], to.toISOString().split('T')[0]];
    const prevParams = ['completed', prevFrom, prevTo];

    const [[current], [previous]] = await Promise.all([
      query(`SELECT COALESCE(SUM(net_amount), 0) as total, COUNT(*) as orders FROM sales WHERE status = ? AND DATE(sale_date) BETWEEN ? AND ?`, currentParams),
      query(`SELECT COALESCE(SUM(net_amount), 0) as total, COUNT(*) as orders FROM sales WHERE status = ? AND DATE(sale_date) BETWEEN ? AND ?`, prevParams)
    ]);

    const currentTotal = Number(current.total);
    const prevTotal = Number(previous.total);
    const change = prevTotal > 0 ? Math.round(((currentTotal - prevTotal) / prevTotal) * 100) : 0;

    res.json({ current_period: { total: currentTotal, orders: Number(current.orders) }, previous_period: { total: prevTotal, orders: Number(previous.orders) }, change_percent: change });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};


exports.getProfitMargin = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const from = date_from || new Date().toISOString().split('T')[0];
    const to   = date_to   || new Date().toISOString().split('T')[0];
    const params = [from, to];

    const [summary] = await query(`
      SELECT
        COALESCE(SUM(sd.total_price), 0)                          as total_revenue,
        COALESCE(SUM(sd.quantity * p.cost_price), 0)              as total_cost,
        COALESCE(SUM(sd.total_price) - SUM(sd.quantity * p.cost_price), 0) as gross_profit
      FROM sale_details sd
      JOIN sales s    ON sd.sale_id    = s.sale_id
      JOIN products p ON sd.product_id = p.product_id
      WHERE s.status = 'completed' AND DATE(s.sale_date) BETWEEN ? AND ? AND p.cost_price IS NOT NULL
    `, params);

    const rows = await query(`
      SELECT
        p.product_id, p.product_name,
        COALESCE(c.category_name, 'Uncategorized') as category_name,
        SUM(sd.quantity)                                                         as total_qty,
        COALESCE(SUM(sd.total_price), 0)                                         as revenue,
        COALESCE(SUM(sd.quantity * p.cost_price), 0)                             as total_cost,
        COALESCE(SUM(sd.total_price) - SUM(sd.quantity * p.cost_price), 0)       as gross_profit,
        CASE WHEN SUM(sd.total_price) > 0
          THEN ROUND((SUM(sd.total_price) - SUM(sd.quantity * p.cost_price)) / SUM(sd.total_price) * 100, 1)
          ELSE 0 END                                                              as margin_pct
      FROM sale_details sd
      JOIN sales s    ON sd.sale_id    = s.sale_id
      JOIN products p ON sd.product_id = p.product_id
      LEFT JOIN categories c ON p.category_id = c.category_id
      WHERE s.status = 'completed' AND DATE(s.sale_date) BETWEEN ? AND ? AND p.cost_price IS NOT NULL
      GROUP BY p.product_id
      ORDER BY gross_profit DESC
    `, params);

    res.json({
      summary: {
        total_revenue: Number(summary.total_revenue),
        total_cost:    Number(summary.total_cost),
        gross_profit:  Number(summary.gross_profit),
        overall_margin: Number(summary.total_revenue) > 0
          ? Math.round((Number(summary.gross_profit) / Number(summary.total_revenue)) * 100)
          : 0,
      },
      data: rows.map(r => ({
        product_id:    Number(r.product_id),
        product_name:  r.product_name,
        category_name: r.category_name,
        total_qty:     Number(r.total_qty),
        revenue:       Number(r.revenue),
        total_cost:    Number(r.total_cost),
        gross_profit:  Number(r.gross_profit),
        margin_pct:    Number(r.margin_pct),
      })),
    });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.getDiscountAnalysis = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const from = date_from || new Date().toISOString().split('T')[0];
    const to   = date_to   || new Date().toISOString().split('T')[0];
    const params = [from, to];

    const [summary] = await query(`
      SELECT
        COUNT(*)                                                           as total_orders,
        COUNT(CASE WHEN s.discount > 0 THEN 1 END)                        as discounted_orders,
        COALESCE(SUM(s.discount), 0)                                       as total_discount,
        COALESCE(SUM(s.total_amount), 0)                                   as gross_sales,
        CASE WHEN SUM(s.total_amount) > 0
          THEN ROUND(SUM(s.discount) / SUM(s.total_amount) * 100, 1)
          ELSE 0 END                                                        as discount_pct
      FROM sales s
      WHERE s.status = 'completed' AND DATE(s.sale_date) BETWEEN ? AND ?
    `, params);

    const bycashier = await query(`
      SELECT
        s.user_id, u.name as cashier_name,
        COUNT(*)                                                              as total_orders,
        COUNT(CASE WHEN s.discount > 0 THEN 1 END)                           as discounted_orders,
        COALESCE(SUM(s.discount), 0)                                          as total_discount,
        COALESCE(SUM(s.total_amount), 0)                                      as gross_sales,
        CASE WHEN SUM(s.total_amount) > 0
          THEN ROUND(SUM(s.discount) / SUM(s.total_amount) * 100, 1)
          ELSE 0 END                                                           as discount_pct
      FROM sales s
      JOIN users u ON s.user_id = u.user_id
      WHERE s.status = 'completed' AND DATE(s.sale_date) BETWEEN ? AND ?
      GROUP BY s.user_id
      ORDER BY total_discount DESC
    `, params);

    const daily = await query(`
      SELECT
        DATE(s.sale_date)                        as date,
        COALESCE(SUM(s.discount), 0)             as total_discount,
        COALESCE(SUM(s.total_amount), 0)         as gross_sales,
        COUNT(CASE WHEN s.discount > 0 THEN 1 END) as discounted_orders
      FROM sales s
      WHERE s.status = 'completed' AND DATE(s.sale_date) BETWEEN ? AND ?
      GROUP BY DATE(s.sale_date)
      ORDER BY date
    `, params);

    res.json({
      summary: {
        total_orders:       Number(summary.total_orders),
        discounted_orders:  Number(summary.discounted_orders),
        total_discount:     Number(summary.total_discount),
        gross_sales:        Number(summary.gross_sales),
        discount_pct:       Number(summary.discount_pct),
      },
      by_cashier: bycashier.map(r => ({
        user_id:           Number(r.user_id),
        cashier_name:      r.cashier_name,
        total_orders:      Number(r.total_orders),
        discounted_orders: Number(r.discounted_orders),
        total_discount:    Number(r.total_discount),
        gross_sales:       Number(r.gross_sales),
        discount_pct:      Number(r.discount_pct),
      })),
      daily: daily.map(r => ({
        date:              r.date,
        total_discount:    Number(r.total_discount),
        gross_sales:       Number(r.gross_sales),
        discounted_orders: Number(r.discounted_orders),
      })),
    });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.getTaxReport = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const from = date_from || new Date().toISOString().split('T')[0];
    const to   = date_to   || new Date().toISOString().split('T')[0];
    const params = [from, to];

    const [summary] = await query(`
      SELECT
        COUNT(*)                                                               as total_orders,
        COUNT(CASE WHEN tax_amount > 0 THEN 1 END)                            as taxable_orders,
        COALESCE(SUM(total_amount), 0)                                         as gross_amount,
        COALESCE(SUM(discount), 0)                                             as total_discount,
        COALESCE(SUM(tax_amount), 0)                                           as tax_collected,
        COALESCE(SUM(net_amount), 0)                                           as net_amount,
        COALESCE(SUM(CASE WHEN tax_amount > 0 THEN net_amount ELSE 0 END), 0) as taxable_sales,
        COALESCE(SUM(CASE WHEN tax_amount = 0 THEN net_amount ELSE 0 END), 0) as non_taxable_sales
      FROM sales
      WHERE status = 'completed' AND DATE(sale_date) BETWEEN ? AND ?
    `, params);

    const daily = await query(`
      SELECT
        DATE(sale_date)                          as date,
        COUNT(*)                                  as total_orders,
        COALESCE(SUM(total_amount), 0)            as gross_amount,
        COALESCE(SUM(tax_amount), 0)              as tax_collected,
        COALESCE(SUM(net_amount), 0)              as net_amount
      FROM sales
      WHERE status = 'completed' AND DATE(sale_date) BETWEEN ? AND ?
      GROUP BY DATE(sale_date)
      ORDER BY date
    `, params);

    res.json({
      summary: {
        total_orders:      Number(summary.total_orders),
        taxable_orders:    Number(summary.taxable_orders),
        gross_amount:      Number(summary.gross_amount),
        total_discount:    Number(summary.total_discount),
        tax_collected:     Number(summary.tax_collected),
        net_amount:        Number(summary.net_amount),
        taxable_sales:     Number(summary.taxable_sales),
        non_taxable_sales: Number(summary.non_taxable_sales),
      },
      daily: daily.map(r => ({
        date:          r.date,
        total_orders:  Number(r.total_orders),
        gross_amount:  Number(r.gross_amount),
        tax_collected: Number(r.tax_collected),
        net_amount:    Number(r.net_amount),
      })),
    });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

// ── 1. Sales Returns ─────────────────────────────────────────
exports.getSalesReturns = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const from = date_from || new Date().toISOString().split('T')[0];
    const to   = date_to   || new Date().toISOString().split('T')[0];
    const params = [from, to];

    const [summary] = await query(`
      SELECT
        COUNT(r.return_id)              as total_returns,
        COALESCE(SUM(r.refund_amount),0) as total_refund,
        COALESCE(AVG(r.refund_amount),0) as avg_refund
      FROM returns r
      JOIN sales s ON r.sale_id = s.sale_id
      WHERE DATE(r.return_date) BETWEEN ? AND ?
    `, params);

    const data = await query(`
      SELECT r.return_id, r.sale_id, r.return_date, r.refund_amount, r.reason,
        u.name as processed_by, s.invoice_no,
        COALESCE(s.customer_name,'Walk-In') as customer_name
      FROM returns r
      JOIN sales s ON r.sale_id = s.sale_id
      LEFT JOIN users u ON r.user_id = u.user_id
      WHERE DATE(r.return_date) BETWEEN ? AND ?
      ORDER BY r.return_date DESC
    `, params);

    res.json({
      summary: {
        total_returns: Number(summary.total_returns),
        total_refund:  Number(summary.total_refund),
        avg_refund:    Number(summary.avg_refund),
      },
      data: data.map(r => ({
        return_id:     Number(r.return_id),
        sale_id:       Number(r.sale_id),
        return_date:   r.return_date,
        refund_amount: Number(r.refund_amount),
        reason:        r.reason,
        processed_by:  r.processed_by,
        invoice_no:    r.invoice_no,
        customer_name: r.customer_name,
      })),
    });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

// ── 2. Shift Sales Report (Morning/Afternoon/Evening/Night) ──
exports.getShiftReport = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const from = date_from || new Date().toISOString().split('T')[0];
    const to   = date_to   || new Date().toISOString().split('T')[0];
    const params = [from, to];

    const rows = await query(`
      SELECT
        CASE
          WHEN HOUR(sale_date) BETWEEN 6  AND 11 THEN 'Morning (6am–12pm)'
          WHEN HOUR(sale_date) BETWEEN 12 AND 17 THEN 'Afternoon (12pm–6pm)'
          WHEN HOUR(sale_date) BETWEEN 18 AND 23 THEN 'Evening (6pm–12am)'
          ELSE 'Night (12am–6am)'
        END AS shift_name,
        COUNT(*)                          as total_orders,
        COALESCE(SUM(net_amount),0)       as total_sales,
        COALESCE(AVG(net_amount),0)       as avg_order,
        COALESCE(SUM(discount),0)         as total_discount,
        COALESCE(SUM(tax_amount),0)       as total_tax
      FROM sales
      WHERE status = 'completed' AND DATE(sale_date) BETWEEN ? AND ?
      GROUP BY shift_name
      ORDER BY MIN(HOUR(sale_date))
    `, params);

    const daily = await query(`
      SELECT
        DATE(sale_date) as date,
        CASE
          WHEN HOUR(sale_date) BETWEEN 6  AND 11 THEN 'Morning'
          WHEN HOUR(sale_date) BETWEEN 12 AND 17 THEN 'Afternoon'
          WHEN HOUR(sale_date) BETWEEN 18 AND 23 THEN 'Evening'
          ELSE 'Night'
        END AS shift,
        COALESCE(SUM(net_amount),0) as total_sales
      FROM sales
      WHERE status = 'completed' AND DATE(sale_date) BETWEEN ? AND ?
      GROUP BY DATE(sale_date), shift
      ORDER BY date
    `, params);

    res.json({
      data: rows.map(r => ({
        shift_name:     r.shift_name,
        total_orders:   Number(r.total_orders),
        total_sales:    Number(r.total_sales),
        avg_order:      Number(r.avg_order),
        total_discount: Number(r.total_discount),
        total_tax:      Number(r.total_tax),
      })),
      daily: daily.map(r => ({
        date:        r.date,
        shift:       r.shift,
        total_sales: Number(r.total_sales),
      })),
    });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

// ── 3. Void / Cancelled Transactions ─────────────────────────
exports.getVoidedSales = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const from = date_from || new Date().toISOString().split('T')[0];
    const to   = date_to   || new Date().toISOString().split('T')[0];
    const params = [from, to];

    const [summary] = await query(`
      SELECT
        COUNT(*)                             as total_voided,
        COALESCE(SUM(net_amount),0)          as total_voided_amount,
        COUNT(DISTINCT user_id)              as cashiers_involved
      FROM sales
      WHERE status != 'completed' AND DATE(sale_date) BETWEEN ? AND ?
    `, params);

    const data = await query(`
      SELECT s.sale_id, s.invoice_no, s.sale_date, s.net_amount, s.status,
        COALESCE(s.customer_name,'Walk-In') as customer_name,
        s.payment_method, s.note, u.name as cashier_name
      FROM sales s
      JOIN users u ON s.user_id = u.user_id
      WHERE s.status != 'completed' AND DATE(s.sale_date) BETWEEN ? AND ?
      ORDER BY s.sale_date DESC
    `, params);

    res.json({
      summary: {
        total_voided:        Number(summary.total_voided),
        total_voided_amount: Number(summary.total_voided_amount),
        cashiers_involved:   Number(summary.cashiers_involved),
      },
      data: data.map(r => ({
        sale_id:        Number(r.sale_id),
        invoice_no:     r.invoice_no,
        sale_date:      r.sale_date,
        net_amount:     Number(r.net_amount),
        status:         r.status,
        customer_name:  r.customer_name,
        payment_method: r.payment_method,
        note:           r.note,
        cashier_name:   r.cashier_name,
      })),
    });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

// ── 4. Product Performance ────────────────────────────────────
exports.getProductPerformance = async (req, res) => {
  try {
    const { date_from, date_to, sort_by } = req.query;
    const from = date_from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const to   = date_to   || new Date().toISOString().split('T')[0];
    const params = [from, to];
    const sortCol = sort_by === 'qty' ? 'total_qty' : sort_by === 'orders' ? 'order_count' : 'revenue';

    const [totals] = await query(`
      SELECT COALESCE(SUM(sd.total_price),0) as grand_total,
        COALESCE(SUM(sd.quantity),0) as grand_qty,
        COUNT(DISTINCT sd.product_id) as unique_products
      FROM sale_details sd
      JOIN sales s ON sd.sale_id = s.sale_id
      WHERE s.status = 'completed' AND DATE(s.sale_date) BETWEEN ? AND ?
    `, params);

    const data = await query(`
      SELECT p.product_id, p.product_name,
        COALESCE(c.category_name,'Uncategorized') as category_name,
        SUM(sd.quantity)                          as total_qty,
        COUNT(DISTINCT sd.sale_id)                as order_count,
        COALESCE(SUM(sd.total_price),0)           as revenue,
        COALESCE(AVG(sd.unit_price),0)            as avg_price
      FROM sale_details sd
      JOIN sales s ON sd.sale_id = s.sale_id
      JOIN products p ON sd.product_id = p.product_id
      LEFT JOIN categories c ON p.category_id = c.category_id
      WHERE s.status = 'completed' AND DATE(s.sale_date) BETWEEN ? AND ?
      GROUP BY p.product_id
      ORDER BY ${sortCol} DESC
      LIMIT 50
    `, params);

    res.json({
      summary: {
        grand_total:      Number(totals.grand_total),
        grand_qty:        Number(totals.grand_qty),
        unique_products:  Number(totals.unique_products),
      },
      data: data.map(r => ({
        product_id:    Number(r.product_id),
        product_name:  r.product_name,
        category_name: r.category_name,
        total_qty:     Number(r.total_qty),
        order_count:   Number(r.order_count),
        revenue:       Number(r.revenue),
        avg_price:     Number(r.avg_price),
      })),
    });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

// ── 5. Customer Sales History ─────────────────────────────────
exports.getCustomerHistory = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const from = date_from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const to   = date_to   || new Date().toISOString().split('T')[0];
    const params = [from, to];

    const [summary] = await query(`
      SELECT COUNT(DISTINCT s.customer_id) as total_customers,
        COUNT(*) as total_orders,
        COALESCE(SUM(s.net_amount),0) as total_revenue,
        COALESCE(AVG(s.net_amount),0) as avg_order_value
      FROM sales s
      WHERE s.status = 'completed' AND DATE(s.sale_date) BETWEEN ? AND ?
        AND s.customer_id != 1
    `, params);

    const data = await query(`
      SELECT c.customer_id, c.customer_name, c.phone,
        COUNT(s.sale_id)             as total_orders,
        COALESCE(SUM(s.net_amount),0) as total_spent,
        COALESCE(AVG(s.net_amount),0) as avg_order,
        MAX(s.sale_date)              as last_visit,
        MIN(s.sale_date)              as first_visit
      FROM sales s
      JOIN customers c ON s.customer_id = c.customer_id
      WHERE s.status = 'completed' AND DATE(s.sale_date) BETWEEN ? AND ?
        AND s.customer_id != 1
      GROUP BY c.customer_id
      ORDER BY total_spent DESC
      LIMIT 50
    `, params);

    res.json({
      summary: {
        total_customers:  Number(summary.total_customers),
        total_orders:     Number(summary.total_orders),
        total_revenue:    Number(summary.total_revenue),
        avg_order_value:  Number(summary.avg_order_value),
      },
      data: data.map(r => ({
        customer_id:   Number(r.customer_id),
        customer_name: r.customer_name,
        phone:         r.phone,
        total_orders:  Number(r.total_orders),
        total_spent:   Number(r.total_spent),
        avg_order:     Number(r.avg_order),
        last_visit:    r.last_visit,
        first_visit:   r.first_visit,
      })),
    });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

// ── 6. Credit Sales / Receivables Aging ──────────────────────
exports.getCreditAging = async (req, res) => {
  try {
    const [summary] = await query(`
      SELECT COUNT(*) as total_records,
        COALESCE(SUM(balance_due),0) as total_outstanding,
        COUNT(CASE WHEN status='overdue' THEN 1 END) as overdue_count,
        COALESCE(SUM(CASE WHEN status='overdue' THEN balance_due ELSE 0 END),0) as overdue_amount
      FROM credit_sales WHERE status != 'paid'
    `);

    const aging = await query(`
      SELECT cs.credit_sale_id, cs.sale_id, cs.total_amount, cs.paid_amount,
        cs.balance_due, cs.due_date, cs.status, cs.created_at,
        c.customer_name, c.phone,
        DATEDIFF(CURDATE(), cs.due_date) as days_overdue
      FROM credit_sales cs
      JOIN customers c ON cs.customer_id = c.customer_id
      WHERE cs.status != 'paid'
      ORDER BY days_overdue DESC, cs.balance_due DESC
    `);

    const buckets = { current: 0, days_1_30: 0, days_31_60: 0, days_61_90: 0, days_90_plus: 0 };
    aging.forEach(r => {
      const d = Number(r.days_overdue);
      if      (d <= 0)  buckets.current     += Number(r.balance_due);
      else if (d <= 30) buckets.days_1_30   += Number(r.balance_due);
      else if (d <= 60) buckets.days_31_60  += Number(r.balance_due);
      else if (d <= 90) buckets.days_61_90  += Number(r.balance_due);
      else              buckets.days_90_plus += Number(r.balance_due);
    });

    res.json({
      summary: {
        total_records:     Number(summary.total_records),
        total_outstanding: Number(summary.total_outstanding),
        overdue_count:     Number(summary.overdue_count),
        overdue_amount:    Number(summary.overdue_amount),
      },
      aging_buckets: buckets,
      data: aging.map(r => ({
        credit_sale_id: Number(r.credit_sale_id),
        sale_id:        Number(r.sale_id),
        customer_name:  r.customer_name,
        phone:          r.phone,
        total_amount:   Number(r.total_amount),
        paid_amount:    Number(r.paid_amount),
        balance_due:    Number(r.balance_due),
        due_date:       r.due_date,
        status:         r.status,
        days_overdue:   Number(r.days_overdue),
        created_at:     r.created_at,
      })),
    });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

// ── 8. Daily Cash Reconciliation ─────────────────────────────
exports.getCashReconciliation = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const from = date_from || new Date().toISOString().split('T')[0];
    const to   = date_to   || new Date().toISOString().split('T')[0];

    const [summary] = await query(`
      SELECT COUNT(*) as total_sessions,
        COALESCE(SUM(opening_balance),0) as total_opening,
        COALESCE(SUM(cash_sales_total),0) as total_cash_sales,
        COALESCE(SUM(total_cash_in),0) as total_cash_in,
        COALESCE(SUM(total_cash_out),0) as total_cash_out,
        COALESCE(SUM(CASE WHEN status='closed' THEN closing_balance ELSE 0 END),0) as total_closing,
        COALESCE(SUM(CASE WHEN difference IS NOT NULL THEN difference ELSE 0 END),0) as total_difference,
        COUNT(CASE WHEN difference < 0 THEN 1 END) as shortage_count,
        COUNT(CASE WHEN difference > 0 THEN 1 END) as overage_count
      FROM cash_registers WHERE DATE(opened_at) BETWEEN ? AND ?
    `, [from, to]);

    const data = await query(`
      SELECT cr.register_id, u1.name as opened_by, u2.name as closed_by,
        cr.opening_balance, cr.closing_balance, cr.expected_balance,
        cr.cash_sales_total, cr.card_sales_total,
        cr.total_cash_in, cr.total_cash_out, cr.difference,
        cr.status, cr.opened_at, cr.closed_at, cr.close_note
      FROM cash_registers cr
      JOIN users u1 ON cr.opened_by = u1.user_id
      LEFT JOIN users u2 ON cr.closed_by = u2.user_id
      WHERE DATE(cr.opened_at) BETWEEN ? AND ?
      ORDER BY cr.opened_at DESC
    `, [from, to]);

    res.json({
      summary: {
        total_sessions:   Number(summary.total_sessions),
        total_opening:    Number(summary.total_opening),
        total_cash_sales: Number(summary.total_cash_sales),
        total_cash_in:    Number(summary.total_cash_in),
        total_cash_out:   Number(summary.total_cash_out),
        total_closing:    Number(summary.total_closing),
        total_difference: Number(summary.total_difference),
        shortage_count:   Number(summary.shortage_count),
        overage_count:    Number(summary.overage_count),
      },
      data: data.map(s => ({
        register_id:      Number(s.register_id),
        opened_by:        s.opened_by,
        closed_by:        s.closed_by,
        opening_balance:  Number(s.opening_balance),
        closing_balance:  s.closing_balance  != null ? Number(s.closing_balance)  : null,
        expected_balance: s.expected_balance != null ? Number(s.expected_balance) : null,
        cash_sales_total: Number(s.cash_sales_total),
        card_sales_total: Number(s.card_sales_total),
        total_cash_in:    Number(s.total_cash_in),
        total_cash_out:   Number(s.total_cash_out),
        difference:       s.difference != null ? Number(s.difference) : null,
        status:           s.status,
        opened_at:        s.opened_at,
        closed_at:        s.closed_at,
        close_note:       s.close_note,
      })),
    });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};

exports.getCategoryBreakdown = async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const from = date_from || new Date().toISOString().split('T')[0];
    const to = date_to || new Date().toISOString().split('T')[0];
    const params = [from, to];

    const rows = await query(`
      SELECT
        CASE
          WHEN order_type = 'dine_in'  THEN 'Dine-In'
          WHEN order_type = 'takeaway' THEN 'Takeaway'
          WHEN order_type = 'delivery' THEN 'Delivery'
          ELSE 'Walk-In'
        END as category,
        order_type,
        COUNT(*) as total_orders,
        COALESCE(SUM(net_amount), 0) as total_sales,
        COALESCE(SUM(tax_amount), 0) as total_tax,
        COALESCE(SUM(additional_charges_amount), 0) as total_charges,
        COALESCE(AVG(net_amount), 0) as avg_order
      FROM sales
      WHERE status = 'completed' AND DATE(sale_date) BETWEEN ? AND ?
      GROUP BY order_type
      ORDER BY total_sales DESC
    `, params);

    res.json({
      data: rows.map(r => ({
        category: r.category,
        order_type: r.order_type,
        total_orders: Number(r.total_orders),
        total_sales: Number(r.total_sales),
        total_tax: Number(r.total_tax),
        total_charges: Number(r.total_charges),
        avg_order: Number(r.avg_order),
      }))
    });
  } catch (err) { logger.error(err); res.status(500).json({ message: 'Server error' }); }
};
