/**
 * server.ts — HTTP server entry point.
 *
 * Startup:
 *   node --env-file=.env src/server.ts
 */

import { createServer } from 'node:http';
import { config } from './config.ts';
import { serveDevAsset } from './lib/dev-static.ts';
import { purgeExpired } from './lib/auth/sessions.ts';
import { initRequestContext, setRequestRoute } from './lib/logging/context.ts';
import { logger, logRequest } from './lib/logging/logger.ts';
import { Router } from './lib/router.ts';
import type { Handler } from './lib/router.ts';

import { handleLogin, handleRegister, handleLogout, handleLang } from './handlers/auth.ts';
import { handleHome } from './handlers/home.ts';
import { handleAdmin } from './handlers/admin.ts';
import { handleAdminSetUserRole } from './handlers/api.ts';
import { handleAdminLogs, handleAdminLogsApi } from './handlers/logs.ts';

type RouteMethod = 'get' | 'post';

interface RouteConfig {
  method: RouteMethod;
  path: string;
  handler: Handler;
}

const routes: RouteConfig[] = [
  // Auth
  {
    method: 'get',
    path: '/login',
    handler: handleLogin,
  },
  {
    method: 'post',
    path: '/login',
    handler: handleLogin,
  },
  {
    method: 'get',
    path: '/register',
    handler: handleRegister,
  },
  {
    method: 'post',
    path: '/register',
    handler: handleRegister,
  },
  {
    method: 'post',
    path: '/logout',
    handler: handleLogout,
  },
  {
    method: 'get',
    path: '/lang/:code',
    handler: handleLang,
  },

  // Home
  {
    method: 'get',
    path: '/',
    handler: handleHome,
  },

  // Admin
  {
    method: 'get',
    path: '/admin',
    handler: handleAdmin,
  },
  {
    method: 'get',
    path: '/admin/logs',
    handler: handleAdminLogs,
  },

  // API
  {
    method: 'post',
    path: '/api/admin/user/role',
    handler: handleAdminSetUserRole,
  },
  {
    method: 'get',
    path: '/api/admin/logs',
    handler: handleAdminLogsApi,
  },
];

const router = new Router();

for (const route of routes) {
  router[route.method](route.path, route.handler);
}

function purgeExpiredSessions(): void {
  try {
    purgeExpired();
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('system', 'sessions.purgeExpired failed', { meta: { error: error.message } });
  }
}

purgeExpiredSessions();
setInterval(purgeExpiredSessions, 60 * 60 * 1000);

// Server
const server = createServer((req, res) => {
  if (process.env.DEV_SERVER === '1' && serveDevAsset(req, res)) return;

  initRequestContext(req);
  const matched = router.match(req);
  setRequestRoute(req, matched?.route.path ?? 'not_found');

  const finish = (err?: unknown) => {
    logRequest(req, res.statusCode || (err ? 500 : 200), err);
  };

  Promise.resolve(matched ? matched.route.handler(req, res, matched.params) : router.dispatch(req, res))
    .then(() => finish())
    .catch((err: unknown) => {
      console.error(err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal server error');
      }
      finish(err);
    });
});

process.on('SIGINT', () => logger.close());
process.on('SIGTERM', () => logger.close());

server.listen(config.PORT, config.HOST, () => {
  console.log(`server listening on ${config.HOST}:${config.PORT}`);
  if (process.env.DEV_SERVER === '1') {
    console.log('dev static serving enabled for /static, /engine, and /parts');
  }
});
