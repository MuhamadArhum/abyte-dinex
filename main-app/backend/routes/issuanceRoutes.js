const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/issuanceController');
const { authenticate, requirePermission } = require('../middleware/auth');
const { requireModule } = require('../middleware/moduleGuard');

router.use(authenticate);
router.use(requireModule('inventory.adjustments'));

// Stock Issues
router.get('/issues',            ctrl.getIssues);
router.get('/issues/:id',        ctrl.getIssueById);
router.post('/issues',           requirePermission('inventory.stock'), ctrl.createIssue);
router.put('/issues/:id',        requirePermission('inventory.stock'), ctrl.updateIssue);
router.delete('/issues/:id',     requirePermission('inventory.stock'), ctrl.deleteIssue);

// Stock Issue Returns
router.get('/returns',           ctrl.getReturns);
router.get('/returns/:id',       ctrl.getReturnById);
router.post('/returns',          requirePermission('inventory.stock'), ctrl.createReturn);

// Raw Sales
router.get('/raw-sales',         ctrl.getRawSales);
router.get('/raw-sales/:id',     ctrl.getRawSaleById);
router.post('/raw-sales',        requirePermission('inventory.stock'), ctrl.createRawSale);
router.delete('/raw-sales/:id',  requirePermission('inventory.stock'), ctrl.deleteRawSale);

module.exports = router;
