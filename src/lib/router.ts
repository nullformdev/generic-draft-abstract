/**
 * router.ts — maps incoming requests to handlers by method and path pattern.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';

// ── Types ─────────────────────────────────────────────────────────────────────

export type Handler = (
  req: IncomingMessage,
  res: ServerResponse,
  params: Record<string, string>,
) => void | Promise<void>;

interface Route {
  method: string;
  path: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
}

// ── Router ────────────────────────────────────────────────────────────────────

export class Router {
  private routes: Route[] = [];

  private add(method: string, path: string, handler: Handler): void {
    const keys: string[] = [];
    const pattern = new RegExp(
      '^' +
        path.replace(/:([a-z]+)/g, (_, key) => {
          keys.push(key);
          return '([^/]+)';
        }) +
        '$',
    );
    this.routes.push({ method, path, pattern, keys, handler });
  }

  get(path: string, handler: Handler): void {
    this.add('GET', path, handler);
  }
  post(path: string, handler: Handler): void {
    this.add('POST', path, handler);
  }

  match(req: IncomingMessage): { route: Route; params: Record<string, string> } | undefined {
    const method = req.method ?? 'GET';
    const url = (req.url ?? '/').split('?')[0];

    for (const route of this.routes) {
      if (route.method !== method) continue;
      const match = url.match(route.pattern);
      if (!match) continue;

      const params: Record<string, string> = {};
      route.keys.forEach((key, i) => {
        params[key] = match[i + 1];
      });

      return { route, params };
    }

    return undefined;
  }

  async dispatch(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const matched = this.match(req);
    if (matched) {
      await matched.route.handler(req, res, matched.params);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}
