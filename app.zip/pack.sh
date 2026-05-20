#!/bin/bash
# ─── Pack ShieldIQ into a Single Shell Script (No Python) ───
# Run this on your Mac to regenerate deploy-all-in-one.sh if you change code.

ZIP_PATH="/Users/rajshreesingh/Documents/Awareness/shieldiq/shieldiq-v2-complete.zip"
OUTPUT_PATH="/Users/rajshreesingh/Documents/Awareness/shieldiq/deploy-all-in-one.sh"

echo "📦 Creating codebase ZIP..."
zip -r "$ZIP_PATH" . -x "node_modules/*" "*/node_modules/*" "**/node_modules/*" ".git/*" "*/.git/*" "**/dist/*" "*/.next/*" "**/.next/*" "*/.turbo/*" "**/.turbo/*" "*.zip" "*.sh" "*.py" > /dev/null

echo "🔒 Encoding ZIP to base64..."
BASE64_DATA=$(openssl base64 -in "$ZIP_PATH")

echo "🚀 Generating deploy-all-in-one.sh..."
cat << 'EOF' > "$OUTPUT_PATH"
#!/bin/bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════════════════════
# ShieldIQ / IDfy — Self-Extracting GCP Debian Deployment Script
# ═══════════════════════════════════════════════════════════════════════════════
# Usage:
#   1. Copy this file to your GCP VM
#   2. chmod +x deploy-all-in-one.sh
#   3. sudo ./deploy-all-in-one.sh
# ═══════════════════════════════════════════════════════════════════════════════

APP_DIR="/opt/shieldiq"
APP_USER="shieldiq"
DOMAIN="${1:-$(curl -s http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip -H 'Metadata-Flavor: Google' 2>/dev/null || hostname -I | awk '{print $1}')}"

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     🛡️  ShieldIQ / IDfy — Self-Extracting Deployment         ║"
echo "╚══════════════════════════════════════════════════════════════╝"

# 1. System packages
apt-get update -qq
apt-get install -y -qq curl wget gnupg2 unzip lsb-release ca-certificates apt-transport-https software-properties-common git nginx ufw > /dev/null 2>&1

# 2. Node.js 20
if ! command -v node &> /dev/null || [[ $(node -v | cut -d. -f1 | tr -d 'v') -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
  apt-get install -y -qq nodejs > /dev/null 2>&1
fi

# 3. Docker
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sh > /dev/null 2>&1
fi
systemctl enable docker --now > /dev/null 2>&1

# 4. Extract Code
id -u $APP_USER &>/dev/null || useradd -r -m -s /bin/bash $APP_USER
usermod -aG docker $APP_USER
rm -rf $APP_DIR && mkdir -p $APP_DIR

echo "📦 Extracting embedded files..."
cat << 'ZIPEOF' | base64 -d > /tmp/shieldiq.zip
EOF

# Append the base64 code and closing block
echo "$BASE64_DATA" >> "$OUTPUT_PATH"

cat << 'EOF' >> "$OUTPUT_PATH"
ZIPEOF

unzip -qo /tmp/shieldiq.zip -d $APP_DIR
rm -f /tmp/shieldiq.zip
chown -R $APP_USER:$APP_USER $APP_DIR

# 5. Secrets
SESSION_SECRET=$(openssl rand -base64 32)
MFA_KEY=$(openssl rand -hex 32)
CSRF_SECRET=$(openssl rand -base64 32)
PHISH_SECRET=$(openssl rand -base64 32)

cat > $APP_DIR/.env << ENVEOF
NODE_ENV=production
PORT=3001
APP_URL=http://$DOMAIN
NEXT_PUBLIC_API_URL=http://$DOMAIN/api/v1
DATABASE_URL=postgresql://shieldiq:changeme@localhost:5432/shieldiq
REDIS_URL=redis://localhost:6379
SESSION_SECRET=$SESSION_SECRET
MFA_ENCRYPTION_KEY=$MFA_KEY
CSRF_SECRET=$CSRF_SECRET
PHISH_HMAC_SECRET=$PHISH_SECRET
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=YOUR_SENDGRID_API_KEY_HERE
SMTP_FROM=security@yourcompany.com
ENVEOF

cat > $APP_DIR/apps/web/.env.local << WEBENVEOF
NEXT_PUBLIC_API_URL=http://$DOMAIN/api/v1
WEBENVEOF
chown $APP_USER:$APP_USER $APP_DIR/.env $APP_DIR/apps/web/.env.local
chmod 600 $APP_DIR/.env

# 6. Docker DB + Redis
cd $APP_DIR
if docker compose version &> /dev/null; then
  sudo -u $APP_USER docker compose up -d 2>/dev/null
else
  docker-compose up -d 2>/dev/null
fi

echo "⏳ Waiting for Database..."
for i in {1..30}; do
  if docker exec shieldiq-postgres pg_isready -U shieldiq &>/dev/null; then break; fi
  sleep 1
done

# 7. Build app
sudo -u $APP_USER npm ci --prefer-offline 2>&1 | tail -1
sudo -u $APP_USER npx prisma generate 2>/dev/null
sudo -u $APP_USER npx prisma migrate deploy 2>/dev/null
sudo -u $APP_USER npx tsx prisma/seed.ts 2>&1 | tail -3
sudo -u $APP_USER npx turbo run build 2>&1 | tail -5

# 8. Services
cat > /etc/systemd/system/shieldiq-api.service << APISVC
[Unit]
Description=ShieldIQ API Server
After=network.target docker.service
[Service]
Type=simple
User=shieldiq
WorkingDirectory=/opt/shieldiq
EnvironmentFile=/opt/shieldiq/.env
ExecStart=$(which npx) tsx /opt/shieldiq/apps/api/src/index.ts
Restart=always
StandardOutput=journal
[Install]
WantedBy=multi-user.target
APISVC

cat > /etc/systemd/system/shieldiq-web.service << WEBSVC
[Unit]
Description=ShieldIQ Web
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
StandardOutput=journal
[Install]
WantedBy=multi-user.target
WEBSVC

systemctl daemon-reload
systemctl enable shieldiq-api shieldiq-web --now > /dev/null 2>&1

# 9. Nginx Configuration
cat > /etc/nginx/sites-available/shieldiq << NGINXCONF
server {
    listen 80;
    server_name $DOMAIN _;
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
    location /videos/ {
        alias /opt/shieldiq/apps/web/public/videos/;
    }
}
NGINXCONF

ln -sf /etc/nginx/sites-available/shieldiq /etc/nginx/sites-enabled/shieldiq
rm -f /etc/nginx/sites-enabled/default
systemctl restart nginx
ufw allow 80/tcp > /dev/null 2>&1
ufw allow 22/tcp > /dev/null 2>&1
ufw --force enable > /dev/null 2>&1

echo "🎉 Live at http://$DOMAIN"
EOF

chmod +x "$OUTPUT_PATH"
echo "✅ deploy-all-in-one.sh generated successfully without Python!"
