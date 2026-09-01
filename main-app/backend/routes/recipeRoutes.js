const express = require('express');
const router = express.Router();
const recipeController = require('../controllers/recipeController');
const { authenticate, requirePermission } = require('../middleware/auth');
const { requireModule } = require('../middleware/moduleGuard');

router.use(authenticate);
router.use(requireModule('inventory.products'));

router.get('/', recipeController.getAll);
router.get('/:id', recipeController.getById);
router.post('/', requirePermission('inventory.products'), recipeController.create);
router.put('/:id', requirePermission('inventory.products'), recipeController.update);
router.delete('/:id', requirePermission('inventory.products'), recipeController.remove);

module.exports = router;
