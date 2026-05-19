#!/bin/bash
# ── ShieldIQ One-Command Startup ──
# Usage: ./start.sh
# This starts Docker containers (Postgres + Redis) AND the dev server in one go.

echo "🐳 Starting Docker containers (Postgres + Redis)..."
docker compose up -d 2>/dev/null || docker-compose up -d

echo "⏳ Waiting for services to be healthy..."
sleep 3

echo "🚀 Starting ShieldIQ dev server..."
npm run dev
