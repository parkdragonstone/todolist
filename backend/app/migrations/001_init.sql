-- Design Ref: §3.3 — 초기 스키마
-- foreign_keys PRAGMA는 트랜잭션 안에서 효과가 없으므로 연결 시점(db.py)에서 설정한다.

CREATE TABLE projects (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL CHECK (length(name) BETWEEN 1 AND 50),
  color       TEXT    NOT NULL DEFAULT '#F23D52',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  archived    INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL
);

CREATE TABLE tasks (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id        INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title             TEXT    NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  memo              TEXT    NOT NULL DEFAULT '' CHECK (length(memo) <= 5000),
  due_date          TEXT,
  due_time          TEXT,
  priority          INTEGER NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 3),
  repeat_freq       TEXT    CHECK (repeat_freq IN ('daily', 'weekly', 'monthly', 'yearly')),
  repeat_interval   INTEGER NOT NULL DEFAULT 1 CHECK (repeat_interval BETWEEN 1 AND 99),
  repeat_weekdays   TEXT,
  repeat_anchor_day INTEGER CHECK (repeat_anchor_day BETWEEN 1 AND 31),
  completed_at      TEXT,
  spawned_task_id   INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  created_at        TEXT    NOT NULL,
  updated_at        TEXT    NOT NULL,
  CHECK (due_time IS NULL OR due_date IS NOT NULL),
  CHECK (repeat_freq IS NULL OR due_date IS NOT NULL)
);
CREATE INDEX ix_tasks_project_open ON tasks(project_id, completed_at);
CREATE INDEX ix_tasks_due_open     ON tasks(due_date, completed_at);

CREATE TABLE tags (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL UNIQUE COLLATE NOCASE CHECK (length(name) BETWEEN 1 AND 30),
  color       TEXT    NOT NULL DEFAULT '#2FB4E0',
  created_at  TEXT    NOT NULL
);

CREATE TABLE task_tags (
  task_id  INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id   INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);

CREATE TABLE sessions (
  token_hash    TEXT PRIMARY KEY,
  created_at    TEXT NOT NULL,
  expires_at    TEXT NOT NULL,
  last_seen_at  TEXT NOT NULL,
  user_agent    TEXT NOT NULL DEFAULT ''
);
