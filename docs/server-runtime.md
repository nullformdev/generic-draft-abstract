# Server Runtime

This document defines how `generic-draft-abstract` runs locally and in production.

## Values

- **Clear ownership:** Node owns application behavior; nginx owns public static delivery in production.
- **One HTTP boundary:** handlers authorize and choose responses.
- **No hidden runtime dependencies:** local development uses Node built-ins, not a dev server package.
- **Operational clarity:** restart Node for application code; reload nginx only for nginx config.

## Local Development

Run:

```bash
node --run dev
```

The script loads `.env.dev`, starts `src/dev-server.ts`, creates `data/`, starts the log service as a child process, sets `DEV_SERVER=1`, and then imports `src/server.ts`.

In dev mode, Node serves:

- `/static/` from `src/static/`
- `/engine/` from `src/engine/`
- `/parts/` from `src/parts/`

Only `.js` files are served from `/engine/` and `/parts/`; `baker.ts` remains server-only and returns 404.
Development static responses use `Cache-Control: no-store` so local asset edits are not hidden by browser cache.

## Production Runtime

Production starts:

```bash
node --env-file=.env src/log-service.ts
node --env-file=.env src/server.ts
```

nginx is the public HTTP entrypoint. Node listens on `config.HOST:config.PORT`.
The app sends structured logs to the log service over `LOG_SOCKET_PATH`; the log service writes `LOG_DB_PATH`.

nginx owns:

```nginx
location /static/ { ... }
location /engine/ { ... }
location /parts/ { ... }
```

Node owns application pages and APIs not matched by static aliases.
Node HTML and JSON helpers send `Cache-Control: no-store` because page shells and API responses may contain session-specific state.

## nginx Locations

Static aliases must be declared before the generic proxy route:

```nginx
location /static/ {
    alias /path/to/generic-draft-abstract/static/;
    add_header Cache-Control "no-cache" always;
    try_files $uri =404;
}

location /engine/ {
    alias /path/to/generic-draft-abstract/src/engine/;
    add_header Cache-Control "no-cache" always;
    try_files $uri =404;
}

location /parts/ {
    alias /path/to/generic-draft-abstract/src/parts/;
    add_header Cache-Control "no-cache" always;
    try_files $uri =404;
}

location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

If `/engine/core.js` or `/parts/.../index.js` returns 404 in production, restarting Node will not fix it. The nginx alias or deployed file set is wrong.
Production browser assets use `Cache-Control: no-cache`: browsers may store them, but must revalidate before reuse. Do not use long-lived immutable caching for stable JS/CSS/module URLs unless the project adopts versioned filenames or a build manifest.

## Router

`src/server.ts` declares routes in a `RouteConfig[]` and registers them with `Router`.

Current route groups:

- Auth: `/login`, `/register`, `/logout`, `/lang/:code`
- Pages: `/`, `/admin`, `/admin/logs`
- API: `/api/admin/user/role`, `/api/admin/logs`

When adding a route, keep it explicit in the route table and put the implementation in `src/handlers/*`.

## Authorization

Authentication is session-based. Authorization is role-based:

- `user` — default for new registrations.
- `admin` — administrative UI and mutation endpoints.

Shared guards:

- `requireSession(req, res)` for protected HTML pages.
- `requireAdmin(req, res)` for admin HTML pages.
- `requireSessionApi(req, res)` for protected JSON APIs.
- `requireAdminApi(req, res)` for admin JSON APIs.

Client-side hiding is only usability. Backend guards are authoritative.

## Request Flows

HTML page:

```text
browser -> nginx or dev static/proxy -> Node router
handler -> require session/role
page renderer -> part baker(s)
renderer -> HTML shell + __BAKED__ + mount scripts
browser -> imports /engine and /parts modules
engine -> mount parts from baked state
```

JSON API:

```text
browser -> Node router
handler -> require session/role -> CSRF check for mutation
handler -> parse/validate body
handler -> durable state mutation
handler -> JSON response
```

## Adding Runtime Surface

1. Add a handler in `src/handlers/*`.
2. Add the route to `src/server.ts`.
3. Choose the correct auth guard.
4. For HTML, call one page renderer.
5. For API, validate inputs and return explicit JSON errors.
6. If new browser modules are introduced, verify dev server and nginx can serve them.
7. Update this document when public URL ownership changes.

## Operations

`setup.sh` creates runtime directories, nginx ACL permissions for browser assets, `/static` symlink, nginx aliases, and the `generic-draft-abstract-server` systemd service. It is first-machine bootstrap, not a normal deploy command.
It also creates `generic-draft-abstract-log-service.service`; the app server wants and starts after the log service.

After deploy, check:

- service status;
- recent service logs;
- static module delivery;
- a protected route;
- a forbidden admin route for a non-admin user.
