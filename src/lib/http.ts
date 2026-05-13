/**
 * http.ts — shared request/response helpers for handlers.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { parseCookies } from './auth/cookies.ts';
import { getSession } from './auth/sessions.ts';
import type { Session } from './auth/sessions.ts';
import { setRequestUser, requestLogInput } from './logging/context.ts';
import { logger } from './logging/logger.ts';

export class BodyTooLargeError extends Error {
  constructor() {
    super('body too large');
    this.name = 'BodyTooLargeError';
  }
}

const NO_STORE = { 'Cache-Control': 'no-store' };

export function redirect(res: ServerResponse, location: string): void {
  res.writeHead(302, { ...NO_STORE, Location: location });
  res.end();
}

const CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'";

export function html(res: ServerResponse, body: string, status = 200): void {
  res.writeHead(status, {
    ...NO_STORE,
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': CSP,
  });
  res.end(body);
}

/** Returns true if the request passes a same-origin check; responds 403 otherwise. */
export function checkCsrf(req: IncomingMessage, res: ServerResponse): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers.host ?? '';
  if (origin === `https://${host}` || origin === `http://${host}`) return true;
  logger.warn('auth', 'csrf forbidden', requestLogInput(req));
  json(res, 403, { error: 'forbidden' });
  return false;
}

export function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { ...NO_STORE, 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

export function notFound(res: ServerResponse, message = 'Not found'): void {
  res.writeHead(404, { ...NO_STORE, 'Content-Type': 'text/plain' });
  res.end(message);
}

export function forbidden(res: ServerResponse, message = 'Forbidden'): void {
  res.writeHead(403, { ...NO_STORE, 'Content-Type': 'text/plain' });
  res.end(message);
}

export function readBody(req: IncomingMessage, maxBytes = 8192): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let tooLarge = false;
    req.on('data', (chunk: Buffer) => {
      if (tooLarge) return;
      size += chunk.length;
      if (size > maxBytes) {
        tooLarge = true;
        return reject(new BodyTooLargeError());
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

export function parseForm(body: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(body));
}

export function getQuery(req: IncomingMessage): Record<string, string> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  return Object.fromEntries(url.searchParams);
}

function isLoopback(address: string): boolean {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

export function getClientIp(req: IncomingMessage): string {
  const remoteAddress = req.socket.remoteAddress ?? '';
  const forwardedFor = req.headers['x-forwarded-for'];
  if (isLoopback(remoteAddress) && typeof forwardedFor === 'string') {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) return first;
  }
  return remoteAddress || 'unknown';
}

/** Returns session or redirects to /login. Use in HTML handlers. */
export function requireSession(req: IncomingMessage, res: ServerResponse): Session | undefined {
  const cookies = parseCookies(req);
  const session = cookies.sid ? getSession(cookies.sid) : undefined;
  if (!session) {
    logger.warn('auth', 'session required', requestLogInput(req));
    redirect(res, '/login');
  } else {
    setRequestUser(req, session.userId, session.role);
  }
  return session;
}

export function requireAdmin(req: IncomingMessage, res: ServerResponse): Session | undefined {
  const session = requireSession(req, res);
  if (!session) return undefined;
  if (session.role !== 'admin') {
    logger.warn('auth', 'admin forbidden', requestLogInput(req));
    forbidden(res);
    return undefined;
  }
  return session;
}

/** Returns session or responds with JSON 401. Use in API handlers. */
export function requireSessionApi(req: IncomingMessage, res: ServerResponse): Session | undefined {
  const cookies = parseCookies(req);
  const session = cookies.sid ? getSession(cookies.sid) : undefined;
  if (!session) {
    logger.warn('auth', 'api session required', requestLogInput(req));
    json(res, 401, { error: 'unauthorized' });
    return undefined;
  }
  setRequestUser(req, session.userId, session.role);
  return session;
}

export function requireAdminApi(req: IncomingMessage, res: ServerResponse): Session | undefined {
  const session = requireSessionApi(req, res);
  if (!session) return undefined;
  if (session.role !== 'admin') {
    logger.warn('auth', 'api admin forbidden', requestLogInput(req));
    json(res, 403, { error: 'forbidden' });
    return undefined;
  }
  return session;
}
