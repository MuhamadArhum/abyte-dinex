const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getAllPermissions,
  getPermissionsByRole,
  updatePermissions,
} = require('../controllers/permissionController');

router.use(authenticate);

// Admin-only: non-admins must not enumerate role permissions
router.get('/', authorize('Admin'), getAllPermissions);
router.get('/:role', authorize('Admin'), getPermissionsByRole);
router.put('/:role', authorize('Admin'), updatePermissions);

module.exports = router;
