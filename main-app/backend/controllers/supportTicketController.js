// Phase 4: Single-tenant LAN — support tickets not applicable.
// Return empty/404 responses to avoid breaking existing route registrations.

async function getMyTickets(_req, res) {
  res.json([]);
}

async function createTicket(_req, res) {
  res.status(404).json({ error: 'Support tickets not available in offline LAN mode' });
}

module.exports = { getMyTickets, createTicket };
