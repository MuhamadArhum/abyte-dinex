// =============================================================
// backupController.js - Database Backup & Restore Controller
// Creates, lists, downloads, restores, and deletes database backups
// via backupService. Admin only.
// Used by: /api/backup routes
// =============================================================

const logger = require('../config/logger');
const path = require('path');
const fs = require('fs');
const { query } = require('../config/database');
const { logAction } = require('../services/auditService');
const backupService = require('../services/backupService');

exports.createBackup = async (req, res) => {
  try {
    const result = await backupService.createBackup(req.user.user_id, 'manual');

    await logAction(req.user.user_id, req.user.name, 'BACKUP_CREATED', 'backup', null,
      { filename: result.filename }, req.ip);

    // Upload to Google Drive in background (single-tenant)
    const gdriveService = require('../services/googleDriveService');
    gdriveService.getTenantDriveSettings(null).then(async (driveSettings) => {
      if (!driveSettings) return;
      try {
        const fileId = await gdriveService.uploadBackupWithSettings(result.filepath, result.filename, driveSettings);
        logger.info('[GDrive] Manual backup uploaded', { fileId, filename: result.filename });
        await gdriveService.recordTenantUploadStatus(null, result.filename, 'success');
      } catch (driveErr) {
        logger.error('[GDrive] Manual backup upload failed', { error: driveErr.message });
        await gdriveService.recordTenantUploadStatus(null, result.filename, `failed: ${driveErr.message.slice(0,80)}`);
      }
    }).catch(err => logger.error('[GDrive] Drive settings fetch failed', { error: err.message }));

    res.status(201).json({ message: 'Backup created successfully', filename: result.filename });
  } catch (error) {
    logger.error('Create backup error:', error);
    res.status(500).json({ message: error.message || 'Failed to create backup' });
  }
};

exports.listBackups = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const countResult = await query('SELECT COUNT(*) as total FROM backups');
    const total = Number(countResult[0].total);

    const backups = await query(
      'SELECT b.*, COALESCE(u.name, "System") as created_by_name FROM backups b LEFT JOIN users u ON b.created_by = u.user_id ORDER BY b.created_at DESC LIMIT ? OFFSET ?',
      [parseInt(limit), offset]
    );
    const sanitized = backups.map(b => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v])));
    
    res.json({
      data: sanitized,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error('List backups error:', error);
    res.status(500).json({ message: 'Failed to list backups' });
  }
};

exports.restoreBackup = async (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) {
      return res.status(400).json({ message: 'Filename is required' });
    }

    // Create a backup before restoring
    try {
      await backupService.createBackup(req.user.user_id, 'manual');
    } catch (preBackupErr) {
      logger.error('Pre-restore backup failed:', preBackupErr);
    }

    await backupService.restoreBackup(filename);

    await logAction(req.user.user_id, req.user.name, 'BACKUP_RESTORED', 'backup', null,
      { filename }, req.ip);

    res.json({ message: 'Backup restored successfully' });
  } catch (error) {
    logger.error('Restore backup error:', error);
    res.status(500).json({ message: error.message || 'Failed to restore backup' });
  }
};

exports.downloadBackup = async (req, res) => {
  try {
    const { filename } = req.params;

    // Validate filename format first
    if (!/^[\w\-]+\.sql$/.test(filename)) {
      return res.status(400).json({ message: 'Invalid filename' });
    }

    // Resolve and verify the final path stays inside BACKUP_DIR
    const backupDir = path.resolve(backupService.getBackupDir());
    const filepath  = path.resolve(path.join(backupDir, filename));
    if (!filepath.startsWith(backupDir + path.sep) && filepath !== backupDir) {
      return res.status(400).json({ message: 'Invalid filename' });
    }

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ message: 'Backup file not found' });
    }

    res.download(filepath, filename, (err) => {
      if (err && !res.headersSent) {
        logger.error('Download backup stream error:', { error: err.message });
        res.status(500).json({ message: 'Download failed' });
      }
    });
  } catch (error) {
    logger.error('Download backup error:', error);
    res.status(500).json({ message: 'Failed to download backup' });
  }
};

exports.deleteBackup = async (req, res) => {
  try {
    const { filename } = req.params;

    await backupService.deleteBackupFile(filename);
    await query('DELETE FROM backups WHERE filename = ?', [filename]);

    await logAction(req.user.user_id, req.user.name, 'BACKUP_DELETED', 'backup', null,
      { filename }, req.ip);

    res.json({ message: 'Backup deleted' });
  } catch (error) {
    logger.error('Delete backup error:', error);
    res.status(500).json({ message: error.message || 'Failed to delete backup' });
  }
};

// GET /api/backup/schedule — return current backup schedule
exports.getSchedule = async (req, res) => {
  try {
    const rows = await query(`SELECT backup_schedule_enabled, backup_schedule_time FROM store_settings WHERE setting_id = 1`);
    if (!rows.length) return res.json({ backup_schedule_enabled: true, backup_schedule_time: '02:00' });

    res.json({
      backup_schedule_enabled: !!rows[0].backup_schedule_enabled,
      backup_schedule_time:    rows[0].backup_schedule_time || '02:00',
    });
  } catch (err) {
    logger.error('getSchedule error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/backup/drive-settings
exports.getDriveSettings = async (req, res) => {
  try {
    const gdriveService = require('../services/googleDriveService');
    const settings = await gdriveService.getSettings();
    // Mask the JSON so private key isn't sent to frontend — just indicate if set
    const hasJson = !!(settings.gdrive_service_account_json && settings.gdrive_service_account_json.trim());
    res.json({ ...settings, gdrive_service_account_json: hasJson ? '__SET__' : '' });
  } catch (err) {
    logger.error('getDriveSettings error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/backup/drive-settings
exports.saveDriveSettings = async (req, res) => {
  try {
    const { gdrive_enabled, gdrive_folder_id, gdrive_service_account_json } = req.body;
    const gdriveService = require('../services/googleDriveService');

    // If frontend sends '__SET__' it means "don't change the existing JSON"
    const currentSettings = await gdriveService.getSettings();
    const jsonToSave = gdrive_service_account_json === '__SET__'
      ? currentSettings.gdrive_service_account_json
      : gdrive_service_account_json;

    await gdriveService.saveSettings({ gdrive_enabled, gdrive_folder_id, gdrive_service_account_json: jsonToSave });

    await logAction(req.user.user_id, req.user.name, 'GDRIVE_SETTINGS_UPDATED', 'store_settings', 1,
      { gdrive_enabled, gdrive_folder_id }, req.ip);

    res.json({ message: 'Google Drive settings saved' });
  } catch (err) {
    logger.error('saveDriveSettings error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
};

// POST /api/backup/test-drive
exports.testDriveConnection = async (req, res) => {
  try {
    const { gdrive_service_account_json, gdrive_folder_id } = req.body;
    if (!gdrive_service_account_json || !gdrive_folder_id) {
      return res.status(400).json({ message: 'Service account JSON and folder ID are required' });
    }

    const gdriveService = require('../services/googleDriveService');
    let jsonToTest = gdrive_service_account_json;
    if (gdrive_service_account_json === '__SET__') {
      const s = await gdriveService.getSettings();
      jsonToTest = s.gdrive_service_account_json;
    }

    const result = await gdriveService.testConnection(jsonToTest, gdrive_folder_id);
    res.json({ message: `Connected! Folder: "${result.folder_name}"`, folder_name: result.folder_name });
  } catch (err) {
    logger.error('testDriveConnection error:', err);
    res.status(400).json({ message: `Connection failed: ${err.message}` });
  }
};

// PUT /api/backup/schedule — save and apply new backup schedule
exports.saveSchedule = async (req, res) => {
  try {
    const { backup_schedule_enabled, backup_schedule_time } = req.body;

    // Validate time format HH:MM
    if (!backup_schedule_time || !/^\d{2}:\d{2}$/.test(backup_schedule_time)) {
      return res.status(400).json({ message: 'Invalid time format. Use HH:MM (e.g. 02:00)' });
    }

    const [hh, mm] = backup_schedule_time.split(':').map(Number);
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) {
      return res.status(400).json({ message: 'Invalid time. Hours 0-23, Minutes 0-59' });
    }

    await query(
      `UPDATE store_settings SET backup_schedule_enabled = ?, backup_schedule_time = ? WHERE setting_id = 1`,
      [backup_schedule_enabled ? 1 : 0, backup_schedule_time]
    );

    // Reschedule the cron job dynamically
    const { rescheduleBackup } = require('../services/backupScheduler');
    rescheduleBackup(backup_schedule_enabled, hh, mm);

    await logAction(req.user.user_id, req.user.name, 'BACKUP_SCHEDULE_UPDATED', 'store_settings', 1,
      { backup_schedule_enabled, backup_schedule_time }, req.ip);

    res.json({ message: `Backup schedule updated — daily at ${backup_schedule_time}` });
  } catch (err) {
    logger.error('saveSchedule error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
