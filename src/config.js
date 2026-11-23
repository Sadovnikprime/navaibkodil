'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || line.trim().startsWith('#')) continue;
    let value = m[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

loadEnvFile(path.join(__dirname, '..', '.env'));

let tokenSecret = process.env.TOKEN_SECRET;
if (!tokenSecret || tokenSecret === 'change-me-to-a-long-random-string') {
  tokenSecret = crypto.randomBytes(32).toString('hex');
  console.warn('[config] TOKEN_SECRET не задан — используется временный ключ. После перезапуска сервера всем придётся войти заново.');
}

const corsOrigins = (process.env.CORS_ORIGINS || '*')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

module.exports = {
  port: Number(process.env.PORT) || 3000,
  corsOrigins,
  databaseUrl: process.env.DATABASE_URL || 'postgres://pomoshnik:pomoshnik@localhost:5432/pomoshnik',
  tokenSecret,
  tokenTtlMs: (Number(process.env.TOKEN_TTL_DAYS) || 30) * 24 * 60 * 60 * 1000,
  admin: {
    login: process.env.ADMIN_LOGIN || 'admin@example.com',
    password: process.env.ADMIN_PASSWORD || 'Admin12345',
    name: process.env.ADMIN_NAME || 'Администратор'
  }
};
