# ShieldIQ — IS Awareness Platform

A production-ready, multi-tenant SaaS platform for Information Security Awareness.

## Features

- **IS Awareness Training** — assign modules by department with deadlines and email reminders
- **Phishing Campaigns** — send simulated phishing emails with full click tracking and funnel analytics
- **Template Library** — 20+ built-in templates (phishing, awareness, social engineering)
- **Tabletop Exercises** — facilitated incident response scenarios with phase stepping
- **Scenario Library** — 7 built-in scenarios (ransomware, BEC, supply chain, AI compromise, etc.)
- **Employee Management** — searchable table, CSV import/export, soft-delete
- **Settings** — live branding preview, module config, department management
- **Security** — MFA (TOTP), session management, RBAC, audit logging, CSRF, CSP

## Quick Start

```bash
# 1. Clone and set up environment
git clone <repo> && cd shieldiq
cp .env.example .env
# Edit .env with your values

# 2. Start dependencies
docker-compose up -d

# 3. Install and migrate
npm install
npx prisma generate --schema=prisma/schema.prisma
npx prisma migrate dev --schema=prisma/schema.prisma --name init
npx prisma db seed --schema=prisma/schema.prisma

# 4. Start development servers
npm run dev
```

The app will be available at:
- **Frontend:** http://localhost:3000
- **API:** http://localhost:3001
- **API Health:** http://localhost:3001/health

**Demo credentials:** `admin@acmecorp.com` / `ShieldIQ-Demo-2026!`

## Project Structure

```
shieldiq/
├── apps/
│   ├── api/          # Fastify backend (Node.js 20, TypeScript)
│   └── web/          # Next.js 14 frontend (App Router)
├── packages/
│   └── shared/       # Shared Zod schemas and TypeScript types
├── prisma/
│   ├── schema.prisma # Database schema
│   └── seed.ts       # Demo data seeder
├── docker-compose.yml
├── .env.example
└── DECISIONS.md      # Architecture decision records
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Fastify 4, Node.js 20, TypeScript |
| Database | PostgreSQL 15 + Prisma 5 |
| Cache/Queue | Redis + BullMQ |
| Auth | Argon2id passwords, TOTP MFA, session tokens |
| Email | Nodemailer (SMTP-agnostic) |
| Frontend | Next.js 14 (App Router), Tailwind CSS |
| Charts | Recharts |
| State | Zustand + TanStack Query |
| Monorepo | Turborepo |

## Production Deployment

```bash
npm run build
npx prisma migrate deploy --schema=prisma/schema.prisma
npm run start
```

Compatible with Railway, Render, Fly.io, or any VPS with Docker.

## Security

See [DECISIONS.md](./DECISIONS.md) for architecture decision records including auth, session management, CSRF, and phishing token design.
