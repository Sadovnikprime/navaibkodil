'use strict';

const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const db = require('../src/db');
const { hashPassword } = require('../src/auth');
const { normalizeLogin } = require('../src/validators');

async function main() {
  const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  await db.pool.query(schema);
  console.log('[db:init] Таблицы созданы или уже существуют');

  const login = normalizeLogin(config.admin.login);
  if (!login) throw new Error('ADMIN_LOGIN должен быть email или телефоном');
  const exists = await db.one('SELECT id FROM users WHERE login = $1', [login]);
  if (exists) {
    console.log('[db:init] Специалист ' + login + ' уже существует');
  } else {
    await db.query(
      `INSERT INTO users (role, login, password_hash, name, company, contact)
       VALUES ('specialist', $1, $2, $3, '', $1)`,
      [login, await hashPassword(config.admin.password), config.admin.name]
    );
    console.log('[db:init] Создан специалист: ' + login + ' (пароль из ADMIN_PASSWORD)');
  }
}

main()
  .then(() => db.pool.end())
  .catch((err) => {
    console.error('[db:init] Ошибка:', err.message);
    console.error('          Проверьте DATABASE_URL в файле .env и что PostgreSQL запущен.');
    db.pool.end().finally(() => process.exit(1));
  });
