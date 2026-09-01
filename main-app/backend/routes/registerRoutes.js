const express = require('express');
const router = express.Router();
const registerController = require('../controllers/registerController');
const { authenticate, requirePermission } = require('../middleware/auth');

router.use(authenticate);

router.get('/current', registerController.getCurrentRegister);
router.post('/open',          requirePermission('sales.register'), registerController.openRegister);
router.post('/close',         requirePermission('sales.pos'),      registerController.closeRegister);
router.post('/force-reset',   requirePermission('sales.pos'),      registerController.forceReset);
router.post('/cash-movement', requirePermission('sales.register'), registerController.addCashMovement);
router.get('/history', requirePermission('sales.pos'), registerController.getHistory);
router.get('/:id', requirePermission('sales.pos'), registerController.getById);

module.exports = router;
