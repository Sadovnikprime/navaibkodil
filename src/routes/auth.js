'use strict';

const express = require('express');
const db = require('../db');
const { hashPassword, verifyPassword, createToken, requireAuth, publicUser } = require('../auth');
const { validateRegister, validateProfile, normalizeLogin, ValidationError } = require('../validators');
const { rateLimit, wrap } = require('../middleware');

const router = express.Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: 'Слишком много попыток входа. Подождите 15 минут' });

router.post('/register', authLimiter, wrap(async (req, res) => {
  const data = validateRegister(req.body || {});
  const exists = await db.one('SELECT id FROM users WHERE login = $1', [data.login]);
  if (exists) throw new ValidationError({ login: 'Пользователь с таким логином уже зарегистрирован' });
  const hash = await hashPassword(data.password);
  let user;
  try {
    user = await db.one(
      `INSERT INTO users (role, login, password_hash, name, company, contact)
       VALUES ('client', $1, $2, $3, $4, $5)
       RETURNING id, role, login, name, company, contact, is_active, created_at`,
      [data.login, hash, data.name, data.company, data.contact]
    );
  } catch (err) {
    if (err.code === '23505') throw new ValidationError({ login: 'Пользователь с таким логином уже зарегистрирован' });
    throw err;
  }
  res.status(201).json({ token: createToken(user), user: publicUser(user) });
}));

router.post('/login', authLimiter, wrap(async (req, res) => {
  const body = req.body || {};
  const login = normalizeLogin(body.login);
  const password = typeof body.password === 'string' ? body.password : '';
  if (!login || !password) return res.status(400).json({ error: 'Введите логин и пароль' });
  const user = await db.one(
    'SELECT id, role, login, password_hash, name, company, contact, is_active, created_at FROM users WHERE login = $1',
    [login]
  );
  const ok = user ? await verifyPassword(password, user.password_hash) : false;
  if (!ok) return res.status(401).json({ error: 'Неверный логин или пароль' });
  if (!user.is_active) return res.status(403).json({ error: 'Учётная запись заблокирована. Обратитесь в компанию' });
  res.json({ token: createToken(user), user: publicUser(user) });
}));

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.patch('/me', requireAuth, wrap(async (req, res) => {
  const data = validateProfile(req.body || {});
  const user = await db.one(
    `UPDATE users SET name = $2, company = $3, contact = $4 WHERE id = $1
     RETURNING id, role, login, name, company, contact, is_active, created_at`,
    [req.user.id, data.name, data.company, data.contact]
  );
  res.json({ user: publicUser(user) });
}));

router.post('/password', requireAuth, authLimiter, wrap(async (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  const row = await db.one('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
  if (!row || !(await verifyPassword(String(oldPassword || ''), row.password_hash))) {
    throw new ValidationError({ oldPassword: 'Текущий пароль указан неверно' });
  }
  if (typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 100) {
    throw new ValidationError({ newPassword: 'Пароль — не меньше 6 символов' });
  }
  await db.query('UPDATE users SET password_hash = $2 WHERE id = $1', [req.user.id, await hashPassword(newPassword)]);
  res.json({ ok: true });
}));

module.exports = router;
