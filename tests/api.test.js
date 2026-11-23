const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/config');
const BASE = process.env.BASE || 'http://localhost:' + (process.env.PORT || 3000);
const ADMIN_LOGIN = process.env.ADMIN_LOGIN || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin12345';

async function api(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body))
  });
  let data = null;
  try { data = await res.json(); } catch (e) {}
  return { status: res.status, data };
}

const uniq = Date.now() % 1e7;
let client, client2, admin, ticket;

test('health и meta', async () => {
  assert.deepEqual((await api('GET', '/api/health')).data, { ok: true, db: 'up' });
  const meta = await api('GET', '/api/meta');
  assert.equal(meta.data.types.length, 6);
  assert.equal((await api('GET', '/api/nope')).status, 404);
});

test('регистрация: валидация', async () => {
  const r = await api('POST', '/api/auth/register', { name: 'И', company: '', login: '123', password: '1' });
  assert.equal(r.status, 400);
  assert.deepEqual(Object.keys(r.data.fields).sort(), ['company', 'login', 'name', 'password']);
  assert.equal((await api('POST', '/api/auth/register', '{bad json')).status, 400);
});

test('регистрация и вход клиента (телефон нормализуется)', async () => {
  const phone = '8 914 ' + String(uniq).padStart(7, '0');
  const r = await api('POST', '/api/auth/register', { name: 'Иван Петров', company: 'ООО «Ромашка»', login: phone, password: 'secret1' });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.user.role, 'client');
  assert.match(r.data.user.login, /^\+7914\d{7}$/);
  client = r.data;
  const dup = await api('POST', '/api/auth/register', { name: 'Иван', company: 'ООО', login: '+7 914 ' + String(uniq).padStart(7, '0'), password: 'secret1' });
  assert.equal(dup.status, 400);
  assert.ok(dup.data.fields.login);
  const bad = await api('POST', '/api/auth/login', { login: phone, password: 'wrong' });
  assert.equal(bad.status, 401);
  const ok = await api('POST', '/api/auth/login', { login: '7914' + String(uniq).padStart(7, '0'), password: 'secret1' });
  assert.equal(ok.status, 200);
  const me = await api('GET', '/api/auth/me', undefined, ok.data.token);
  assert.equal(me.data.user.name, 'Иван Петров');
  const r2 = await api('POST', '/api/auth/register', { name: 'Пётр', company: 'ИП Пётр', login: 'petr' + uniq + '@example.com', password: 'secret2' });
  client2 = r2.data;
});

test('без токена и с поддельным токеном — 401', async () => {
  assert.equal((await api('GET', '/api/tickets')).status, 401);
  assert.equal((await api('GET', '/api/tickets', undefined, client.token.slice(0, -2) + 'xx')).status, 401);
});

test('вход специалиста', async () => {
  const r = await api('POST', '/api/auth/login', { login: ADMIN_LOGIN, password: ADMIN_PASSWORD });
  assert.equal(r.status, 200);
  assert.equal(r.data.user.role, 'specialist');
  admin = r.data;
});

test('создание заявки: валидация и успех', async () => {
  const bad = await api('POST', '/api/tickets', { name: 'Иван', company: 'ООО', contact: 'abc', program: 'Нет такой', type: 'x', description: 'коротко' }, client.token);
  assert.equal(bad.status, 400);
  assert.deepEqual(Object.keys(bad.data.fields).sort(), ['contact', 'description', 'program', 'type']);
  const r = await api('POST', '/api/tickets', {
    name: 'Иван Петров', company: 'ООО «Ромашка»', contact: '+7 914 000-00-00',
    program: '1С:Бухгалтерия предприятия', type: 'error', urgency: 'high',
    description: "Ошибка «Конфликт блокировок» при проведении; кавычки ' и % _ \\ проверка"
  }, client.token);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  ticket = r.data.ticket;
  assert.ok(ticket.number >= 1001);
  assert.equal(ticket.status, 'new');
  assert.equal(ticket.history.length, 1);
  assert.equal(ticket.history[0].kind, 'created');
  assert.equal(ticket.unread, false);
  assert.ok(ticket.description.includes("' и % _ \\"));
});

test('клиент видит только свои заявки', async () => {
  const mine = await api('GET', '/api/tickets', undefined, client.token);
  assert.ok(mine.data.tickets.some((t) => t.id === ticket.id));
  const other = await api('GET', '/api/tickets', undefined, client2.token);
  assert.ok(!other.data.tickets.some((t) => t.id === ticket.id));
  assert.equal((await api('GET', '/api/tickets/' + ticket.id, undefined, client2.token)).status, 404);
  assert.equal((await api('GET', '/api/tickets/abc', undefined, client.token)).status, 404);
});

test('клиент не может менять статус и смотреть пользователей', async () => {
  assert.equal((await api('PATCH', '/api/tickets/' + ticket.id, { status: 'done' }, client.token)).status, 403);
  assert.equal((await api('GET', '/api/users', undefined, client.token)).status, 403);
  assert.equal((await api('GET', '/api/stats', undefined, client.token)).status, 403);
});

test('специалист: список, фильтры, поиск', async () => {
  const all = await api('GET', '/api/tickets', undefined, admin.token);
  assert.ok(all.data.tickets.some((t) => t.id === ticket.id));
  const f = await api('GET', '/api/tickets?status=done', undefined, admin.token);
  assert.ok(!f.data.tickets.some((t) => t.id === ticket.id));
  const q = await api('GET', '/api/tickets?q=' + encodeURIComponent('№ ' + ticket.number), undefined, admin.token);
  assert.ok(q.data.tickets.some((t) => t.id === ticket.id));
  const q2 = await api('GET', '/api/tickets?q=' + encodeURIComponent('блокировок'), undefined, admin.token);
  assert.ok(q2.data.tickets.some((t) => t.id === ticket.id));
  const q3 = await api('GET', '/api/tickets?q=' + encodeURIComponent("'; DROP TABLE users; --"), undefined, admin.token);
  assert.equal(q3.status, 200);
  assert.equal(q3.data.tickets.length, 0);
});

test('специалист меняет статус и комментарий → у клиента «Обновление»', async () => {
  const bad = await api('PATCH', '/api/tickets/' + ticket.id, { status: 'wrong' }, admin.token);
  assert.equal(bad.status, 400);
  const same = await api('PATCH', '/api/tickets/' + ticket.id, { status: 'new' }, admin.token);
  assert.equal(same.status, 400);
  const r = await api('PATCH', '/api/tickets/' + ticket.id, { status: 'in_progress', comment: 'Подключились, разбираемся' }, admin.token);
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.ticket.status, 'in_progress');
  assert.equal(r.data.ticket.assignee.name, admin.user.name);
  assert.ok(r.data.ticket.commentAt);
  assert.equal(r.data.ticket.history.length, 2);
  assert.equal(r.data.ticket.history[1].authorName, admin.user.name);
  const c = await api('PATCH', '/api/tickets/' + ticket.id, { comment: 'Готово к проверке' }, admin.token);
  assert.equal(c.data.ticket.history[2].kind, 'comment');

  const list = await api('GET', '/api/tickets', undefined, client.token);
  const t = list.data.tickets.find((x) => x.id === ticket.id);
  assert.equal(t.unread, true);
  assert.equal(t.comment, 'Готово к проверке');
  await api('POST', '/api/tickets/' + ticket.id + '/seen', undefined, client.token);
  const after = await api('GET', '/api/tickets/' + ticket.id, undefined, client.token);
  assert.equal(after.data.ticket.unread, false);
});

test('статистика, специалисты, блокировка', async () => {
  const s = await api('GET', '/api/stats', undefined, admin.token);
  assert.equal(s.status, 200);
  assert.ok(s.data.total >= 1 && s.data.clients >= 2);
  const sp = await api('POST', '/api/users', { name: 'Олег Специалист', login: 'oleg' + uniq + '@example.com', password: 'oleg123' }, admin.token);
  assert.equal(sp.status, 201, JSON.stringify(sp.data));
  const login2 = await api('POST', '/api/auth/login', { login: 'oleg' + uniq + '@example.com', password: 'oleg123' });
  assert.equal(login2.data.user.role, 'specialist');
  const clients = await api('GET', '/api/users?role=client', undefined, admin.token);
  const me = clients.data.users.find((u) => u.id === client.user.id);
  assert.equal(me.ticketsTotal, 1);
  assert.ok(!('password_hash' in me) && !('passwordHash' in me));
  assert.equal((await api('PATCH', '/api/users/' + admin.user.id, { isActive: false }, admin.token)).status, 400);
  const block = await api('PATCH', '/api/users/' + client2.user.id, { isActive: false }, admin.token);
  assert.equal(block.data.user.isActive, false);
  assert.equal((await api('GET', '/api/tickets', undefined, client2.token)).status, 401);
  assert.equal((await api('POST', '/api/auth/login', { login: 'petr' + uniq + '@example.com', password: 'secret2' })).status, 403);
  await api('PATCH', '/api/users/' + client2.user.id, { isActive: true }, admin.token);
});

test('профиль и смена пароля', async () => {
  const p = await api('PATCH', '/api/auth/me', { name: 'Иван Сергеевич', company: 'ООО «Ромашка»', contact: 'ivan@example.com' }, client.token);
  assert.equal(p.data.user.name, 'Иван Сергеевич');
  assert.equal((await api('POST', '/api/auth/password', { oldPassword: 'nope', newPassword: 'secret9' }, client.token)).status, 400);
  assert.equal((await api('POST', '/api/auth/password', { oldPassword: 'secret1', newPassword: 'secret9' }, client.token)).status, 200);
  assert.equal((await api('POST', '/api/auth/login', { login: client.user.login, password: 'secret9' })).status, 200);
});

test('CORS: запросы с другого сайта (GitHub Pages)', async () => {
  const pre = await fetch(BASE + '/api/tickets', {
    method: 'OPTIONS',
    headers: { Origin: 'https://example.github.io', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' }
  });
  assert.equal(pre.status, 204);
  assert.ok(pre.headers.get('access-control-allow-origin'));
  assert.match(pre.headers.get('access-control-allow-headers'), /Authorization/);
});

test('статика: приложение и админка', async () => {
  assert.equal((await fetch(BASE + '/')).status, 200);
  assert.equal((await fetch(BASE + '/admin/')).status, 200);
  assert.equal((await fetch(BASE + '/js/app.js')).status, 200);
  assert.equal((await fetch(BASE + '/admin/admin.js')).status, 200);
  const h = await fetch(BASE + '/api/health');
  assert.equal(h.headers.get('x-content-type-options'), 'nosniff');
});
