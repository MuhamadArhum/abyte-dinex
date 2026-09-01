# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

AByte ERP is a multi-tenant SaaS Point-of-Sale / ERP system. It has three deployable apps:

| App | Path | Port | Stack |
|-----|------|------|-------|
| Main App Backend | `main-app/backend/` | 5000 | Node.js + Express + MariaDB |
| Main App Frontend | `main-app/frontend/` | 5173 (dev) | React + TypeScript + Vite + Tailwind |
| Admin Panel Backend | `admin-panel/backend/` | 5001 | Node.js + Express |
| Admin Panel Frontend | `admin-panel/frontend/` | 5174 (dev) | React + TypeScript + Vite |

Other directories: `printer-agent/` (Electron desktop app), `waiter-app/` (mobile-facing React app), `database/` (SQL schema files).

---

## Commands

### Backend (main-app/backend)
```bash
node server.js                  # start server
npm test                        # run all Jest tests
npm run test:coverage           # run tests with coverage
npx jest tests/unit/auth.test.js  # run a single test file
npm run migrate:all             # run migrations across all tenant DBs
npm run db:status               # check DB/migration status
```

### Frontend (main-app/frontend)
```bash
npm run dev       # start Vite dev server (port 5173)
npm run build     # TypeScript check + production build
npm run lint      # ESLint
npm test          # Vitest (run once)
npm run test:watch  # Vitest (watch mode)
```

### Admin Panel (admin-panel/backend)
```bash
node server.js      # no test runner; use nodemon for dev
```

### Environment
Backend requires `.env` in `main-app/backend/`. Copy from `.env` (already present) and set:
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (default: `abyte_pos`), `MASTER_DB_NAME` (default: `abyte_master`)
- `JWT_SECRET` — generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM` — for email features
- `PORT=5000`

Frontend uses `VITE_API_URL` to point at the backend. In dev, Vite proxies `/api` to `localhost:5000` automatically.

---

## Multi-Tenant Architecture (Critical)

**Every request is tenant-scoped.** Understanding this is essential before touching any backend code.

### How it works
1. Login sends `company_code` + `email` + `password`.
2. `authController` looks up the tenant in `abyte_master.tenants` → gets `db_name`.
3. JWT payload includes `{ tenant_db, tenant_id, modules, branch_id }`.
4. `authenticate` middleware (in `middleware/auth.js`) decodes JWT → calls `tenantStorage.run(tenantDb, next)`.
5. `query()` in `config/database.js` reads `tenantStorage` via `AsyncLocalStorage` and routes to the correct per-tenant MariaDB pool automatically.

**Result:** Controllers call `query(sql, params)` with no tenant logic — routing is fully transparent. Never pass a DB name to `query()` in controller code. Use `queryDb(dbName, sql, params)` only when you explicitly need to target a specific DB (e.g., in migrations or auth).

### Database layout
- `abyte_master` — global DB: `tenants`, `tenant_configs`, `modules`, `super_admins`
- `abyte_<tenant_code>` — one DB per tenant, full schema from `database/schema.sql`

### Schema changes
All schema changes go through `services/migrationService.js`. Add a new numbered object to the `MIGRATIONS` array at the bottom. Each migration runs once per tenant DB, tracked in `schema_migrations`. **Never use `ALTER TABLE` in controllers.**

---

## Authorization Layers

Three layers stack on every protected route:

| Middleware | Purpose | Usage |
|-----------|---------|-------|
| `authenticate` | Verifies JWT, loads `req.user`, sets `req.tenantDb` | Every protected route |
| `requireModule('sales')` | Checks tenant has subscribed to the module | Module-gated features |
| `requirePermission('sales.pos')` | Checks role has the permission in `role_permissions` table | Feature-level access |

`requirePermission` auto-maps HTTP methods to CRUD sub-keys: `POST` → `.create`, `PUT/PATCH` → `.update`, `DELETE` → `.delete`. `GET` checks the base key. Admin role bypasses permission checks entirely.

On the frontend, use `hasPermission(moduleKey)` from `useAuth()`, or wrap routes in `<PermissionGuard moduleKey="sales.pos">`. The sidebar in `Layout.tsx` drives nav visibility via `moduleKey` on each item.

---

## Frontend Patterns

### API calls
All API calls go through `src/utils/api.ts` (Axios instance). It auto-attaches the JWT header and injects `filter_branch` query param on GET requests when an admin has selected a branch. Import as:
```ts
import api from '../utils/api';
const { data } = await api.get('/products');
```

### Auth & permissions
```ts
const { user, hasPermission, canDo, hasModule, isAdmin, currencySymbol } = useAuth();
hasPermission('sales.pos')           // view access
canDo('sales.pos', 'create')         // write access
hasModule('accounts')                // module subscription
```

### Page routing
All pages are lazy-loaded via `React.lazy` in `App.tsx`. To add a new page: create the file, add a `lazy()` import in `App.tsx`, and add the `<Route>` inside the authenticated layout block. Add it to the sidebar in `Layout.tsx` with a `moduleKey`.

### Settings context
`useSettings()` from `SettingsContext` provides company settings (tax rate, receipt config, currency, etc.) loaded once at login.

---

## Backend Patterns

### Adding a new API endpoint
1. Create or update a controller in `controllers/`.
2. Create or update a route file in `routes/`.
3. Register the route in `server.js` with the correct middleware stack.
4. Standard stack: `router.get('/path', authenticate, requireModule('x'), requirePermission('x.y'), controller)`.

### Branch isolation
Non-admin users have `req.branchId` set from their JWT. Controllers must scope queries to `branch_id = req.branchId` when it is non-null. Admins have `branch_id = null` and see all branches.

### Audit logging
Call `logAction(userId, username, action, entity, entityId, changes, ip)` from `services/auditService.js` for any data-mutating operation.

### Error responses
- `400` — validation / missing fields
- `401` — unauthenticated
- `403` — forbidden (wrong role or missing module)
- `404` — not found
- `500` — caught exception with `res.status(500).json({ message: 'Server error' })`

Actual error detail goes to `logger.error(...)`, never in the 500 response body.

---

## Testing

Backend tests use **Jest + Supertest** with mocked DB and logger. The pattern:
```js
jest.mock('../../config/database');   // mock query/queryDb
jest.mock('../../config/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn(), http: jest.fn() }));
const { buildTestApp } = require('../helpers/testApp');
const app = buildTestApp();
```
Tests live in `tests/unit/` and `tests/integration/`. Frontend tests use **Vitest** in `src/tests/`.

---

## Modules / Plan Gating

The four billable modules are `sales`, `inventory`, `accounts`, `hr`. Each tenant's enabled modules are stored in `abyte_master.tenant_configs.modules_enabled` (JSON array). The JWT carries `modules[]`, and `requireModule()` checks it server-side. Frontend `hasModule()` checks the same array client-side to hide UI for unsubscribed features.

---

## Key Files Quick Reference

| File | Role |
|------|------|
| `main-app/backend/server.js` | Entry point, all route mounts |
| `main-app/backend/config/database.js` | Multi-tenant DB pool + `query()` / `queryDb()` |
| `main-app/backend/middleware/auth.js` | `authenticate`, `authorize`, `requirePermission` |
| `main-app/backend/middleware/moduleGuard.js` | `requireModule`, module list + pricing |
| `main-app/backend/services/migrationService.js` | Schema migrations (add new ones here) |
| `main-app/backend/services/emailService.js` | Email sending via nodemailer |
| `main-app/frontend/src/utils/api.ts` | Axios instance with auth + branch injection |
| `main-app/frontend/src/context/AuthContext.tsx` | User, permissions, modules, tenant config |
| `main-app/frontend/src/context/SettingsContext.tsx` | Company settings (tax, currency, receipt) |
| `main-app/frontend/src/App.tsx` | All route definitions |
| `main-app/frontend/src/components/Layout.tsx` | Sidebar nav with permission-gated items |
| `database/schema.sql` | Canonical tenant DB schema |
| `database/master_schema.sql` | Master DB schema (`abyte_master`) |
