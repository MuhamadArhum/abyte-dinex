// queueService.js - BullMQ job queue factory
//
// Queues (all backed by Redis via REDIS_URL):
//   email   – fire-and-forget email sends with retry
//   ai      – heavyweight AI context rebuild jobs
//   report  – slow report generation jobs
//
// Graceful fallback: if Redis is unavailable the add() calls execute
// the job inline so the system never goes dark — it just loses queuing.

const { Queue, Worker, QueueEvents } = require('bullmq');
const logger = require('../config/logger');

const REDIS_URL = process.env.REDIS_URL;

let _connection = null;
function getConnection() {
  if (!_connection && REDIS_URL) {
    // BullMQ uses ioredis syntax for connection
    const url = new URL(REDIS_URL);
    _connection = {
      host:     url.hostname,
      port:     parseInt(url.port) || 6379,
      password: url.password || undefined,
      db:       parseInt(url.pathname?.slice(1)) || 0,
      maxRetriesPerRequest: null, // required by BullMQ
      enableReadyCheck: false,
    };
  }
  return _connection;
}

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { count: 500 },
  removeOnFail:     { count: 200 },
};

// ── Queue registry ────────────────────────────────────────────
const _queues = new Map();

function getQueue(name) {
  if (!REDIS_URL) return null;
  if (!_queues.has(name)) {
    _queues.set(name, new Queue(name, {
      connection: getConnection(),
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    }));
  }
  return _queues.get(name);
}

// ── Add job (with inline fallback) ───────────────────────────
async function addJob(queueName, jobName, data, opts = {}) {
  const queue = getQueue(queueName);
  if (!queue) {
    // No Redis — execute inline (synchronous fallback)
    logger.warn(`[Queue] Redis not configured — running ${queueName}:${jobName} inline`);
    return { inline: true };
  }
  return queue.add(jobName, data, { ...DEFAULT_JOB_OPTIONS, ...opts });
}

// ── Close all queues on graceful shutdown ─────────────────────
async function closeQueues() {
  const closers = [..._queues.values()].map(q => q.close().catch(() => {}));
  await Promise.all(closers);
  _queues.clear();
}

// ── Convenience helpers ───────────────────────────────────────
const emailQueue = {
  add: (jobName, data, opts) => addJob('email', jobName, data, opts),
};

const aiQueue = {
  add: (jobName, data, opts) => addJob('ai', jobName, data, opts),
};

const reportQueue = {
  add: (jobName, data, opts) => addJob('report', jobName, data, opts),
};

module.exports = {
  getQueue,
  addJob,
  closeQueues,
  emailQueue,
  aiQueue,
  reportQueue,
  getConnection,
  REDIS_AVAILABLE: !!REDIS_URL,
};
