// =============================================================
// agentController.js — Printer Agent polling endpoints
//
// No JWT required. Auth uses:
//   X-Tenant-Code: tenant_code (e.g. "khayyam")
//   X-Agent-Token: token stored in store_settings.agent_token
//
// Flow:
//   Agent polls GET /api/agent/print-queue/pending every 3s
//   Backend returns pending jobs (marks them 'printing')
//   Agent prints, then PATCH /api/agent/print-queue/:id → done|failed
// =============================================================

// Phase 4: single-tenant — no master DB, no X-Tenant-Code lookup.
// Auth uses only X-Agent-Token validated against store_settings.agent_token.

const crypto = require('crypto');
const { query, getConnection } = require('../config/database');
const logger  = require('../config/logger');

async function resolveAndAuth(req, res) {
  const agentToken = req.headers['x-agent-token'];

  if (!agentToken) {
    res.status(401).json({ message: 'X-Agent-Token header required' });
    return false;
  }

  const settings = await query('SELECT agent_token FROM store_settings WHERE setting_id = 1');
  const stored   = settings && settings[0] ? settings[0].agent_token : null;

  if (!stored) {
    res.status(401).json({ message: 'Agent token not configured' });
    return false;
  }

  const storedBuf = Buffer.from(stored, 'utf8');
  const tokenBuf  = Buffer.from(agentToken, 'utf8');
  if (storedBuf.length !== tokenBuf.length ||
      !crypto.timingSafeEqual(storedBuf, tokenBuf)) {
    res.status(401).json({ message: 'Invalid agent token' });
    return false;
  }

  return true;
}

// GET /api/agent/print-queue/pending
exports.getPendingJobs = async (req, res) => {
  try {
    const ok = await resolveAndAuth(req, res);
    if (!ok) return;

    const conn = await getConnection();
    let jobs   = [];
    try {
      await conn.beginTransaction();
      jobs = await conn.query(
        `SELECT id, type, payload, created_at FROM print_queue WHERE status = 'pending' ORDER BY created_at ASC LIMIT 5 FOR UPDATE`
      );
      if (jobs.length > 0) {
        const ids = jobs.map(j => j.id);
        await conn.query(
          `UPDATE print_queue SET status = 'printing' WHERE id IN (${ids.map(() => '?').join(',')})`,
          ids
        );
      }
      await conn.commit();
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }

    const parsed = jobs.map(j => ({
      id:         j.id,
      type:       j.type,
      payload:    typeof j.payload === 'string' ? JSON.parse(j.payload) : j.payload,
      created_at: j.created_at,
    }));

    res.json({ jobs: parsed });
  } catch (err) {
    logger.error('[agentController] getPendingJobs:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// PATCH /api/agent/print-queue/:id
exports.updateJobStatus = async (req, res) => {
  try {
    const ok = await resolveAndAuth(req, res);
    if (!ok) return;

    const { id } = req.params;
    const { status, error_message } = req.body;

    if (!['done', 'failed'].includes(status)) {
      return res.status(400).json({ message: 'status must be done or failed' });
    }

    await query(
      `UPDATE print_queue SET status = ?, error_message = ?, processed_at = NOW() WHERE id = ?`,
      [status, error_message || null, id]
    );

    res.json({ success: true });
  } catch (err) {
    logger.error('[agentController] updateJobStatus:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};
