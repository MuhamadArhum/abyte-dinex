const express = require('express');
const router = express.Router();
const backupController = require('../controllers/backupController');
const { authenticate, requirePermission } = require('../middleware/auth');
const { validateBackupFilename, validateBackupFilenameParam, handleValidation } = require('../middleware/validate');

router.use(authenticate);
router.use(requirePermission('system.backup'));

router.post('/', backupController.createBackup);
router.get('/', backupController.listBackups);
router.get('/schedule', backupController.getSchedule);
router.put('/schedule', backupController.saveSchedule);
router.get('/drive-settings', backupController.getDriveSettings);
router.put('/drive-settings', backupController.saveDriveSettings);
router.post('/test-drive', backupController.testDriveConnection);
router.post('/restore', validateBackupFilename, handleValidation, backupController.restoreBackup);
router.get('/download/:filename', validateBackupFilenameParam, handleValidation, backupController.downloadBackup);
router.delete('/:filename', validateBackupFilenameParam, handleValidation, backupController.deleteBackup);

module.exports = router;
