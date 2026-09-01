const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getAllPermissions,
  getPermissionsByRole,
  updatePermissions,
} = require('../controllers/permissionController');

router.use(authenticate);

router.get('/', getAllPermissions);
router.get('/:role', getPermissionsByRole);
router.put('/:role', authorize('Admin'), updatePermissions);

module.exports = router;
