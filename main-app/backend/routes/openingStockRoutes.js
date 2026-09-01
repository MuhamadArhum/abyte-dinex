const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/openingStockController');
const { authenticate, requirePermission } = require('../middleware/auth');
const { requireModule } = require('../middleware/moduleGuard');

router.use(authenticate);
router.use(requireModule('inventory.products'));
router.use(requirePermission('inventory.stock'));

router.get('/',        ctrl.getAll);
router.post('/',       ctrl.save);
router.get('/history', ctrl.getHistory);

module.exports = router;
