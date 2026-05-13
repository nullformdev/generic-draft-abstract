/**
 * dev-static.ts — development-only browser asset serving.
 *
 * Production serves /static, /engine, and /parts through nginx. This helper
 * mirrors that routing locally so the app can run without nginx in development.
 */

import { readFileSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, resolve } from 'node:path';

interface StaticMount {
  prefix: string;
  root: string;
  allow: (path: string) => boolean;
}

const mounts: StaticMount[] = [
  {
    prefix: '/static/',
    root: resolve('src/static'),
    allow: () => true,
  },
  {
    prefix: '/engine/',
    root: resolve('src/engine'),
    allow: (path) => path.endsWith('.js'),
  },
  {
    prefix: '/parts/',
    root: resolve('src/parts'),
    allow: (path) => path.endsWith('.js'),
  },
];

const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function notFound(res: ServerResponse): void {
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
}

function isInside(root: string, filePath: string): boolean {
  return filePath === root || filePath.startsWith(`${root}/`);
}

export function serveDevAsset(req: IncomingMessage, res: ServerResponse): boolean {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;

  const rawPath = (req.url ?? '/').split('?')[0];
  const mount = mounts.find((item) => rawPath.startsWith(item.prefix));
  if (!mount) return false;

  let relativePath: string;
  try {
    relativePath = decodeURIComponent(rawPath.slice(mount.prefix.length));
  } catch {
    notFound(res);
    return true;
  }

  const filePath = resolve(mount.root, relativePath);
  if (!isInside(mount.root, filePath) || !mount.allow(filePath)) {
    notFound(res);
    return true;
  }

  try {
    const stat = statSync(filePath);
    if (stat.size < 0) {
      notFound(res);
      return true;
    }
    const body = readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentTypes[extname(filePath)] ?? 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'no-store',
    });
    if (req.method === 'HEAD') res.end();
    else res.end(body);
  } catch {
    notFound(res);
  }

  return true;
}
