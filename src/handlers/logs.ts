/**
 * handlers/logs.ts — admin log pages and APIs.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { config } from '../config.ts';
import { requireAdmin, requireAdminApi, html, json, getQuery } from '../lib/http.ts';
import { renderLogsPage } from '../pages/logs.ts';
import { listRecentLogs } from '../lib/log-reader.ts';

export function handleAdminLogs(req: IncomingMessage, res: ServerResponse): void {
  const session = requireAdmin(req, res);
  if (!session) return;

  html(
    res,
    renderLogsPage({
      lang: session.data.lang ?? config.DEFAULT_LANG,
      isAdmin: session.role === 'admin',
    }),
  );
}

export function handleAdminLogsApi(req: IncomingMessage, res: ServerResponse): void {
  if (!requireAdminApi(req, res)) return;

  const limit = Number.parseInt(getQuery(req).limit ?? '100', 10);
  json(res, 200, { ok: true, logs: listRecentLogs(limit) });
}
