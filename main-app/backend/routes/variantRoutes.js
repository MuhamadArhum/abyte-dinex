const express = require('express');
const router = express.Router();
const variantController = require('../controllers/variantController');
const { authenticate, requirePermission } = require('../middleware/auth');
const { requireModule } = require('../middleware/moduleGuard');

router.get('/types', authenticate, variantController.getVariantTypes);
router.post('/types', authenticate, requirePermission('inventory.products'), variantController.createVariantType);

router.get('/types/:variant_type_id/values', authenticate, variantController.getVariantValues);
router.post('/values', authenticate, requirePermission('inventory.products'), variantController.createVariantValue);

router.get('/product/:product_id', authenticate, variantController.getProductVariants);
router.get('/:variant_id', authenticate, variantController.getVariantById);

router.post('/', authenticate, requirePermission('inventory.products'), variantController.createProductVariant);
router.put('/:variant_id', authenticate, requirePermission('inventory.products'), variantController.updateProductVariant);
router.delete('/:variant_id', authenticate, requirePermission('inventory.products'), variantController.deleteProductVariant);
router.post('/:variant_id/stock/adjust', authenticate, requirePermission('inventory.products'), variantController.adjustVariantStock);

module.exports = router;
