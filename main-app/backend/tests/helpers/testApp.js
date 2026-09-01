/**
 * Test app factory — builds the Express app with all routes mounted,
 * WITHOUT calling app.listen() or starting the cron scheduler.
 *
 * Caller must mock heavy services (DB, JWT, logger) before calling this.
 */
const express    = require('express');
const rateLimit  = require('express-rate-limit');

// Unlimited rate limiter for tests so no 429s
const noLimit = rateLimit({ windowMs: 1000, max: 0, skip: () => true });

function buildTestApp() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Disable rate limiting in tests
  app.use(noLimit);

  // Ping
  app.get('/api/ping', (_req, res) => res.json({ ok: true }));

  // Auth
  app.use('/api/auth',              require('../../routes/authRoutes'));
  // Core
  app.use('/api/users',             require('../../routes/userRoutes'));
  app.use('/api/customers',         require('../../routes/customerRoutes'));
  app.use('/api/settings',          require('../../routes/settingsRoutes'));
  app.use('/api/permissions',       require('../../routes/permissionRoutes'));
  // Sales
  app.use('/api/sales',             require('../../routes/salesRoutes'));
  app.use('/api/register',          require('../../routes/registerRoutes'));
  app.use('/api/returns',           require('../../routes/returnRoutes'));
  app.use('/api/credit-sales',      require('../../routes/creditSaleRoutes'));
  // Inventory
  app.use('/api/products',          require('../../routes/productRoutes'));
  app.use('/api/inventory',         require('../../routes/inventoryRoutes'));
  app.use('/api/suppliers',         require('../../routes/supplierRoutes'));
  app.use('/api/stock-adjustments', require('../../routes/stockAdjustmentRoutes'));
  // HR
  app.use('/api/staff',             require('../../routes/staffRoutes'));
  // Restaurant
  app.use('/api/restaurant/tables', require('../../routes/restaurantRoutes'));

  // Global error handler
  app.use((err, req, res, _next) => {
    res.status(500).json({ message: err.message || 'Internal server error' });
  });

  return app;
}

module.exports = { buildTestApp };
