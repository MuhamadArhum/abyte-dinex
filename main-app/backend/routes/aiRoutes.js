const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { authenticate } = require('../middleware/auth');

// Protected AI route - requires authenticated user
router.post('/chat', authenticate, aiController.chat);

module.exports = router;
