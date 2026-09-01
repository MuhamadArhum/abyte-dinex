const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireModule } = require('../middleware/moduleGuard');

// GET /api/loyalty/config
// Returns is_active: false until loyalty tables are provisioned
router.get('/config', authenticate, requireModule('sales.loyalty'), (_req, res) => {
  res.json({ is_active: false });
});

// GET /api/loyalty/customer/:id
router.get('/customer/:id', authenticate, (_req, res) => {
  res.json({ loyalty_points: 0 });
});

module.exports = router;
