#!/bin/bash
set -euo pipefail

# ============================================
# generic-draft-abstract setup script
# Ubuntu 24.04, fresh install
# Run as root from project root: sudo bash setup.sh
# Source code is already in place alongside this script
# ============================================

DOMAIN="example.com"
APP_NAME="generic-draft-abstract"
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
DATA_DIR="${APP_DIR}/data"
NODE_MAJOR=24

# Detect the user who owns the project directory; fall back to root.
APP_USER="$(stat -c '%U' "${APP_DIR}")"
APP_GROUP="$(stat -c '%G' "${APP_DIR}")"
if [ "${APP_USER}" = "UNKNOWN" ] || [ -z "${APP_USER}" ]; then
  APP_USER="root"
  APP_GROUP="root"
fi

echo "=== Project directory: ${APP_DIR} (owner: ${APP_USER}) ==="

echo "=== Updating system ==="
apt update && apt upgrade -y

echo "=== Installing base packages ==="
apt install -y curl wget git unzip acl

echo "=== Installing nginx ==="
apt install -y nginx
systemctl enable nginx

echo "=== Installing certbot ==="
apt install -y certbot python3-certbot-nginx

echo "=== Installing Node.js ${NODE_MAJOR} ==="
curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash -
apt install -y nodejs
echo "Node.js version: $(node --version)"

echo "=== Creating runtime directories ==="
mkdir -p "${DATA_DIR}"
chown -R "${APP_USER}:${APP_GROUP}" "${DATA_DIR}"

echo "=== Setting up firewall ==="
if command -v ufw &>/dev/null; then
  ufw allow 22/tcp || true
  ufw allow 'Nginx Full'
  ufw --force enable
else
  echo "ufw not found — skipping firewall setup"
fi

echo "=== Setting permissions for nginx ==="
# nginx (www-data) needs traversal/read access for browser modules only.
setfacl -m u:www-data:--x "$(dirname "${APP_DIR}")" "${APP_DIR}" "${APP_DIR}/src"
find "${APP_DIR}/src/static" "${APP_DIR}/src/engine" "${APP_DIR}/src/parts" -type d -exec setfacl -m u:www-data:rx {} +
find "${APP_DIR}/src/static" "${APP_DIR}/src/engine" "${APP_DIR}/src/parts" -type f -exec setfacl -m u:www-data:r {} +
ln -sfn "${APP_DIR}/src/static" "${APP_DIR}/static"

echo "=== Creating nginx config ==="
cat > /etc/nginx/sites-available/${APP_NAME} << NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} localhost;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /static/ {
        alias ${APP_DIR}/static/;
        try_files \$uri =404;
    }

    location /engine/ {
        alias ${APP_DIR}/src/engine/;
        try_files \$uri =404;
    }

    location /parts/ {
        alias ${APP_DIR}/src/parts/;
        try_files \$uri =404;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/${APP_NAME} /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "=== Creating systemd service ==="

cat > /etc/systemd/system/${APP_NAME}-log-service.service << EOF
[Unit]
Description=${APP_NAME} - log service
After=network.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_GROUP}
WorkingDirectory=${APP_DIR}
RuntimeDirectory=${APP_NAME}
RuntimeDirectoryMode=0750
ExecStart=/usr/bin/node --env-file=${APP_DIR}/.env src/log-service.ts
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/${APP_NAME}-server.service << EOF
[Unit]
Description=${APP_NAME} - server
After=network.target ${APP_NAME}-log-service.service
Wants=${APP_NAME}-log-service.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_GROUP}
WorkingDirectory=${APP_DIR}
ExecStart=/usr/bin/node --env-file=${APP_DIR}/.env src/server.ts
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload

echo "=== Creating .env template ==="
if [ ! -f "${APP_DIR}/.env" ]; then
cat > "${APP_DIR}/.env" << EOF
# Server
PORT=3000
HOST=127.0.0.1
DOMAIN=${DOMAIN}

# Database
DB_PATH=${DATA_DIR}/${APP_NAME}.db

# Auth
INVITE_CODE=changeme
SESSION_MAX_AGE=604800000

# i18n
DEFAULT_LANG=ru

# Logging
LOG_SOCKET_PATH=/run/${APP_NAME}/log.sock
LOG_DB_PATH=${DATA_DIR}/logs.db
LOG_RETENTION_DAYS=30
LOG_QUEUE_LIMIT=1000
LOG_SLOW_DB_MS=100
EOF
chown "${APP_USER}:${APP_GROUP}" "${APP_DIR}/.env"
echo ".env created — edit before starting services"
else
echo ".env already exists — skipping"
fi

echo ""
echo "=== Setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Point DNS to this VPS and set DOMAIN in ${APP_DIR}/.env"
echo "  2. Get HTTPS: certbot --nginx -d your-domain.com"
echo "  3. Edit config: nano ${APP_DIR}/.env"
echo "  4. Start service:"
echo "     systemctl enable --now ${APP_NAME}-log-service ${APP_NAME}-server"
echo ""
