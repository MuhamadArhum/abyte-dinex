const express = require('express');
const router = express.Router();
const bundleController = require('../controllers/bundleController');
const { authenticate, requirePermission } = require('../middleware/auth');
const { requireModule } = require('../middleware/moduleGuard');

router.get('/', authenticate, bundleController.getAllBundles);
router.post('/', authenticate, requirePermission('inventory.products'), bundleController.createBundle);
router.post('/detect', authenticate, bundleController.detectBundles);
router.get('/:bundle_id', authenticate, bundleController.getBundleById);
router.put('/:bundle_id', authenticate, requirePermission('inventory.products'), bundleController.updateBundle);
router.delete('/:bundle_id', authenticate, requirePermission('inventory.products'), bundleController.deleteBundle);

module.exports = router;
