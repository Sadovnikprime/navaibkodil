'use strict';

const crypto = require('crypto');
const config = require('./config');
const db = require('./db');

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16);
    crypto.scrypt(password, salt, 64, (err, key) => {
      if (err) return reject(err);
      resolve(salt.toString('hex') + ':' + key.toString('hex'));
    });
  });
}

function verifyPassword(password, stored) {
  return new Promise((resolve) => {
    const [saltHex, keyHex] = String(stored).split(':');
    if (!saltHex || !keyHex) return resolve(false);
    crypto.scrypt(password, Buffer.from(saltHex, 'hex'), 64, (err, key) => {
      if (err) return resolve(false);
      const expected = Buffer.from(keyHex, 'hex');
      resolve(expected.length === key.length && crypto.timingSafeEqual(expected, key));
    });
  });
}

const b64 = (buf) => Buffer.from(buf).toString('base64url');
const sign = (data) => crypto.createHmac('sha256', config.tokenSecret).update(data).digest('base64url');

function createToken(user) {
  const payload = b64(JSON.stringify({ uid: user.id, role: user.role, exp: Date.now() + config.tokenTtlMs }));
  return payload + '.' + sign(payload);
}

function readToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, signature] = token.split('.');
  const expected = sign(payload);
  if (!signature || signature.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.uid || !data.exp || data.exp < Date.now()) return null;
    return data;
  } catch (e) {
    return null;
  }
}

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    const data = readToken(token);
    if (!data) return res.status(401).json({ error: 'Требуется вход в систему' });
    const user = await db.one(
      'SELECT id, role, login, name, company, contact, is_active, created_at FROM users WHERE id = $1',
      [data.uid]
    );
    if (!user || !user.is_active) return res.status(401).json({ error: 'Учётная запись недоступна' });
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) return res.status(403).json({ error: 'Недостаточно прав' });
    next();
  };
}

function publicUser(u) {
  return {
    id: u.id,
    role: u.role,
    login: u.login,
    name: u.name,
    company: u.company,
    contact: u.contact,
    isActive: u.is_active,
    createdAt: new Date(u.created_at).getTime()
  };
}

module.exports = { hashPassword, verifyPassword, createToken, readToken, requireAuth, requireRole, publicUser };
