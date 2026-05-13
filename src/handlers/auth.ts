/**
 * handlers/auth.ts — GET/POST /login, GET/POST /register, POST /logout, GET /lang/:code
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { parseCookies } from '../lib/auth/cookies.ts';
import { setCookie, clearCookie } from '../lib/auth/cookies.ts';
import {
  createSession,
  getSession,
  destroySession,
  updateSessionData,
} from '../lib/auth/sessions.ts';
import { checkLoginRateLimit, resetLoginRateLimit } from '../lib/auth/ratelimit.ts';
import { authenticate, register, checkInviteCode } from '../lib/auth/auth.ts';
import { renderLoginPage, renderRegisterPage } from '../pages/auth.ts';
import {
  BodyTooLargeError,
  redirect,
  html,
  readBody,
  parseForm,
  getClientIp,
} from '../lib/http.ts';
import { logInputFromRequest, logger } from '../lib/logging/logger.ts';
import { config } from '../config.ts';

// ── Helpers ───────────────────────────────────────────────────────────────────

const LOGIN_MAX_LENGTH = 64;
const PASSWORD_MAX_LENGTH = 256;
const LANG_COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000;

function getLang(req: IncomingMessage): string {
  return parseCookies(req).lang ?? config.DEFAULT_LANG;
}

function normalizeLogin(login: string): string {
  return login.trim();
}

function credentialsAreValid(login: string, password: string): boolean {
  return (
    login.length > 0 &&
    login.length <= LOGIN_MAX_LENGTH &&
    password.length > 0 &&
    password.length <= PASSWORD_MAX_LENGTH
  );
}

function redirectBack(req: IncomingMessage): string {
  const ref = (req.headers.referer as string | undefined) ?? '';
  if (ref.startsWith('/') && !ref.startsWith('//')) return ref;
  try {
    const url = new URL(ref);
    if (url.host === req.headers.host) return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
  return '/';
}

// ── Handlers ──────────────────────────────────────────────────────────────────

export async function handleLogin(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const lang = getLang(req);

  if (req.method === 'GET') {
    const cookies = parseCookies(req);
    if (cookies.sid && getSession(cookies.sid)) return redirect(res, '/');
    return html(res, renderLoginPage(lang));
  }

  let body: string;
  try {
    body = await readBody(req);
  } catch (err) {
    if (err instanceof BodyTooLargeError) {
      logger.warn('auth', 'login body too large', logInputFromRequest(req));
      return html(res, renderLoginPage(lang, 'auth.error.invalid'), 413);
    }
    throw err;
  }
  const form = parseForm(body);
  const login = normalizeLogin(form.login ?? '');
  const password = form.password ?? '';
  const ip = getClientIp(req);

  if (!credentialsAreValid(login, password)) {
    logger.warn('auth', 'login invalid input', logInputFromRequest(req, { login }));
    return html(res, renderLoginPage(lang, 'auth.error.invalid'));
  }

  if (!checkLoginRateLimit(ip, login)) {
    logger.warn('auth', 'login rate limited', logInputFromRequest(req, { login }));
    return html(res, renderLoginPage(lang, 'auth.error.ratelimit'));
  }

  const user = await authenticate(login, password);
  if (!user) {
    logger.warn('auth', 'login failed', logInputFromRequest(req, { login }));
    return html(res, renderLoginPage(lang, 'auth.error.invalid'));
  }

  resetLoginRateLimit(ip, login);
  const sid = createSession(user.id, { lang });
  setCookie(res, 'sid', sid, config.SESSION_MAX_AGE);
  logger.info('auth', 'login success', logInputFromRequest(req, { userId: user.id, login }));
  redirect(res, '/');
}

export async function handleRegister(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const lang = getLang(req);

  if (req.method === 'GET') {
    return html(res, renderRegisterPage(lang));
  }

  let body: string;
  try {
    body = await readBody(req);
  } catch (err) {
    if (err instanceof BodyTooLargeError) {
      logger.warn('auth', 'register body too large', logInputFromRequest(req));
      return html(res, renderRegisterPage(lang, 'auth.error.invalid'), 413);
    }
    throw err;
  }
  const form = parseForm(body);
  const invite = form.invite ?? '';
  const login = normalizeLogin(form.login ?? '');
  const password = form.password ?? '';

  if (!credentialsAreValid(login, password)) {
    logger.warn('auth', 'register invalid input', logInputFromRequest(req, { login }));
    return html(res, renderRegisterPage(lang, 'auth.error.invalid'));
  }

  if (!checkInviteCode(invite)) {
    logger.warn('auth', 'register invalid invite', logInputFromRequest(req, { login }));
    return html(res, renderRegisterPage(lang, 'auth.error.invite'));
  }

  try {
    const user = await register(login, password);
    const sid = createSession(user.id, { lang });
    setCookie(res, 'sid', sid, config.SESSION_MAX_AGE);
    logger.info('auth', 'register success', logInputFromRequest(req, { userId: user.id, login }));
    redirect(res, '/');
  } catch {
    logger.warn('auth', 'register failed', logInputFromRequest(req, { login }));
    return html(res, renderRegisterPage(lang, 'auth.error.taken'));
  }
}

export function handleLang(
  req: IncomingMessage,
  res: ServerResponse,
  params: Record<string, string>,
): void {
  const cookies = parseCookies(req);
  const session = cookies.sid ? getSession(cookies.sid) : undefined;
  const lang = params.code === 'ru' ? 'ru' : 'en';

  if (session) {
    updateSessionData(session.sid, { ...session.data, lang });
    logger.info('auth', 'language changed', logInputFromRequest(req, { lang }));
  }

  setCookie(res, 'lang', lang, LANG_COOKIE_MAX_AGE);
  redirect(res, redirectBack(req));
}

export function handleLogout(req: IncomingMessage, res: ServerResponse): void {
  const cookies = parseCookies(req);
  if (cookies.sid) destroySession(cookies.sid);
  clearCookie(res, 'sid');
  logger.info('auth', 'logout', logInputFromRequest(req));
  redirect(res, '/login');
}
