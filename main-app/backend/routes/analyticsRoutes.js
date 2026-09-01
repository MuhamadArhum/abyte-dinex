const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/dashboard', analyticsController.getDashboardStats);
router.get('/sales-trend', analyticsController.getSalesTrend);
router.get('/category-breakdown', analyticsController.getCategoryBreakdown);
router.get('/customer-analytics', analyticsController.getCustomerAnalytics);
router.get('/payment-methods', analyticsController.getPaymentMethods);
router.get('/hourly-sales', analyticsController.getHourlySales);

module.exports = router;
