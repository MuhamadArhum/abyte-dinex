const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { authenticate, requirePermission } = require('../middleware/auth');

// The frontend already gates visibility of the AI widget behind the
// "system.ai_widget" permission (see AIWidget.tsx / AccessControl.tsx's
// MODULE_TREE) — but that was a client-side-only check with no matching
// server-side enforcement, so any authenticated role could still call this
// endpoint directly and read its company-wide revenue/profit/customer-balance
// context regardless of whether their role has system.ai_widget granted.
// { asView: true } — this is a POST (it has a message body) but semantically a
// read, so check the base "system.ai_widget" permission rather than the
// POST→"system.ai_widget.create" mapping requirePermission would otherwise apply.
router.post('/chat', authenticate, requirePermission('system.ai_widget', { asView: true }), aiController.chat);

module.exports = router;
