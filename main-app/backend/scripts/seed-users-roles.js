/**
 * Users & Roles Seed Script — adds 10 new roles and 100 new users.
 * Run: node scripts/seed-users-roles.js
 *
 * SAFE / NON-DESTRUCTIVE:
 *   - Does NOT touch existing roles or users — only INSERTs new rows.
 *   - All new users get password: Password@123 (bcrypt-hashed).
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mariadb = require('mariadb');
const bcrypt  = require('bcryptjs');

const DB = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'abyte_pos',
  connectTimeout: 30000,
  bigIntAsNumber: true,
};

const ROLE_COUNT = 10;
const USER_COUNT = 100;

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = arr => arr[rand(0, arr.length - 1)];

const NEW_ROLE_NAMES = [
  'Cashier', 'Supervisor', 'Storekeeper', 'Accountant', 'Branch Manager',
  'Kitchen Staff', 'Delivery Rider', 'Auditor', 'Inventory Clerk', 'HR Officer',
];

const FIRST_NAMES = ['Ahmed','Ali','Hassan','Bilal','Usman','Fahad','Zain','Hamza','Saad','Umar',
  'Ayesha','Fatima','Sana','Hira','Zainab','Mahnoor','Amina','Sara','Nida','Rabia',
  'Imran','Kashif','Waleed','Junaid','Talha','Asad','Noman','Farhan','Adeel','Shahzad'];
const LAST_NAMES = ['Khan','Malik','Sheikh','Butt','Chaudhry','Raza','Iqbal','Ahmad','Hussain','Qureshi'];

async function batchInsertMulti(conn, table, cols, rows) {
  if (!rows.length) return;
  const colStr = cols.map(c => '`' + c + '`').join(',');
  const placeholders = rows.map(() => '(' + cols.map(() => '?').join(',') + ')').join(',');
  const sql = `INSERT INTO \`${table}\` (${colStr}) VALUES ${placeholders}`;
  await conn.query(sql, rows.flat());
  console.log(`  ${table}: inserted ${rows.length} rows`);
}

async function seed() {
  console.log('Connecting to', DB.host, '/', DB.database);
  const conn = await mariadb.createConnection(DB);

  try {
    // ── 1. Roles ─────────────────────────────────────────────────────────────
    console.log('\n[1/2] roles');
    const existingRoles = await conn.query('SELECT role_name FROM roles');
    const existingNames = new Set(existingRoles.map(r => r.role_name));
    const rolesToAdd = NEW_ROLE_NAMES.filter(n => !existingNames.has(n)).slice(0, ROLE_COUNT);
    // pad out with numbered fallback names if some of the preferred names already exist
    let extra = 1;
    while (rolesToAdd.length < ROLE_COUNT) {
      const candidate = `Custom Role ${extra++}`;
      if (!existingNames.has(candidate) && !rolesToAdd.includes(candidate)) rolesToAdd.push(candidate);
    }
    for (const name of rolesToAdd) {
      await conn.query('INSERT INTO roles (role_name) VALUES (?)', [name]);
    }
    console.log(`  roles: inserted ${rolesToAdd.length} rows (${rolesToAdd.join(', ')})`);

    const allRoles = await conn.query('SELECT role_id, role_name FROM roles');

    // ── 2. Users ─────────────────────────────────────────────────────────────
    console.log('\n[2/2] users');
    const [{ nextUserId }] = await conn.query('SELECT COALESCE(MAX(user_id),0)+1 AS nextUserId FROM users');
    const pwdHash = await bcrypt.hash('Password@123', 10);
    const userRows = [];
    const usedUsernames = new Set();
    for (let i = 0; i < USER_COUNT; i++) {
      const id = nextUserId + i;
      const first = pick(FIRST_NAMES);
      const last = pick(LAST_NAMES);
      let username = `${first.toLowerCase()}.${last.toLowerCase()}${id}`;
      while (usedUsernames.has(username)) username = `${username}x`;
      usedUsernames.add(username);
      const role = pick(allRoles);
      userRows.push([
        username,
        `${first} ${last}`,
        `${username}@example.com`,
        pwdHash,
        role.role_id,
        role.role_name,
        1,
        new Date().toISOString().slice(0, 19).replace('T', ' '),
      ]);
    }
    await batchInsertMulti(conn, 'users',
      ['username', 'name', 'email', 'password_hash', 'role_id', 'role_name', 'is_active', 'created_at'], userRows);

    // ── Done ─────────────────────────────────────────────────────────────────
    console.log('\n✓ Seed complete! All new users have password: Password@123\n');
    const [{ roleCnt }] = await conn.query('SELECT COUNT(*) AS roleCnt FROM roles');
    const [{ userCnt }] = await conn.query('SELECT COUNT(*) AS userCnt FROM users');
    console.log(`  roles  ${String(roleCnt).padStart(6)} total`);
    console.log(`  users  ${String(userCnt).padStart(6)} total`);
  } finally {
    await conn.end();
  }
}

seed().catch(e => { console.error('\nSeed failed:', e.message); process.exit(1); });
