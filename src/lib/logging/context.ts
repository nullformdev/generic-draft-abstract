import { randomBytes } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { RequestLogContext, UserRole } from './types.ts';

const contexts = new WeakMap<IncomingMessage, RequestLogContext>();

function requestId(): string {
  return `req_${randomBytes(8).toString('hex')}`;
}

function pathOnly(req: IncomingMessage): string {
  return (req.url ?? '/').split('?')[0] || '/';
}

export function initRequestContext(req: IncomingMessage): RequestLogContext {
  const ctx: RequestLogContext = {
    requestId: requestId(),
    method: req.method ?? 'GET',
    path: pathOnly(req),
    route: '',
    startMs: Date.now(),
  };
  contexts.set(req, ctx);
  return ctx;
}

export function getRequestContext(req: IncomingMessage): RequestLogContext | undefined {
  return contexts.get(req);
}

export function setRequestRoute(req: IncomingMessage, route: string): void {
  const ctx = contexts.get(req);
  if (ctx) ctx.route = route;
}

export function setRequestUser(req: IncomingMessage, userId: number, role: UserRole): void {
  const ctx = contexts.get(req);
  if (!ctx) return;
  ctx.userId = userId;
  ctx.role = role;
}

export function requestLogInput(req: IncomingMessage): {
  requestId?: string;
  userId?: number;
  role?: UserRole;
} {
  const ctx = contexts.get(req);
  if (!ctx) return {};
  return {
    requestId: ctx.requestId,
    userId: ctx.userId,
    role: ctx.role,
  };
}
