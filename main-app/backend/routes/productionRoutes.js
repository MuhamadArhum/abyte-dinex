const express = require('express');
const router = express.Router();
const productionController = require('../controllers/productionController');
const { authenticate, requirePermission } = require('../middleware/auth');
const { requireModule } = require('../middleware/moduleGuard');

router.use(authenticate);
router.use(requireModule('inventory.products'));

router.get('/', productionController.getAll);
router.get('/:id', productionController.getById);
router.post('/', requirePermission('inventory.products'), productionController.create);

module.exports = router;
