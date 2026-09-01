const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const { authenticate, requirePermission } = require('../middleware/auth');
const { requireModule } = require('../middleware/moduleGuard');

router.use(authenticate);
router.use(requireModule('inventory.suppliers'));

router.get('/', supplierController.getAll);
router.get('/:id', supplierController.getById);
router.post('/', requirePermission('inventory.purchases'), supplierController.create);
router.put('/:id', requirePermission('inventory.purchases'), supplierController.update);
router.delete('/:id', requirePermission('inventory.purchases'), supplierController.delete);

router.post('/:supplier_id/payments', requirePermission('inventory.purchases'), supplierController.addPayment);
router.get('/:supplier_id/payments', supplierController.getPayments);

module.exports = router;
