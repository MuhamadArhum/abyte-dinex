const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticate, requirePermission } = require('../middleware/auth');
const { requireModule } = require('../middleware/moduleGuard');

router.use(authenticate);
router.use(requireModule('inventory.products'));

router.get('/categories', productController.getCategories);
router.post('/categories', requirePermission('inventory.categories'), productController.createCategory);
router.put('/categories/:id', requirePermission('inventory.categories'), productController.updateCategory);
router.delete('/categories/:id', requirePermission('inventory.categories'), productController.deleteCategory);

router.get('/', productController.getAll);
router.get('/:id', productController.getById);
router.post('/', requirePermission('inventory.products'), productController.create);
router.post('/:id/generate-barcode', requirePermission('inventory.products'), productController.generateBarcode);
router.put('/:id', requirePermission('inventory.products'), productController.update);
router.delete('/:id', requirePermission('inventory.products'), productController.remove);

module.exports = router;
