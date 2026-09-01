// =============================================================
// Abyte ERP Printer Agent v3.0
// Runs on cashier PC — bridges Abyte ERP web app to local printers
//
// Supports multiple printers per PC:
//   - Invoice printers  (receipts, invoices)
//   - KOT printers      (kitchen order tickets, category-routed)
//
// Connection types: network (TCP), usb (serial/COM), windows (shared)
//
// Endpoints:
//   GET  /                      — Web UI dashboard
//   GET  /health                — liveness + printer summary
//   GET  /jobs                  — job log (last 500)
//   DELETE /jobs                — clear job log
//   GET  /printers              — list configured printers
//   POST /printers              — add printer
//   PUT  /printers/:id          — update printer
//   DELETE /printers/:id        — remove printer
//   POST /printers/:id/test     — send test page to specific printer
//   POST /print/invoice         — print receipt / invoice
//   POST /print/kot             — print KOT (routes to printers by category)
// =============================================================

const express  = require('express');
const cors     = require('cors');
const net      = require('net');
const fs       = require('fs');
const path     = require('path');
const os       = require('os');
const { exec } = require('child_process');
const crypto   = require('crypto');
const http     = require('http');
const https    = require('https');

const app     = express();
const PORT    = process.env.PORT || 3001;
const VERSION = '3.1.0';

// ── Config path — works both as Node script AND as pkg EXE ────
// When running as EXE, __dirname is inside the bundle (read-only).
// We store config next to the EXE instead.
const isPkg     = typeof process.pkg !== 'undefined';
const BASE_DIR  = isPkg ? path.dirname(process.execPath) : __dirname;
const CONFIG_FILE = path.join(BASE_DIR, 'config.json');

const DEFAULT_CONFIG = { printers: [], server_url: '', tenant_code: '', agent_token: '' };

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      if (!Array.isArray(data.printers)) data.printers = [];
      return data;
    }
  } catch (e) {
    console.warn('[config] Read error:', e.message, '— using defaults');
  }
  return { ...DEFAULT_CONFIG };
}

function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  } catch (e) {
    console.error('[config] Save error:', e.message);
  }
}

let config = loadConfig();

// ── Job Log ───────────────────────────────────────────────────
const MAX_JOBS = 500;
let jobLog = [];

function addJob(job) {
  jobLog.unshift({ id: crypto.randomUUID(), ts: new Date().toISOString(), ...job });
  if (jobLog.length > MAX_JOBS) jobLog = jobLog.slice(0, MAX_JOBS);
}

// ── Middleware ─────────────────────────────────────────────────
app.use(cors({
  origin: (origin, cb) => {
    // allow requests with no origin (Electron, curl, same-origin) or any localhost port
    if (!origin || /^https?:\/\/localhost(:\d+)?$/.test(origin)) cb(null, true);
    else cb(new Error('CORS: origin not allowed'));
  }
}));
app.use(express.json({ limit: '4mb' }));

// ── ESC/POS Commands ──────────────────────────────────────────
const ESC = 0x1B;
const GS  = 0x1D;

const CMD = {
  INIT:          Buffer.from([ESC, 0x40]),
  ALIGN_CENTER:  Buffer.from([ESC, 0x61, 0x01]),
  ALIGN_LEFT:    Buffer.from([ESC, 0x61, 0x00]),
  ALIGN_RIGHT:   Buffer.from([ESC, 0x61, 0x02]),
  BOLD_ON:       Buffer.from([ESC, 0x45, 0x01]),
  BOLD_OFF:      Buffer.from([ESC, 0x45, 0x00]),
  DOUBLE_SIZE:   Buffer.from([ESC, 0x21, 0x30]),
  DOUBLE_HEIGHT: Buffer.from([ESC, 0x21, 0x10]),
  NORMAL_SIZE:   Buffer.from([ESC, 0x21, 0x00]),
  CUT_PARTIAL:   Buffer.from([GS,  0x56, 0x41, 0x05]),
  CUT_FULL:      Buffer.from([GS,  0x56, 0x00]),
  OPEN_DRAWER:   Buffer.from([ESC, 0x70, 0x00, 0x19, 0xFA]),
  FEED_1:        Buffer.from([ESC, 0x64, 0x01]),
  FEED_3:        Buffer.from([ESC, 0x64, 0x03]),
  FEED_5:        Buffer.from([ESC, 0x64, 0x05]),
};

function txt(s) { return Buffer.from(String(s) + '\n', 'utf8'); }

function buildInvoiceESCPOS(d, printerCfg) {
  const W      = printerCfg.paper_width === 58 ? 32 : 42;
  const bufs   = [];
  const push   = (...b) => b.forEach(x => bufs.push(x));
  const dashes = '-'.repeat(W);
  const equals = '='.repeat(W);

  const split = (l, r) => {
    l = String(l); r = String(r);
    const gap = W - l.length - r.length;
    return gap > 0 ? l + ' '.repeat(gap) + r : l.slice(0, W - r.length - 1) + ' ' + r;
  };
  const padR = (s, n) => String(s).slice(0, n).padEnd(n);
  const padL = (s, n) => String(s).slice(0, n).padStart(n);

  push(CMD.INIT);

  // Logo (pre-rasterized ESC/POS bitmap from frontend)
  if (d.logoEscPosData) {
    try {
      const logoBytes = Buffer.from(d.logoEscPosData, 'base64');
      push(CMD.ALIGN_CENTER);
      bufs.push(logoBytes);
      push(CMD.FEED_1);
    } catch {}
  }

  // Header
  push(CMD.ALIGN_CENTER, CMD.BOLD_ON, CMD.DOUBLE_HEIGHT);
  push(txt((d.storeName || 'Store').toUpperCase()));
  push(CMD.NORMAL_SIZE, CMD.BOLD_OFF);
  if (d.storeAddress) push(txt(d.storeAddress));
  if (d.storePhone)   push(txt('Tel: ' + d.storePhone));
  push(CMD.ALIGN_LEFT, txt(dashes));

  // Meta
  push(CMD.BOLD_ON);
  if (d.invoiceNo) push(txt(split('Invoice:', d.invoiceNo)));
  else             push(txt(split('Receipt #:', String(d.saleId || ''))));
  push(CMD.BOLD_OFF);

  if (d.status) push(txt(split('Status:', d.status.toUpperCase())));

  if (d.tokenNo) {
    push(CMD.ALIGN_CENTER, CMD.BOLD_ON, CMD.DOUBLE_HEIGHT);
    push(txt('Token: ' + d.tokenNo));
    push(CMD.NORMAL_SIZE, CMD.BOLD_OFF, CMD.ALIGN_LEFT);
  }
  push(txt(split('Date:', d.date || new Date().toLocaleString())));
  push(txt(split('Cashier:', d.cashierName || '')));
  if (d.customerName) push(txt(split('Customer:', d.customerName)));
  if (d.tableNo)      push(txt(split('Table:', d.tableNo)));
  push(txt(dashes));

  // Items header
  const nameW = W - 16;
  push(CMD.BOLD_ON);
  push(txt(padR('Item', nameW) + padR('Qty', 5) + padL('Price', 11)));
  push(CMD.BOLD_OFF, txt(dashes));

  const cs = d.currencySymbol || 'Rs.';
  for (const item of (d.items || [])) {
    push(txt(padR(item.name, nameW) + padR(item.quantity, 5) + padL(cs + Number(item.price).toFixed(2), 11)));
    if (item.note) push(txt('  * ' + item.note));
  }
  push(txt(dashes));

  // Totals
  if (Number(d.subtotal)      > 0) push(txt(split('Subtotal:',                      `${cs}${Number(d.subtotal).toFixed(2)}`)));
  if (Number(d.discount)      > 0) push(txt(split('Discount:',                      `-${cs}${Number(d.discount).toFixed(2)}`)));
  if (Number(d.taxAmount)     > 0) push(txt(split(`Tax (${d.taxPercent || 0}%):`,   `${cs}${Number(d.taxAmount).toFixed(2)}`)));
  if (Number(d.chargesAmount) > 0) push(txt(split('Charges:',                       `${cs}${Number(d.chargesAmount).toFixed(2)}`)));
  push(txt(equals));
  push(CMD.BOLD_ON, CMD.DOUBLE_HEIGHT);
  push(txt(split('TOTAL:', `${cs}${Number(d.totalAmount || 0).toFixed(2)}`)));
  push(CMD.NORMAL_SIZE, CMD.BOLD_OFF, txt(equals));
  push(txt(split(`Paid (${d.paymentMethod || 'Cash'}):`, `${cs}${Number(d.amountPaid || 0).toFixed(2)}`)));
  if (Number(d.changeDue) > 0) push(txt(split('Change Due:', `${cs}${Number(d.changeDue).toFixed(2)}`)));
  push(txt(dashes));

  // Footer
  push(CMD.ALIGN_CENTER);
  push(txt(d.footer || 'Thank you for your visit!'));
  push(CMD.ALIGN_LEFT, CMD.FEED_3);
  if (printerCfg.cut_paper !== false) push(CMD.CUT_PARTIAL);
  if (printerCfg.open_drawer)         push(CMD.OPEN_DRAWER);

  return Buffer.concat(bufs);
}

function buildKOTESCPOS(d, printerCfg) {
  const W    = printerCfg.paper_width === 58 ? 32 : 42;
  const bufs = [];
  const push = (...b) => b.forEach(x => bufs.push(x));

  push(CMD.INIT);

  // KOT Header
  push(CMD.ALIGN_CENTER, CMD.BOLD_ON, CMD.DOUBLE_SIZE);
  push(txt('** KOT **'));
  push(CMD.NORMAL_SIZE, CMD.BOLD_OFF);
  push(txt('='.repeat(W)));
  push(CMD.ALIGN_LEFT);

  if (d.tokenNo) {
    push(CMD.BOLD_ON, CMD.DOUBLE_HEIGHT, CMD.ALIGN_CENTER);
    push(txt('Token: ' + d.tokenNo));
    push(CMD.NORMAL_SIZE, CMD.BOLD_OFF, CMD.ALIGN_LEFT);
  }
  if (d.tableNo) {
    push(CMD.BOLD_ON, CMD.DOUBLE_HEIGHT, CMD.ALIGN_CENTER);
    push(txt('Table: ' + d.tableNo));
    push(CMD.NORMAL_SIZE, CMD.BOLD_OFF, CMD.ALIGN_LEFT);
  }
  push(txt(d.date || new Date().toLocaleString()));
  if (d.cashierName) push(txt('By: ' + d.cashierName));
  if (d.categoryName) {
    push(CMD.ALIGN_CENTER, CMD.BOLD_ON);
    push(txt('[ ' + d.categoryName + ' ]'));
    push(CMD.BOLD_OFF, CMD.ALIGN_LEFT);
  }
  push(txt('-'.repeat(W)));

  for (const item of (d.items || [])) {
    push(CMD.BOLD_ON, CMD.DOUBLE_HEIGHT);
    push(txt(`${item.quantity}x  ${item.name}`));
    push(CMD.NORMAL_SIZE, CMD.BOLD_OFF);
    if (item.note) push(txt('   -> ' + item.note));
  }

  push(txt('='.repeat(W)));
  push(CMD.FEED_5);
  if (printerCfg.cut_paper !== false) push(CMD.CUT_PARTIAL);

  return Buffer.concat(bufs);
}

// ── Print methods ─────────────────────────────────────────────
function printNetwork(buf, ip, port) {
  return new Promise((resolve, reject) => {
    const socket  = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Printer at ${ip}:${port} not reachable (timeout)`));
    }, 6000);

    socket.connect(Number(port) || 9100, ip, () => {
      socket.write(buf, (err) => {
        clearTimeout(timeout);
        socket.destroy();
        if (err) reject(err); else resolve();
      });
    });
    socket.on('error', (err) => { clearTimeout(timeout); socket.destroy(); reject(err); });
  });
}

function printWindows(buf, printerName) {
  const tmpFile = path.join(os.tmpdir(), `abyte_${Date.now()}_${Math.random().toString(36).slice(2)}.bin`);
  fs.writeFileSync(tmpFile, buf);
  return new Promise((resolve, reject) => {
    const safeName = printerName.replace(/"/g, '');
    const cmd = `copy /B "${tmpFile}" "\\\\.\\${safeName}" >nul 2>&1 || copy /B "${tmpFile}" "\\\\localhost\\${safeName}" >nul 2>&1`;
    exec(cmd, { shell: 'cmd.exe' }, (err) => {
      try { fs.unlinkSync(tmpFile); } catch {}
      if (err) reject(new Error(`Windows print failed. Check printer name: "${printerName}"`));
      else resolve();
    });
  });
}

function printUSB(buf, comPort) {
  // On Windows, write raw bytes to COM port via cmd
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(os.tmpdir(), `abyte_${Date.now()}.bin`);
    fs.writeFileSync(tmpFile, buf);
    const safePort = comPort.replace(/"/g, '');
    exec(`copy /B "${tmpFile}" "${safePort}"`, { shell: 'cmd.exe' }, (err) => {
      try { fs.unlinkSync(tmpFile); } catch {}
      if (err) reject(new Error(`USB print to ${comPort} failed: ${err.message}`));
      else resolve();
    });
  });
}

async function sendToPrinter(printerCfg, buf) {
  switch (printerCfg.connection) {
    case 'network': return printNetwork(buf, printerCfg.ip, printerCfg.port || 9100);
    case 'usb':     return printUSB(buf, printerCfg.com || 'COM1');
    case 'windows': return printWindows(buf, printerCfg.printer_name);
    default: throw new Error(`Unknown connection type: "${printerCfg.connection}"`);
  }
}

// ── Printer helpers ───────────────────────────────────────────
function getPrinters()          { return config.printers || []; }
function getPrinterById(id)     { return getPrinters().find(p => p.id === id) || null; }
function savePrinters(printers) { config.printers = printers; saveConfig(); }

// ── Web UI ────────────────────────────────────────────────────
function buildUI() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Abyte ERP Printer Agent</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg:      #0f1117;
    --surface: #1a1d27;
    --border:  #2a2d3a;
    --text:    #e2e8f0;
    --muted:   #64748b;
    --green:   #22c55e;
    --red:     #ef4444;
    --amber:   #f59e0b;
    --blue:    #3b82f6;
    --orange:  #f97316;
  }
  body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; min-height: 100vh; }
  .header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 14px 24px; display: flex; align-items: center; gap: 12px; position: sticky; top: 0; z-index: 100; }
  .header-logo { width: 36px; height: 36px; background: linear-gradient(135deg, #3b82f6, #8b5cf6); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 15px; color: #fff; flex-shrink: 0; }
  .header-title { font-size: 16px; font-weight: 700; }
  .header-sub { font-size: 12px; color: var(--muted); }
  .header-right { margin-left: auto; display: flex; align-items: center; gap: 12px; }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); box-shadow: 0 0 8px var(--green); animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
  .status-label { font-size: 12px; color: var(--green); font-weight: 600; }
  .version-badge { background: var(--border); color: var(--muted); font-size: 11px; padding: 3px 10px; border-radius: 20px; }
  .main { max-width: 1100px; margin: 0 auto; padding: 24px; display: grid; gap: 20px; }
  .section { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; }
  .section-header { padding: 14px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
  .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: var(--muted); display: flex; align-items: center; gap: 8px; }
  .section-title span { font-size: 16px; }
  .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; transition: all .15s; }
  .btn-primary { background: var(--blue); color: #fff; }
  .btn-primary:hover { background: #2563eb; transform: translateY(-1px); }
  .btn-danger  { background: transparent; border: 1px solid var(--border); color: var(--red); font-size: 12px; padding: 5px 12px; border-radius: 20px; cursor: pointer; transition: all .15s; }
  .btn-danger:hover { background: rgba(239,68,68,.1); border-color: var(--red); }
  .btn-ghost { background: transparent; border: 1px solid var(--border); color: var(--muted); font-size: 12px; padding: 6px 12px; border-radius: 6px; cursor: pointer; transition: all .15s; }
  .btn-ghost:hover { border-color: var(--blue); color: var(--text); }
  .stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 1px; background: var(--border); }
  .stat { background: var(--surface); padding: 18px 20px; }
  .stat-value { font-size: 30px; font-weight: 800; line-height: 1; }
  .stat-label { font-size: 11px; color: var(--muted); margin-top: 5px; text-transform: uppercase; letter-spacing: .5px; }
  .stat-value.green { color: var(--green); }
  .stat-value.red   { color: var(--red); }
  .stat-value.blue  { color: var(--blue); }
  .stat-value.amber { color: var(--amber); }
  .printers-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 14px; padding: 16px; }
  .printer-card { background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 16px; transition: border-color .2s; }
  .printer-card:hover { border-color: var(--blue); }
  .printer-card-header { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
  .printer-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
  .printer-icon.invoice { background: rgba(59,130,246,.15); }
  .printer-icon.kot     { background: rgba(249,115,22,.15); }
  .printer-name { font-weight: 700; font-size: 14px; }
  .printer-meta { font-size: 11px; color: var(--muted); margin-top: 2px; font-family: monospace; }
  .printer-badges { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 10px; }
  .badge { display: inline-flex; align-items: center; padding: 2px 9px; border-radius: 20px; font-size: 11px; font-weight: 700; }
  .badge.invoice { background: rgba(59,130,246,.15); color: #93c5fd; }
  .badge.kot     { background: rgba(249,115,22,.15);  color: #fdba74; }
  .badge.network { background: rgba(34,197,94,.12);   color: #86efac; }
  .badge.usb     { background: rgba(168,85,247,.12);  color: #d8b4fe; }
  .badge.windows { background: rgba(245,158,11,.12);  color: #fcd34d; }
  .badge.master  { background: rgba(239,68,68,.12);   color: #fca5a5; }
  .badge.cut     { background: rgba(100,116,139,.12); color: #94a3b8; }
  .badge.drawer  { background: rgba(34,197,94,.1);    color: #86efac; }
  .printer-actions { margin-left: auto; display: flex; gap: 6px; flex-shrink: 0; }
  .act-btn { width: 30px; height: 30px; border-radius: 6px; border: 1px solid var(--border); background: transparent; color: var(--muted); cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; transition: all .15s; }
  .act-btn:hover { border-color: var(--blue); color: var(--text); background: rgba(59,130,246,.08); }
  .act-btn.del:hover { border-color: var(--red); color: var(--red); background: rgba(239,68,68,.08); }
  .no-printers { padding: 48px; text-align: center; color: var(--muted); }
  .no-printers-icon { font-size: 44px; margin-bottom: 14px; }
  .filter-group { display: flex; gap: 6px; }
  .filter-btn { background: transparent; border: 1px solid var(--border); color: var(--muted); font-size: 12px; padding: 4px 12px; border-radius: 20px; cursor: pointer; transition: all .15s; }
  .filter-btn:hover { border-color: var(--blue); color: var(--text); }
  .filter-btn.active { background: var(--blue); border-color: var(--blue); color: #fff; }
  .jobs-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .refresh-label { font-size: 11px; color: var(--muted); }
  .toggle { display: flex; align-items: center; gap: 6px; cursor: pointer; }
  .toggle input { display: none; }
  .toggle-track { width: 32px; height: 18px; background: var(--border); border-radius: 9px; position: relative; transition: background .2s; }
  .toggle input:checked + .toggle-track { background: var(--blue); }
  .toggle-thumb { position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; background: #fff; border-radius: 50%; transition: transform .2s; }
  .toggle input:checked ~ .toggle-track .toggle-thumb { transform: translateX(14px); }
  .toggle-label { font-size: 12px; color: var(--muted); }
  .jobs-table { width: 100%; border-collapse: collapse; }
  .jobs-table th { text-align: left; padding: 10px 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; color: var(--muted); border-bottom: 1px solid var(--border); }
  .jobs-table td { padding: 10px 20px; border-bottom: 1px solid rgba(42,45,58,.5); vertical-align: middle; }
  .jobs-table tr:last-child td { border-bottom: none; }
  .jobs-table tr:hover td { background: rgba(255,255,255,.015); }
  .job-type { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
  .job-type.invoice { background: rgba(59,130,246,.15); color: #93c5fd; }
  .job-type.kot     { background: rgba(249,115,22,.15);  color: #fdba74; }
  .job-type.test    { background: rgba(168,85,247,.12);  color: #d8b4fe; }
  .status-pill { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; }
  .status-pill.success { background: rgba(34,197,94,.12);  color: #86efac; }
  .status-pill.failed  { background: rgba(239,68,68,.12);  color: #fca5a5; }
  .status-pill.partial { background: rgba(245,158,11,.12); color: #fcd34d; }
  .job-printer { font-size: 13px; font-weight: 600; }
  .job-detail  { font-size: 11px; color: var(--muted); margin-top: 2px; }
  .job-error   { font-size: 11px; color: var(--red); margin-top: 3px; font-family: monospace; }
  .job-time    { font-size: 12px; color: var(--muted); white-space: nowrap; }
  .sub-results { margin-top: 6px; display: grid; gap: 3px; }
  .sub-row { font-size: 11px; display: flex; align-items: center; gap: 6px; }
  .dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
  .dot.ok  { background: var(--green); }
  .dot.err { background: var(--red); }
  .no-jobs { padding: 48px; text-align: center; color: var(--muted); }
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.65); backdrop-filter: blur(6px); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 16px; }
  .modal-overlay.hidden { display: none; }
  .modal { background: var(--surface); border: 1px solid var(--border); border-radius: 16px; width: 100%; max-width: 500px; max-height: 92vh; overflow-y: auto; }
  .modal-header { padding: 20px 22px 16px; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
  .modal-title { font-size: 17px; font-weight: 700; }
  .modal-close { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 22px; line-height: 1; padding: 2px 6px; border-radius: 4px; }
  .modal-close:hover { color: var(--text); background: var(--border); }
  .modal-body { padding: 22px; display: grid; gap: 18px; }
  .modal-footer { padding: 14px 22px; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 10px; }
  .form-group { display: grid; gap: 6px; }
  .form-label { font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: .5px; }
  .form-input { background: var(--bg); border: 1px solid var(--border); color: var(--text); border-radius: 8px; padding: 10px 13px; font-size: 14px; width: 100%; outline: none; transition: border-color .15s; }
  .form-input:focus { border-color: var(--blue); }
  select.form-input { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M6 8L1 3h10z'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 13px center; padding-right: 34px; }
  .form-hint { font-size: 11px; color: var(--muted); }
  .type-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .type-card { border: 2px solid var(--border); border-radius: 12px; padding: 14px; cursor: pointer; transition: all .15s; text-align: center; background: var(--bg); }
  .type-card:hover { border-color: var(--muted); }
  .type-card.sel-invoice { border-color: var(--blue);   background: rgba(59,130,246,.08); }
  .type-card.sel-kot     { border-color: var(--orange); background: rgba(249,115,22,.08); }
  .type-icon  { font-size: 26px; margin-bottom: 6px; }
  .type-label { font-size: 14px; font-weight: 700; }
  .type-desc  { font-size: 11px; color: var(--muted); margin-top: 3px; }
  .conn-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; }
  .conn-card { border: 2px solid var(--border); border-radius: 10px; padding: 12px 8px; cursor: pointer; text-align: center; transition: all .15s; background: var(--bg); }
  .conn-card:hover { border-color: var(--muted); }
  .conn-card.sel { border-color: var(--blue); background: rgba(59,130,246,.08); }
  .conn-icon  { font-size: 20px; margin-bottom: 4px; }
  .conn-label { font-size: 12px; font-weight: 600; }
  .check-row { display: flex; align-items: center; gap: 12px; cursor: pointer; padding: 11px 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg); transition: border-color .15s; }
  .check-row:hover { border-color: var(--blue); }
  .check-row input { width: 16px; height: 16px; accent-color: var(--blue); cursor: pointer; flex-shrink: 0; }
  .check-title { font-size: 13px; font-weight: 600; }
  .check-desc  { font-size: 11px; color: var(--muted); margin-top: 1px; }
  .toast { position: fixed; bottom: 24px; right: 24px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 12px 20px; font-size: 13px; font-weight: 600; z-index: 999; transform: translateY(80px); opacity: 0; transition: all .25s; box-shadow: 0 8px 32px rgba(0,0,0,.5); display: flex; align-items: center; gap: 8px; min-width: 200px; }
  .toast.show { transform: translateY(0); opacity: 1; }
  .toast.green { border-color: var(--green); }
  .toast.red   { border-color: var(--red); }
  @media (max-width: 640px) {
    .stats { grid-template-columns: repeat(2,1fr); }
    .main  { padding: 12px; }
    .jobs-table th:nth-child(4), .jobs-table td:nth-child(4) { display: none; }
  }
</style>
</head>
<body>

<div class="header">
  <div class="header-logo">A</div>
  <div>
    <div class="header-title">Abyte ERP Printer Agent</div>
    <div class="header-sub">Local thermal printer bridge — port 3001</div>
  </div>
  <div class="header-right">
    <div style="display:flex;align-items:center;gap:6px;">
      <div class="status-dot"></div>
      <span class="status-label">RUNNING</span>
    </div>
    <span class="version-badge">v${VERSION}</span>
  </div>
</div>

<div class="main">

  <div class="section">
    <div class="stats">
      <div class="stat"><div class="stat-value blue" id="st-printers">-</div><div class="stat-label">Printers</div></div>
      <div class="stat"><div class="stat-value" id="st-total">-</div><div class="stat-label">Total Jobs</div></div>
      <div class="stat"><div class="stat-value green" id="st-success">-</div><div class="stat-label">Success</div></div>
      <div class="stat"><div class="stat-value red" id="st-failed">-</div><div class="stat-label">Failed</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-header">
      <div class="section-title"><span>🌐</span> Server Connection</div>
      <span id="poll-status" style="font-size:12px;color:var(--muted)">Not configured</span>
    </div>
    <div style="padding:16px;display:grid;gap:12px;">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
        <div class="form-group">
          <label class="form-label">Server URL</label>
          <input class="form-input" id="sc-url" placeholder="https://erp.abytesol.com">
          <div class="form-hint">Base URL of your AByte backend</div>
        </div>
        <div class="form-group">
          <label class="form-label">Tenant Code</label>
          <input class="form-input" id="sc-tenant" placeholder="e.g. khayyam">
        </div>
        <div class="form-group">
          <label class="form-label">Agent Token</label>
          <input class="form-input" id="sc-token" placeholder="From Settings → Printers">
        </div>
      </div>
      <div>
        <button class="btn btn-primary" onclick="saveServerConfig()">Save &amp; Connect</button>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-header">
      <div class="section-title"><span>🖨️</span> Configured Printers</div>
      <button class="btn btn-primary" onclick="openAddModal()">+ Add Printer</button>
    </div>
    <div id="printers-container"></div>
  </div>

  <div class="section">
    <div class="section-header">
      <div class="section-title"><span>📋</span> Print Jobs</div>
      <div class="jobs-toolbar">
        <div class="filter-group">
          <button class="filter-btn active" data-filter="all">All</button>
          <button class="filter-btn" data-filter="invoice">Invoice</button>
          <button class="filter-btn" data-filter="kot">KOT</button>
          <button class="filter-btn" data-filter="test">Test</button>
          <button class="filter-btn" data-filter="failed">Failed</button>
        </div>
        <label class="toggle" title="Auto-refresh every 3s">
          <input type="checkbox" id="auto-refresh" checked>
          <div class="toggle-track"><div class="toggle-thumb"></div></div>
          <span class="toggle-label">Auto</span>
        </label>
        <span class="refresh-label" id="refresh-label"></span>
        <button class="btn-danger" onclick="clearJobs()">🗑 Clear</button>
      </div>
    </div>
    <div id="jobs-container"></div>
  </div>

</div>

<!-- Printer Modal -->
<div class="modal-overlay hidden" id="modal">
  <div class="modal">
    <div class="modal-header">
      <div class="modal-title" id="modal-title">Add Printer</div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-body">

      <div class="form-group">
        <label class="form-label">Printer Name *</label>
        <input class="form-input" id="f-name" placeholder="e.g. Counter Receipt, Kitchen Hot Food">
      </div>

      <div class="form-group">
        <label class="form-label">Printer Type *</label>
        <div class="type-grid">
          <div class="type-card sel-invoice" data-type="invoice" id="tc-invoice" onclick="setType('invoice')">
            <div class="type-icon">🧾</div>
            <div class="type-label">Invoice</div>
            <div class="type-desc">Receipts & bills</div>
          </div>
          <div class="type-card" data-type="kot" id="tc-kot" onclick="setType('kot')">
            <div class="type-icon">🍽️</div>
            <div class="type-label">KOT</div>
            <div class="type-desc">Kitchen orders</div>
          </div>
        </div>
      </div>

      <div id="kot-options" style="display:none;gap:12px;flex-direction:column;">
        <label class="check-row">
          <input type="checkbox" id="f-master">
          <div>
            <div class="check-title">Master / XPR Printer</div>
            <div class="check-desc">Gets ALL items from every order (expeditor / main kitchen)</div>
          </div>
        </label>
        <div class="form-group" id="cat-group">
          <label class="form-label">Category IDs <span style="font-weight:400;text-transform:none;opacity:.7">(optional)</span></label>
          <input class="form-input" id="f-categories" placeholder="e.g. 3, 7, 12 (comma separated IDs)">
          <span class="form-hint">Leave empty = catch-all for unmatched items</span>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Connection Type *</label>
        <div class="conn-grid">
          <div class="conn-card sel" id="cc-network" onclick="setConn('network')">
            <div class="conn-icon">🌐</div>
            <div class="conn-label">Network</div>
          </div>
          <div class="conn-card" id="cc-usb" onclick="setConn('usb')">
            <div class="conn-icon">🔌</div>
            <div class="conn-label">USB / COM</div>
          </div>
          <div class="conn-card" id="cc-windows" onclick="setConn('windows')">
            <div class="conn-icon">🖥️</div>
            <div class="conn-label">Windows</div>
          </div>
        </div>
      </div>

      <div id="conn-network" style="display:grid;gap:12px;">
        <div class="form-group">
          <label class="form-label">IP Address *</label>
          <input class="form-input" id="f-ip" placeholder="192.168.1.100">
        </div>
        <div class="form-group">
          <label class="form-label">Port</label>
          <input class="form-input" id="f-port" type="number" value="9100">
          <span class="form-hint">Default: 9100</span>
        </div>
      </div>

      <div id="conn-usb" style="display:none;gap:12px;">
        <div class="form-group">
          <label class="form-label">COM Port *</label>
          <input class="form-input" id="f-com" placeholder="COM3">
          <span class="form-hint">Check Device Manager for COM port number</span>
        </div>
      </div>

      <div id="conn-windows" style="display:none;gap:12px;">
        <div class="form-group">
          <label class="form-label">Windows Printer Name *</label>
          <input class="form-input" id="f-winname" placeholder="EPSON TM-T20III">
          <span class="form-hint">Exact name from Windows → Printers & Scanners</span>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Paper Width</label>
        <select class="form-input" id="f-width">
          <option value="80">80mm (standard — most printers)</option>
          <option value="58">58mm (narrow)</option>
        </select>
      </div>

      <div style="display:grid;gap:8px;">
        <label class="check-row">
          <input type="checkbox" id="f-cut" checked>
          <div>
            <div class="check-title">Auto Cut Paper</div>
            <div class="check-desc">Automatically cut paper after each print</div>
          </div>
        </label>
        <label class="check-row" id="drawer-row">
          <input type="checkbox" id="f-drawer">
          <div>
            <div class="check-title">Open Cash Drawer</div>
            <div class="check-desc">Open cash drawer after printing receipt</div>
          </div>
        </label>
      </div>

    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="save-btn" onclick="savePrinter()">Add Printer</button>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
  let allJobs = [], allPrinters = [], activeFilter = 'all', timer = null, editId = null;
  let selType = 'invoice', selConn = 'network';

  // Toast
  let toastTimer;
  function toast(msg, type='green') {
    const t = document.getElementById('toast');
    t.textContent = (type === 'green' ? '✓  ' : '✗  ') + msg;
    t.className = 'toast show ' + type;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
  }

  // Server Config
  async function loadServerConfig() {
    try {
      const res = await fetch('/server-config');
      const d   = await res.json();
      document.getElementById('sc-url').value    = d.server_url   || '';
      document.getElementById('sc-tenant').value = d.tenant_code  || '';
      document.getElementById('sc-token').value  = d.agent_token  || '';
      const lbl = document.getElementById('poll-status');
      if (d.server_url && d.tenant_code && d.agent_token) {
        lbl.textContent = '✅ Polling ' + d.server_url;
        lbl.style.color = 'var(--green)';
      } else {
        lbl.textContent = '⚠️ Not configured';
        lbl.style.color = 'var(--muted)';
      }
    } catch {}
  }

  async function saveServerConfig() {
    const payload = {
      server_url:  document.getElementById('sc-url').value.trim(),
      tenant_code: document.getElementById('sc-tenant').value.trim(),
      agent_token: document.getElementById('sc-token').value.trim(),
    };
    try {
      await fetch('/server-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      toast('Server config saved! Polling started.');
      loadServerConfig();
    } catch { toast('Save failed', 'red'); }
  }

  loadServerConfig();

  // Fetch
  async function load() {
    try {
      const [hRes, jRes] = await Promise.all([fetch('/health'), fetch('/jobs')]);
      const h = await hRes.json(), j = await jRes.json();
      allPrinters = h.printerList || [];
      allJobs     = j.jobs || [];
      renderStats(h, j.stats);
      renderPrinters();
      renderJobs();
      document.getElementById('refresh-label').textContent = 'Updated ' + new Date().toLocaleTimeString();
    } catch { document.getElementById('refresh-label').textContent = 'Connection error'; }
  }

  function renderStats(h, s) {
    document.getElementById('st-printers').textContent = h.printers ?? '-';
    document.getElementById('st-total').textContent    = s?.total   ?? allJobs.length;
    document.getElementById('st-success').textContent  = s?.success ?? '-';
    document.getElementById('st-failed').textContent   = s?.failed  ?? '-';
  }

  function renderPrinters() {
    const c = document.getElementById('printers-container');
    if (!allPrinters.length) {
      c.innerHTML = \`<div class="no-printers">
        <div class="no-printers-icon">🖨️</div>
        <div style="font-weight:700;font-size:15px;margin-bottom:8px;">No printers added yet</div>
        <div style="font-size:13px;margin-bottom:20px;color:var(--muted);">Add an Invoice printer for receipts, or a KOT printer for kitchen</div>
        <button class="btn btn-primary" onclick="openAddModal()">+ Add First Printer</button>
      </div>\`;
      return;
    }
    c.innerHTML = '<div class="printers-grid">' + allPrinters.map(p => {
      const target = p.connection === 'network' ? p.ip + ':' + (p.port || 9100) :
                     p.connection === 'usb'     ? (p.com || 'COM?') : (p.printer_name || '?');
      return \`<div class="printer-card">
        <div class="printer-card-header">
          <div class="printer-icon \${p.type}">\${p.type === 'kot' ? '🍽️' : '🧾'}</div>
          <div style="flex:1;min-width:0">
            <div class="printer-name">\${esc(p.name)}</div>
            <div class="printer-meta">\${esc(target)}</div>
          </div>
          <div class="printer-actions">
            <button class="act-btn" title="Test print" onclick="testPrinter('\${p.id}','\${esc(p.name)}',this)">▶</button>
            <button class="act-btn" title="Edit" onclick="openEdit('\${p.id}')">✏️</button>
            <button class="act-btn del" title="Delete" onclick="deletePrinter('\${p.id}','\${esc(p.name)}')">🗑</button>
          </div>
        </div>
        <div class="printer-badges">
          <span class="badge \${p.type}">\${p.type.toUpperCase()}</span>
          <span class="badge \${p.connection}">\${p.connection.toUpperCase()}</span>
          \${p.is_master ? '<span class="badge master">MASTER/XPR</span>' : ''}
          \${(p.categories||[]).length ? \`<span class="badge" style="background:rgba(100,116,139,.15);color:#94a3b8;">\${p.categories.length} cats</span>\` : ''}
          \${p.cut_paper !== false ? '<span class="badge cut">AUTO CUT</span>' : ''}
          \${p.open_drawer ? '<span class="badge drawer">DRAWER</span>' : ''}
        </div>
        \${(p.categories||[]).length ? \`<div style="margin-top:8px;font-size:11px;color:var(--muted)">Cat IDs: \${p.categories.join(', ')}</div>\` : ''}
      </div>\`;
    }).join('') + '</div>';
  }

  async function testPrinter(id, name, btn) {
    const orig = btn.textContent; btn.textContent = '…'; btn.disabled = true;
    try {
      const res = await fetch('/printers/' + id + '/test', { method: 'POST' });
      const d = await res.json();
      res.ok ? toast('Test sent to ' + name) : toast(d.error || 'Test failed', 'red');
    } catch { toast('Agent error', 'red'); }
    btn.textContent = orig; btn.disabled = false;
    load();
  }

  async function deletePrinter(id, name) {
    if (!confirm('Delete printer "' + name + '"?')) return;
    await fetch('/printers/' + id, { method: 'DELETE' });
    toast(name + ' deleted');
    load();
  }

  // Modal
  function setType(t) {
    selType = t;
    document.getElementById('tc-invoice').className = 'type-card' + (t === 'invoice' ? ' sel-invoice' : '');
    document.getElementById('tc-kot').className     = 'type-card' + (t === 'kot'     ? ' sel-kot'     : '');
    document.getElementById('kot-options').style.display = t === 'kot' ? 'flex' : 'none';
    document.getElementById('drawer-row').style.display  = t === 'invoice' ? '' : 'none';
  }

  function setConn(c) {
    selConn = c;
    ['network','usb','windows'].forEach(x => {
      document.getElementById('cc-' + x).className     = 'conn-card' + (x === c ? ' sel' : '');
      document.getElementById('conn-' + x).style.display = x === c ? 'grid' : 'none';
    });
  }

  function resetForm() {
    document.getElementById('f-name').value       = '';
    document.getElementById('f-ip').value         = '';
    document.getElementById('f-port').value       = '9100';
    document.getElementById('f-com').value        = '';
    document.getElementById('f-winname').value    = '';
    document.getElementById('f-width').value      = '80';
    document.getElementById('f-cut').checked      = true;
    document.getElementById('f-drawer').checked   = false;
    document.getElementById('f-master').checked   = false;
    document.getElementById('f-categories').value = '';
    setType('invoice'); setConn('network');
  }

  function openAddModal() {
    editId = null;
    document.getElementById('modal-title').textContent = 'Add Printer';
    document.getElementById('save-btn').textContent    = 'Add Printer';
    resetForm();
    document.getElementById('modal').classList.remove('hidden');
  }

  function openEdit(id) {
    const p = allPrinters.find(x => x.id === id); if (!p) return;
    editId = id;
    document.getElementById('modal-title').textContent = 'Edit Printer';
    document.getElementById('save-btn').textContent    = 'Save Changes';
    resetForm();
    document.getElementById('f-name').value       = p.name || '';
    document.getElementById('f-ip').value         = p.ip || '';
    document.getElementById('f-port').value       = p.port || 9100;
    document.getElementById('f-com').value        = p.com || '';
    document.getElementById('f-winname').value    = p.printer_name || '';
    document.getElementById('f-width').value      = p.paper_width || 80;
    document.getElementById('f-cut').checked      = p.cut_paper !== false;
    document.getElementById('f-drawer').checked   = !!p.open_drawer;
    document.getElementById('f-master').checked   = !!p.is_master;
    document.getElementById('f-categories').value = (p.categories || []).join(', ');
    setType(p.type || 'invoice');
    setConn(p.connection || 'network');
    document.getElementById('modal').classList.remove('hidden');
  }

  function closeModal() {
    document.getElementById('modal').classList.add('hidden');
    editId = null;
  }

  async function savePrinter() {
    const name = document.getElementById('f-name').value.trim();
    if (!name)                                                           { toast('Printer name is required', 'red'); return; }
    if (selConn === 'network' && !document.getElementById('f-ip').value.trim())      { toast('IP address is required', 'red'); return; }
    if (selConn === 'usb'     && !document.getElementById('f-com').value.trim())     { toast('COM port is required', 'red'); return; }
    if (selConn === 'windows' && !document.getElementById('f-winname').value.trim()) { toast('Printer name is required', 'red'); return; }

    const catRaw     = document.getElementById('f-categories').value.trim();
    const categories = catRaw ? catRaw.split(',').map(s => s.trim()).filter(Boolean).map(Number).filter(n => !isNaN(n)) : [];

    const payload = {
      name, type: selType, connection: selConn,
      ip:           document.getElementById('f-ip').value.trim()      || null,
      port:         parseInt(document.getElementById('f-port').value)  || 9100,
      com:          document.getElementById('f-com').value.trim()      || null,
      printer_name: document.getElementById('f-winname').value.trim()  || null,
      paper_width:  parseInt(document.getElementById('f-width').value) || 80,
      cut_paper:    document.getElementById('f-cut').checked,
      open_drawer:  document.getElementById('f-drawer').checked,
      is_master:    document.getElementById('f-master').checked,
      categories,
    };

    const btn = document.getElementById('save-btn');
    btn.textContent = 'Saving…'; btn.disabled = true;
    try {
      const res  = await fetch(editId ? '/printers/' + editId : '/printers', {
        method:  editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { toast(data.error || 'Save failed', 'red'); return; }
      toast(editId ? name + ' updated' : name + ' added ✓');
      closeModal(); load();
    } catch { toast('Request failed', 'red'); }
    finally { btn.textContent = editId ? 'Save Changes' : 'Add Printer'; btn.disabled = false; }
  }

  // Jobs
  function renderJobs() {
    const c = document.getElementById('jobs-container');
    const list = activeFilter === 'all'    ? allJobs :
                 activeFilter === 'failed' ? allJobs.filter(j => j.status === 'failed' || j.status === 'partial') :
                 allJobs.filter(j => j.type === activeFilter);

    if (!list.length) {
      c.innerHTML = '<div class="no-jobs"><div style="font-size:40px;margin-bottom:10px;">📭</div>No jobs yet</div>';
      return;
    }

    const rows = list.map(j => {
      const ago   = timeAgo(j.ts);
      const full  = new Date(j.ts).toLocaleString();
      const sc    = j.status === 'success' ? 'success' : j.status === 'partial' ? 'partial' : 'failed';
      const sl    = j.status === 'success' ? '✓ OK' : j.status === 'partial' ? '⚡ Partial' : '✗ Failed';
      const dets  = [j.invoiceNo && 'Inv: '+j.invoiceNo, j.tokenNo && 'Token: '+j.tokenNo, j.items != null && j.items+' items', j.durationMs && j.durationMs+'ms'].filter(Boolean);
      const sub   = j.results && j.results.length > 1
        ? '<div class="sub-results">' + j.results.map(r =>
            \`<div class="sub-row"><div class="dot \${r.success?'ok':'err'}"></div><span style="color:var(--muted)">\${esc(r.printer)}\${r.role?' ('+r.role+')':''}</span>\${r.items!=null?' · '+r.items+' items':''}\${!r.success&&r.error?' — <span style="color:var(--red)">\${esc(r.error)}</span>':''}</div>\`
          ).join('') + '</div>' : '';
      return \`<tr>
        <td><span class="job-type \${j.type}">\${j.type.toUpperCase()}</span></td>
        <td>
          <div class="job-printer">\${esc(j.printer||'—')}</div>
          \${dets.length ? '<div class="job-detail">'+esc(dets.join(' · '))+'</div>' : ''}
          \${j.error ? '<div class="job-error">⚠ '+esc(j.error)+'</div>' : ''}
          \${sub}
        </td>
        <td><span class="status-pill \${sc}">\${sl}</span></td>
        <td><span class="job-time" title="\${full}">\${ago}</span></td>
      </tr>\`;
    }).join('');

    c.innerHTML = \`<table class="jobs-table">
      <thead><tr><th style="width:90px">Type</th><th>Printer / Details</th><th style="width:110px">Status</th><th style="width:110px">Time</th></tr></thead>
      <tbody>\${rows}</tbody>
    </table>\`;
  }

  async function clearJobs() {
    if (!confirm('Clear all job logs?')) return;
    await fetch('/jobs', { method: 'DELETE' });
    toast('Job log cleared');
    load();
  }

  function timeAgo(ts) {
    const s = Math.floor((Date.now() - new Date(ts)) / 1000);
    if (s < 5)    return 'just now';
    if (s < 60)   return s + 's ago';
    if (s < 3600) return Math.floor(s/60) + 'm ago';
    return new Date(ts).toLocaleTimeString();
  }

  function esc(s) {
    return s == null ? '' : String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      renderJobs();
    });
  });

  // Auto refresh
  function startRefresh() { stopRefresh(); timer = setInterval(load, 3000); }
  function stopRefresh()  { if (timer) { clearInterval(timer); timer = null; } }
  document.getElementById('auto-refresh').addEventListener('change', function() {
    this.checked ? startRefresh() : stopRefresh();
  });

  // Close modal on overlay click
  document.getElementById('modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });

  load();
  startRefresh();
</script>
</body>
</html>`;
}

// ── Routes ────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(buildUI());
});

app.get('/health', (req, res) => {
  const printers = getPrinters();
  const stats = {
    total:   jobLog.length,
    success: jobLog.filter(j => j.status === 'success').length,
    failed:  jobLog.filter(j => j.status === 'failed' || j.status === 'partial').length,
  };
  res.json({
    status:      'ok',
    version:     VERSION,
    printers:    printers.length,
    invoice:     printers.filter(p => p.type === 'invoice').length,
    kot:         printers.filter(p => p.type === 'kot').length,
    printerList: printers,
    jobStats:    stats,
    configPath:  CONFIG_FILE,
  });
});

app.get('/jobs', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 200, MAX_JOBS);
  const type  = req.query.type;
  const jobs  = type ? jobLog.filter(j => j.type === type) : jobLog;
  res.json({
    jobs: jobs.slice(0, limit),
    stats: {
      total:   jobLog.length,
      success: jobLog.filter(j => j.status === 'success').length,
      failed:  jobLog.filter(j => j.status === 'failed').length,
      partial: jobLog.filter(j => j.status === 'partial').length,
    },
  });
});

app.delete('/jobs', (req, res) => {
  jobLog = [];
  res.json({ success: true });
});

app.get('/printers', (req, res) => {
  res.json({ data: getPrinters() });
});

app.post('/printers', (req, res) => {
  const { name, type, connection, ip, port, com, printer_name, paper_width, categories, cut_paper, open_drawer, is_master } = req.body;
  if (!name || !type || !connection)
    return res.status(400).json({ error: 'name, type, and connection are required' });
  if (!['invoice','kot'].includes(type))
    return res.status(400).json({ error: 'type must be invoice or kot' });
  if (!['network','usb','windows'].includes(connection))
    return res.status(400).json({ error: 'connection must be network | usb | windows' });

  const printer = {
    id:           crypto.randomUUID(),
    name,
    type,
    connection,
    ip:           ip           || null,
    port:         port         || 9100,
    com:          com          || null,
    printer_name: printer_name || null,
    paper_width:  paper_width  || 80,
    categories:   type === 'kot' ? (Array.isArray(categories) ? categories.map(Number) : []) : [],
    is_master:    type === 'kot' ? Boolean(is_master) : false,
    cut_paper:    cut_paper !== false,
    open_drawer:  Boolean(open_drawer),
  };

  const printers = getPrinters();
  printers.push(printer);
  savePrinters(printers);
  console.log(`[printers] Added: ${name} (${type}, ${connection})`);
  res.status(201).json({ success: true, printer });
});

app.put('/printers/:id', (req, res) => {
  const printers = getPrinters();
  const idx = printers.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Printer not found' });

  const { name, type, connection, ip, port, com, printer_name, paper_width, categories, cut_paper, open_drawer, is_master } = req.body;
  printers[idx] = {
    ...printers[idx],
    name:         name         ?? printers[idx].name,
    type:         type         ?? printers[idx].type,
    connection:   connection   ?? printers[idx].connection,
    ip:           ip           !== undefined ? ip           : printers[idx].ip,
    port:         port         ?? printers[idx].port,
    com:          com          !== undefined ? com          : printers[idx].com,
    printer_name: printer_name !== undefined ? printer_name : printers[idx].printer_name,
    paper_width:  paper_width  ?? printers[idx].paper_width,
    categories:   Array.isArray(categories) ? categories.map(Number) : printers[idx].categories,
    is_master:    is_master    !== undefined ? Boolean(is_master)  : printers[idx].is_master,
    cut_paper:    cut_paper    !== undefined ? Boolean(cut_paper)  : printers[idx].cut_paper,
    open_drawer:  open_drawer  !== undefined ? Boolean(open_drawer): printers[idx].open_drawer,
  };
  savePrinters(printers);
  console.log(`[printers] Updated: ${printers[idx].name}`);
  res.json({ success: true, printer: printers[idx] });
});

app.delete('/printers/:id', (req, res) => {
  const printers = getPrinters();
  const idx = printers.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Printer not found' });
  const [removed] = printers.splice(idx, 1);
  savePrinters(printers);
  console.log(`[printers] Deleted: ${removed.name}`);
  res.json({ success: true });
});

app.post('/printers/:id/test', async (req, res) => {
  const printer = getPrinterById(req.params.id);
  if (!printer) return res.status(404).json({ error: 'Printer not found' });

  const t0 = Date.now();
  try {
    const buf = printer.type === 'kot'
      ? buildKOTESCPOS({ tokenNo: 'TEST-001', date: new Date().toLocaleString(), cashierName: 'System', categoryName: printer.is_master ? 'XPR / All Items' : 'Section Test', items: [{ name: 'Chicken Burger', quantity: 2 }, { name: 'French Fries', quantity: 1 }] }, printer)
      : buildInvoiceESCPOS({ storeName: 'Abyte ERP', storeAddress: 'Test Print', saleId: 1, invoiceNo: 'TEST-001', date: new Date().toLocaleString(), cashierName: 'System', currencySymbol: 'Rs.', items: [{ name: 'Test Item', quantity: 1, price: 100 }], subtotal: 100, totalAmount: 100, amountPaid: 100, changeDue: 0, footer: '** Printer is working! **' }, printer);

    await sendToPrinter(printer, buf);
    const ms = Date.now() - t0;
    addJob({ type: 'test', printer: printer.name, status: 'success', durationMs: ms });
    console.log(`[test] OK: ${printer.name} (${ms}ms)`);
    res.json({ success: true, message: `Test sent to "${printer.name}"` });
  } catch (e) {
    const ms = Date.now() - t0;
    addJob({ type: 'test', printer: printer.name, status: 'failed', error: e.message, durationMs: ms });
    console.error(`[test] FAIL: ${printer.name}:`, e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Server Config API ─────────────────────────────────────────
app.get('/server-config', (req, res) => {
  res.json({
    server_url:   config.server_url   || '',
    tenant_code:  config.tenant_code  || '',
    agent_token:  config.agent_token  || '',
  });
});

app.post('/server-config', (req, res) => {
  const { server_url, tenant_code, agent_token } = req.body;
  config.server_url  = (server_url  || '').trim();
  config.tenant_code = (tenant_code || '').trim();
  config.agent_token = (agent_token || '').trim();
  saveConfig();
  startPolling();
  res.json({ success: true });
});

app.post('/print/invoice', async (req, res) => {
  const { receiptData, printerId } = req.body;
  if (!receiptData) return res.status(400).json({ error: 'receiptData is required' });

  const invoicePrinters = getPrinters().filter(p => p.type === 'invoice');
  if (!invoicePrinters.length) {
    addJob({ type: 'invoice', printer: '(none)', status: 'failed', error: 'No invoice printer configured' });
    return res.status(400).json({ error: 'No invoice printer configured. Add one in the agent UI.' });
  }

  const printer = printerId
    ? (invoicePrinters.find(p => p.id === printerId) || invoicePrinters[0])
    : invoicePrinters[0];

  const t0 = Date.now();
  try {
    const buf = buildInvoiceESCPOS(receiptData, printer);
    await sendToPrinter(printer, buf);
    const ms = Date.now() - t0;
    addJob({ type: 'invoice', printer: printer.name, status: 'success', invoiceNo: receiptData.invoiceNo || null, tokenNo: receiptData.tokenNo || null, items: (receiptData.items||[]).length, durationMs: ms });
    console.log(`[print/invoice] OK — ${printer.name} (${ms}ms)`);
    res.json({ success: true, printer: printer.name });
  } catch (e) {
    const ms = Date.now() - t0;
    addJob({ type: 'invoice', printer: printer.name, status: 'failed', invoiceNo: receiptData.invoiceNo || null, items: (receiptData.items||[]).length, error: e.message, durationMs: ms });
    console.error(`[print/invoice] FAIL — ${printer.name}:`, e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/print/kot', async (req, res) => {
  const { kotData } = req.body;
  if (!kotData) return res.status(400).json({ error: 'kotData is required' });

  const allKOT = getPrinters().filter(p => p.type === 'kot');
  if (!allKOT.length) {
    addJob({ type: 'kot', printer: '(none)', status: 'failed', error: 'No KOT printer configured' });
    return res.status(400).json({ error: 'No KOT printer configured. Add one in the agent UI.' });
  }

  const masterPrinters  = allKOT.filter(p => p.is_master);
  const sectionPrinters = allKOT.filter(p => !p.is_master);
  const items           = kotData.items || [];
  const results         = [];
  const t0              = Date.now();

  // Master printers — get complete order
  for (const printer of masterPrinters) {
    const pt = Date.now();
    try {
      await sendToPrinter(printer, buildKOTESCPOS({ ...kotData, items, categoryName: 'Complete Order' }, printer));
      results.push({ printer: printer.name, role: 'master', items: items.length, success: true, durationMs: Date.now()-pt });
      console.log(`[kot] MASTER OK — ${printer.name}: ${items.length} items`);
    } catch (e) {
      results.push({ printer: printer.name, role: 'master', items: items.length, success: false, error: e.message, durationMs: Date.now()-pt });
      console.error(`[kot] MASTER FAIL — ${printer.name}:`, e.message);
    }
  }

  // Section printers — route by category_id
  if (sectionPrinters.length > 0) {
    const jobMap = new Map();
    for (const item of items) {
      const catId = item.category_id ? Number(item.category_id) : null;
      let matched = null;
      for (const p of sectionPrinters) {
        if (p.categories && p.categories.length > 0 && catId && p.categories.includes(catId)) { matched = p; break; }
      }
      if (!matched) matched = sectionPrinters.find(p => !p.categories || p.categories.length === 0);
      if (!matched) matched = sectionPrinters[0];
      if (!jobMap.has(matched.id)) jobMap.set(matched.id, { printer: matched, items: [] });
      jobMap.get(matched.id).items.push(item);
    }

    for (const { printer, items: si } of jobMap.values()) {
      const pt = Date.now();
      const label = [...new Set(si.map(i => i.category_name).filter(Boolean))].join(' / ') || printer.name;
      try {
        await sendToPrinter(printer, buildKOTESCPOS({ ...kotData, items: si, categoryName: label }, printer));
        results.push({ printer: printer.name, role: 'section', items: si.length, success: true, durationMs: Date.now()-pt });
        console.log(`[kot] SECTION OK — ${printer.name} [${label}]: ${si.length} items`);
      } catch (e) {
        results.push({ printer: printer.name, role: 'section', items: si.length, success: false, error: e.message, durationMs: Date.now()-pt });
        console.error(`[kot] SECTION FAIL — ${printer.name}:`, e.message);
      }
    }
  }

  const allOk  = results.every(r => r.success);
  const anyOk  = results.some(r => r.success);
  const status = allOk ? 'success' : anyOk ? 'partial' : 'failed';
  const ms     = Date.now() - t0;

  addJob({
    type:         'kot',
    printer:      results.length === 1 ? results[0].printer : `${results.length} printers`,
    status,
    tokenNo:      kotData.tokenNo || null,
    tableNo:      kotData.tableNo || null,
    items:        items.length,
    printerCount: results.length,
    results,
    error:        results.find(r => !r.success)?.error || null,
    durationMs:   ms,
  });

  res.status(allOk ? 200 : 207).json({ success: allOk, results });
});

// ── Backend Polling ───────────────────────────────────────────
// Polls the Abyte ERP backend print queue directly so jobs from the
// mobile app are processed even when no browser tab is open.

function backendRequest(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(url); } catch { return reject(new Error('Invalid URL: ' + url)); }
    const lib = parsed.protocol === 'https:' ? https : http;
    const reqOpts = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.pathname + (parsed.search || ''),
      method:   options.method || 'GET',
      headers:  Object.assign({}, options.headers),
      timeout:  10000,
    };
    let bodyStr = null;
    if (body) {
      bodyStr = JSON.stringify(body);
      reqOpts.headers['Content-Type']   = 'application/json';
      reqOpts.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }
    const req = lib.request(reqOpts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('error', reject);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch  { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error',   reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

let _polling = false;
async function pollBackend() {
  if (_polling) return;
  const cfg = config;
  if (!cfg.server_url || !cfg.tenant_code || !cfg.agent_token) return;

  _polling = true;
  try {
    const base    = cfg.server_url.replace(/\/$/, '');
    const headers = { 'X-Tenant-Code': cfg.tenant_code, 'X-Agent-Token': cfg.agent_token };
    const res     = await backendRequest(base + '/api/agent/print-queue/pending', { headers });
    if (res.status !== 200 || !Array.isArray(res.data.jobs)) return;

    for (const job of res.data.jobs) {
      let status = 'failed', errMsg = null;
      try {
        const endpoint  = job.type === 'kot' ? '/print/kot' : '/print/invoice';
        const body      = job.type === 'kot'
          ? { kotData:     job.payload.kotData }
          : { receiptData: job.payload.receiptData };
        const pr = await backendRequest(`http://localhost:${PORT}${endpoint}`, { method: 'POST' }, body);
        if (pr.status === 200 || pr.status === 207) status = 'done';
        else errMsg = (pr.data && pr.data.error) || `Agent error ${pr.status}`;
      } catch (e) { errMsg = e.message; }

      try {
        await backendRequest(
          base + `/api/agent/print-queue/${job.id}`,
          { method: 'PATCH', headers },
          { status, error_message: errMsg }
        );
      } catch {}
    }
  } catch { /* network unavailable — skip silently */ }
  finally { _polling = false; }
}

// ── Polling lifecycle ─────────────────────────────────────────
let _pollTimer = null;
function startPolling() {
  if (_pollTimer) return;
  if (!config.server_url || !config.tenant_code || !config.agent_token) return;
  _pollTimer = setInterval(pollBackend, 3000);
  console.log(`[poll] Started — ${config.server_url}`);
}

// ── Start ─────────────────────────────────────────────────────
const server = app.listen(PORT, '0.0.0.0', () => {
  const printers = getPrinters();
  console.log(`\n========================================`);
  console.log(`  Abyte ERP Printer Agent v${VERSION}`);
  console.log(`========================================`);
  console.log(`  URL     : http://localhost:${PORT}`);
  console.log(`  Config  : ${CONFIG_FILE}`);
  console.log(`  Mode    : ${isPkg ? 'EXE' : 'Node.js'}`);
  console.log(`  Printers: ${printers.length} configured`);
  printers.forEach(p => {
    const t = p.connection === 'network' ? `${p.ip}:${p.port||9100}` : p.connection === 'usb' ? p.com : p.printer_name || '?';
    console.log(`    [${p.type.toUpperCase()}] ${p.name} → ${t}`);
  });
  console.log(`========================================\n`);
  startPolling();
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[ERROR] Port ${PORT} already in use!`);
    console.error(`  Stop existing agent: taskkill /F /IM node.exe`);
    console.error(`  Or: taskkill /F /IM ABytePrinterAgent.exe\n`);
  } else {
    console.error('[ERROR]', err.message);
  }
  process.exit(1);
});

function shutdown() {
  console.log('\n[agent] Shutting down…');
  if (_pollTimer) clearInterval(_pollTimer);
  server.close(() => process.exit(0));
}
process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);
