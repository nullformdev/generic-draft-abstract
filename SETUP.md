# generic-draft-abstract — setup guide

## 1. Clone and bootstrap

```bash
sudo git clone <repo> /srv/generic-draft-abstract
cd /srv/generic-draft-abstract
sudo bash setup.sh
```

`setup.sh` installs Node.js 24, nginx, certbot, creates `data/`, creates the `static` symlink, writes nginx aliases for browser modules, creates `.env`, and installs two systemd services: `generic-draft-abstract-log-service` and `generic-draft-abstract-server`.

For local development, do not run `setup.sh`. Use:

```bash
node --run dev
```

The dev command creates `data/`, uses `./data/dev.db`, starts the log service child process, and serves browser assets from Node without nginx.

Development settings live in `.env.dev`.

## 2. Configure

Edit `.env`:

```bash
nano .env
```

Important values:

| Variable | Purpose |
| --- | --- |
| `DOMAIN` | Public domain used by nginx/certbot |
| `DB_PATH` | SQLite database path |
| `INVITE_CODE` | Code required by `/register` |
| `SESSION_MAX_AGE` | Session lifetime in milliseconds |
| `DEFAULT_LANG` | `en` or `ru` |
| `LOG_SOCKET_PATH` | Unix socket used by the app to send logs |
| `LOG_DB_PATH` | SQLite database written by the log service |
| `LOG_RETENTION_DAYS` | Log retention window |

## 3. Start

```bash
sudo systemctl enable --now generic-draft-abstract-log-service generic-draft-abstract-server
```

For HTTPS:

```bash
sudo certbot --nginx -d your-domain.com
```

## 4. First admin

Register the first user at `/register`, then promote it from the VPS:

```bash
node --env-file=.env -e "const { DatabaseSync } = require('node:sqlite'); const db = new DatabaseSync(process.env.DB_PATH); db.prepare('UPDATE users SET role = ? WHERE login = ?').run('admin', 'YOUR_LOGIN');"
```

After that, use `/admin` to manage user roles.

## 5. Logs

```bash
sudo systemctl status generic-draft-abstract-server --no-pager
sudo journalctl -u generic-draft-abstract-server -n 50 --no-pager
sudo systemctl status generic-draft-abstract-log-service --no-pager
sudo journalctl -u generic-draft-abstract-log-service -n 50 --no-pager
```
