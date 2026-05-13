import { dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { LogEvent } from '../lib/logging/types.ts';

function dbPath(): string {
  return process.env.LOG_DB_PATH || './data/logs.db';
}

export function openLogDb(readOnly = false): DatabaseSync {
  const path = dbPath();
  if (!readOnly) mkdirSync(dirname(path), { recursive: true });
  const db = readOnly ? new DatabaseSync(path, { readOnly: true }) : new DatabaseSync(path);
  if (!readOnly) {
    db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      PRAGMA synchronous = NORMAL;
    `);
    db.exec(`
      CREATE TABLE IF NOT EXISTS app_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        created_at TEXT NOT NULL,
        level TEXT NOT NULL,
        kind TEXT NOT NULL,
        message TEXT NOT NULL,
        request_id TEXT NOT NULL DEFAULT '',
        user_id INTEGER,
        role TEXT NOT NULL DEFAULT '',
        route TEXT NOT NULL DEFAULT '',
        status INTEGER,
        duration_ms INTEGER,
        meta_json TEXT NOT NULL DEFAULT '{}'
      );

      CREATE INDEX IF NOT EXISTS idx_app_logs_created ON app_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_app_logs_level_created ON app_logs(level, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_app_logs_kind_created ON app_logs(kind, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_app_logs_route_created ON app_logs(route, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_app_logs_request ON app_logs(request_id);
    `);
  }
  return db;
}

export class LogStore {
  private db = openLogDb(false);
  private insert = this.db.prepare(`
    INSERT INTO app_logs (
      created_at, level, kind, message, request_id, user_id, role, route, status, duration_ms, meta_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  write(event: LogEvent): void {
    const meta = event.meta ?? {};
    this.insert.run(
      event.ts,
      event.level,
      event.kind,
      event.message,
      event.requestId ?? '',
      event.userId ?? null,
      event.role ?? '',
      typeof meta.route === 'string' ? meta.route : '',
      typeof meta.status === 'number' ? meta.status : null,
      typeof meta.durationMs === 'number' ? meta.durationMs : null,
      JSON.stringify(meta).slice(0, 4000),
    );
  }

  retention(): void {
    const days = Number.parseInt(process.env.LOG_RETENTION_DAYS ?? '30', 10);
    if (!Number.isInteger(days) || days <= 0) return;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    this.db.prepare(`DELETE FROM app_logs WHERE created_at < ?`).run(cutoff);
  }
}
