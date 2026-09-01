const express = require('express');
const router = express.Router();
const controller = require('../controllers/inventoryReportController');
const { authenticate, requirePermission } = require('../middleware/auth');

router.use(authenticate);
router.use(requirePermission('inventory.reports'));

router.get('/summary', controller.getStockSummary);
router.get('/low-stock', controller.getLowStock);
router.get('/top-products', controller.getTopProducts);
router.get('/category-breakdown', controller.getCategoryBreakdown);
router.get('/slow-movers', controller.getSlowMovers);

// New inventory report endpoints
router.get('/items-ledger', controller.itemsLedger);
router.get('/item-wise-purchase', controller.itemWisePurchase);
router.get('/supplier-wise', controller.supplierWise);
router.get('/issuance-summary', controller.issuanceSummary);
router.get('/stock-reconciliation', controller.stockReconciliation);

router.get('/slow-moving',          controller.slowMovingStock);
router.get('/fast-moving',          controller.fastMovingItems);
router.get('/purchase-vs-issuance', controller.purchaseVsIssuance);
router.get('/opening-closing',      controller.openingClosingStock);
router.get('/reorder-alert',        controller.reorderAlert);
router.get('/category-wise-purchase', controller.categoryWisePurchase);
router.get('/rate-history',         controller.rateHistory);
router.get('/stock-valuation',      controller.getStockValuation);
router.get('/purchase-returns',     controller.getPurchaseReturns);
router.get('/stock-transfers',      controller.getStockTransfers);
router.get('/dead-stock',           controller.getDeadStock);
router.get('/stock-adjustments',    controller.getStockAdjustments);
router.get('/supplier-performance', controller.getSupplierPerformance);

module.exports = router;
