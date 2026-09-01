const express = require('express');
const router = express.Router();
const poController = require('../controllers/purchaseOrderController');
const { authenticate, requirePermission } = require('../middleware/auth');
const { requireModule } = require('../middleware/moduleGuard');

router.use(authenticate);
router.use(requireModule('inventory.purchases'));

router.get('/stock-alerts/stats', poController.getAlertStats);
router.get('/stock-alerts', poController.getStockAlerts);
router.put('/stock-alerts/:id/resolve', requirePermission('inventory.purchases'), poController.resolveAlert);
router.get('/', poController.getAll);
router.get('/:id', poController.getById);
router.post('/', requirePermission('inventory.purchases'), poController.create);
router.put('/:id', requirePermission('inventory.purchases'), poController.update);
router.delete('/:id', requirePermission('inventory.purchases'), poController.remove);
router.post('/:id/receive', requirePermission('inventory.purchases'), poController.receive);
router.put('/:id/cancel', requirePermission('inventory.purchases'), poController.cancel);

module.exports = router;
