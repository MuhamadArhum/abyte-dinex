// =============================================================
// tenantRoutes.js - Company Config Routes (Single-Tenant)
//
// Phase 4: Super-admin multi-tenant management routes removed.
// =============================================================

const express = require('express');
const router  = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const tenantController = require('../controllers/tenantController');

// Public (no auth) — login page branding
router.get('/config/public', tenantController.getPublicConfig);

// Authenticated — company config
router.get('/config', authenticate, tenantController.getConfig);
router.put('/config', authenticate, authorize('Admin'), tenantController.updateConfig);

module.exports = router;
