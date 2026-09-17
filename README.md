# Abyte Dinex

A single-tenant Point-of-Sale / ERP system for restaurants and retail — sales (POS, orders, returns, credit sales, quotations, deliveries), inventory (products, purchasing, stock adjustments, recipes/production), and an AI business-assistant chat widget, all served from one Node.js/Express backend and one React frontend against a single MariaDB database.

> One deployed instance = one company. There is no multi-tenant routing, no separate admin panel, and no per-branch data isolation — see [Architecture](#architecture) below for what that actually means in the code.

---

## Architecture

| App | Path | Stack |
|---|---|---|
| Backend | `main-app/backend/` | Node.js + Express + MariaDB (`mariadb` driver) |
| Frontend | `main-app/frontend/` | React 19 + TypeScript + Vite + Tailwind CSS |
| Printer Agent | `printer-agent/` | Electron/Node desktop app — polls the backend for print jobs and sends them to a local/network receipt printer |
| Waiter App | `waiter-app/` | Expo/React Native app for waitstaff to take orders on mobile |

**Auth & authorization**: JWT (HS256), password hashing via `bcryptjs`, a DB-backed token blacklist for logout/revocation, and role-based permissions stored in a `role_permissions` table checked per-request by `requirePermission()` middleware — this is the real, server-enforced authorization boundary. The frontend's route guards (`PermissionGuard`, `AdminGuard`) are a UX convenience only; every sensitive action is independently checked server-side.

**AI assistant**: `controllers/aiController.js` builds a live snapshot of business data (sales, inventory, customers, purchase orders) and sends it to an LLM — Groq's hosted API if `GROQ_API_KEY` is set, otherwise a local Ollama model — as the `system` message, with the user's chat message as the `user` message (proper role separation, not string-concatenated). Access to the endpoint requires the `system.ai_widget` permission (same key the frontend widget's visibility check uses).

**Database**: one MariaDB database (`DB_NAME`, default `abyte_pos`). Schema in `database/schema.sql`; all schema changes after initial creation go through numbered migrations in `main-app/backend/services/migrationService.js`, run automatically at server startup.

See `CLAUDE.md` for a more detailed map of authorization internals, known architectural remnants from an earlier multi-tenant version of this app, and file-by-file pointers — useful if you're making non-trivial backend changes.

---

## Requirements

- Node.js 18+ (backend uses native `fetch`)
- MariaDB 10.6+ (or compatible MySQL)
- `mariadb-dump` / `mysqldump` and `mysql` / `mariadb` CLI tools on `PATH` (or set `MARIADB_DUMP_PATH`) — required for the backup/restore feature
- Optional: Redis (caching falls back to in-memory automatically if `REDIS_URL` isn't set)
- Optional: a Groq API key, or a locally running [Ollama](https://ollama.com) instance, for the AI chat widget

---

## Installation

```bash
# Backend
cd main-app/backend
npm install
cp .env.example .env    # then fill in the values — see Environment Variables below
npm run migrate:all     # or just start the server; migrations run automatically on boot

# Frontend
cd ../frontend
npm install
```

### Database setup

```bash
mysql -u root -p -e "CREATE DATABASE abyte_pos"
mysql -u root -p abyte_pos < database/schema.sql
```

The backend runs any pending numbered migrations from `services/migrationService.js` automatically every time it starts — you don't need to run them manually after the initial schema load, but `npm run migrate:all` is available if you want to apply them without starting the server.

### Environment variables

Copy `main-app/backend/.env.example` to `.env` and set at minimum:

| Variable | Notes |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MariaDB connection. `DB_SSL_CA` is required in production if `DB_HOST` isn't localhost. |
| `JWT_SECRET` | 64-byte hex, generate with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`. Startup **refuses to run** in production with a missing, default, or short secret. |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `8h`. |
| `PORT` | Backend listen port. **`.env.example` suggests `5000`, but this repo's `main-app/frontend/vite.config.ts` dev proxy is committed pointing at `http://localhost:3004`** — set your local `PORT=3004` to match it, or edit `vite.config.ts` if you want a different port. Production builds don't use this proxy at all (see below). |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowlist. Refuses to start with `*` in production. |
| `EMAIL_*` | SMTP settings for password-reset and invoice emails. Optional — a warning is logged if unset, email features are just disabled. |
| `GROQ_API_KEY` / `OLLAMA_BASE_URL` / `OLLAMA_MODEL` | AI chat provider. If `GROQ_API_KEY` is unset, the backend automatically falls back to a local Ollama instance. |
| `ENCRYPTION_KEY` | 32-byte hex, used by `services/cryptoService.js` for at-rest encryption of sensitive stored values. Falls back to deriving a key from `JWT_SECRET` if unset — set this explicitly in production. |
| `METRICS_TOKEN` | Bearer token protecting `/api/metrics` (Prometheus). Optional but recommended if you expose that endpoint. |
| `STORAGE_PROVIDER` | `local` (default), `s3`, `r2`, or `minio` for uploaded files (product/store logos). |
| `BACKUPS_DIR`, `MARIADB_DUMP_PATH` | Backup file location and dump-tool path. |

The frontend only reads `VITE_API_URL` (production API base URL) — nothing else is read from environment at build time, and no secret should ever be prefixed `VITE_` (Vite inlines those into the client bundle).

---

## Development

```bash
# Terminal 1 — backend
cd main-app/backend
npm run start   # or: node server.js   (nodemon: npx nodemon server.js)

# Terminal 2 — frontend
cd main-app/frontend
npm run dev     # http://localhost:5175, proxies /api to the backend port set in vite.config.ts
```

Log in with a user created directly in the database (there is no public sign-up — see [Authentication model](#authentication-model)).

---

## Testing

```bash
# Backend — Jest + Supertest, mocked DB/logger
cd main-app/backend
npm test               # run once
npm run test:coverage  # with coverage report

# Frontend — Vitest
cd main-app/frontend
npm test               # run once
npm run test:watch     # watch mode
npm run test:coverage
```

Coverage is deliberately test-first for the highest-risk paths (sale create/complete/delete/refund lifecycle, cash register reconciliation, credit sales, AI chat authorization, fractional-quantity stock adjustments) but is not exhaustive across every controller — see `CLAUDE.md`'s Testing section before assuming an untested path is regression-safe.

---

## Production build

```bash
# Backend — no separate build step; run directly with Node
cd main-app/backend
NODE_ENV=production node server.js

# Frontend
cd main-app/frontend
npm run build     # tsc -b && vite build — outputs to dist/
```

The backend serves the built frontend directly: `server.js` serves static files from `../frontend/dist` and falls back to `index.html` for any non-API route (SPA routing), so a typical single-server deployment just needs `main-app/backend` running with the frontend already built into `main-app/frontend/dist`.

---

## Deployment

This app supports two deployment postures found in the code — confirm which one applies to you before touching security-sensitive config:

1. **Local LAN** (the default assumption in `server.js`): plain HTTP, HSTS deliberately disabled, `ALLOWED_ORIGINS` set to your LAN frontend origin(s).
2. **Public hosting** (e.g. Render — `server.js` has a `/api/ping` endpoint specifically to keep a free-tier instance awake): if you deploy this way, put it behind HTTPS and reconsider re-enabling HSTS in the Helmet config, since the current default assumes plain LAN HTTP.

Either way:
- Set `NODE_ENV=production` — this enables several hard startup checks (JWT secret strength, DB SSL requirement unless `DB_HOST` is localhost, CORS wildcard rejection).
- `/api/health` reports DB connectivity and process memory (200 when healthy, 503 when the DB is unreachable) — wire this into your process manager / load balancer health check.
- Graceful shutdown is handled on `SIGTERM`/`SIGINT`: the server stops accepting new connections, drains in-flight requests (30s timeout), and closes DB pools/queues before exiting.
- Backups run on a schedule configurable from Settings → Backup (default 02:00 daily), with automatic retention pruning and an integrity check of the latest backup — but they still depend on `mariadb-dump`/`mysqldump` being available on the host.

---

## Authentication model

There is **no public sign-up**. Admin users create accounts for staff from System → Users; roles and their permissions are managed from System → Access Control. `POST /api/auth/login` takes `email` + `password` and returns a JWT plus the caller's resolved permission list (`null` for Admin, meaning unrestricted). See `CLAUDE.md`'s Authentication & Authorization section for the exact enforcement mechanics.

---

## AI Assistant

The chat widget (bottom-right corner, visible only to roles with the `system.ai_widget` permission) answers questions about live business data — sales, inventory, customers, purchase orders — using an LLM with a system prompt that includes a real-time snapshot of that data. It does **not** have access to staff account details (names/emails/roles) by design, and it does not generate audit findings, compliance judgments, or anything resembling a formal report — it's a conversational Q&A/navigation assistant, not a decision-making system. Treat any numeric answer it gives as a convenience summary of the same data visible elsewhere in the app, not as an authoritative source — always verify against the actual reports pages for anything consequential (e.g. financial reconciliation, tax filings).

**Known limitation**: the underlying LLM can still occasionally misread ambiguous phrasing in a user's question or the provided data, as with any LLM integration — there is no automated fact-checking layer between the model's response and the user. If you're extending this feature, keep the context data and the user's message in separate `system`/`user` roles (as the current implementation does) rather than concatenating them into one string — that's a meaningful, if not perfect, mitigation against a user's message being interpreted as an instruction rather than a question.

---

## Security considerations

See `SECURITY.md` for a focused list of production security expectations (secrets handling, backup access, known accepted risks) that anyone deploying or extending this app should read before shipping changes.
