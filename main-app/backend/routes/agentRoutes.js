const express       = require('express');
const router        = express.Router();
const agentController = require('../controllers/agentController');

// No JWT auth — uses X-Tenant-Code + X-Agent-Token headers
router.get('/print-queue/pending', agentController.getPendingJobs);
router.patch('/print-queue/:id',   agentController.updateJobStatus);

module.exports = router;
