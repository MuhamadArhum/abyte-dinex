// =============================================================
// backup-all.js — Backup ALL tenant databases
//
// Usage:
//   node scripts/backup-all.js
//   node scripts/backup-all.js --dir /custom/path   (optional)
//
// What it does:
//   1. Reads all active tenants from abyte_master.tenants
//   2. Dumps each DB to a compressed .sql.gz file
//   3. Saves to /var/backups/abyte/YYYY-MM-DD/
//   4. Keeps last 7 days of backups (auto-deletes old ones)
//   5. Reports size and status of each backup
// =============================================================

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { spawn }   = require('child_process');
const { queryDb } = require('../config/database');
const fs          = require('fs');
const fsp         = fs.promises;
const path        = require('path');

const MASTER_DB = process.env.MASTER_DB_NAME || 'abyte_master';
const DB_USER   = process.env.DB_USER     || 'root';
const DB_PASS   = process.env.DB_PASSWORD || '';
const DB_HOST   = process.env.DB_HOST     || 'localhost';
const DB_PORT   = process.env.DB_PORT     || '3306';

// Backup retention: delete backups older than this many days
const KEEP_DAYS = 7;

const c = {
  reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m',
  yellow: '\x1b[33m', cyan: '\x1b[36m', bold: '\x1b[1m', dim: '\x1b[2m',
};

function formatBytes(bytes) {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024*1024)  return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/1024/1024).toFixed(2)} MB`;
}

function deleteOldBackups(baseDir) {
  if (!fs.existsSync(baseDir)) return;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - KEEP_DAYS);

  const dirs = fs.readdirSync(baseDir).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
  let deleted = 0;
  for (const dir of dirs) {
    const dirDate = new Date(dir);
    if (dirDate < cutoff) {
      fs.rmSync(path.join(baseDir, dir), { recursive: true, force: true });
      deleted++;
    }
  }
  if (deleted > 0) {
    console.log(`${c.dim}  Deleted ${deleted} old backup folder(s) (>${KEEP_DAYS} days)${c.reset}`);
  }
}

async function main() {
  console.log(`\n${c.bold}${c.cyan}══════════════════════════════════════${c.reset}`);
  console.log(`${c.bold}  Abyte ERP — Backup All Tenant DBs${c.reset}`);
  console.log(`${c.cyan}══════════════════════════════════════${c.reset}\n`);

  // Resolve backup directory
  const argDir = process.argv.includes('--dir')
    ? process.argv[process.argv.indexOf('--dir') + 1]
    : null;

  const today     = new Date().toISOString().split('T')[0];
  const baseDir   = argDir || '/var/backups/abyte';
  const backupDir = path.join(baseDir, today);

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  console.log(`  ${c.dim}Backup folder : ${backupDir}${c.reset}`);

  // Clean old backups
  deleteOldBackups(baseDir);

  // Get tenants from master DB
  let tenants;
  try {
    tenants = await queryDb(
      MASTER_DB,
      `SELECT tenant_code, tenant_name, db_name, is_active FROM tenants ORDER BY created_at ASC`
    );
    // Also backup master DB itself
    tenants = [
      { tenant_code: 'master', tenant_name: 'Master DB', db_name: MASTER_DB, is_active: 1 },
      ...tenants
    ];
  } catch (err) {
    console.error(`${c.red}✗ Could not read master DB: ${err.message}${c.reset}`);
    process.exit(1);
  }

  console.log(`  ${c.dim}Tenants found : ${tenants.length - 1} + 1 master\n${c.reset}`);

  let success = 0, failed = 0, skipped = 0;
  let totalSize = 0;
  const startTime = Date.now();

  for (const tenant of tenants) {
    const label    = `${tenant.tenant_name} (${tenant.db_name})`;
    const fileName = `${tenant.db_name}_${today}.sql.gz`;
    const filePath = path.join(backupDir, fileName);

    if (!tenant.is_active && tenant.tenant_code !== 'master') {
      console.log(`  ${c.dim}⊘ SKIPPED  ${label} — inactive${c.reset}`);
      skipped++;
      continue;
    }

    process.stdout.write(`  ${c.dim}Backing up ${label}...${c.reset}`);
    try {
      // Build arg array safely — no shell interpolation, no injection risk
      const dumpArgs = [
        `-u${DB_USER}`,
        ...(DB_PASS ? [`-p${DB_PASS}`] : []),
        ...(DB_HOST !== 'localhost' && DB_HOST !== '127.0.0.1' ? [`-h${DB_HOST}`, `-P${DB_PORT}`] : []),
        '--single-transaction', '--quick', '--routines',
        tenant.db_name,
      ];

      // Async pipeline: mariadb-dump | gzip > file (no blocking, no 512MB RAM buffer)
      await new Promise((resolve, reject) => {
        const dump = spawn('mariadb-dump', dumpArgs, { shell: false });
        const gz   = spawn('gzip',         [],        { shell: false });
        const out  = fs.createWriteStream(filePath);

        dump.stdout.pipe(gz.stdin);
        gz.stdout.pipe(out);

        let dumpErr = '';
        dump.stderr.on('data', d => { dumpErr += d.toString(); });

        dump.on('close', code => { if (code !== 0) reject(new Error(dumpErr.substring(0, 120))); });
        gz.on('close',   code => { if (code !== 0) reject(new Error('gzip failed')); });
        out.on('finish', resolve);
        out.on('error',  reject);
        dump.on('error', reject);
        gz.on('error',   reject);
      });

      const stats = await fsp.stat(filePath);
      const size = stats.size;
      totalSize += size;
      process.stdout.write(`\r  ${c.green}✓ OK      ${c.reset}${label} ${c.dim}— ${formatBytes(size)}${c.reset}\n`);
      success++;
    } catch (err) {
      process.stdout.write(`\r  ${c.red}✗ FAILED  ${c.reset}${label} — ${err.message.substring(0, 60)}\n`);
      failed++;
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n${c.cyan}──────────────────────────────────────${c.reset}`);
  console.log(`  ${c.green}✓ Success    : ${success}${c.reset}`);
  if (failed  > 0) console.log(`  ${c.red}✗ Failed     : ${failed}${c.reset}`);
  if (skipped > 0) console.log(`  ${c.dim}⊘ Skipped    : ${skipped}${c.reset}`);
  console.log(`  ${c.dim}Total size   : ${formatBytes(totalSize)}${c.reset}`);
  console.log(`  ${c.dim}Time taken   : ${elapsed}s${c.reset}`);
  console.log(`  ${c.dim}Saved to     : ${backupDir}${c.reset}`);
  console.log(`${c.cyan}──────────────────────────────────────${c.reset}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(`\n${c.red}Unexpected error: ${err.message}${c.reset}\n`);
  process.exit(1);
});
