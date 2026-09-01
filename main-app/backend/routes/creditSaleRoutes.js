const express = require('express');
const router = express.Router();
const controller = require('../controllers/creditSaleController');
const { authenticate, requirePermission } = require('../middleware/auth');
const { requireModule } = require('../middleware/moduleGuard');

router.use(authenticate);
router.use(requireModule('sales.credit'));

router.get('/stats', controller.getStats);
router.get('/overdue', controller.getOverdue);
router.get('/customer/:id/balance', controller.getCustomerBalance);
router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/',             requirePermission('sales.credit'), controller.create);
router.post('/:id/payment', requirePermission('sales.credit'), controller.recordPayment);

module.exports = router;
