const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/deliveryController');
const { authenticate, requirePermission } = require('../middleware/auth');
const { requireModule } = require('../middleware/moduleGuard');

router.use(authenticate);
router.use(requireModule('sales.deliveries'));

router.get('/stats', ctrl.getStats);
router.get('/',      ctrl.getAll);
router.get('/:id',   ctrl.getById);
router.post('/',            requirePermission('sales.deliveries'), ctrl.create);
router.put('/:id',          requirePermission('sales.deliveries'), ctrl.update);
router.patch('/:id/status', requirePermission('sales.deliveries'), ctrl.updateStatus);
router.delete('/:id',       requirePermission('sales.deliveries'), ctrl.remove);

module.exports = router;
