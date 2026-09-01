// googleDriveService.js — Google Drive upload via Service Account
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');
const logger = require('../config/logger');
const { encrypt, decrypt } = require('./cryptoService');

const SETTING_ID = 1;

async function ensureColumns() {
  const alters = [
    `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS gdrive_enabled TINYINT(1) DEFAULT 0`,
    `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS gdrive_folder_id VARCHAR(255) DEFAULT NULL`,
    `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS gdrive_service_account_json TEXT DEFAULT NULL`,
    `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS gdrive_last_upload_at TIMESTAMP NULL DEFAULT NULL`,
    `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS gdrive_last_upload_file VARCHAR(255) DEFAULT NULL`,
    `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS gdrive_last_upload_status VARCHAR(50) DEFAULT NULL`,
  ];
  for (const sql of alters) {
    await query(sql).catch(() => {});
  }
}

async function getSettings() {
  await ensureColumns();
  const rows = await query(
    `SELECT gdrive_enabled, gdrive_folder_id, gdrive_service_account_json,
            gdrive_last_upload_at, gdrive_last_upload_file, gdrive_last_upload_status
     FROM store_settings WHERE setting_id = ?`,
    [SETTING_ID]
  );
  if (!rows.length) {
    return { gdrive_enabled: false, gdrive_folder_id: '', gdrive_service_account_json: '', gdrive_last_upload_at: null, gdrive_last_upload_file: null, gdrive_last_upload_status: null };
  }
  const r = rows[0];
  return {
    gdrive_enabled: !!r.gdrive_enabled,
    gdrive_folder_id: r.gdrive_folder_id || '',
    gdrive_service_account_json: decrypt(r.gdrive_service_account_json || ''),
    gdrive_last_upload_at: r.gdrive_last_upload_at,
    gdrive_last_upload_file: r.gdrive_last_upload_file,
    gdrive_last_upload_status: r.gdrive_last_upload_status,
  };
}

async function saveSettings({ gdrive_enabled, gdrive_folder_id, gdrive_service_account_json }) {
  await ensureColumns();

  if (gdrive_service_account_json && gdrive_service_account_json.trim()) {
    try {
      JSON.parse(gdrive_service_account_json);
    } catch {
      throw new Error('Invalid service account JSON');
    }
  }

  const encryptedJson = gdrive_service_account_json
    ? encrypt(gdrive_service_account_json)
    : null;

  await query(
    `UPDATE store_settings SET gdrive_enabled = ?, gdrive_folder_id = ?, gdrive_service_account_json = ? WHERE setting_id = ?`,
    [gdrive_enabled ? 1 : 0, gdrive_folder_id || null, encryptedJson, SETTING_ID]
  );
}

function buildDriveClient(serviceAccountJson) {
  const credentials = typeof serviceAccountJson === 'string'
    ? JSON.parse(serviceAccountJson)
    : serviceAccountJson;

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
}

async function testConnection(serviceAccountJson, folderId) {
  const drive = buildDriveClient(serviceAccountJson);
  // Try to get folder metadata — proves auth + folder access
  const res = await drive.files.get({ fileId: folderId, fields: 'id,name' });
  return { folder_id: res.data.id, folder_name: res.data.name };
}

// Upload using settings object directly (for per-tenant scheduler use)
async function uploadBackupWithSettings(filePath, filename, settings) {
  if (!settings.gdrive_enabled) return null;
  if (!settings.gdrive_service_account_json || !settings.gdrive_folder_id) return null;

  const drive = buildDriveClient(settings.gdrive_service_account_json);

  const res = await drive.files.create({
    requestBody: { name: filename, parents: [settings.gdrive_folder_id] },
    media: { mimeType: 'application/octet-stream', body: fs.createReadStream(filePath) },
    fields: 'id,name',
  });

  return res.data.id;
}

// Upload for current tenant (reads settings from tenant's store_settings)
async function uploadBackup(filePath, filename) {
  const settings = await getSettings();
  if (!settings.gdrive_enabled) return null;
  if (!settings.gdrive_service_account_json || !settings.gdrive_folder_id) return null;

  logger.info('[GDrive] Uploading backup to Google Drive', { filename });

  const fileId = await uploadBackupWithSettings(filePath, filename, settings);
  logger.info('[GDrive] Upload complete', { filename, fileId });

  await query(
    `UPDATE store_settings SET gdrive_last_upload_at = NOW(), gdrive_last_upload_file = ?, gdrive_last_upload_status = 'success' WHERE setting_id = ?`,
    [filename, SETTING_ID]
  ).catch(() => {});

  return fileId;
}

async function recordUploadFailure(filename, errMsg) {
  await query(
    `UPDATE store_settings SET gdrive_last_upload_at = NOW(), gdrive_last_upload_file = ?, gdrive_last_upload_status = ? WHERE setting_id = ?`,
    [filename, `failed: ${errMsg.slice(0, 100)}`, SETTING_ID]
  ).catch(() => {});
}

// Get Drive settings for a specific tenant DB (for scheduler)
async function getTenantDriveSettings(tenantDbName) {
  const { queryDb } = require('../config/database');
  try {
    const rows = await queryDb(tenantDbName,
      `SELECT gdrive_enabled, gdrive_folder_id, gdrive_service_account_json FROM store_settings WHERE setting_id = 1`
    );
    if (!rows.length) return null;
    const r = rows[0];
    if (!r.gdrive_enabled || !r.gdrive_folder_id || !r.gdrive_service_account_json) return null;
    return { gdrive_enabled: !!r.gdrive_enabled, gdrive_folder_id: r.gdrive_folder_id, gdrive_service_account_json: decrypt(r.gdrive_service_account_json) };
  } catch (_e) {
    return null;
  }
}

// Update Drive upload status for a specific tenant DB
async function recordTenantUploadStatus(tenantDbName, filename, status) {
  const { queryDb } = require('../config/database');
  await queryDb(tenantDbName,
    `UPDATE store_settings SET gdrive_last_upload_at = NOW(), gdrive_last_upload_file = ?, gdrive_last_upload_status = ? WHERE setting_id = 1`,
    [filename, status]
  ).catch(() => {});
}

module.exports = {
  getSettings, saveSettings, testConnection,
  uploadBackup, uploadBackupWithSettings, recordUploadFailure,
  getTenantDriveSettings, recordTenantUploadStatus,
};
