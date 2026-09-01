const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const { authenticate, requirePermission } = require('../middleware/auth');
const { requireModule } = require('../middleware/moduleGuard');

router.use(authenticate);
router.use(requireModule('sales.pos'));

router.post('/', requirePermission('sales.pos'), salesController.createSale);
router.get('/pending', salesController.getPending);
router.get('/assignable-users', salesController.getAssignableUsers);
router.put('/:id/assign-user', requirePermission('sales.pos'), salesController.assignUser);
router.put('/:id/complete', requirePermission('sales.pos'), salesController.completeSale);
router.patch('/:id/kot-printed', requirePermission('sales.pos'), salesController.markKotPrinted);
router.put('/:id/items', requirePermission('sales.pos'), salesController.updateSaleItems);
router.put('/:id/table', requirePermission('sales.pos'), salesController.swapTable);
router.post('/:id/refund', requirePermission('sales.returns'), salesController.refundSale);
router.post('/:id/sync-tax', requirePermission('sales.pos'), salesController.syncTax);
router.delete('/:id', requirePermission('sales.orders'), salesController.deleteSale);
router.get('/today', salesController.getToday);
router.get('/', salesController.getAll);
router.get('/:id', salesController.getById);

module.exports = router;
