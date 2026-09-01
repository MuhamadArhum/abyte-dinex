const express = require('express');
const router = express.Router();
const controller = require('../controllers/priceRuleController');
const { authenticate, requirePermission } = require('../middleware/auth');
const { requireModule } = require('../middleware/moduleGuard');

router.use(authenticate);
router.use(requireModule('sales.pricerules'));

router.get('/stats', controller.getStats);
router.post('/evaluate', controller.evaluate);
router.get('/:id', controller.getById);
router.get('/', controller.getAll);
router.post('/',   requirePermission('sales.pricerules'), controller.create);
router.put('/:id', requirePermission('sales.pricerules'), controller.update);
router.delete('/:id', requirePermission('sales.pricerules'), controller.delete);

module.exports = router;
