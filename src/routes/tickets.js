'use strict';

const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../auth');
const { validateTicket, validateTicketUpdate, parseId, STATUSES, URGENCY, ValidationError } = require('../validators');
const { wrap } = require('../middleware');

const router = express.Router();
router.use(requireAuth);

const ms = (d) => (d ? new Date(d).getTime() : null);

function ticketDto(t, viewer) {
  return {
    id: t.id,
    number: t.number,
    userId: t.user_id,
    name: t.name,
    company: t.company,
    contact: t.contact,
    program: t.program,
    type: t.type,
    description: t.description,
    urgency: t.urgency,
    status: t.status,
    comment: t.comment,
    commentAt: ms(t.comment_at),
    assignee: t.assignee_id ? { id: t.assignee_id, name: t.assignee_name || '' } : null,
    lastBy: t.last_by,
    unread: viewer.role === 'client' ? t.unread === true : false,
    createdAt: ms(t.created_at),
    updatedAt: ms(t.updated_at)
  };
}

const SELECT_TICKET = `
  SELECT t.*, a.name AS assignee_name,
         (t.last_by = 'specialist' AND t.updated_at > t.client_seen_at) AS unread
    FROM tickets t
    LEFT JOIN users a ON a.id = t.assignee_id`;

async function findTicket(id, user) {
  const row = await db.one(SELECT_TICKET + ' WHERE t.id = $1', [id]);
  if (!row) return null;
  if (user.role !== 'specialist' && row.user_id !== user.id) return null;
  return row;
}

async function historyOf(ticketId) {
  const rows = await db.query(
    `SELECT h.id, h.status, h.comment, h.kind, h.author_role, h.created_at, u.name AS author_name
       FROM ticket_history h
       LEFT JOIN users u ON u.id = h.author_id
      WHERE h.ticket_id = $1
      ORDER BY h.created_at, h.id`,
    [ticketId]
  );
  return rows.map((h) => ({
    status: h.status, comment: h.comment, kind: h.kind, by: h.author_role,
    authorName: h.author_name || '', at: ms(h.created_at)
  }));
}

router.get('/', wrap(async (req, res) => {
  const where = [];
  const params = [];
  const add = (sql, value) => { params.push(value); where.push(sql.replace('?', '$' + params.length)); };

  if (req.user.role !== 'specialist') {
    add('t.user_id = ?', req.user.id);
  } else if (parseId(req.query.userId)) {
    add('t.user_id = ?', parseId(req.query.userId));
  }
  if (STATUSES.includes(req.query.status)) add('t.status = ?', req.query.status);
  if (URGENCY.includes(req.query.urgency)) add('t.urgency = ?', req.query.urgency);
  const q = typeof req.query.q === 'string' ? req.query.q.trim().replace(/^№\s*/, '').slice(0, 100) : '';
  if (q) {
    params.push('%' + q.replace(/[\\%_]/g, '\\$&') + '%');
    const p = '$' + params.length;
    where.push(`(t.number::text ILIKE ${p} OR t.description ILIKE ${p} OR t.company ILIKE ${p} OR t.name ILIKE ${p} OR t.contact ILIKE ${p})`);
  }

  const rows = await db.query(
    SELECT_TICKET + (where.length ? ' WHERE ' + where.join(' AND ') : '') + ' ORDER BY t.created_at DESC LIMIT 500',
    params
  );
  res.json({ tickets: rows.map((r) => ticketDto(r, req.user)) });
}));

router.post('/', wrap(async (req, res) => {
  const d = validateTicket(req.body || {});
  const created = await db.one(
    `WITH t AS (
       INSERT INTO tickets (user_id, name, company, contact, program, type, description, urgency)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *
     ), h AS (
       INSERT INTO ticket_history (ticket_id, status, kind, author_role, author_id)
       SELECT id, 'new', 'created', $9, $1 FROM t
     )
     SELECT * FROM t`,
    [req.user.id, d.name, d.company, d.contact, d.program, d.type, d.description, d.urgency, req.user.role]
  );
  const row = await findTicket(created.id, req.user);
  res.status(201).json({ ticket: Object.assign(ticketDto(row, req.user), { history: await historyOf(row.id) }) });
}));

router.get('/:id', wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const row = id && (await findTicket(id, req.user));
  if (!row) return res.status(404).json({ error: 'Заявка не найдена' });
  res.json({ ticket: Object.assign(ticketDto(row, req.user), { history: await historyOf(row.id) }) });
}));

router.post('/:id/seen', wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Заявка не найдена' });
  await db.query('UPDATE tickets SET client_seen_at = now() WHERE id = $1 AND user_id = $2', [id, req.user.id]);
  res.json({ ok: true });
}));

router.patch('/:id', requireRole('specialist'), wrap(async (req, res) => {
  const id = parseId(req.params.id);
  const cur = id && (await findTicket(id, req.user));
  if (!cur) return res.status(404).json({ error: 'Заявка не найдена' });
  const d = validateTicketUpdate(req.body || {});

  const newStatus = d.status !== undefined ? d.status : cur.status;
  const newComment = d.comment !== undefined ? d.comment : cur.comment;
  const statusChanged = newStatus !== cur.status;
  const commentChanged = newComment !== cur.comment;
  if (!statusChanged && !commentChanged) throw new ValidationError({ status: 'Изменений нет' });

  await db.query(
    `WITH u AS (
       UPDATE tickets
          SET status = $2::varchar,
              comment = $3::text,
              comment_at = CASE WHEN $5::boolean THEN now() ELSE comment_at END,
              assignee_id = COALESCE(assignee_id, $4::int),
              last_by = 'specialist',
              updated_at = now()
        WHERE id = $1::int
        RETURNING id, status
     ), h AS (
       INSERT INTO ticket_history (ticket_id, status, comment, kind, author_role, author_id)
       SELECT id, status, $6::text, $7::varchar, 'specialist', $4::int FROM u
     )
     SELECT id FROM u`,
    [id, newStatus, newComment, req.user.id, commentChanged, commentChanged ? newComment : '', statusChanged ? 'status' : 'comment']
  );
  const row = await findTicket(id, req.user);
  res.json({ ticket: Object.assign(ticketDto(row, req.user), { history: await historyOf(id) }) });
}));

module.exports = router;
