// =============================================================
// server.js - Main Entry Point for AByte ERP Backend
//
// Phase 4: Single-tenant LAN deployment.
// One DB, no master DB, no module gating.
// =============================================================

const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const compression  = require('compression');
const morgan       = require('morgan');
const path         = require('path');
const rateLimit    = require('express-rate-limit');
const cron         = require('node-cron');
require('dotenv').config({
  path: path.join(__dirname, process.env.NODE_ENV === 'production' ? '.env.production' : '.env'),
});

const logger = require('./config/logger');
const { validateEnv } = require('./config/validateEnv');
const { requestIdMiddleware } = require('./middleware/requestId');
const { metricsMiddleware, metricsHandler } = require('./services/metricsService');
validateEnv();

// ── JWT Secret Safety Check ──────────────────────────────────
const INSECURE_JWT_DEFAULTS = [
  'your-super-secret-jwt-key-change-in-production',
  'secret',
  'changeme',
  'jwt_secret',
];
if (!process.env.JWT_SECRET || INSECURE_JWT_DEFAULTS.includes(process.env.JWT_SECRET)) {
  if (process.env.NODE_ENV === 'production') {
    logger.error('FATAL: JWT_SECRET is not set or is using a default insecure value. Set a strong random secret in .env.production and restart.');
    process.exit(1);
  } else {
    logger.warn('WARNING: JWT_SECRET is insecure. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  }
}

// ── Global Process Error Handlers ────────────────────────────
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack:  reason instanceof Error ? reason.stack : undefined,
  });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception — shutting down', { error: err.message, stack: err.stack });
  process.exit(1);
});

// --- Import Route Files ---
const authRoutes            = require('./routes/authRoutes');
const userRoutes            = require('./routes/userRoutes');
const productRoutes         = require('./routes/productRoutes');
const inventoryRoutes       = require('./routes/inventoryRoutes');
const salesRoutes           = require('./routes/salesRoutes');
const customerRoutes        = require('./routes/customerRoutes');
const reportRoutes          = require('./routes/reportRoutes');
const settingsRoutes        = require('./routes/settingsRoutes');
const aiRoutes              = require('./routes/aiRoutes');
const auditRoutes           = require('./routes/auditRoutes');
const registerRoutes        = require('./routes/registerRoutes');
const returnRoutes          = require('./routes/returnRoutes');
const backupRoutes          = require('./routes/backupRoutes');
const variantRoutes         = require('./routes/variantRoutes');
const bundleRoutes          = require('./routes/bundleRoutes');
const supplierRoutes        = require('./routes/supplierRoutes');
const purchaseOrderRoutes   = require('./routes/purchaseOrderRoutes');
const analyticsRoutes       = require('./routes/analyticsRoutes');
const stockAdjustmentRoutes = require('./routes/stockAdjustmentRoutes');
const inventoryReportRoutes = require('./routes/inventoryReportRoutes');
const salesReportRoutes     = require('./routes/salesReportRoutes');
const sectionsRoutes        = require('./routes/sectionsRoutes');
const issuanceRoutes        = require('./routes/issuanceRoutes');
const purchaseVoucherRoutes = require('./routes/purchaseVoucherRoutes');
const purchaseReturnRoutes  = require('./routes/purchaseReturnRoutes');
const openingStockRoutes    = require('./routes/openingStockRoutes');
const creditSaleRoutes      = require('./routes/creditSaleRoutes');
const quotationRoutes       = require('./routes/quotationRoutes');
const priceRuleRoutes       = require('./routes/priceRuleRoutes');
const salesTargetRoutes     = require('./routes/salesTargetRoutes');
const deliveryRoutes        = require('./routes/deliveryRoutes');
const permissionRoutes      = require('./routes/permissionRoutes');
const tenantRoutes          = require('./routes/tenantRoutes');
const emailRoutes           = require('./routes/emailRoutes');
const restaurantRoutes      = require('./routes/restaurantRoutes');
const recipeRoutes          = require('./routes/recipeRoutes');
const productionRoutes      = require('./routes/productionRoutes');
const agentRoutes           = require('./routes/agentRoutes');
const supportTicketRoutes   = require('./routes/supportTicketRoutes');
const whatsappRoutes        = require('./routes/whatsappRoutes');
const fbrRoutes             = require('./routes/fbrRoutes');

const app = express();

// Trust nginx reverse proxy (required for express-rate-limit behind nginx)
app.set('trust proxy', 1);

// ── CORS Configuration ───────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000'];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. same-origin, mobile apps, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes('*')) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: Origin '${origin}' not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Subdomain', 'X-Tenant-Code', 'X-Agent-Token'],
};

// ── Rate Limiters ────────────────────────────────────────────
// General API limiter: 500 requests per 15 minutes per IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' },
});

// Strict limiter for login: 10 attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please wait 15 minutes.' },
});

// Heavy endpoint limiter: 60 requests per 15 minutes per IP
const heavyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests to this endpoint. Please slow down.' },
});

// AI limiter: 30 requests per 15 minutes (expensive AI calls)
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'AI request limit reached. Please wait before asking again.' },
});

// Agent endpoint limiter: 300 requests per 15 minutes per IP
const agentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many agent requests. Please wait.' },
});

// ── Security Headers (Helmet) ────────────────────────────────
const helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'"],
      styleSrc:       ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc:         ["'self'", "data:", "blob:"],    // data: for base64 logos, blob: for previews
      connectSrc:     ["'self'"],                      // API calls — same origin only
      fontSrc:        ["'self'", "data:", "https://fonts.gstatic.com"],
      objectSrc:      ["'none'"],
      frameSrc:       ["'none'"],
      frameAncestors: ["'none'"],                      // Clickjacking protection
      baseUri:        ["'self'"],
      formAction:     ["'self'"],
      // upgradeInsecureRequests intentionally omitted — this is a local LAN HTTP server
    },
  },
  // HSTS disabled — this server runs on HTTP over LAN, not public HTTPS
  hsts: false,
  // Keep other Helmet defaults: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, etc.
};

app.use(requestIdMiddleware);  // inject X-Request-ID before anything else
app.use(metricsMiddleware);    // track latency/count per route
app.use(helmet(helmetConfig));
app.use(cors(corsOptions));
app.use(compression()); // gzip/brotli — 60-80% smaller JSON responses

app.use(morgan('combined', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));
app.use(express.json({ limit: '10mb' }));

// Sensitive operation limiter: 5 per 15 min (password reset, etc.)
const sensitiveOpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' },
});

// Apply rate limiting
app.use('/api/', apiLimiter);
// authLimiter removed — single client system
app.use('/api/auth/forgot-password', sensitiveOpLimiter);
app.use('/api/auth/reset-password',  sensitiveOpLimiter);
app.use('/api/reports',           heavyLimiter);
app.use('/api/sales-reports',     heavyLimiter);
app.use('/api/inventory-reports', heavyLimiter);
app.use('/api/analytics',         heavyLimiter);
app.use('/api/ai',                aiLimiter);

// ── API Routes ───────────────────────────────────────────────

// Health check — public, no auth (used to wake up Render free tier)
app.get('/api/ping',    (_req, res) => res.json({ ok: true }));
app.get('/api/v1/ping', (_req, res) => res.json({ ok: true, version: 'v1' }));

// Prometheus metrics — protected by METRICS_TOKEN if set
app.get('/api/metrics', metricsHandler);

// Readiness probe — lightweight check used by load balancers / K8s readiness gate
app.get('/api/ready', (_req, res) => res.json({ ready: true }));


// Auth (no tenant guard needed — login resolves tenant itself)
app.use('/api/auth',    authRoutes);

// Tenant management (Admin-only, uses master DB)
app.use('/api/tenants', tenantRoutes);

// Core routes (available on all plans)
app.use('/api/users',           userRoutes);
app.use('/api/customers',       customerRoutes);
app.use('/api/settings',        settingsRoutes);
app.use('/api/ai',              aiRoutes);
app.use('/api/audit',           auditRoutes);
app.use('/api/backup',          backupRoutes);
app.use('/api/permissions',     permissionRoutes);
app.use('/api/analytics',       analyticsRoutes);
app.use('/api/email',           emailRoutes);

// Restaurant module
app.use('/api/restaurant/tables', restaurantRoutes);

// Sales module (basic+)
app.use('/api/sales',           salesRoutes);
app.use('/api/register',        registerRoutes);
app.use('/api/returns',         returnRoutes);
app.use('/api/credit-sales',    creditSaleRoutes);
app.use('/api/quotations',      quotationRoutes);
app.use('/api/price-rules',     priceRuleRoutes);
app.use('/api/sales-targets',   salesTargetRoutes);
app.use('/api/deliveries',      deliveryRoutes);

// Manufacturing / Recipe module
app.use('/api/recipes',             recipeRoutes);
app.use('/api/production-orders',   productionRoutes);

// Inventory module (basic+)
app.use('/api/products',            productRoutes);
app.use('/api/variants',            variantRoutes);
app.use('/api/bundles',             bundleRoutes);
app.use('/api/inventory',           inventoryRoutes);
app.use('/api/suppliers',           supplierRoutes);
app.use('/api/purchase-orders',     purchaseOrderRoutes);
app.use('/api/stock-adjustments',   stockAdjustmentRoutes);
app.use('/api/sections',            sectionsRoutes);
app.use('/api/issuance',            issuanceRoutes);
app.use('/api/purchase-vouchers',   purchaseVoucherRoutes);
app.use('/api/purchase-returns',    purchaseReturnRoutes);
app.use('/api/opening-stock',       openingStockRoutes);

// Reports module (basic+)
app.use('/api/reports',             reportRoutes);
app.use('/api/sales-reports',       salesReportRoutes);
app.use('/api/inventory-reports',   inventoryReportRoutes);

app.use('/api/agent', agentLimiter);
app.use('/api/agent',               agentRoutes);
app.use('/api/support-tickets',     supportTicketRoutes);
app.use('/api/whatsapp',            whatsappRoutes);
app.use('/api/fbr',                 fbrRoutes);

// Health check — probes DB, reports memory/heap/uptime.
// Returns 200 when healthy, 503 when DB is unreachable.
app.get('/api/health', async (_req, res) => {
  const { query: q } = require('./config/database');

  let dbOk = false;
  let dbLatencyMs = null;
  try {
    const t0 = Date.now();
    await q('SELECT 1');
    dbLatencyMs = Date.now() - t0;
    dbOk = true;
  } catch (_e) { /* dbOk stays false */ }

  const mem  = process.memoryUsage();
  const toMB = (b) => Math.round(b / 1024 / 1024);

  const payload = {
    status:        dbOk ? 'ok' : 'error',
    ts:            new Date().toISOString(),
    uptime_s:      Math.floor(process.uptime()),
    db:            dbOk ? `ok (${dbLatencyMs}ms)` : 'unreachable',
    memory: {
      rss_mb:       toMB(mem.rss),
      heap_used_mb: toMB(mem.heapUsed),
      heap_total_mb: toMB(mem.heapTotal),
      external_mb:  toMB(mem.external),
    },
  };

  res.status(dbOk ? 200 : 503).json(payload);
});

// ── Serve Uploaded Files (logos, etc.) ───────────────────────
const _fs = require('fs');
const _os = require('os');
function resolveUploadsDir() {
  if (process.env.UPLOADS_DIR) return process.env.UPLOADS_DIR;
  const defaultDir = path.join(__dirname, 'uploads');
  try { _fs.mkdirSync(defaultDir, { recursive: true }); return defaultDir; } catch {
    const fallback = path.join(_os.homedir(), 'AppData', 'Roaming', 'AByte ERP Server', 'uploads');
    _fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}
const uploadsDir = resolveUploadsDir();
app.use('/uploads', express.static(uploadsDir));

// ── Serve React Frontend ──────────────────────────────────────
// Must be AFTER all /api routes so API calls are not intercepted.
const frontendDist = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDist));

// Catch-all: any non-API route returns index.html (SPA routing)
app.use((req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// ── Global Error Handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.message && err.message.startsWith('CORS')) {
    return res.status(403).json({ message: err.message });
  }
  logger.error('Unhandled route error', {
    error:  err.message,
    stack:  err.stack,
    method: req.method,
    url:    req.originalUrl,
  });
  res.status(500).json({ message: 'Internal server error' });
});

// ── Scheduled Backup (dynamic — time set by Admin in Settings) ──
const { rescheduleBackup } = require('./services/backupScheduler');

// ── Startup Migration: run numbered migrations on the single DB ──
const { runMigrationsForDb } = require('./services/migrationService');

async function runStartupMigrations() {
  const dbName = process.env.DB_NAME || 'abyte_pos';
  try {
    await runMigrationsForDb(dbName);
    logger.info('[Migration] DB migrations complete', { db: dbName });
  } catch (e) {
    logger.warn('[Migration] Startup migration skipped', { error: e.message });
  }
}

// ── Graceful Shutdown ─────────────────────────────────────────
const { closeAllPools } = require('./config/database');
const { closeQueues }   = require('./services/queueService');

function gracefulShutdown(signal) {
  logger.info(`[Shutdown] ${signal} received — draining connections`);

  // Stop accepting new requests; give in-flight requests 30s to finish
  httpServer.close(async () => {
    try {
      cron.getTasks().forEach(t => t.stop());
      await Promise.all([closeAllPools(), closeQueues()]);
      logger.info('[Shutdown] Clean exit');
    } catch (e) {
      logger.error('[Shutdown] Error during cleanup', { error: e.message });
    }
    process.exit(0);
  });

  // Force-exit if graceful drain takes too long
  setTimeout(() => {
    logger.error('[Shutdown] Force-exiting after 30s timeout');
    process.exit(1);
  }, 30000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

// ── Start Server ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const httpServer = app.listen(PORT, async () => {
  logger.info(`AByte ERP backend started`, {
    port:    PORT,
    db:      process.env.DB_NAME || 'abyte_pos',
    origins: allowedOrigins,
  });

  // Signal PM2 that this worker is ready (enables zero-downtime reloads)
  if (typeof process.send === 'function') process.send('ready');

  // Run after server is accepting requests so DB pool is ready
  runStartupMigrations();

  // Initialize DB-backed token blacklist table
  const { ensureTable, cleanExpired } = require('./services/tokenBlacklist');
  await ensureTable();

  // Clean expired blacklisted tokens every hour
  cron.schedule('0 * * * *', () => {
    cleanExpired().catch(() => {});
  });

  // Load backup schedule from DB and start cron (columns ensured by Migration v19)
  try {
    const { query: q } = require('./config/database');
    const rows = await q(`SELECT backup_schedule_enabled, backup_schedule_time FROM store_settings WHERE setting_id = 1`).catch(() => []);
    const enabled = rows.length ? !!rows[0].backup_schedule_enabled : true;
    const timeStr = (rows.length && rows[0].backup_schedule_time) ? rows[0].backup_schedule_time : '02:00';
    const [hh, mm] = timeStr.split(':').map(Number);
    rescheduleBackup(enabled, hh || 2, mm || 0);
  } catch (e) {
    logger.warn('[Backup] Could not load schedule from DB, using default 02:00', { error: e.message });
    rescheduleBackup(true, 2, 0);
  }

  // Run backup retention sweep daily at 03:00
  cron.schedule('0 3 * * *', async () => {
    const { pruneOldBackups, verifyLastBackup } = require('./services/backupService');
    await pruneOldBackups().catch(e => logger.error('[Backup] Retention sweep failed', { error: e.message }));
    const check = await verifyLastBackup().catch(() => ({ ok: false, reason: 'verify threw' }));
    if (!check.ok) logger.warn('[Backup] Last backup integrity check failed', check);
    else logger.info('[Backup] Last backup integrity OK', { filename: check.filename, sizeBytes: check.sizeBytes });
  });
});
