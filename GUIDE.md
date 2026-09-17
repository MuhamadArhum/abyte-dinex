# Abyte Dinex — System Guide

## Overview

Abyte Dinex is a **single-tenant** Point-of-Sale / ERP system for restaurants and retail. It covers sales (POS terminal, KOT/dine-in orders, returns, credit sales, quotations, deliveries), inventory (products, variants, bundles, suppliers, purchase orders/vouchers/returns, stock adjustments, stock issuance, opening stock), light manufacturing (recipes, production orders), reporting/analytics, and an AI business-assistant chat widget that answers questions about live business data. One deployed instance serves one company — there is no multi-tenant routing, no admin panel, and no per-branch data isolation (the codebase was originally multi-tenant and was refactored down to single-tenant; some vestigial columns/no-op middleware remain from that era — see Notes). The system is composed of a Node.js/Express API, a React single-page frontend, a small MariaDB database, a companion desktop "printer agent" that bridges the web app to local receipt/KOT printers, and an Expo/React Native mobile app for waitstaff order-taking.

## Tech Stack

**Backend** (`main-app/backend`) — Node.js, Express 5 (`express@^5.2.1`)
- `mariadb` ^3.4.5 (native async driver, no ORM — raw SQL with parameterized queries)
- `jsonwebtoken` ^9 (JWT auth, HS256), `bcryptjs` ^3 (password hashing)
- `express-validator`, `express-rate-limit`, `helmet`, `cors`, `compression`, `morgan`
- `bullmq` ^5.80 (queues), `node-cron` ^4 (scheduled jobs — backups, token cleanup)
- `winston` ^3 (logging), `prom-client` ^15 (Prometheus `/api/metrics`)
- `nodemailer` ^9 (email), `googleapis` ^173, `groq-sdk` ^0.37 (hosted LLM for AI widget, with local Ollama fallback)
- `@aws-sdk/client-s3` ^3 (optional S3/R2/MinIO file storage)
- Dev/test: `jest` ^30, `supertest` ^7, `nodemon` ^3

**Frontend** (`main-app/frontend`) — React 19, TypeScript, Vite 6
- `react` / `react-dom` ^19, `react-router-dom` ^7, `axios` ^1.7
- `tailwindcss` ^3.4, `framer-motion` ^12, `recharts` ^3.7, `lucide-react` (icons)
- `qz-tray` ^2.2.5 (browser-to-printer bridge client), `jsbarcode`, `react-qr-code`
- `vite-plugin-pwa` ^1.2 (installable PWA), `sonner` (toasts)
- Dev/test: `vitest` ^4, `@testing-library/react`, `eslint` ^9, `typescript` ~5.7

**Printer Agent** (`printer-agent`) — Node.js, Express 4, `cors`; packaged to a Windows `.exe` with `pkg` (`node18-win-x64`). Runs on the cashier PC, polls the backend for print jobs and forwards them to network/USB/Windows-shared receipt and KOT printers.

**Waiter App** (`waiter-app`) — Expo ~54 / React Native 0.81, `expo-router` ~6, `zustand` ^5, `@react-native-async-storage/async-storage`. Mobile app for waitstaff to take orders; talks to the same backend API.

**Database**: MariaDB (SQL, no ORM — hand-written schema and migrations).

## Architecture & Modules

This is **not** a single monorepo workspace (no root `package.json`/workspaces) — it's four independently-run applications living in one repo, sharing one backend API:

| App | Path | Role |
|---|---|---|
| Backend | `main-app/backend/` | Express REST API, serves the built frontend in production |
| Frontend | `main-app/frontend/` | React SPA (the main web UI) |
| Printer Agent | `printer-agent/` | Local desktop bridge, cashier PC ↔ physical printers |
| Waiter App | `waiter-app/` | Mobile order-taking app for waitstaff |
| Database | `database/` | `schema.sql` — canonical DB schema |

### Backend (`main-app/backend/`)
- `server.js` — entry point: Express app setup, Helmet/CORS/rate-limiting config, all ~40 route mounts, health/readiness/metrics endpoints, static-serves the built frontend (`../frontend/dist`) with SPA fallback, graceful shutdown, and startup tasks (run DB migrations, initialize token blacklist table, schedule cron jobs for token cleanup and backups).
- `routes/` + `controllers/` — one pair per feature area, mounted under `/api/...`. Major areas: `auth`, `users`, `products`/`variants`/`bundles`, `inventory`/`stockAdjustment`/`openingStock`/`sections`/`issuance`, `suppliers`/`purchaseOrder`/`purchaseVoucher`/`purchaseReturn`, `sales`/`register`/`returns`/`creditSale`/`quotation`/`priceRule`/`salesTarget`/`delivery`, `restaurant` (tables), `recipe`/`production` (manufacturing), `reports`/`salesReport`/`inventoryReport`/`analytics`, `customers`, `settings`, `permissions` (RBAC), `audit`, `backup`, `ai` (chat assistant), `agent` (printer-agent integration), `supportTicket`, `whatsapp`, `fbr` (Pakistan tax-authority integration), `email`, and a legacy `tenant` route kept for compatibility.
- `middleware/` — `auth.js` (JWT verification, `authenticate`/`authorize`/`requirePermission`), `moduleGuard.js` (permanent no-op, vestigial from the old multi-tenant pricing tiers), `requestId.js`.
- `services/` — `migrationService.js` (numbered schema migrations, run automatically at boot), `auditService.js` (audit log writer), `tokenBlacklist.js` (DB-backed JWT revocation for logout), `backupService.js`/`backupScheduler.js` (scheduled MariaDB dumps + retention + integrity check), `emailService.js` (nodemailer), `cryptoService.js` (at-rest encryption of sensitive fields), `cacheService.js` (Redis or in-memory fallback), `queueService.js` (BullMQ), `storageService.js`/`googleDriveService.js` (uploaded file storage), `metricsService.js` (Prometheus).
- `config/` — `database.js` (MariaDB pool + `query`/`queryDb`), `logger.js` (Winston), `validateEnv.js` (fails fast if required env vars are missing).
- `scripts/` — `migrate-all.js`, `backup-all.js`, `status.js`, plus data-seeding scripts.
- No ORM/model layer — all data access is raw parameterized SQL via the `mariadb` driver, called directly from controllers.

### Frontend (`main-app/frontend/`)
- `src/App.tsx` — all route definitions, pages lazy-loaded via `React.lazy`, routes guarded per-permission with a `<G k="module.key">` helper or `<AdminGuard>`.
- `src/pages/` — grouped by module: `sales/` (POS, Quotations, CreditSales, PriceRules, SalesTargets, SalesReports), `inventory/` (Inventory, InventoryReports, StockAdjustments, StockCount, PurchaseOrders, Bundles, ProductVariants), `system/` (Settings, Users, access control), and others (customers, reports, restaurant tables).
- `src/context/` — `AuthContext.tsx` (login state, JWT, `hasPermission`/`canDo`), `SettingsContext.tsx` (company/tax/receipt/currency settings loaded once at login).
- `src/components/`, `src/hooks/`, `src/printing/` — shared UI (`Layout.tsx` sidebar/nav), `usePrintQueue.ts` (polls backend for print jobs, forwards to the local Printer Agent on `localhost:3022`), `agentPrinter.ts`/`InvoiceView.tsx` (receipt rendering/printing).
- `src/utils/api.ts` — single Axios instance; auto-attaches the JWT and redirects to `/login` on 401.
- Builds to `dist/`, served directly by the backend in production (or via the included `nginx.conf` for a containerized reverse-proxy deployment).

### Printer Agent (`printer-agent/`)
`agent.js` — Express server + local web dashboard; manages a JSON-configured printer list (`config.json`), supports network (TCP), USB/serial, and Windows-shared printers, and exposes endpoints the frontend/backend poll to dispatch invoice and KOT print jobs. Packaged into a standalone Windows `.exe` via `pkg`.

### Waiter App (`waiter-app/`)
Expo Router app (`app/` directory), `components/`, `services/` (API calls), `store/` (Zustand state). Lets waitstaff browse the menu and place orders against the same backend API used by the main frontend.

## Database

- **Type**: MariaDB (MySQL-compatible), single database, no multi-tenant routing.
- **Driver**: `mariadb` npm package (native async driver) — no ORM. All queries are hand-written parameterized SQL.
- **Connection config**: `main-app/backend/config/database.js` builds a connection pool from `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (env vars); enforces TLS (`DB_SSL_CA`) for any non-localhost host in production.
- **Schema**: canonical DDL in `database/schema.sql` (60 tables). Key groups: `users`/`roles`/`role_permissions` (RBAC), `products`/`categories`/`variant_types`/`variant_values`/`product_variants`/`product_bundles` (catalog), `inventory`/`stock_layers`/`stock_adjustments`/`stock_issues`/`stock_alerts`/`opening_stock_entries` (stock), `suppliers`/`purchase_orders`/`inv_purchase_vouchers`/`purchase_returns`/`supplier_payments` (procurement), `sales`/`sale_details`/`returns`/`credit_sales`/`quotations`/`price_rules`/`sales_targets`/`deliveries`/`cash_registers`/`cash_movements`/`print_queue` (sales/POS), `restaurant_tables`, `recipes`/`recipe_ingredients`/`production_orders` (manufacturing), `customers`/`customer_addresses`, `store_settings` (single-row company config), `audit_logs`, `backups`, `printers`.
- **Migrations**: after the initial `schema.sql` load, all schema changes go through numbered entries in `main-app/backend/services/migrationService.js`, tracked in a `schema_migrations` table and applied automatically every time the backend starts.

## Location

- Repo root: `D:\abyte-dinex`
- Backend: `D:\abyte-dinex\main-app\backend`
- Frontend: `D:\abyte-dinex\main-app\frontend`
- Printer Agent: `D:\abyte-dinex\printer-agent`
- Waiter App: `D:\abyte-dinex\waiter-app`
- Database schema: `D:\abyte-dinex\database\schema.sql`

## Ports

This project has **separate frontend and backend** processes, so both ports below apply to `main-app`:

| Service | Port | Notes |
|---|---|---|
| **Backend** (`main-app/backend`) | **3008** | `process.env.PORT`, defaulting to `3008` if unset. Set via `PORT` in `main-app/backend/.env` (and `.env.example`). |
| **Frontend** (`main-app/frontend`, dev) | **5181** | Vite dev server (`vite.config.ts` → `server.port`). Vite's dev proxy forwards `/api` requests to the backend at `http://localhost:3008`. |
| **Frontend** (`main-app/frontend`, `vite preview`) | **5181** | `vite.config.ts` → `preview.port` (added; previously unset). |

Two other apps in this repo have their own independent ports:
- **Printer Agent** (`printer-agent/agent.js`) — port **3022** (`process.env.PORT || 3022`), a local bridge the cashier's browser talks to directly. **Updated from 3001 → 3022** in a follow-up fix: port 3001 collided across multiple *separate* repos on this machine that each also run their own printer-agent hardcoded to 3001 (and one other repo's backend now also uses 3001), so this repo's printer-agent was moved to the unused port 3022 to avoid cross-repo collisions. This is unrelated to the main-app backend/frontend ports (3008/5181), which are unchanged.
- **Waiter App** — Expo/React Native; no conventional "frontend port" (it's a compiled mobile app, not a browser dev server). Its `EXPO_PUBLIC_API_URL` was updated to point at the new backend port (3008) — see Environment Variables below.

## Environment Variables

**Backend** — set in `main-app/backend/.env` (copy from `main-app/backend/.env.example`; an existing `.env` was left untouched except for the `PORT`/`ALLOWED_ORIGINS` values described below):

| Variable | Purpose |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MariaDB connection. `DB_SSL_CA` required in production for non-localhost hosts. |
| `PORT` | Backend listen port — now **3008**. |
| `NODE_ENV` | `development` / `production` / `test`; gates several hard startup checks. |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowlist — now includes `http://localhost:5181` (the frontend's new dev origin). |
| `FRONTEND_URL` | Used to build links in emails (e.g. password reset); falls back to `http://localhost:5181` if unset. |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | JWT signing secret (64-byte hex) and token lifetime. Startup refuses to run in production with a missing/default/short secret. |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM` | SMTP for transactional email. Optional — disabled with a warning if unset. |
| `GROQ_API_KEY` / `OLLAMA_BASE_URL` / `OLLAMA_MODEL` | AI chat widget provider; falls back to local Ollama if the Groq key is unset. |
| `ENCRYPTION_KEY` | 32-byte hex key for at-rest encryption; derived from `JWT_SECRET` if unset. |
| `METRICS_TOKEN` | Bearer token protecting `/api/metrics`. Optional. |
| `STORAGE_PROVIDER`, `BACKUPS_DIR`, `MARIADB_DUMP_PATH`, `REDIS_URL`, `UPLOADS_DIR` | Optional storage/backup/cache settings — see `.env.example` for full list. |
| `VITE_PRINTER_AGENT_URL` | Present in `main-app/backend/.env` but actually a frontend (Vite) build-time variable — see Notes. |

**Frontend** — no `.env` file exists in `main-app/frontend/`; it only reads `VITE_API_URL` (production API base URL) and `VITE_PRINTER_AGENT_URL` at build time if present in the environment. Neither is required for local dev (dev uses the Vite proxy to reach the backend).

**Waiter App** — `waiter-app/.env` (copy from `waiter-app/.env.example`): `EXPO_PUBLIC_API_URL`, the backend's base URL — updated to `http://192.168.0.105:3008/api` (LAN IP placeholder; update the IP for your network, the port is now 3008).

**Printer Agent** — no `.env`; `PORT` env var optional (defaults to 3022, updated from 3001 to avoid a cross-repo port collision — see Ports above), `config.json` holds the configured printer list.

## How to Run

```bash
# 1. Install dependencies
cd main-app/backend && npm install
cd ../frontend && npm install
cd ../../printer-agent && npm install      # optional, only if using local printing
cd ../waiter-app && npm install            # optional, only if running the mobile app

# 2. Database setup (one-time)
mysql -u root -p -e "CREATE DATABASE abyte_pos"
mysql -u root -p abyte_pos < database/schema.sql
# Migrations run automatically on backend startup; to run them manually instead:
cd main-app/backend && npm run migrate:all

# 3. Backend dev — set PORT=3008 in main-app/backend/.env (already done), then:
cd main-app/backend
npm run start          # node server.js — listens on http://localhost:3008
# or, with auto-restart on file changes:
npx nodemon server.js

# 4. Frontend dev (separate terminal) — Vite dev server on port 5181,
#    proxying /api to the backend at localhost:3008:
cd main-app/frontend
npm run dev             # http://localhost:5181

# 5. (Optional) Printer Agent — local bridge for receipt/KOT printers, port 3022 (moved from 3001, see Ports/Notes):
cd printer-agent
npm run start

# 6. (Optional) Waiter App — Expo dev server:
cd waiter-app
npm run start           # expo start; set EXPO_PUBLIC_API_URL in waiter-app/.env first

# --- Build & production start ---

# Frontend production build:
cd main-app/frontend
npm run build            # tsc -b && vite build → outputs main-app/frontend/dist

# Backend production start (serves the built frontend from ../frontend/dist):
cd main-app/backend
NODE_ENV=production node server.js    # listens on PORT (3008) unless overridden
```

Log in with a user created directly in the database — there is no public sign-up (see `README.md`'s "Authentication model" section).

## Notes

- **Port scope of this change**: `main-app/backend` (assigned 3008) and `main-app/frontend` (assigned 5181) are the app's actual backend/frontend pair. The Expo-based `waiter-app` (no browser dev-server port) was left untouched, per instructions to not change unrelated services' ports — but `waiter-app/.env`'s `EXPO_PUBLIC_API_URL` and the frontend's/backend's hardcoded references to the *old* backend port (5000) were updated to 3008 so those clients keep working against the relocated backend.
- **Follow-up fix — Printer Agent port collision (3001 → 3022)**: `printer-agent` was originally left on port 3001 (unrelated to the main-app port change above). It later turned out that port 3001 is used by printer-agent services in *other, separate* repos on this machine, and by a different repo's backend — all colliding on the same port. To fix this, `printer-agent`'s port was moved to **3022**. Files touched: `printer-agent/agent.js` (`PORT` default, dashboard footer text), `main-app/backend/.env` (`VITE_PRINTER_AGENT_URL`), `main-app/backend/controllers/settingsController.js` (example URL in an error message), `main-app/frontend/src/pages/system/Settings.tsx` (fallback `AGENT_URL`), `main-app/frontend/src/hooks/usePrintQueue.ts` (`AGENT_URL` constant + comment), `main-app/frontend/src/printing/agentPrinter.ts` (comment). `main-app/backend` (3008) and `main-app/frontend` (5181) were not touched by this fix.
- **Files edited for the port change**:
  - `main-app/backend/.env` — `PORT` 3004→3008, `ALLOWED_ORIGINS` old frontend port 5175→5181.
  - `main-app/backend/.env.example` — `PORT` 5000→3008, `ALLOWED_ORIGINS` gained `:5181`.
  - `main-app/backend/server.js` — hardcoded CORS fallback list (`5173`→`5181`) and `PORT` fallback (`5000`→`3008`).
  - `main-app/backend/controllers/authController.js` — `FRONTEND_URL` fallback (`5173`→`5181`), used for password-reset email links.
  - `main-app/backend/controllers/settingsController.js` — `/settings/server-ip` endpoint's port fallback (`5000`→`3008`); this is the endpoint the frontend calls to build the waiter-app QR code URL.
  - `main-app/frontend/vite.config.ts` — `server.port` (5175→5181), added `preview.port` (5181, previously unset), dev proxy target (`3004`→`3008`).
  - `main-app/frontend/src/components/Layout.tsx` — initial fallback URL for the waiter-app QR code (`:5000`→`:3008`) before the real port loads from the backend.
  - `main-app/frontend/nginx.conf` — containerized reverse-proxy `proxy_pass` target (`backend:5000`→`backend:3008`), for anyone deploying the built frontend behind this nginx config with a `backend` service alias.
  - `waiter-app/.env` — `EXPO_PUBLIC_API_URL` port (`5000`→`3008`).
- **Pre-existing port inconsistency**: before this change, `main-app/backend/.env` already had `PORT=3004`, while `.env.example` suggested `5000` and several hardcoded fallbacks in code used `5000` or `5173`/`5175` inconsistently (documented as a known issue in this repo's own `README.md` and `CLAUDE.md`). This change makes all of those consistent at `3008`/`5181`.
- **`.env` secrets preserved**: `main-app/backend/.env` already existed with real values (DB password, JWT secret, etc.) — only the `PORT` and `ALLOWED_ORIGINS` keys were changed; no other values were touched or leaked into this guide.
- **`VITE_PRINTER_AGENT_URL` is misplaced**: it's set in `main-app/backend/.env`, but it's actually consumed by the frontend (`main-app/frontend/src/pages/system/Settings.tsx` reads `import.meta.env.VITE_PRINTER_AGENT_URL`) at Vite build time. Since it lives in the backend's env file, Vite never actually sees it unless it's also exported in the frontend's own build environment; the frontend code's hardcoded fallback (now `http://localhost:3022`, updated alongside the `.env` value during the printer-agent port fix) is what's actually in effect today. Both were updated to 3022 for consistency even though the misplacement issue itself remains unfixed.
- **Multi-tenant remnants**: per `CLAUDE.md`, this codebase was originally multi-tenant and was refactored to single-tenant ("Phase 4"). `queryDb(dbName, ...)` ignores its `dbName` argument, `middleware/moduleGuard.js`'s `requireModule()` is a permanent no-op, and some `branch_id` columns have no corresponding application logic. These are pre-existing and unrelated to this port-reassignment task — flagged here only so they aren't mistaken for something this change touched.
- **`.claude/worktrees/agent-abdbeb53`**: an existing, uncommitted local git worktree directory was present at the repo root (containing what look like alternate/older copies of several apps, e.g. `admin-panel`, `client-app`, `server-app`, which do **not** exist in the main working tree). It was left untouched and not treated as part of this repository's real structure — `git status` shows it as a modified path, pre-existing before this task.
- No `docker-compose.yml` exists anywhere in the repo (checked); only a standalone `nginx.conf` under `main-app/frontend/` for an optional containerized reverse-proxy deployment, which was updated as noted above.
- No Prisma/Mongoose/other ORM is used anywhere in this repo — confirmed by inspecting `main-app/backend/config/database.js` and the full `controllers/` directory (all raw `mariadb` queries).
