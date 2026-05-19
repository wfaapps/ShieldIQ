# ShieldIQ — Architecture Decisions

## Authentication

**Decision:** Custom session-token auth (not JWT-based) with Argon2id password hashing.

**Reasoning:** JWTs cannot be revoked without a token store; for a security platform, the ability to immediately invalidate sessions on logout or compromise is essential. Sessions are stored hashed in the database (SHA-256 of the raw token). Tokens are compared in constant time.

**MFA:** TOTP (RFC 6238) via `otpauth`. Secrets stored AES-256-GCM encrypted at rest. A short-lived Redis challenge token is issued on password auth success; the full session is only created after TOTP verification.

---

## Phishing Tracking Tokens

**Decision:** HMAC-signed JWTs (HS256, 30-day expiry) for open/click tracking — not database-stored tokens.

**Reasoning:** Tokens are embedded in every email link and open-pixel URL. Storing each one in the DB would create millions of rows. Stateless JWTs signed with `PHISH_HMAC_SECRET` are verified on each request; no DB lookup required for tracking. Redirect targets are allowlisted to the app domain to prevent open-redirect abuse.

---

## Multi-tenancy

**Decision:** `orgId` is always derived from the authenticated user's session — never accepted from client request bodies.

**Reasoning:** This prevents horizontal privilege escalation (IDOR) where an attacker changes `orgId` in a request body to access another tenant's data. All Prisma queries include `orgId: request.user.orgId`.

---

## Email Queue

**Decision:** BullMQ + Redis for all email sends, with a rate limiter of 50 emails/minute per queue.

**Reasoning:** Large activity launches can target hundreds of employees. Sending synchronously would time out the HTTP request and could overwhelm SMTP servers. BullMQ provides retries, job deduplication, and the rate limiter prevents SMTP rate-limit errors. Reminder emails are scheduled as delayed jobs at launch time, not via a polling cron.

---

## Soft Deletes for Employees

**Decision:** `deletedAt` soft-delete on `Employee`, not hard delete.

**Reasoning:** Employees may have completion records and phishing click records that represent historical audit data. Hard-deleting would cascade and destroy audit history, which is required for compliance reporting.

---

## CSV Import Security

**Decision:** CSV files are parsed server-side with an explicit `columns: true` parser; each row is validated through the `CreateEmployeeSchema` Zod schema before insert. File size is capped at 5MB.

**Reasoning:** Prevents formula injection attacks (rows starting with `=`, `+`, `@`) since data never reaches a spreadsheet unvalidated. Prevents ReDoS via malformed CSV by using a strict streaming parser with length caps.

---

## Frontend Cookie Security

**Decision:** Session cookies are `HttpOnly`, `Secure` (in production), `SameSite=Lax`.

**Reasoning:** `HttpOnly` prevents JavaScript access, mitigating XSS-based session theft. `SameSite=Lax` prevents CSRF on cross-site form submissions while allowing top-level navigations. In addition, Fastify's `@fastify/csrf-protection` adds a CSRF token for all state-changing API routes.

---

## Org Branding via CSS Custom Property

**Decision:** Accent colour is applied as `--accent` CSS variable on the `<html>` element at login time, not via inline styles or per-component props.

**Reasoning:** A single CSS variable allows the entire Tailwind design system to reference `var(--accent)` without prop-drilling, and allows live preview in Settings to update the whole UI instantly by changing the variable. The value is validated as a 6-digit hex colour on the server.

---

## No S3 Dependency at Dev Time

**Decision:** File storage is local disk in development; S3-compatible configuration is optional via environment variables.

**Reasoning:** This allows the project to run with only Docker (Postgres + Redis) without requiring cloud credentials. The `S3_*` env vars enable S3 in production without code changes.
