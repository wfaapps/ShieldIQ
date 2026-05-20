#!/bin/bash

# ==============================================================================
# ShieldIQ - GCP Debian 12 (Bookworm) Deployment Script
# ==============================================================================
# This script installs all dependencies, builds the application, and starts the
# services using Docker (for DB/Redis) and PM2 (for the Node.js apps).
# 
# Usage: 
#   chmod +x deploy-gcp.sh
#   sudo ./deploy-gcp.sh
# ==============================================================================

set -e # Exit immediately if a command exits with a non-zero status

echo "🚀 Starting ShieldIQ Deployment on GCP Debian..."

# 1. Update OS & Install system dependencies
echo "📦 Updating system packages..."
apt-get update -y
apt-get upgrade -y
apt-get install -y curl git build-essential unzip ca-certificates gnupg

# 2. Install Docker & Docker Compose
if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker..."
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo \
      "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
      "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable docker
    systemctl start docker
else
    echo "✅ Docker is already installed."
fi

# 3. Install Node.js (v20 LTS)
if ! command -v node &> /dev/null; then
    echo "🟢 Installing Node.js v20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    echo "✅ Node.js is already installed."
fi

# 4. Install Global npm tools (pnpm & pm2)
echo "🔧 Installing pnpm and pm2..."
npm install -g pnpm pm2

# 5. Start Infrastructure (PostgreSQL & Redis)
echo "🗄️ Starting Database and Redis via Docker Compose..."
# Assuming docker-compose.yml is in the root directory
docker compose up -d

echo "⏳ Waiting for Database to be ready..."
sleep 10 # Give postgres a few seconds to accept connections

# 6. Install Project Dependencies & Build
echo "📦 Installing project dependencies..."
pnpm install

echo "🏗️ Building the monorepo..."
pnpm run build

# 7. Database Migrations and Seeding
echo "🌱 Pushing Prisma schema to database and seeding..."
npx prisma db push --accept-data-loss
pnpm run db:seed

# 8. Start Services with PM2
echo "🚀 Starting applications with PM2..."

# Check if pm2 processes already exist, delete them if they do
pm2 delete shieldiq-api 2>/dev/null || true
pm2 delete shieldiq-web 2>/dev/null || true

# Start API Server (Background Workers run automatically inside this process)
cd apps/api
pm2 start dist/index.js --name shieldiq-api
cd ../..

# Start Web Server (Next.js)
cd apps/web
pm2 start npm --name shieldiq-web -- run start
cd ../..

# Save PM2 configuration to start on boot
pm2 save
pm2 startup | tail -n 1 | bash || true

echo ""
echo "========================================================================"
echo "🎉 DEPLOYMENT COMPLETE!"
echo "========================================================================"
echo "Backend API is running on port 3001 (managed by PM2)"
echo "Frontend Web is running on port 3000 (managed by PM2)"
echo ""
echo "Next Steps for GCP:"
echo "1. Ensure your VPC Firewall Rules allow ingress TCP traffic on port 3000"
echo "2. Set up an Nginx reverse proxy with SSL (Let's Encrypt) for production"
echo "3. Update your .env file with production secrets and SMTP config"
echo "========================================================================"
