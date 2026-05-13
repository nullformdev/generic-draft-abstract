import { getRequestContext, requestLogInput } from './context.ts';
import { SocketLogClient } from './socket-client.ts';
import type { LogEvent, LogInput, LogKind, LogLevel } from './types.ts';
import type { IncomingMessage } from 'node:http';

const transport = new SocketLogClient();

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

function safeMeta(meta: Record<string, unknown> = {}): Record<string, unknown> {
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

function emit(level: LogLevel, kind: LogKind, message: string, input: LogInput = {}): void {
  const event: LogEvent = {
    v: 1,
    ts: new Date().toISOString(),
    level,
    kind,
    message: message.slice(0, 500),
    meta: safeMeta(input.meta),
  };
  if (input.requestId) event.requestId = input.requestId;
  if (input.userId) event.userId = input.userId;
  if (input.role) event.role = input.role;
  transport.write(event);
}

export const logger = {
  debug: (kind: LogKind, message: string, input?: LogInput) => emit('debug', kind, message, input),
  info: (kind: LogKind, message: string, input?: LogInput) => emit('info', kind, message, input),
  warn: (kind: LogKind, message: string, input?: LogInput) => emit('warn', kind, message, input),
  error: (kind: LogKind, message: string, input?: LogInput) => emit('error', kind, message, input),
  audit: (message: string, input?: LogInput) => emit('info', 'audit', message, input),
  close: () => transport.close(),
};

export function logRequest(req: IncomingMessage, status: number, error?: unknown): void {
  const ctx = getRequestContext(req);
  if (!ctx) return;
  const level = error || status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
  const err = error instanceof Error ? error : undefined;
  emit(level, 'request', `${ctx.method} ${ctx.route || ctx.path}`, {
    requestId: ctx.requestId,
    userId: ctx.userId,
    role: ctx.role,
    meta: {
      method: ctx.method,
      route: ctx.route || ctx.path,
      path: ctx.path,
      status,
      durationMs: Date.now() - ctx.startMs,
      error: err?.message,
      errorName: err?.name,
    },
  });
}

export function logDbOperation<T>(name: string, fn: () => T): T {
  const start = Date.now();
  try {
    const result = fn();
    const durationMs = Date.now() - start;
    const slowMs = Number.parseInt(process.env.LOG_SLOW_DB_MS ?? '100', 10);
    if (durationMs >= slowMs) {
      logger.warn('db', name, { meta: { operation: name, durationMs } });
    }
    return result;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('db', name, {
      meta: { operation: name, durationMs: Date.now() - start, error: error.message },
    });
    throw err;
  }
}

export function logBaker<T>(name: string, fn: () => T, input: LogInput = {}): T {
  const start = Date.now();
  try {
    const result = fn();
    const durationMs = Date.now() - start;
    logger.info('baker', name, { ...input, meta: { ...(input.meta ?? {}), baker: name, durationMs } });
    return result;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('baker', name, {
      ...input,
      meta: { ...(input.meta ?? {}), baker: name, durationMs: Date.now() - start, error: error.message },
    });
    throw err;
  }
}

export function logInputFromRequest(req: IncomingMessage, meta: Record<string, unknown> = {}): LogInput {
  return { ...requestLogInput(req), meta };
}
