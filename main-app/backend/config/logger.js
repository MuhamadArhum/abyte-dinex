// =============================================================
// logger.js - Structured Logger (Winston)
// Console: human-readable with colors
// Files:   JSON (Loki / ELK / Datadog compatible)
// Request IDs injected automatically via AsyncLocalStorage
// =============================================================

const { createLogger, format, transports } = require('winston');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

const { combine, timestamp, printf, colorize, errors, json } = format;

// Resolve a writable log directory. Priority:
// 1. LOG_DIR env var (set by server-app Electron process)
// 2. ../logs relative to this file (works in dev)
// 3. AppData fallback (when installed under C:\Program Files\)
function resolveLogDir() {
  if (process.env.LOG_DIR) return process.env.LOG_DIR;
  const devDir = path.join(__dirname, '../logs');
  try { fs.mkdirSync(devDir, { recursive: true }); return devDir; } catch {
    return path.join(os.homedir(), 'AppData', 'Roaming', 'AByte ERP Server', 'logs');
  }
}
const logDir = resolveLogDir();

// Pull request ID from requestId middleware context (zero-dependency circular-import safe)
const getRequestId = () => {
  try { return require('../middleware/requestId').getRequestId(); } catch { return null; }
};

// Add requestId to every log record
const requestIdFormat = format((info) => {
  const rid = getRequestId();
  if (rid) info.requestId = rid;
  return info;
});

// Human-readable format for console
const consoleFormat = printf(({ level, message, timestamp, stack, requestId, ...meta }) => {
  const rid   = requestId ? ` [${requestId.slice(0, 8)}]` : '';
  const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
  return `[${timestamp}]${rid} ${level.toUpperCase()}: ${stack || message}${metaStr}`;
});

// JSON format for files (Loki labels: level, requestId, service)
const fileJsonFormat = combine(
  timestamp(),
  errors({ stack: true }),
  requestIdFormat(),
  format((info) => { info.service = 'abyte-api'; return info; })(),
  json()
);

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    requestIdFormat()
  ),
  transports: [
    new transports.Console({
      format: combine(
        colorize({ all: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        requestIdFormat(),
        consoleFormat
      ),
    }),

    // JSON structured error log — grep-able, Loki-importable
    new transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: fileJsonFormat,
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    }),

    // JSON structured combined log
    new transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: fileJsonFormat,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
});

module.exports = logger;
