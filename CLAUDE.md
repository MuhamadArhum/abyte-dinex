# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

Abyte Dinex is a **single-tenant** Point-of-Sale / ERP system, deployed one instance per company (LAN or single cloud instance — see "Deployment model" below). It has three deployable apps:

| App | Path | Port | Stack |
|-----|------|------|-------|
| Backend | `main-app/backend/` | `PORT` env var (`.env.example` suggests 5000; this repo's committed Vite proxy expects 3004 — see below) | Node.js + Express + MariaDB |
| Frontend | `main-app/frontend/` | 5175 (dev) | React 19 + TypeScript + Vite + Tailwind |
| Printer Agent | `printer-agent/` | — | Electron/Node desktop app, polls the backend for print jobs |
| Waiter App | `waiter-app/` | — | Expo/React Native mobile-facing app |

There is **no `admin-panel` app** — it does not exist in this repository (no directory, no git history). If you see it referenced in older notes, ignore it.

Other directories: `database/` (SQL schema — `schema.sql` only; there is no `master_schema.sql`).

---

## Architecture note: this was a multi-tenant app, refactored to single-tenant

The codebase was originally built multi-tenant (per-company database routing via `AsyncLocalStorage`, a master `abyte_master` DB, JWT-carried `tenant_db`/`modules`/`branch_id`). That was removed in an internal migration referred to in code comments as **"Phase 4"**. The app is now single-tenant: one MariaDB database (`DB_NAME`, default `abyte_pos`), one connection pool, no tenant routing.

Remnants of the old design still show up in a few places and should not be mistaken for live behavior:
- `queryDb(dbName, sql, params)` in `config/database.js` **ignores its `dbName` argument** — it's kept only so old call sites don't need touching. Never rely on it to target a specific DB.
- `middleware/moduleGuard.js`'s `requireModule()` is a **permanent no-op** — it does not gate anything. The `MODULES` dictionary in that file (pricing/sub-module metadata) is vestigial; the real authorization source of truth is the `role_permissions` DB table (see below).
- Some DB columns (e.g. `branch_id` on several tables) are leftovers with no corresponding application logic — there is no `req.branchId`, no branch-scoping middleware, and no branch filtering in any controller. Don't assume branch isolation exists just because a `branch_id` column is present.

---

## Commands

### Backend (main-app/backend)
```bash
node server.js                  # start server
npm test                        # run all Jest tests
npm run test:coverage           # run tests with coverage
npx jest tests/unit/auth.test.js  # run a single test file
npm run migrate:all             # run migrations across configured DBs
npm run db:status               # check DB/migration status
```

### Frontend (main-app/frontend)
```bash
npm run dev       # start Vite dev server (port 5175, per vite.config.ts)
npm run build     # TypeScript check + production build
npm run lint      # ESLint
npm test          # Vitest (run once)
npm run test:watch  # Vitest (watch mode)
```

### Environment
Backend requires `.env` in `main-app/backend/`. Copy from `.env.example` and set:
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (default: `abyte_pos`), `DB_PORT`
- `JWT_SECRET` — generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`. Startup refuses to run in production with a missing/default/short secret.
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM` — for email features (password reset, invoice emails)
- `PORT` — `.env.example` suggests `5000`, but `main-app/frontend/vite.config.ts`'s dev proxy (`server.proxy['/api'].target`) is committed as `http://localhost:3004`. Either set your local backend `PORT=3004` to match the committed proxy, or edit `vite.config.ts` if you intentionally want a different port — the two must agree for `npm run dev` to reach the API.
- `MASTER_DB_NAME` in `.env.example` is a **legacy leftover** — nothing reads it. Don't set it expecting it to do anything.

Frontend uses `VITE_API_URL` in production builds to point at the backend. In dev, Vite's dev server (port 5175) proxies `/api` to the hardcoded target in `vite.config.ts` (currently `http://localhost:3004`) — it does not read `PORT` from any env file.

### Deployment model
Code comments indicate this app runs in (at least) two postures: a local LAN HTTP deployment (HSTS is deliberately disabled for this — see `server.js`) and, separately, references to waking a Render-hosted instance (`/api/ping`). Confirm with whoever owns deployment which posture applies before changing security headers, CORS, or anything HTTPS-related.

---

## Authentication & Authorization (Critical)

- **JWT**: signed with `{ user_id, username, role_name }`, HS256, expiry from `JWT_EXPIRES_IN` (default `8h`). No tenant/branch/module data is carried in the token.
- **Session revocation**: a DB-backed token blacklist (`services/tokenBlacklist.js`) is checked on every request; `POST /api/auth/logout` blacklists the presenting token. Independently, `users.password_changed_at` is checked against the JWT's `iat` in `authenticate()` — changing or resetting a password invalidates *all* previously issued tokens for that user, not just the one used to make the change.
- **`authenticate` middleware** (`middleware/auth.js`): verifies the JWT, loads `req.user` (`user_id, username, name, email, role_id, role_name, is_active`) from the `users` table. Rejects deactivated users and tokens issued before the last password change.
- **`requirePermission(moduleKey)`**: the real authorization mechanism. Checks the `role_permissions` table for the current role; `Admin` always passes. HTTP method auto-maps to a CRUD sub-key (`POST`→`.create`, `PUT/PATCH`→`.update`, `DELETE`→`.delete`; `GET` checks the base key). Results are cached for 5 minutes per role+key and invalidated immediately by `permissionController.updatePermissions` on any permission change.
- **`authorize('Admin')`**: hardcoded role check, used for the small number of Admin-only route groups (`userRoutes.js`, `permissionRoutes.js`).
- **`requireModule()`**: no-op — do not use it to gate anything; it exists only for call-site compatibility.

On the frontend, use `hasPermission(moduleKey)` / `canDo(moduleKey, action)` from `useAuth()`, or wrap routes in `<PermissionGuard moduleKey="...">` / the `<G k="...">` shorthand in `App.tsx`. **These are UX conveniences only** — every sensitive route is independently enforced server-side via `requirePermission`/`authorize`; never assume a frontend guard is sufficient and never add a new sensitive endpoint without a matching server-side check.

---

## Database

- `DB_NAME` (default `abyte_pos`) — the only application database. Full schema in `database/schema.sql`.
- Schema changes go through `services/migrationService.js`. Add a new numbered object to the `MIGRATIONS` array at the bottom; each migration runs once per DB, tracked in `schema_migrations`, executed automatically at server startup. **Never use `ALTER TABLE` in controllers.**
- `roles` / `role_permissions` drive RBAC (see above). `store_settings` (single row, `setting_id = 1`) holds company/receipt/tax/backup-schedule config.
- Modules: only `sales` and `inventory` exist (see `middleware/moduleGuard.js`). There is no `accounts` module and no `hr` module — HR was explicitly removed (`migrationService.js` migration v4 is a documented no-op for this reason). If a request references those, they're describing a feature that isn't in this codebase.

---

## Backend Patterns

### Adding a new API endpoint
1. Create or update a controller in `controllers/`.
2. Create or update a route file in `routes/`.
3. Register the route in `server.js`.
4. Standard stack: `router.use(authenticate)` at the top of the route file, then per-route `requirePermission('x.y')` (or `authorize('Admin')` for the rare Admin-only group).

### Numbered documents (invoices, POs, vouchers, etc.)
Sequence numbers (`invoice_no`, `po_number`, `pv_number`, `pr_number`, `quotation_number`, `delivery_number`, issuance numbers) are generated with a `SELECT MAX(...) + 1` pattern that **must** be wrapped in a named MySQL lock (`GET_LOCK(...)` / `RELEASE_LOCK(...)`) on the transaction connection to avoid duplicate-number races under concurrent submissions. Follow the pattern in `salesController.js` (invoice/token generation) or `purchaseOrderController.js`'s `nextPONumber` when adding a new one.

### Audit logging
Call `logAction(userId, username, action, entity, entityId, changes, ip)` from `services/auditService.js` for any data-mutating operation. `logAction` internally catches all its own errors and returns `false` on failure — it never throws, so it's always safe to `await` without a surrounding try/catch just for it.

### Cash register / stock integrity (POS core — be careful here)
`salesController.js` and `registerController.js` implement the sale lifecycle (create → complete → delete/refund) and register reconciliation (open → cash movements → close). Stock is only deducted for `'completed'` sales (never for `'pending'` KOT/dine-in orders), and `cash_registers.cash_sales_total`/`card_sales_total` are only incremented for completed, non-credit sales against whichever register was open at the time. Any code that restores stock or reverses register totals (delete, refund, void) **must** check the sale's actual prior state before acting — restoring stock for a sale that never had stock deducted, or failing to reverse a register total that was incremented, will corrupt inventory counts or cash reconciliation. See `reverseRegisterForSale()` in `salesController.js` for the guarded pattern to reuse.

### Error responses
- `400` — validation / missing fields
- `401` — unauthenticated
- `403` — forbidden (wrong role or missing permission)
- `404` — not found
- `500` — caught exception with `res.status(500).json({ message: 'Server error' })`

Actual error detail goes to `logger.error(...)`, never in the 500 response body.

---

## Frontend Patterns

### API calls
All API calls go through `src/utils/api.ts` (Axios instance). It auto-attaches the JWT header and handles 401 by clearing local storage and redirecting to `/login`. Import as:
```ts
import api from '../utils/api';
const { data } = await api.get('/products');
```

### Auth & permissions
```ts
const { user, hasPermission, canDo, isAdmin, currencySymbol } = useAuth();
hasPermission('sales.pos')           // view access
canDo('sales.pos', 'create')         // write access
```
`hasModule()` always returns `true` (single-tenant — every module is enabled). Don't use it to gate anything meaningful; it's kept only for call-site compatibility with older code.

### Page routing
All pages are lazy-loaded via `React.lazy` in `App.tsx`. To add a new page: create the file, add a `lazy()` import in `App.tsx`, and add the `<Route>` inside the authenticated layout block, guarded with the `<G k="module.key">` helper (or `<AdminGuard>` for Admin-only pages). Add it to the sidebar in `Layout.tsx` with a matching permission key.

### Settings context
`useSettings()` from `SettingsContext` provides company settings (tax rate, receipt config, currency, etc.) loaded once at login.

---

## Testing

Backend tests use **Jest + Supertest** with mocked DB and logger:
```js
jest.mock('../../config/database');   // mock query/queryDb
jest.mock('../../config/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), http: jest.fn() }));
const { buildTestApp } = require('../helpers/testApp');
const app = buildTestApp();
```
Tests live in `tests/unit/` and `tests/integration/`. Frontend tests use **Vitest** in `src/tests/`.

Coverage is currently thin relative to the app's size — most controllers (especially the sale lifecycle, register, purchase vouchers/orders/returns, inventory, delivery, quotation, stock adjustments, production/recipe) have no tests. When touching any of those, add a test alongside the change rather than assuming existing coverage will catch a regression.

---

## Key Files Quick Reference

| File | Role |
|------|------|
| `main-app/backend/server.js` | Entry point, all route mounts, rate limiting, CORS, Helmet, graceful shutdown |
| `main-app/backend/config/database.js` | DB pool + `query()` / `queryDb()` (single DB; `queryDb`'s db-name argument is ignored) |
| `main-app/backend/middleware/auth.js` | `authenticate`, `authorize`, `requirePermission` — the real authorization layer |
| `main-app/backend/middleware/moduleGuard.js` | `requireModule` (no-op) + vestigial module pricing metadata |
| `main-app/backend/services/migrationService.js` | Schema migrations (add new ones here) |
| `main-app/backend/services/auditService.js` | `logAction()` — never throws |
| `main-app/backend/services/tokenBlacklist.js` | DB-backed JWT revocation, used at logout |
| `main-app/backend/services/emailService.js` | Email sending via nodemailer |
| `main-app/frontend/src/utils/api.ts` | Axios instance with auth header + 401 handling |
| `main-app/frontend/src/context/AuthContext.tsx` | User, permissions, `hasPermission`/`canDo` |
| `main-app/frontend/src/context/SettingsContext.tsx` | Company settings (tax, currency, receipt) |
| `main-app/frontend/src/App.tsx` | All route definitions |
| `main-app/frontend/src/components/Layout.tsx` | Sidebar nav with permission-gated items |
| `database/schema.sql` | Canonical DB schema (there is no `master_schema.sql`) |
