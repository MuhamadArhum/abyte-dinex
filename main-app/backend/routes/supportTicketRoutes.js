const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const { getMyTickets, createTicket } = require('../controllers/supportTicketController');

router.get('/',  authenticate, getMyTickets);
router.post('/', authenticate, createTicket);

module.exports = router;
