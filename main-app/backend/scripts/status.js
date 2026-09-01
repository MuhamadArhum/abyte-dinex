// =============================================================
// status.js — Show live status of ALL tenant databases
//
// Usage:
//   node scripts/status.js
//
// Shows for each tenant:
//   - Active / Inactive status
//   - DB size in MB
//   - Total users, sales, pending orders
//   - Last login activity
//   - Migration version
// =============================================================

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { queryDb } = require('../config/database');

const MASTER_DB = process.env.MASTER_DB_NAME || 'abyte_master';

const c = {
  reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m',
  yellow: '\x1b[33m', cyan: '\x1b[36m', blue: '\x1b[34m',
  bold: '\x1b[1m', dim: '\x1b[2m', magenta: '\x1b[35m',
};

function pad(str, len) {
  const s = String(str ?? '—');
  return s.length >= len ? s.substring(0, len) : s + ' '.repeat(len - s.length);
}

async function safeQuery(db, sql, params) {
  try {
    return await queryDb(db, sql, params);
  } catch {
    return null;
  }
}

async function main() {
  console.log(`\n${c.bold}${c.cyan}═══════════════════════════════════════════════════════════════════${c.reset}`);
  console.log(`${c.bold}  Abyte ERP — Live Database Status${c.reset}`);
  console.log(`${c.cyan}═══════════════════════════════════════════════════════════════════${c.reset}\n`);

  // Get all tenants
  let tenants;
  try {
    tenants = await queryDb(
      MASTER_DB,
      `SELECT t.tenant_id, t.tenant_code, t.tenant_name, t.db_name,
              t.is_active, t.created_at,
              tc.company_name, tc.modules_enabled
       FROM tenants t
       LEFT JOIN tenant_configs tc ON tc.tenant_id = t.tenant_id
       ORDER BY t.created_at ASC`
    );
  } catch (err) {
    console.error(`${c.red}✗ Cannot connect to master DB (${MASTER_DB}): ${err.message}${c.reset}\n`);
    process.exit(1);
  }

  if (tenants.length === 0) {
    console.log(`${c.yellow}  No tenants found.${c.reset}\n`);
    process.exit(0);
  }

  // Table header
  console.log(
    `  ${c.bold}${c.dim}` +
    `${ pad('CLIENT',          18) }` +
    `${ pad('DB NAME',         22) }` +
    `${ pad('STATUS',          10) }` +
    `${ pad('SIZE',             8) }` +
    `${ pad('USERS',            7) }` +
    `${ pad('SALES',            7) }` +
    `${ pad('PENDING',          9) }` +
    `${ pad('LAST LOGIN',      20) }` +
    `${ pad('MIGRATION',        5) }` +
    `${c.reset}`
  );
  console.log(`  ${c.dim}${'─'.repeat(110)}${c.reset}`);

  let totalUsers = 0, totalSales = 0, totalPending = 0;
  let onlineCount = 0, offlineCount = 0;

  for (const tenant of tenants) {
    const db     = tenant.db_name;
    const name   = tenant.company_name || tenant.tenant_name;
    const active = tenant.is_active;

    if (!active) {
      offlineCount++;
      console.log(
        `  ${c.dim}` +
        `${ pad(name, 18) }${ pad(db, 22) }` +
        `${c.red}${ pad('INACTIVE', 10) }${c.reset}` +
        `${c.dim}${'—'.padEnd(8)}${'—'.padEnd(7)}${'—'.padEnd(7)}${'—'.padEnd(9)}${'—'.padEnd(20)}${'—'.padEnd(5)}${c.reset}`
      );
      continue;
    }

    // Run all queries in parallel
    const [sizeRes, usersRes, salesRes, pendingRes, loginRes, migRes] = await Promise.all([
      safeQuery(db,
        `SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 1) AS mb
         FROM information_schema.tables WHERE table_schema = ?`, [db]),
      safeQuery(db, `SELECT COUNT(*) AS cnt FROM users WHERE is_active = 1`),
      safeQuery(db, `SELECT COUNT(*) AS cnt FROM sales WHERE status = 'completed'`),
      safeQuery(db, `SELECT COUNT(*) AS cnt FROM sales WHERE status = 'pending'`),
      safeQuery(db,
        `SELECT created_at FROM audit_logs WHERE action = 'USER_LOGIN'
         ORDER BY created_at DESC LIMIT 1`),
      safeQuery(db,
        `SELECT MAX(version) AS v FROM schema_migrations`),
    ]);

    const sizeMb   = sizeRes?.[0]?.mb   ?? 0;
    const users    = usersRes?.[0]?.cnt  ?? 0;
    const sales    = salesRes?.[0]?.cnt  ?? 0;
    const pending  = pendingRes?.[0]?.cnt ?? 0;
    const migVer   = migRes?.[0]?.v       ?? 0;

    let lastLogin = '—';
    if (loginRes?.[0]?.created_at) {
      const d = new Date(loginRes[0].created_at);
      lastLogin = d.toLocaleDateString('en-PK', {
        day: '2-digit', month: 'short', year: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });
    }

    totalUsers   += Number(users);
    totalSales   += Number(sales);
    totalPending += Number(pending);
    onlineCount++;

    const statusColor = pending > 0 ? c.green : c.dim;

    console.log(
      `  ${c.green}✓${c.reset} ` +
      `${c.bold}${ pad(name, 17) }${c.reset}` +
      `${c.dim}${ pad(db, 22) }${c.reset}` +
      `${c.green}${ pad('ACTIVE', 10) }${c.reset}` +
      `${c.dim}${ pad(`${sizeMb}MB`, 8) }${c.reset}` +
      `${c.cyan}${ pad(users, 7) }${c.reset}` +
      `${c.blue}${ pad(sales, 7) }${c.reset}` +
      `${statusColor}${ pad(pending, 9) }${c.reset}` +
      `${c.dim}${ pad(lastLogin, 20) }${c.reset}` +
      `${c.dim}v${migVer}${c.reset}`
    );
  }

  // Footer totals
  console.log(`  ${c.dim}${'─'.repeat(110)}${c.reset}`);
  console.log(
    `  ${c.bold}  ${ pad('TOTAL', 17) }${ pad('', 22) }${ pad('', 10) }${ pad('', 8) }` +
    `${c.cyan}${ pad(totalUsers, 7) }${c.reset}` +
    `${c.blue}${c.bold}${ pad(totalSales, 7) }${c.reset}` +
    `${c.green}${c.bold}${ pad(totalPending, 9) }${c.reset}`
  );
  console.log();

  // Summary box
  console.log(`  ${c.dim}Tenants   : ${c.green}${onlineCount} active${c.dim}${offlineCount > 0 ? ` · ${c.red}${offlineCount} inactive${c.dim}` : ''}${c.reset}`);
  console.log(`  ${c.dim}Master DB : ${MASTER_DB}${c.reset}`);
  console.log(`  ${c.dim}Checked   : ${new Date().toLocaleString('en-PK')}${c.reset}`);
  console.log(`\n${c.cyan}═══════════════════════════════════════════════════════════════════${c.reset}\n`);

  process.exit(0);
}

main().catch(err => {
  console.error(`\n${c.red}Unexpected error: ${err.message}${c.reset}\n`);
  process.exit(1);
});
