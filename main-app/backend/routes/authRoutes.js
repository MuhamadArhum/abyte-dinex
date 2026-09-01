// =============================================================
// authRoutes.js - Authentication Routes
// Defines the API endpoints for login and token verification.
// Mounted at: /api/auth (see server.js)
//
// Endpoints:
//   POST /api/auth/login   - Login with email and password (public, no auth needed)
//   GET  /api/auth/verify  - Check if the current token is valid (requires auth)
// =============================================================

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { validateLogin, handleValidation } = require('../middleware/validate');

// POST /api/auth/login - validate input before controller
router.post('/login', validateLogin, handleValidation, authController.login);

// Password reset (public — no auth required)
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password',  authController.resetPassword);

// GET /api/auth/verify - Requires valid JWT token (authenticate middleware checks it)
router.get('/verify', authenticate, authController.verify);

// POST /api/auth/logout - Revokes token server-side (requires auth)
router.post('/logout', authenticate, authController.logout);

// PUT /api/auth/profile - Update own profile (any authenticated user)
router.put('/profile', authenticate, authController.updateProfile);

module.exports = router;
