// backupScheduler.js — Single-tenant daily backup scheduler
// Phase 4: no master DB tenant loop. Backs up the single configured DB.

const cron   = require('node-cron');
const logger = require('../config/logger');

let currentTask = null;

async function runBackup() {
  const { query }       = require('../config/database');
  const backupService   = require('./backupService');
  const gdriveService   = require('./googleDriveService');

  try {
    const schedRows = await query(
      'SELECT backup_schedule_enabled FROM store_settings WHERE setting_id = 1'
    ).catch(() => []);

    const enabled = schedRows.length ? !!schedRows[0].backup_schedule_enabled : true;
    if (!enabled) {
      logger.info('[Backup] Scheduled backup disabled in settings');
      return;
    }

    const result = await backupService.createBackup(null, 'scheduled');
    logger.info('[Backup] Scheduled backup done', { filename: result.filename });

    const driveSettings = await gdriveService.getTenantDriveSettings(null);
    if (driveSettings) {
      try {
        const fileId = await gdriveService.uploadBackupWithSettings(result.filepath, result.filename, driveSettings);
        logger.info('[GDrive] Backup uploaded', { fileId, file: result.filename });
        await gdriveService.recordTenantUploadStatus(null, result.filename, 'success');
      } catch (driveErr) {
        logger.error('[GDrive] Upload failed', { error: driveErr.message });
        await gdriveService.recordTenantUploadStatus(null, result.filename, `failed: ${driveErr.message.slice(0, 80)}`);
      }
    }
  } catch (err) {
    logger.error('[Backup] Scheduled backup error', { error: err.message });
  }
}

function rescheduleBackup(enabled, hour, minute) {
  if (currentTask) {
    currentTask.stop();
    currentTask = null;
  }

  if (!enabled) {
    logger.info('[Backup] Scheduled backup disabled');
    return;
  }

  const cronExpr = `${minute} ${hour} * * *`;
  currentTask = cron.schedule(cronExpr, async () => {
    try { await runBackup(); }
    catch (err) { logger.error('[Backup] Scheduler error', { error: err.message }); }
  });

  logger.info(`[Backup] Scheduled daily backup at ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`);
}

module.exports = { rescheduleBackup };
