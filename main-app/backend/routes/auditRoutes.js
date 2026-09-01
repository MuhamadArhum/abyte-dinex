const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { authenticate, requirePermission } = require('../middleware/auth');

router.use(authenticate);
router.use(requirePermission('system.audit'));

router.get('/actions', auditController.getActions);
router.get('/export', auditController.exportLogs);
router.get('/', auditController.getLogs);
router.get('/:id', auditController.getLogById);

module.exports = router;
