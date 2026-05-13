/**
 * handlers/api.ts — JSON API endpoints.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { BodyTooLargeError, requireAdminApi, checkCsrf, readBody, json } from '../lib/http.ts';
import { setUserRole, type UserRole } from '../lib/auth/auth.ts';
import { logger, logInputFromRequest } from '../lib/logging/logger.ts';

// ── Handlers ──────────────────────────────────────────────────────────────────

export async function handleAdminSetUserRole(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const session = requireAdminApi(req, res);
  if (!session) return;
  if (!checkCsrf(req, res)) return;

  let data: { userId: number; role: UserRole };
  try {
    data = JSON.parse(await readBody(req));
  } catch (err) {
    if (err instanceof BodyTooLargeError) {
      logger.warn('api', 'admin.user.role.set body too large', logInputFromRequest(req));
      return json(res, 413, { error: 'body too large' });
    }
    return json(res, 400, { error: 'invalid json' });
  }

  if (!Number.isInteger(data.userId) || !['user', 'admin'].includes(data.role)) {
    logger.warn('api', 'admin.user.role.set invalid', logInputFromRequest(req));
    return json(res, 400, { error: 'invalid request' });
  }

  if (data.userId === session.userId && data.role !== 'admin') {
    logger.warn(
      'auth',
      'admin.user.role.self-demotion rejected',
      logInputFromRequest(req, { targetUserId: data.userId }),
    );
    return json(res, 403, { error: 'cannot change your own admin role' });
  }

  const saved = setUserRole(data.userId, data.role);
  logger.audit(
    'admin.user.role.set',
    logInputFromRequest(req, { targetUserId: data.userId, targetRole: data.role, saved }),
  );
  json(res, 200, { ok: true, saved });
}
