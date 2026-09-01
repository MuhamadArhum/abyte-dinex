// =============================================================
// reportRoutes.js - Report Routes
// Defines the API endpoints for generating business reports.
// All routes require authentication AND Admin or Manager role.
// Cashiers cannot access reports.
// Mounted at: /api/reports (see server.js)
//
// Endpoints:
//   GET /api/reports/daily       - Today's sales summary
//   GET /api/reports/date-range  - Sales summary for a date range (?start_date, ?end_date)
//   GET /api/reports/product     - Product-wise sales breakdown (optional date range)
//   GET /api/reports/inventory   - Current inventory snapshot with stock analysis
// =============================================================

const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticate, requirePermission } = require('../middleware/auth');

router.use(authenticate);
router.use(requirePermission('sales'));

router.get('/dashboard', reportController.dashboardSummary);  // Combined dashboard stats (1 query)
router.get('/daily', reportController.dailyReport);           // Today's sales summary
router.get('/date-range', reportController.dateRangeReport);  // Date range sales report
router.get('/product', reportController.productReport);       // Product performance report
router.get('/inventory', reportController.inventoryReport);   // Inventory status report

module.exports = router;
