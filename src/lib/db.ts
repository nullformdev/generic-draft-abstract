/**
 * db.ts — opens the SQLite database, applies connection PRAGMAs, and creates
 * all tables and indexes on first run (idempotent, safe to call on every restart).
 *
 * Usage: import { db } from './db.ts'
 *
 * Requires Node.js 24+ (node:sqlite stable since v24).
 */

import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.ts';

export const db: DatabaseSync = new DatabaseSync(config.DB_PATH);

// ── Connection PRAGMAs ────────────────────────────────────────────────────────

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  PRAGMA synchronous  = NORMAL;
  PRAGMA foreign_keys = ON;
`);

// ── Schema ────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    login         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    sid      TEXT    PRIMARY KEY,
    user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data     TEXT    NOT NULL DEFAULT '{}',
    expires  TEXT    NOT NULL
  );
`);

// ── Indexes ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires);
`);
