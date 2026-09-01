const { queryDb, getPool } = require('./database');

const MASTER_DB = process.env.MASTER_DB_NAME || 'abyte_master';

async function masterQuery(sql, params) {
  return queryDb(MASTER_DB, sql, params);
}

async function masterGetConnection() {
  return getPool(MASTER_DB).getConnection();
}

module.exports = { masterQuery, masterGetConnection };
