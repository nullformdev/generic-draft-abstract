/**
 * handlers/home.ts — GET /
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { config } from '../config.ts';
import { requireSession, html } from '../lib/http.ts';
import { renderHomePage } from '../pages/home.ts';

export function handleHome(req: IncomingMessage, res: ServerResponse): void {
  const session = requireSession(req, res);
  if (!session) return;

  html(
    res,
    renderHomePage({
      lang: session.data.lang ?? config.DEFAULT_LANG,
      isAdmin: session.role === 'admin',
    }),
  );
}
