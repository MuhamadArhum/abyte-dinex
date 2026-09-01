const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/purchaseReturnController');
const { authenticate, requirePermission } = require('../middleware/auth');
const { requireModule } = require('../middleware/moduleGuard');

router.use(authenticate);
router.use(requireModule('inventory.purchases'));
router.get('/',         ctrl.getAll);
router.get('/:id',      ctrl.getById);
router.post('/',        requirePermission('inventory.purchases'), ctrl.create);
router.delete('/:id',   requirePermission('inventory.purchases'), ctrl.remove);

module.exports = router;
