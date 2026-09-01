// Phase 4: Single-tenant LAN — announcements from master DB removed.
// Return empty array so frontend banner code doesn't break.

const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');

router.get('/active',    (_req, res) => res.json([]));
router.post('/:id/view', authenticate, (_req, res) => res.json({ ok: true }));

module.exports = router;
