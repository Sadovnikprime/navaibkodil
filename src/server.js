'use strict';

const config = require('./config');
const db = require('./db');
const { createApp } = require('./app');

async function main() {
  try {
    await db.query('SELECT 1 FROM users LIMIT 1');
  } catch (err) {
    console.error('\n[server] Не удалось подключиться к базе данных или она не подготовлена.');
    console.error('         ' + err.message);
    console.error('         Проверьте DATABASE_URL в файле .env и выполните: npm run db:init\n');
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log('\n  1С: Помощник запущен');
    console.log('  Приложение для клиентов:  http://localhost:' + config.port + '/');
    console.log('  Админка для специалистов: http://localhost:' + config.port + '/admin/\n');
  });

  const shutdown = () => {
    console.log('\n[server] Остановка…');
    server.close(() => db.pool.end().then(() => process.exit(0)));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
