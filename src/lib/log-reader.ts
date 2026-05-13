import { DatabaseSync } from 'node:sqlite';

export interface LogRow {
  id: number;
  createdAt: string;
  level: string;
  kind: string;
  message: string;
  requestId: string;
  userId: number | null;
  role: string;
  route: string;
  status: number | null;
  durationMs: number | null;
  metaJson: string;
}

function logDbPath(): string {
  return process.env.LOG_DB_PATH || './data/logs.db';
}

export function listRecentLogs(limit = 100): LogRow[] {
  const safeLimit = Number.isInteger(limit) && limit > 0 && limit <= 500 ? limit : 100;
  try {
    const db = new DatabaseSync(logDbPath(), { readOnly: true });
    const rows = db
      .prepare(
        `SELECT id, created_at, level, kind, message, request_id, user_id, role, route, status, duration_ms, meta_json
         FROM app_logs
         ORDER BY id DESC
         LIMIT ?`,
      )
      .all(safeLimit) as {
      id: number;
      created_at: string;
      level: string;
      kind: string;
      message: string;
      request_id: string;
      user_id: number | null;
      role: string;
      route: string;
      status: number | null;
      duration_ms: number | null;
      meta_json: string;
    }[];
    db.close();
    return rows.map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      level: row.level,
      kind: row.kind,
      message: row.message,
      requestId: row.request_id,
      userId: row.user_id,
      role: row.role,
      route: row.route,
      status: row.status,
      durationMs: row.duration_ms,
      metaJson: row.meta_json,
    }));
  } catch {
    return [];
  }
}
