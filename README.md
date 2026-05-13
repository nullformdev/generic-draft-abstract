# generic-draft-abstract

Minimal Node.js 24 + SQLite boilerplate with a small custom frontend parts system.

The project starts with:

- login, registration by invite code, logout;
- session-based authentication;
- `user` and `admin` roles;
- admin page for user role management;
- protected empty home page;
- SQLite `users` and `sessions` tables;
- logging architecture documented for a separate log service;
- nginx/systemd deployment notes;
- no application-level npm runtime dependencies.

## Development

Prerequisites: Node.js 24 and development tools for type checking/linting.

Runtime code should stay free of application-level npm dependencies. See `docs/dependencies.md`.

Run the local dev server:

```bash
node --run dev
```

The dev server loads `.env.dev`:

- `PORT=3000`
- `HOST=127.0.0.1`
- `DOMAIN=localhost`
- `DB_PATH=./data/dev.db`
- `INVITE_CODE=dev`
- `DEFAULT_LANG=ru`
- `LOG_SOCKET_PATH=./data/log.sock`
- `LOG_DB_PATH=./data/logs.dev.db`

It also serves `/static/`, `/engine/`, and `/parts/` from Node so nginx is not needed locally.
It starts the log service as a child process.

```bash
node --run check
node --run lint
node --run format
```

## Deploying to a VPS

Tested target: Ubuntu 24.04. Full deployment documentation lives in `docs/deploy.md`.

Quick first deploy on the VPS:

```bash
git clone <repo> /srv/generic-draft-abstract
cd /srv/generic-draft-abstract
bash setup.sh
nano .env
systemctl enable --now generic-draft-abstract-log-service generic-draft-abstract-server
```

For HTTPS, point DNS to the VPS and run:

```bash
certbot --nginx -d your-domain.com
```

Open `/register` and register with `INVITE_CODE` from `.env`. New accounts start as `user`; grant the first admin role from the VPS:

```bash
cd /srv/generic-draft-abstract
node --env-file=.env -e "const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync(process.env.DB_PATH); db.prepare('UPDATE users SET role = ? WHERE login = ?').run('admin', 'YOUR_LOGIN');"
```

After one admin exists, manage roles from `/admin`.

## Runtime Shape

- nginx serves `/static/`, `/engine/`, and `/parts/` directly.
- Node owns application routes and JSON APIs.
- Application logs are emitted to a separate log service over Unix socket JSONL; see `docs/logging.md`.
- Admins can view recent application logs at `/admin/logs`.
- HTML handlers call page renderers.
- Page renderers assemble the shell, baked JSON, and part mount scripts.
- Part bakers are server-only state builders colocated with frontend parts.
