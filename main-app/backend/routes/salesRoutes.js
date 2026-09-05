const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const { authenticate, authorize, requirePermission } = require('../middleware/auth');
const { requireModule } = require('../middleware/moduleGuard');

router.use(authenticate);
router.use(requireModule('sales.pos'));

router.post('/', requirePermission('sales.pos'), salesController.createSale);
router.get('/pending', requirePermission('sales.pos'), salesController.getPending);
router.get('/assignable-users', requirePermission('sales.pos'), salesController.getAssignableUsers);
router.put('/:id/assign-user', requirePermission('sales.pos'), salesController.assignUser);
router.put('/:id/complete', requirePermission('sales.pos'), salesController.completeSale);
router.patch('/:id/kot-printed', requirePermission('sales.pos'), salesController.markKotPrinted);
router.put('/:id/items', requirePermission('sales.pos'), salesController.updateSaleItems);
router.put('/:id/table', requirePermission('sales.pos'), salesController.swapTable);
router.post('/:id/refund', requirePermission('sales.returns'), salesController.refundSale);
router.post('/:id/sync-tax', requirePermission('sales.pos'), salesController.syncTax);
router.delete('/:id', authorize('Admin'), salesController.deleteSale);
router.get('/today', requirePermission('sales.pos'), salesController.getToday);
router.get('/', requirePermission('sales.orders'), salesController.getAll);
router.get('/:id', requirePermission('sales.pos'), salesController.getById);

module.exports = router;
