'use strict';

function cors(allowedOrigins) {
  const allowAll = allowedOrigins.includes('*');
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (allowAll || allowedOrigins.includes(origin))) {
      res.setHeader('Access-Control-Allow-Origin', allowAll ? '*' : origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
      res.setHeader('Access-Control-Max-Age', '86400');
    }

    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
  };
}

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
}

function rateLimit({ windowMs, max, message }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [key, v] of hits) if (v.reset < now) hits.delete(key);
  }, windowMs).unref();
  return (req, res, next) => {
    const key = req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.reset < now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.reset - now) / 1000));
      return res.status(429).json({ error: message || 'Слишком много попыток. Попробуйте позже' });
    }
    next();
  };
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function apiNotFound(req, res) {
  res.status(404).json({ error: 'Метод API не найден' });
}

function errorHandler(err, req, res, next) {
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ error: 'Некорректный JSON в теле запроса' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Слишком большой запрос' });
  }
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ error: err.message, fields: err.fields });
  }
  console.error('[error]', err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
}

module.exports = { cors, securityHeaders, rateLimit, wrap, apiNotFound, errorHandler };
