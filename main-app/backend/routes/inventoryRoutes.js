const express = require('express');
const router  = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { authenticate, requirePermission } = require('../middleware/auth');
const { requireModule } = require('../middleware/moduleGuard');

router.use(authenticate);
router.use(requireModule('inventory.products'));

router.get('/low-stock', inventoryController.getLowStock);
router.get('/stats',     inventoryController.getStats);
router.get('/',          inventoryController.getAll);
router.put('/:id', requirePermission('inventory.stock'), inventoryController.updateStock);

module.exports = router;
