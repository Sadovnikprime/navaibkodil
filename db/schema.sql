CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  role          VARCHAR(20)  NOT NULL DEFAULT 'client'
                CHECK (role IN ('client', 'specialist')),
  login         VARCHAR(120) NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  name          VARCHAR(80)  NOT NULL,
  company       VARCHAR(120) NOT NULL DEFAULT '',
  contact       VARCHAR(80)  NOT NULL DEFAULT '',
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START 1001;

CREATE TABLE IF NOT EXISTS tickets (
  id             SERIAL PRIMARY KEY,
  number         INTEGER      NOT NULL UNIQUE DEFAULT nextval('ticket_number_seq'),
  user_id        INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           VARCHAR(80)  NOT NULL,
  company        VARCHAR(120) NOT NULL,
  contact        VARCHAR(80)  NOT NULL,
  program        VARCHAR(80)  NOT NULL,
  type           VARCHAR(20)  NOT NULL
                 CHECK (type IN ('error', 'consult', 'dev', 'update', 'report', 'other')),
  description    TEXT         NOT NULL CHECK (char_length(description) BETWEEN 10 AND 2000),
  urgency        VARCHAR(20)  NOT NULL DEFAULT 'normal'
                 CHECK (urgency IN ('low', 'normal', 'high', 'critical')),
  status         VARCHAR(20)  NOT NULL DEFAULT 'new'
                 CHECK (status IN ('new', 'accepted', 'in_progress', 'done')),
  comment        TEXT         NOT NULL DEFAULT '',
  comment_at     TIMESTAMPTZ,
  assignee_id    INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  last_by        VARCHAR(20)  NOT NULL DEFAULT 'client'
                 CHECK (last_by IN ('client', 'specialist')),
  client_seen_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tickets_user_idx    ON tickets (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tickets_status_idx  ON tickets (status);
CREATE INDEX IF NOT EXISTS tickets_created_idx ON tickets (created_at DESC);

CREATE TABLE IF NOT EXISTS ticket_history (
  id          SERIAL PRIMARY KEY,
  ticket_id   INTEGER     NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  status      VARCHAR(20) NOT NULL,
  comment     TEXT        NOT NULL DEFAULT '',
  kind        VARCHAR(20) NOT NULL DEFAULT 'status'
              CHECK (kind IN ('created', 'status', 'comment')),
  author_role VARCHAR(20) NOT NULL CHECK (author_role IN ('client', 'specialist')),
  author_id   INTEGER     REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ticket_history_ticket_idx ON ticket_history (ticket_id, created_at);
