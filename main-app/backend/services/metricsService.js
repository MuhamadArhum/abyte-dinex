// metricsService.js - Prometheus metrics via prom-client
//
// Exposes:
//   http_requests_total          counter  – by method, route, status
//   http_request_duration_seconds histogram – request latency
//   db_pool_active_count         gauge    – live MariaDB tenant pools
//   queue_jobs_total             counter  – by queue name and status
//   nodejs_*                     built-in Node.js metrics (memory, GC, event-loop)
//
// Endpoint: GET /api/metrics  (protected by METRICS_TOKEN header)

const client = require('prom-client');

// Enable Node.js default metrics (heap, GC, event-loop lag, handles)
const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: 'abyte_' });

// ── HTTP metrics ──────────────────────────────────────────────
const httpRequestsTotal = new client.Counter({
  name:       'abyte_http_requests_total',
  help:       'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers:  [register],
});

const httpRequestDuration = new client.Histogram({
  name:       'abyte_http_request_duration_seconds',
  help:       'HTTP request latency',
  labelNames: ['method', 'route', 'status'],
  buckets:    [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers:  [register],
});

// ── Database pool gauge ───────────────────────────────────────
const dbPoolActiveCount = new client.Gauge({
  name:      'abyte_db_pool_active_count',
  help:      'Number of active MariaDB tenant pools',
  registers: [register],
});

// ── Queue metrics ─────────────────────────────────────────────
const queueJobsTotal = new client.Counter({
  name:       'abyte_queue_jobs_total',
  help:       'Total BullMQ jobs processed',
  labelNames: ['queue', 'status'],
  registers:  [register],
});

// Update DB pool gauge on each scrape
register.setDefaultLabels({ app: 'abyte-erp' });

// ── Express middleware ────────────────────────────────────────
// Normalise route labels so high-cardinality IDs don't blow up Prometheus
const PARAM_RE = /\/\d+/g;
const normaliseRoute = (path) =>
  path.replace(PARAM_RE, '/:id').replace(/\?.*$/, '').substring(0, 80);

function metricsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const route  = normaliseRoute(req.route?.path || req.path || 'unknown');
    const labels = { method: req.method, route, status: res.statusCode };
    httpRequestsTotal.inc(labels);
    const durationSec = Number(process.hrtime.bigint() - start) / 1e9;
    httpRequestDuration.observe(labels, durationSec);
  });
  next();
}

// Called periodically or on each /api/metrics scrape to refresh gauges
function refreshGauges() {
  try {
    const { pools } = require('../config/database');
    if (pools) dbPoolActiveCount.set(pools.size);
  } catch { /* ignore */ }
}

// Expose increment helpers for queue workers
function incQueueJob(queueName, status) {
  queueJobsTotal.inc({ queue: queueName, status });
}

// ── Metrics endpoint handler ──────────────────────────────────
async function metricsHandler(req, res) {
  const token = process.env.METRICS_TOKEN;
  if (token) {
    const provided = req.headers['authorization']?.replace('Bearer ', '') || req.query.token;
    if (provided !== token) return res.status(401).json({ message: 'Unauthorized' });
  }
  refreshGauges();
  res.setHeader('Content-Type', register.contentType);
  res.end(await register.metrics());
}

module.exports = { metricsMiddleware, metricsHandler, incQueueJob, register };
