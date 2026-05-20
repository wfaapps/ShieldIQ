#!/bin/bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════════════════════
# ShieldIQ / IDfy — One-Click GCP Debian Deployment Script
# ═══════════════════════════════════════════════════════════════════════════════
# Usage:
#   1. Upload shieldiq-v2-complete.zip to your GCP VM
#   2. chmod +x deploy-debian-gcp.sh
#   3. sudo ./deploy-debian-gcp.sh
#
# This script will:
#   • Install Node.js 20, Docker, Nginx
#   • Start PostgreSQL 15 + Redis 7 via Docker
#   • Build the Next.js frontend + API backend
#   • Configure Nginx reverse proxy on port 80
#   • Create systemd services for auto-restart
# ═══════════════════════════════════════════════════════════════════════════════

APP_DIR="/opt/shieldiq"
APP_USER="shieldiq"
DOMAIN="${1:-$(curl -s http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip -H 'Metadata-Flavor: Google' 2>/dev/null || hostname -I | awk '{print $1}')}"

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     🛡️  ShieldIQ / IDfy — GCP Debian Deployment            ║"
echo "║     Target: http://${DOMAIN}                                ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ─── 1. System packages ──────────────────────────────────────────────────────
echo "📦 [1/9] Installing system dependencies..."
apt-get update -qq
apt-get install -y -qq curl wget gnupg2 unzip lsb-release ca-certificates \
  apt-transport-https software-properties-common git nginx ufw > /dev/null 2>&1
echo "   ✅ System packages installed"

# ─── 2. Node.js 20 ───────────────────────────────────────────────────────────
echo "📦 [2/9] Installing Node.js 20..."
if ! command -v node &> /dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
  apt-get install -y -qq nodejs > /dev/null 2>&1
fi
echo "   ✅ Node.js $(node -v) / npm $(npm -v)"

# ─── 3. Docker ────────────────────────────────────────────────────────────────
echo "🐳 [3/9] Installing Docker..."
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sh > /dev/null 2>&1
fi
systemctl enable docker --now > /dev/null 2>&1
echo "   ✅ Docker $(docker --version | awk '{print $3}' | tr -d ',')"

# ─── 4. Create app user & deploy code ────────────────────────────────────────
echo "📂 [4/9] Setting up application directory..."
id -u ${APP_USER} &>/dev/null || useradd -r -m -s /bin/bash ${APP_USER}
usermod -aG docker ${APP_USER}

# If zip exists in current dir, unpack it
if [ -f "shieldiq-v2-complete.zip" ]; then
  rm -rf ${APP_DIR}
  mkdir -p ${APP_DIR}
  unzip -qo shieldiq-v2-complete.zip -d ${APP_DIR}
  chown -R ${APP_USER}:${APP_USER} ${APP_DIR}
  echo "   ✅ Code deployed to ${APP_DIR}"
elif [ -d "${APP_DIR}" ]; then
  echo "   ✅ Using existing code at ${APP_DIR}"
else
  echo "   ❌ ERROR: No shieldiq-v2-complete.zip found and ${APP_DIR} doesn't exist!"
  echo "      Please upload the zip to the same directory as this script."
  exit 1
fi

# ─── 5. Generate secrets & create .env ────────────────────────────────────────
echo "🔐 [5/9] Generating production secrets..."
SESSION_SECRET=$(openssl rand -base64 32)
MFA_KEY=$(openssl rand -hex 32)
CSRF_SECRET=$(openssl rand -base64 32)
PHISH_SECRET=$(openssl rand -base64 32)

cat > ${APP_DIR}/.env << ENVEOF
# ─── App ──────────────────────────────────────────────────────────────────────
NODE_ENV=production
PORT=3001

APP_URL=http://${DOMAIN}
NEXT_PUBLIC_API_URL=http://${DOMAIN}/api/v1

# ─── Database ─────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://shieldiq:changeme@localhost:5432/shieldiq

# ─── Redis ────────────────────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ─── Auth ─────────────────────────────────────────────────────────────────────
SESSION_SECRET=${SESSION_SECRET}
MFA_ENCRYPTION_KEY=${MFA_KEY}
CSRF_SECRET=${CSRF_SECRET}
PHISH_HMAC_SECRET=${PHISH_SECRET}

# ─── Email ────────────────────────────────────────────────────────────────────
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=YOUR_SENDGRID_API_KEY_HERE
SMTP_FROM=security@yourcompany.com

# ─── Storage ──────────────────────────────────────────────────────────────────
S3_ENDPOINT=
S3_BUCKET=
S3_KEY=
S3_SECRET=
ENVEOF

# Web app .env.local
cat > ${APP_DIR}/apps/web/.env.local << WEBENVEOF
NEXT_PUBLIC_API_URL=http://${DOMAIN}/api/v1
WEBENVEOF

chown ${APP_USER}:${APP_USER} ${APP_DIR}/.env ${APP_DIR}/apps/web/.env.local
chmod 600 ${APP_DIR}/.env
echo "   ✅ Production secrets generated"

# ─── 6. Start Docker services (Postgres + Redis) ────────────────────────────
echo "🐳 [6/9] Starting PostgreSQL & Redis..."
cd ${APP_DIR}

# Use docker compose if available, otherwise docker-compose
if docker compose version &> /dev/null; then
  sudo -u ${APP_USER} docker compose up -d 2>/dev/null
else
  docker-compose up -d 2>/dev/null
fi

# Wait for Postgres to be healthy
echo "   ⏳ Waiting for PostgreSQL to be healthy..."
for i in {1..30}; do
  if docker exec shieldiq-postgres pg_isready -U shieldiq &>/dev/null; then
    break
  fi
  sleep 1
done
echo "   ✅ PostgreSQL & Redis running"

# ─── 7. Install deps, build, seed ────────────────────────────────────────────
echo "🔨 [7/9] Installing dependencies & building..."
cd ${APP_DIR}
sudo -u ${APP_USER} npm ci --prefer-offline 2>&1 | tail -1

echo "   📦 Generating Prisma client..."
sudo -u ${APP_USER} npx prisma generate 2>/dev/null

echo "   📦 Running database migrations..."
sudo -u ${APP_USER} npx prisma migrate deploy 2>/dev/null

echo "   📦 Seeding database..."
sudo -u ${APP_USER} npx tsx prisma/seed.ts 2>&1 | tail -3

echo "   📦 Building Next.js production bundle..."
sudo -u ${APP_USER} npx turbo run build 2>&1 | tail -5
echo "   ✅ Build complete"

# ─── 8. Create systemd services ──────────────────────────────────────────────
echo "⚙️  [8/9] Creating systemd services..."

# API service
cat > /etc/systemd/system/shieldiq-api.service << 'APISVC'
[Unit]
Description=ShieldIQ API Server
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=shieldiq
WorkingDirectory=/opt/shieldiq
EnvironmentFile=/opt/shieldiq/.env
ExecStart=/usr/bin/node /opt/shieldiq/apps/api/dist/index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
APISVC

# If no dist/index.js, use tsx directly
if [ ! -f "${APP_DIR}/apps/api/dist/index.js" ]; then
  sed -i "s|ExecStart=.*|ExecStart=$(which npx) tsx /opt/shieldiq/apps/api/src/index.ts|" /etc/systemd/system/shieldiq-api.service
fi

# Web service
cat > /etc/systemd/system/shieldiq-web.service << 'WEBSVC'
[Unit]
Description=ShieldIQ Web (Next.js)
After=network.target shieldiq-api.service

[Service]
Type=simple
User=shieldiq
WorkingDirectory=/opt/shieldiq/apps/web
EnvironmentFile=/opt/shieldiq/.env
Environment=PORT=3000
Environment=HOSTNAME=0.0.0.0
ExecStart=/usr/bin/npx next start -p 3000 -H 0.0.0.0
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
WEBSVC

systemctl daemon-reload
systemctl enable shieldiq-api shieldiq-web --now > /dev/null 2>&1
echo "   ✅ Systemd services created & started"

# ─── 9. Nginx reverse proxy on port 80 ──────────────────────────────────────
echo "🌐 [9/9] Configuring Nginx on port 80..."

cat > /etc/nginx/sites-available/shieldiq << NGINXCONF
server {
    listen 80;
    server_name ${DOMAIN} _;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    # API → port 3001
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        client_max_body_size 50M;
    }

    # Web → port 3000
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Static video assets
    location /videos/ {
        alias /opt/shieldiq/apps/web/public/videos/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
NGINXCONF

# Enable site & remove default
ln -sf /etc/nginx/sites-available/shieldiq /etc/nginx/sites-enabled/shieldiq
rm -f /etc/nginx/sites-enabled/default
nginx -t > /dev/null 2>&1
systemctl restart nginx
systemctl enable nginx > /dev/null 2>&1
echo "   ✅ Nginx configured on port 80"

# ─── Firewall ────────────────────────────────────────────────────────────────
echo "🔒 Configuring firewall..."
ufw allow 80/tcp > /dev/null 2>&1
ufw allow 22/tcp > /dev/null 2>&1
ufw --force enable > /dev/null 2>&1
echo "   ✅ Firewall: ports 22 (SSH) and 80 (HTTP) open"

# ─── Done! ────────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     🎉  ShieldIQ Deployment Complete!                      ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║                                                            ║"
echo "║  🌐 URL:      http://${DOMAIN}                             "
echo "║  👤 Admin:    admin@idfy.com                               ║"
echo "║  🔑 Password: ShieldIQ-Demo-2026!                         ║"
echo "║                                                            ║"
echo "║  📋 Useful commands:                                       ║"
echo "║  • sudo systemctl status shieldiq-api                     ║"
echo "║  • sudo systemctl status shieldiq-web                     ║"
echo "║  • sudo journalctl -u shieldiq-api -f                     ║"
echo "║  • sudo journalctl -u shieldiq-web -f                     ║"
echo "║  • docker ps  (check Postgres & Redis)                    ║"
echo "║                                                            ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
