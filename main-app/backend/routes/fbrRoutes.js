const express = require('express');
const router = express.Router();
const fbrController = require('../controllers/fbrController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.get('/settings',      authorize('Admin'), fbrController.getSettings);
router.put('/settings',      authorize('Admin'), fbrController.saveSettings);
router.post('/test',         authorize('Admin'), fbrController.testConnection);
router.post('/post-invoice',                     fbrController.postInvoice);
router.post('/retry-failed', authorize('Admin'), fbrController.retryFailed);
router.get('/logs',          authorize('Admin'), fbrController.getLogs);

module.exports = router;
