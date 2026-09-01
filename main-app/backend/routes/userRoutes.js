// =============================================================
// userRoutes.js - User Management Routes
// Defines the API endpoints for managing system users.
// All routes require authentication AND Admin role.
// Mounted at: /api/users (see server.js)
//
// Endpoints:
//   GET    /api/users/roles  - Get available roles (Admin, Manager, Cashier)
//   GET    /api/users        - List all users
//   POST   /api/users        - Create a new user
//   PUT    /api/users/:id    - Update a user
//   DELETE /api/users/:id    - Delete a user
// =============================================================


const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, authorize } = require('../middleware/auth');

// Apply middleware to ALL routes in this file:
// 1. authenticate - verify JWT token (must be logged in)
// 2. authorize('Admin') - only Admin users can manage other users
router.use(authenticate);
router.use(authorize('Admin'));

router.get('/roles', userController.getRoles);              // Get list of roles
router.post('/roles', userController.createRole);           // Create new role
router.delete('/roles/:id', userController.deleteRole);     // Delete a custom role
router.get('/', userController.getAll);                     // Get all users
router.post('/', userController.create);                    // Create new user
router.put('/:id', userController.update);                  // Update user by ID
router.delete('/:id', userController.remove);               // Delete user by ID

module.exports = router;
