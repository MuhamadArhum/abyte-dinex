const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { requireModule } = require('../middleware/moduleGuard');

// POST /api/coupons/validate
router.post('/validate', authenticate, requireModule('sales.loyalty'), (_req, res) => {
  res.status(404).json({ message: 'Coupon not found' });
});

module.exports = router;
