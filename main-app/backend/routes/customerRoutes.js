const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const { authenticate, requirePermission } = require('../middleware/auth');

router.use(authenticate);

router.get('/', customerController.getAll);
router.post('/', requirePermission('sales.customers'), customerController.create);
router.get('/:id', customerController.getById);
router.put('/:id', requirePermission('sales.customers'), customerController.update);
router.delete('/:id', requirePermission('sales.customers'), customerController.remove);
router.get('/:id/addresses', customerController.getAddresses);
router.post('/:id/addresses', requirePermission('sales.customers'), customerController.addAddress);

module.exports = router;
