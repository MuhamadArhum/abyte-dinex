const express = require('express');
const router = express.Router();
const controller = require('../controllers/salesTargetController');
const { authenticate, requirePermission } = require('../middleware/auth');
const { requireModule } = require('../middleware/moduleGuard');

router.use(authenticate);
router.use(requireModule('sales.targets'));

router.get('/stats', controller.getStats);
router.get('/dashboard', controller.getDashboard);
router.get('/:id', controller.getById);
router.get('/', controller.getAll);
router.post('/', requirePermission('sales.targets'), controller.create);
router.put('/:id', requirePermission('sales.targets'), controller.update);
router.delete('/:id', requirePermission('sales.targets'), controller.delete);

module.exports = router;
