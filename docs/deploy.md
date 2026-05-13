# Deployment

This document describes how to deploy `generic-draft-abstract` without mixing application source and persistent runtime data.

## Values

- **Bootstrap once:** machine setup is not a normal source deploy.
- **Preserve data:** deploys must not overwrite `.env` or `data/`.
- **Restart narrowly:** restart Node for source changes, reload nginx only for nginx config changes.
- **Verify behavior:** check services, logs, static modules, and auth paths after deploy.

## Runtime Files

The VPS app directory should usually be `/srv/generic-draft-abstract` or another service
directory outside `/root`. Avoid deploying under `/root`; nginx only needs ACL access to
static browser assets, not broad traversal access to the root home directory.

Runtime source:

- `src/`
- `package.json`

Persistent runtime files:

- `.env`
- `data/`
- `static` symlink to `src/static`, created by `setup.sh`
- runtime socket directory managed by systemd for log service

`package.json` is needed because it contains `"type": "module"`. The `dev` script is local-only; production starts `src/server.ts` directly.

## First Deploy With Git

```bash
ssh root@<VPS_IP>
git clone <repo> /srv/generic-draft-abstract
cd /srv/generic-draft-abstract
bash setup.sh
nano .env
systemctl enable --now generic-draft-abstract-log-service generic-draft-abstract-server
```

For HTTPS:

```bash
certbot --nginx -d your-domain.com
```

`setup.sh` installs system packages, creates directories, writes nginx config, writes systemd services for the log service and app server, creates `.env` if missing, and reloads systemd/nginx. Do not rerun it casually on an existing server unless you intend to reapply machine setup.

## First Admin

New registrations receive `user`. After registering the first account, grant admin once from the VPS:

```bash
cd /srv/generic-draft-abstract
node --env-file=.env -e "const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync(process.env.DB_PATH); db.prepare('UPDATE users SET role = ? WHERE login = ?').run('admin', 'YOUR_LOGIN');"
```

Check roles:

```bash
node --env-file=.env -e "const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync(process.env.DB_PATH); console.log(db.prepare('SELECT id, login, role FROM users').all());"
```

After one admin exists, manage roles from `/admin`.

## Subsequent Git Deploy

```bash
cd /srv/generic-draft-abstract
git pull
systemctl restart generic-draft-abstract-log-service generic-draft-abstract-server
```

Reload nginx only if nginx config changed:

```bash
nginx -t && systemctl reload nginx
```

## rsync Deploy

Use this when the local checkout is the source of truth.

First server setup:

```bash
rsync -av ~/<project_path>/generic-draft-abstract/setup.sh root@<VPS_IP>:/srv/generic-draft-abstract/setup.sh
ssh root@<VPS_IP>
cd /srv/generic-draft-abstract
bash setup.sh
nano .env
systemctl enable --now generic-draft-abstract-log-service generic-draft-abstract-server
```

Subsequent source deploy:

```bash
rsync -av --delete \
  --include='/src/***' \
  --include='/package.json' \
  --exclude='*' \
  ~/<project_path>/generic-draft-abstract/ \
  root@<VPS_IP>:/srv/generic-draft-abstract/
```

Then restart Node:

```bash
ssh root@<VPS_IP> 'systemctl restart generic-draft-abstract-log-service generic-draft-abstract-server'
```

The rsync include set intentionally excludes `.env` and `data/`.

## Post-Deploy Checks

```bash
ssh root@<VPS_IP> 'systemctl status generic-draft-abstract-server --no-pager'
ssh root@<VPS_IP> 'journalctl -u generic-draft-abstract-server -n 50 --no-pager'
ssh root@<VPS_IP> 'systemctl status generic-draft-abstract-log-service --no-pager'
ssh root@<VPS_IP> 'journalctl -u generic-draft-abstract-log-service -n 50 --no-pager'
curl -I https://your-domain.com/engine/core.js
curl -I https://your-domain.com/parts/home-page/index.js
```

Also verify:

- guest `/` redirects to `/login`;
- a normal user receives `403` on `/admin`;
- an admin can open `/admin`.
- an admin can open `/admin/logs`.
