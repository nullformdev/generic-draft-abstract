import type { LogEvent, LogKind, LogLevel, UserRole } from '../lib/logging/types.ts';

const levels = new Set<LogLevel>(['debug', 'info', 'warn', 'error']);
const kinds = new Set<LogKind>(['request', 'api', 'db', 'baker', 'auth', 'audit', 'system']);
const roles = new Set<UserRole>(['user', 'admin']);
const secretKeys = new Set([
  'password',
  'passwordHash',
  'password_hash',
  'invite',
  'inviteCode',
  'cookie',
  'cookies',
  'sid',
  'session',
  'sessionId',
  'authorization',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === 'string' && levels.has(value as LogLevel);
}

function isLogKind(value: unknown): value is LogKind {
  return typeof value === 'string' && kinds.has(value as LogKind);
}

function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && roles.has(value as UserRole);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || typeof value === 'number';
}

function safeMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (secretKeys.has(key)) continue;
    if (value === undefined) continue;
    if (typeof value === 'string') out[key] = value.slice(0, 500);
    else if (typeof value === 'number' || typeof value === 'boolean' || value === null) out[key] = value;
    else out[key] = JSON.stringify(value).slice(0, 1000);
  }
  return out;
}

export function parseLogLine(line: string): LogEvent | undefined {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (!isRecord(value)) return undefined;
  const item = value;

  if (
    item.v !== 1 ||
    typeof item.ts !== 'string' ||
    !isLogLevel(item.level) ||
    !isLogKind(item.kind) ||
    typeof item.message !== 'string' ||
    !isOptionalString(item.requestId) ||
    !isOptionalNumber(item.userId) ||
    (item.role !== undefined && !isUserRole(item.role))
  ) {
    return undefined;
  }

  return {
    v: 1,
    ts: item.ts,
    level: item.level,
    kind: item.kind,
    message: item.message.slice(0, 500),
    requestId: item.requestId,
    userId: item.userId,
    role: item.role,
    meta: isRecord(item.meta) ? safeMeta(item.meta) : {},
  };
}
