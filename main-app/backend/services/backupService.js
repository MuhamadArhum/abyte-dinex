const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { query, queryDb } = require('../config/database');
const logger = require('../config/logger');

const os = require('os');
function resolveBackupDir() {
  if (process.env.BACKUPS_DIR) return process.env.BACKUPS_DIR;
  const defaultDir = path.join(__dirname, '..', 'backups');
  try { fs.mkdirSync(defaultDir, { recursive: true }); return defaultDir; } catch {
    const fallback = path.join(os.homedir(), 'AppData', 'Roaming', 'AByte ERP Server', 'backups');
    fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}
const BACKUP_DIR = resolveBackupDir();

function getTimestamp() {
  const now = new Date();
  return now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') + '_' +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');
}

// Validate filename: only allow safe backup filenames (no path traversal)
function validateFilename(filename) {
  if (!filename || typeof filename !== 'string') throw new Error('Invalid filename');
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new Error('Invalid filename: path traversal detected');
  }
  if (!/^[\w\-\.]+\.sql$/.test(filename)) {
    throw new Error('Invalid filename: only alphanumeric, hyphens, underscores allowed');
  }
}

// Run a command safely using spawn (no shell interpolation)
function runCommand(executable, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(executable, args, { ...options, shell: false });
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${executable} exited with code ${code}: ${stderr.slice(0, 200)}`));
    });
    proc.on('error', reject);
  });
}

function getAllDatabaseNames() {
  return [process.env.DB_NAME || 'abyte_pos'];
}

async function createBackup(userId, type = 'manual') {
  const filename = `abyte_all_backup_${getTimestamp()}.sql`;
  const filepath = path.join(BACKUP_DIR, filename);

  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = process.env.DB_PORT || '3306';
  const dbUser = process.env.DB_USER || 'root';
  const dbPass = process.env.DB_PASSWORD || '';

  const allDbs = await getAllDatabaseNames();
  logger.info('[Backup] Dumping databases', { dbs: allDbs });

  // Use --databases flag so mysqldump includes CREATE DATABASE + USE statements
  const buildArgs = (dbs) => [
    `-h${dbHost}`,
    `-P${dbPort}`,
    `-u${dbUser}`,
    ...(dbPass ? [`-p${dbPass}`] : []),
    '--databases',
    ...dbs,
  ];

  const dumpPath = process.env.MARIADB_DUMP_PATH || 'mariadb-dump';

  const runDump = (executable) =>
    new Promise((resolve, reject) => {
      const args = buildArgs(allDbs);
      const proc = spawn(executable, args, { shell: false });
      const out = fs.createWriteStream(filepath);
      proc.stdout.pipe(out);
      let stderr = '';
      proc.stderr.on('data', (d) => { stderr += d.toString(); });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`${executable} failed (code ${code}): ${stderr.slice(0, 200)}`));
      });
      proc.on('error', reject);
    });

  try {
    try {
      await runDump(dumpPath);
    } catch {
      await runDump('mysqldump');
    }
    await finishBackup(filename, filepath, userId, type);
    return { filename, filepath };
  } catch (err) {
    try {
      await query(
        'INSERT INTO backups (filename, file_size, created_by, type, status) VALUES (?, 0, ?, ?, ?)',
        [filename, userId, type, 'failed']
      );
    } catch (dbErr) {
      logger.error('Failed to log backup failure', { error: dbErr.message });
    }
    throw new Error('Backup failed. Ensure mariadb-dump or mysqldump is available in PATH.');
  }
}

async function finishBackup(filename, filepath, userId, type) {
  const stats = await fsp.stat(filepath);
  await query(
    'INSERT INTO backups (filename, file_size, created_by, type, status) VALUES (?, ?, ?, ?, ?)',
    [filename, stats.size, userId, type, 'completed']
  );
}

async function restoreBackup(filename) {
  validateFilename(filename);

  const filepath = path.join(BACKUP_DIR, filename);
  if (!fs.existsSync(filepath)) throw new Error('Backup file not found');

  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = process.env.DB_PORT || '3306';
  const dbUser = process.env.DB_USER || 'root';
  const dbPass = process.env.DB_PASSWORD || '';
  const dbName = process.env.DB_NAME || 'abyte_pos';

  const buildArgs = () => [
    `-h${dbHost}`,
    `-P${dbPort}`,
    `-u${dbUser}`,
    ...(dbPass ? [`-p${dbPass}`] : []),
    dbName,
  ];

  const runRestore = (executable) =>
    new Promise((resolve, reject) => {
      const proc = spawn(executable, buildArgs(), { shell: false });
      const inp = fs.createReadStream(filepath);
      inp.pipe(proc.stdin);
      let stderr = '';
      proc.stderr.on('data', (d) => { stderr += d.toString(); });
      proc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`${executable} failed (code ${code}): ${stderr.slice(0, 200)}`));
      });
      proc.on('error', reject);
    });

  try {
    await runRestore('mysql');
  } catch {
    await runRestore('mariadb');
  }
}

async function listBackupFiles() {
  try {
    const files = await fsp.readdir(BACKUP_DIR);
    const entries = await Promise.all(
      files
        .filter(f => f.endsWith('.sql'))
        .map(async f => {
          const stats = await fsp.stat(path.join(BACKUP_DIR, f));
          return { filename: f, size: stats.size, created: stats.mtime };
        })
    );
    return entries.sort((a, b) => b.created - a.created);
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
}

async function deleteBackupFile(filename) {
  validateFilename(filename);
  const filepath = path.join(BACKUP_DIR, filename);
  await fsp.unlink(filepath).catch(e => {
    if (e.code !== 'ENOENT') throw e; // ignore "file not found"
  });
}

function getBackupDir() {
  return BACKUP_DIR;
}

// Create a backup for ONE tenant's DB only — used by per-tenant scheduler
async function createTenantBackup(tenantDbName, type = 'scheduled') {
  const safeName = tenantDbName.replace(/[^a-zA-Z0-9_]/g, '_');
  const filename = `backup_${safeName}_${getTimestamp()}.sql`;
  const filepath = path.join(BACKUP_DIR, filename);

  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = process.env.DB_PORT || '3306';
  const dbUser = process.env.DB_USER || 'root';
  const dbPass = process.env.DB_PASSWORD || '';

  const buildArgs = () => [
    `-h${dbHost}`, `-P${dbPort}`, `-u${dbUser}`,
    ...(dbPass ? [`-p${dbPass}`] : []),
    tenantDbName,
  ];

  const dumpPath = process.env.MARIADB_DUMP_PATH || 'mariadb-dump';

  const runDump = (executable) => new Promise((resolve, reject) => {
    const proc = spawn(executable, buildArgs(), { shell: false });
    const out = fs.createWriteStream(filepath);
    proc.stdout.pipe(out);
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${executable} failed (code ${code}): ${stderr.slice(0, 200)}`));
    });
    proc.on('error', reject);
  });

  try {
    try { await runDump(dumpPath); } catch { await runDump('mysqldump'); }

    const stats = await fsp.stat(filepath);
    await queryDb(tenantDbName,
      'INSERT INTO backups (filename, file_size, created_by, type, status) VALUES (?, ?, NULL, ?, ?)',
      [filename, stats.size, type, 'completed']
    );
    return { filename, filepath };
  } catch (err) {
    try {
      await queryDb(tenantDbName,
        'INSERT INTO backups (filename, file_size, created_by, type, status) VALUES (?, 0, NULL, ?, ?)',
        [filename, type, 'failed']
      );
    } catch (_e) { /* silent */ }
    throw err;
  }
}

// ── Retention policy ──────────────────────────────────────────
// Keep: all of last 7 days | 1 per week for 4 weeks | 1 per month for 3 months
// Deletes disk file AND removes DB record (if exists).
async function pruneOldBackups() {
  const now   = Date.now();
  const DAY   = 86400000;
  const WEEK  = 7 * DAY;
  const MONTH = 30 * DAY;

  let files;
  try {
    files = await listBackupFiles();
  } catch { return; }

  // Group by bucket: daily (0-7d), weekly (7-30d), monthly (30-90d), archive (>90d)
  const keep = new Set();

  // Always keep last 7 days
  files.filter(f => now - f.created.getTime() <= 7 * DAY).forEach(f => keep.add(f.filename));

  // Keep oldest file per calendar week in 7-28 day window
  const weekBuckets = new Map();
  files
    .filter(f => { const age = now - f.created.getTime(); return age > 7 * DAY && age <= 28 * DAY; })
    .forEach(f => {
      const weekKey = Math.floor(f.created.getTime() / WEEK);
      if (!weekBuckets.has(weekKey)) { weekBuckets.set(weekKey, f.filename); keep.add(f.filename); }
    });

  // Keep oldest file per calendar month in 28-90 day window
  const monthBuckets = new Map();
  files
    .filter(f => { const age = now - f.created.getTime(); return age > 28 * DAY && age <= 90 * DAY; })
    .forEach(f => {
      const monthKey = `${f.created.getFullYear()}-${f.created.getMonth()}`;
      if (!monthBuckets.has(monthKey)) { monthBuckets.set(monthKey, f.filename); keep.add(f.filename); }
    });

  // Delete everything else (>90 days or not in keep set)
  const toDelete = files.filter(f => !keep.has(f.filename));
  for (const f of toDelete) {
    await deleteBackupFile(f.filename).catch(() => {});
    logger.info('[Backup] Pruned old backup', { filename: f.filename, ageDays: Math.floor((now - f.created.getTime()) / DAY) });
  }
  if (toDelete.length) logger.info(`[Backup] Retention sweep complete — removed ${toDelete.length} old backups`);
}

// ── Backup integrity check ────────────────────────────────────
// Reads the latest backup file and verifies it contains expected SQL markers.
async function verifyLastBackup() {
  const files = await listBackupFiles();
  if (!files.length) return { ok: false, reason: 'No backups found' };

  const latest = files[0];
  const filepath = path.join(BACKUP_DIR, latest.filename);

  // Stream just the first 8KB to check SQL headers
  const chunk = await new Promise((resolve, reject) => {
    const bufs = [];
    let total = 0;
    const stream = fs.createReadStream(filepath, { end: 8192 });
    stream.on('data', d => { bufs.push(d); total += d.length; });
    stream.on('end', () => resolve(Buffer.concat(bufs)));
    stream.on('error', reject);
  });

  const head = chunk.toString('utf8');
  const hasMariaDb = head.includes('MariaDB dump') || head.includes('MySQL dump') || head.includes('Dump completed');
  const hasCreateOrInsert = head.includes('CREATE TABLE') || head.includes('INSERT INTO') || head.includes('CREATE DATABASE');

  if (!hasMariaDb && !hasCreateOrInsert) {
    return { ok: false, reason: 'File does not appear to be a valid SQL dump', filename: latest.filename };
  }
  return { ok: true, filename: latest.filename, sizeBytes: latest.size };
}

module.exports = { createBackup, createTenantBackup, restoreBackup, listBackupFiles, deleteBackupFile, getBackupDir, pruneOldBackups, verifyLastBackup };
