// Run: node scripts/seed-admin.js
const bcrypt  = require('bcryptjs');
const mariadb = require('mariadb');

const DB = {
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '3306'),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'abytedesk-arhum',
};

async function seed() {
  const conn = await mariadb.createConnection(DB);
  try {
    const hash = await bcrypt.hash('12345678', 10);
    await conn.query(`
      INSERT INTO users (username, name, email, password_hash, role_id, role_name, is_active)
      VALUES ('admin', 'Administrator', 'admin@abyte.com', ?, 1, 'Admin', 1)
      ON DUPLICATE KEY UPDATE
        password_hash = VALUES(password_hash),
        role_id       = 1,
        role_name     = 'Admin',
        is_active     = 1
    `, [hash]);
    console.log('Admin user created: admin@abyte.com / 12345678');
  } finally {
    await conn.end();
  }
}

seed().catch(e => { console.error('Seed failed:', e.message); process.exit(1); });
