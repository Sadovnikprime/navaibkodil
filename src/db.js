'use strict';

const { Pool } = require('pg');
const config = require('./config');

const connectionString = config.databaseUrl
  .replace(/([?&])channel_binding=[^&]*&?/, '$1')
  .replace(/[?&]$/, '');

const pool = new Pool({ connectionString, max: 10 });

pool.on('error', (err) => {
  console.error('[db] Ошибка соединения с PostgreSQL:', err.message);
});

async function query(text, params) {
  const res = await pool.query(text, params);
  return res.rows;
}

async function one(text, params) {
  const rows = await query(text, params);
  return rows[0] || null;
}

module.exports = { pool, query, one };
