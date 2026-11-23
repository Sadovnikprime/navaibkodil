'use strict';

const express = require('express');
const db = require('../db');
const { requireAuth, requireRole, hashPassword, publicUser } = require('../auth');
const { validateSpecialist, parseId, ValidationError } = require('../validators');
const { wrap } = require('../middleware');

const router = express.Router();
router.use(requireAuth, requireRole('specialist'));

router.get('/', wrap(async (req, res) => {
  const role = req.query.role === 'specialist' ? 'specialist' : req.query.role === 'client' ? 'client' : null;
  const rows = await db.query(
    `SELECT u.id, u.role, u.login, u.name, u.company, u.contact, u.is_active, u.created_at,
            COUNT(t.id)::int AS tickets_total,
            COUNT(t.id) FILTER (WHERE t.status <> 'done')::int AS tickets_active
       FROM users u
       LEFT JOIN tickets t ON t.user_id = u.id
      WHERE ($1::varchar IS NULL OR u.role = $1::varchar)
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT 1000`,
    [role]
  );
  res.json({
    users: rows.map((u) => Object.assign(publicUser(u), { ticketsTotal: u.tickets_total, ticketsActive: u.tickets_active }))
  });
}));

router.post('/', wrap(async (req, res) => {
  const d = validateSpecialist(req.body || {});
  const exists = await db.one('SELECT id FROM users WHERE login = $1', [d.login]);
  if (exists) throw new ValidationError({ login: 'Такой логин уже занят' });
  try {
    const user = await db.one(
      `INSERT INTO users (role, login, password_hash, name, company, contact)
       VALUES ('specialist', $1, $2, $3, '', $4)
       RETURNING id, role, login, name, company, contact, is_active, created_at`,
      [d.login, await hashPassword(d.password), d.name, d.login]
    );
    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    if (err.code === '23505') throw new ValidationError({ login: 'Такой логин уже занят' });
    throw err;
  }
}));

router.patch('/:id', wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Пользователь не найден' });
  if (typeof (req.body || {}).isActive !== 'boolean') throw new ValidationError({ isActive: 'Ожидается true или false' });
  if (id === req.user.id && req.body.isActive === false) throw new ValidationError({ isActive: 'Нельзя заблокировать самого себя' });
  const user = await db.one(
    `UPDATE users SET is_active = $2 WHERE id = $1
     RETURNING id, role, login, name, company, contact, is_active, created_at`,
    [id, req.body.isActive]
  );
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  res.json({ user: publicUser(user) });
}));

const stats = express.Router();
stats.use(requireAuth, requireRole('specialist'));
stats.get('/', wrap(async (req, res) => {
  const byStatus = await db.query('SELECT status, COUNT(*)::int AS n FROM tickets GROUP BY status');
  const extra = await db.one(
    `SELECT (SELECT COUNT(*)::int FROM tickets) AS total,
            (SELECT COUNT(*)::int FROM tickets WHERE created_at >= date_trunc('day', now())) AS today,
            (SELECT COUNT(*)::int FROM tickets WHERE urgency = 'critical' AND status <> 'done') AS critical,
            (SELECT COUNT(*)::int FROM users WHERE role = 'client') AS clients`
  );
  const statuses = { new: 0, accepted: 0, in_progress: 0, done: 0 };
  byStatus.forEach((r) => { statuses[r.status] = r.n; });
  res.json({ statuses, total: extra.total, today: extra.today, critical: extra.critical, clients: extra.clients });
}));

module.exports = { usersRouter: router, statsRouter: stats };
