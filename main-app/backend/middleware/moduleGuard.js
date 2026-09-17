// =============================================================
// moduleGuard.js - Module gating (disabled in single-tenant)
//
// Phase 4: single-tenant — every module is enabled for the one
// company this instance serves, so requireModule() is a no-op.
// Still imported by route files for structure/call-site
// compatibility; kept as its own middleware so gating can be
// reintroduced later without touching every route file.
//
// The real, live permission tree that drives Access Control (RBAC)
// UI and enforcement is the DB-backed `role_permissions` table
// (see middleware/auth.js's requirePermission) plus the hardcoded
// MODULE_TREE in frontend/src/pages/system/AccessControl.tsx — not
// this file. A previous pricing/module dictionary lived here but
// was never wired to any endpoint or frontend page; it was removed
// as dead code rather than kept in sync with two other sources of
// truth it never actually fed.
// =============================================================

const requireModule = (_moduleName) => (_req, _res, next) => next();

module.exports = { requireModule };
