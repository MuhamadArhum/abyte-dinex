const express = require('express');
const router = express.Router();
const returnController = require('../controllers/returnController');
const { authenticate, requirePermission } = require('../middleware/auth');
const { requireModule } = require('../middleware/moduleGuard');

router.use(authenticate);
router.use(requireModule('sales.returns'));

router.get('/sale/:saleId', returnController.getSaleForReturn);
router.post('/', requirePermission('sales.returns'), returnController.createReturn);
router.get('/', returnController.getReturns);
router.get('/:id', returnController.getReturnById);

module.exports = router;
