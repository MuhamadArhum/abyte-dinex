const express = require('express');
const router = express.Router();
const emailController = require('../controllers/emailController');
const { authenticate, authorize, requirePermission } = require('../middleware/auth');

router.use(authenticate);

router.get('/status', emailController.getStatus);
router.post('/test-connection', authorize('Admin'), emailController.testConnection);
router.post('/send-test', authorize('Admin'), emailController.sendTest);
router.post('/low-stock-alert', requirePermission('inventory'), emailController.sendLowStockAlert);
router.post('/send-invoice',   requirePermission('sales'),     emailController.sendInvoice);

module.exports = router;
