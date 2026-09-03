const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');
const { authenticate, authorize, requirePermission } = require('../middleware/auth');

router.use(authenticate);
router.get('/settings',      authorize('Admin'), whatsappController.getSettings);
router.put('/settings',      authorize('Admin'), whatsappController.saveSettings);
router.post('/test',         authorize('Admin'), whatsappController.testConnection);
router.post('/send-invoice', requirePermission('sales.pos'), whatsappController.sendInvoice);

module.exports = router;
