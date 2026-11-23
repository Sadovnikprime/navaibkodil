'use strict';

const path = require('path');
const express = require('express');
const { cors, securityHeaders, apiNotFound, errorHandler } = require('./middleware');
const config = require('./config');
const { PROGRAMS, TYPES, URGENCY, STATUSES } = require('./validators');
const authRoutes = require('./routes/auth');
const ticketRoutes = require('./routes/tickets');
const { usersRouter, statsRouter } = require('./routes/users');
const db = require('./db');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(securityHeaders);

  app.use('/api', cors(config.corsOrigins));
  app.use('/api', express.json({ limit: '100kb' }));
  app.use('/api', (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

  app.get('/api/health', async (req, res) => {
    try {
      await db.query('SELECT 1');
      res.json({ ok: true, db: 'up' });
    } catch (e) {
      res.status(503).json({ ok: false, db: 'down' });
    }
  });

  app.get('/api/meta', (req, res) => {
    res.json({ programs: PROGRAMS, types: TYPES, urgency: URGENCY, statuses: STATUSES });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/tickets', ticketRoutes);
  app.use('/api/users', usersRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api', apiNotFound);

  app.use(express.static(path.join(__dirname, '..', 'docs')));

  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
