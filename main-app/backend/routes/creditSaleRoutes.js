const express = require('express');
const router = express.Router();
const controller = require('../controllers/creditSaleController');
const { authenticate, requirePermission } = require('../middleware/auth');
const { requireModule } = require('../middleware/moduleGuard');

router.use(authenticate);
router.use(requireModule('sales.credit'));

router.get('/stats',                requirePermission('sales.credit'), controller.getStats);
router.get('/overdue',              requirePermission('sales.credit'), controller.getOverdue);
router.get('/customer/:id/balance', requirePermission('sales.credit'), controller.getCustomerBalance);
router.get('/',                     requirePermission('sales.credit'), controller.getAll);
router.get('/:id',                  requirePermission('sales.credit'), controller.getById);
router.post('/',             requirePermission('sales.credit'), controller.create);
router.post('/:id/payment', requirePermission('sales.credit'), controller.recordPayment);

module.exports = router;
