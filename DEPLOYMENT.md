# Deployment Guide

LaxaLab ships with **two supported production targets**:

1. **Railway (primary / managed)** — recommended. No servers to run or patch.
2. **Self-hosted Docker Compose** (`docker-compose.prod.yml`) — full TLS via
   Let's Encrypt, nginx in front of the Next.js frontend and NestJS backend.

Pick one per environment. The environment variables are the same either way
(see `.env.production.example`).

---

## Target 1: Railway (recommended)

Railway deploys from this GitHub repository. Three services:

| Service    | Build command        | Start command       | Env var                          |
|-----------|---------------------|--------------------|----------------------------------|
| Backend    | `npm install`        | `npm run build && node dist/main.js` | `DATABASE_URL`, `JWT_SECRET`, SMTP, etc. |
| Frontend   | `npm install`        | `npm run build && npm start` (Next standalone) | `NEXT_PUBLIC_API_URL` (no `/api` suffix) |
| Postgres   | (Railway managed)    | —                  | internal `DATABASE_URL` connection |

Backend variables (all on the backend service dashboard):

```
DATABASE_URL, JWT_SECRET, FRONTEND_URL, GOOGLE_CLIENT_ID,
GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL, SMTP_HOST, SMTP_PORT,
SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM, STRIPE_SECRET_KEY,
STRIPE_WEBHOOK_SECRET, ADMIN_EMAIL
```

Frontend variables:

```
NEXT_PUBLIC_API_URL=https://<your-railway-backend>/api   # no trailing /api stripped
NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_CURRENCY, NEXT_PUBLIC_GA4_ID, NEXT_PUBLIC_GTM_ID
```

> Note: the frontend build **bakes** `NEXT_PUBLIC_*` values into the bundle, so
> changing them requires a redeploy. In the Dockerfile the default
> `NEXT_PUBLIC_API_URL` already points at the real backend, so the build arg is
> only needed when the backend URL changes.

The migrations run automatically at backend container start (`prisma migrate deploy`).

### First-deploy assumption (no legacy data)

The `seatsTaken` column on `CourseOpening` (introduced with the
`20260925181018_webhook_events_and_seat_counter` migration) backfills itself
from existing non-rejected enrollments. The assumption is that this project has
**no legacy production data on first deploy**: a brand-new Railway Postgres is
created and `prisma migrate deploy` runs every migration including the backfill
against empty tables. If you ever import old data, re-run the backfill by
counting enrollments with `status NOT IN ('REJECTED','REVOKED')` per opening.

### Refund policy

- A refund is **only** possible from a `PAID` payment (admin/finance only;
  students cancel `PENDING` payments themselves).
- `refund()` marks the payment `REFUNDED`, sets `refundedAt`, **revokes** the
  linked enrollment (`REVOKED`), **releases the claimed seat**, and writes an
  audit log row — all in one transaction. A refunded enrollment never holds a
  seat and never appears as an active course member.
- Stripe webhook over-capacity settlement **auto-refunds**: if a paid
  PaymentIntent can't claim a seat because the opening filled up between
  checkout and settlement, the payment is refunded automatically, the student is
  emailed, and the opening seat counter is never touched.
- Financial records are **never deleted**; a refund keeps the original `Payment`
  row (status `REFUNDED`) for ledger integrity.

### Certificate issuance policy

- Ending a course **does not issue certificates automatically**. Instructors
  and admins manually select which approved students receive a certificate once
  the opening is `ENDED` (requires `course.certificateIssued = true`).
- Staff gate: ADMIN / COURSE_MANAGER anywhere; INSTRUCTORS only for openings
  they teach. `revoke()`/`reissue()` are admin/course-manager only.
- Everything is audit-logged; students get an in-app + email notification.

### Stripe webhook integrity

- The webhook is **idempotent**: each Stripe event id is recorded in a
  `WebhookEvent` table and duplicates short-circuit.
- The PaymentIntent is verified (`providerRef`, exact amount, currency) before
  any settlement; mismatches are logged and ignored (no enrollment granted).
- Settlement (payment `PAID` + enrollment `APPROVED` + seat claim + coupon
  usage + `WebhookEvent`) happens in a **single atomic transaction**.

---

## Target 2: Self-hosted Docker Compose

`docker-compose.prod.yml` runs: **Postgres 15**, **NestJS backend**, **Next.js
frontend**, **nginx** (HTTP→HTTPS, TLS, 100MB uploads), and **certbot** (Let's
Encrypt, auto-renewal).

### Requirements

- Docker + Docker Compose v2
- A domain `A`/`AAAA` record → your server's public IP (ports 80 & 443 open)

### 1. Configure the environment

```bash
cp .env.production.example .env.production
# then edit .env.production:
#  - DB_PASS, JWT_SECRET: strong random values
#  - DOMAIN: your real domain
#  - CERTBOT_EMAIL: your email (for certificate expiry notices)
#  - FRONTEND_URL / NEXT_PUBLIC_API_URL: https://yourdomain.com / https://yourdomain.com/api
#  - SMTP_*, GOOGLE_*, STRIPE_* as needed
```

`.env.production` is gitignored and never committed.

### 2. Start the stack

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

> `--env-file .env.production` is **required**: Compose interpolates `${DB_USER}`,
> `${DOMAIN}`, `DATABASE_URL`, etc. from it, and the services read the same file
> via `env_file:`, so one file drives the whole stack.

This starts `db`, `backend`, `frontend`, and `nginx`; the backend runs
`prisma migrate deploy` on startup. nginx serves HTTP 80 and redirects to HTTPS.

### 3. Issuing the TLS certificate (first run only)

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up --build certbot
```

`certbot` obtains a certificate for `DOMAIN` and `www.DOMAIN` via the webroot
challenge (nginx serves `/.well-known/acme-challenge/` on port 80), then keeps
renewing automatically in the background. After issuance nginx picks up the
certificates at `/etc/letsencrypt/live/${DOMAIN}/` on its next reload.

### 4. Verify

```bash
curl -I https://yourdomain.com          # expect 301/200 + TLS
curl -I https://yourdomain.com/api/health  # backend liveness
```

### Environment mapping (Compose => service)

| `.env.production` key      | Used by                                            |
|----------------------------|----------------------------------------------------|
| `DB_USER`/`DB_PASS`/`DB_NAME` | Postgres + backend `DATABASE_URL`               |
| `PORT`                     | backend (must stay `3000`)                         |
| `NEXT_PUBLIC_API_URL`      | frontend build arg (baked into bundle)             |
| `DOMAIN`, `CERTBOT_EMAIL`  | nginx `server_name` + certbot certificate          |
| all others                 | backend runtime (JWT, SMTP, Google, Stripe, ...)   |

### Backups

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T db \
  pg_dump -U "$DB_USER" "$DB_NAME" > backup.sql
```

The `uploads` volume (`uploads_data`) holds user-uploaded files — include it in
your backup automation.