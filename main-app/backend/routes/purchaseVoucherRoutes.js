const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/purchaseVoucherController');
const { authenticate, requirePermission } = require('../middleware/auth');
const { requireModule } = require('../middleware/moduleGuard');

router.use(authenticate);
router.use(requireModule('inventory.purchases'));
router.get('/',                         ctrl.getAll);
router.get('/po-items/:po_id',          ctrl.getPOItems);
router.get('/:id',                      ctrl.getById);
router.post('/',                        requirePermission('inventory.purchases'), ctrl.create);
router.put('/:id',                      requirePermission('inventory.purchases'), ctrl.update);
router.delete('/:id',                   requirePermission('inventory.purchases'), ctrl.remove);

module.exports = router;
