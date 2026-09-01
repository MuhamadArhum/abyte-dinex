const express = require('express');
const router = express.Router();
const controller = require('../controllers/salesReportController');
const { authenticate, requirePermission } = require('../middleware/auth');

router.use(authenticate);
router.use(requirePermission('sales.reports'));

router.get('/summary', controller.getSalesSummary);
router.get('/hourly', controller.getHourlySales);
router.get('/payment-breakdown', controller.getPaymentBreakdown);
router.get('/cashier-performance', controller.getCashierPerformance);
router.get('/daily-trend', controller.getDailyTrend);
router.get('/top-customers', controller.getTopCustomers);
router.get('/comparison', controller.getSalesComparison);
router.get('/category-breakdown', controller.getCategoryBreakdown);
router.get('/profit-margin', controller.getProfitMargin);
router.get('/discount-analysis', controller.getDiscountAnalysis);
router.get('/tax-report', controller.getTaxReport);
router.get('/returns', controller.getSalesReturns);
router.get('/shift-report', controller.getShiftReport);
router.get('/voided', controller.getVoidedSales);
router.get('/product-performance', controller.getProductPerformance);
router.get('/customer-history', controller.getCustomerHistory);
router.get('/credit-aging', controller.getCreditAging);
router.get('/cash-reconciliation', controller.getCashReconciliation);

module.exports = router;
