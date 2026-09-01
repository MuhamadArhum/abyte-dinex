// =============================================================
// qzPrinter.ts — QZ Tray bridge for network thermal printing
//
// QZ Tray is a local agent installed on the cashier's PC.
// It runs on wss://localhost:8181 and bridges the browser
// to local/network printers — the only way to print directly
// to a thermal printer from a cloud-deployed web app.
//
// Download: https://qz.io/download/
// =============================================================

let qz: any = null;

async function loadQZ(): Promise<boolean> {
  if (qz) return true;
  try {
    const mod = await import('qz-tray');
    qz = mod.default ?? mod;
    return true;
  } catch {
    return false;
  }
}

/** Returns true if QZ Tray is installed and running on this machine */
export async function isQZAvailable(): Promise<boolean> {
  const loaded = await loadQZ();
  if (!loaded) return false;
  try {
    if (!qz.websocket.isActive()) {
      await qz.websocket.connect({ retries: 1, delay: 0.5 });
    }
    return qz.websocket.isActive();
  } catch {
    return false;
  }
}

/** Disconnect QZ Tray websocket cleanly */
export async function disconnectQZ(): Promise<void> {
  if (qz && qz.websocket.isActive()) {
    await qz.websocket.disconnect().catch(() => {});
  }
}

/**
 * Print raw ESC/POS receipt to a network printer via QZ Tray.
 * @param printerIp   - IP address of the thermal printer (e.g. "192.168.1.100")
 * @param printerPort - Port of the printer (default 9100)
 * @param receiptData - Object with receipt fields to print
 */
export async function printViaQZ(
  printerIp: string,
  printerPort: number = 9100,
  receiptData: QZReceiptData
): Promise<void> {
  if (!qz || !qz.websocket.isActive()) {
    throw new Error('QZ Tray not connected');
  }

  const escpos = buildESCPOS(receiptData);

  // Network printer config (bypasses OS print dialog completely)
  const config = qz.configs.create(null, {
    host: printerIp,
    port: printerPort,
    protocol: 'socket',
  });

  await qz.print(config, [
    { type: 'raw', format: 'base64', data: bufToBase64(escpos) },
  ]);
}

/**
 * Print to a Windows shared/USB printer by name via QZ Tray.
 * @param printerName - Exact printer name as shown in Windows (e.g. "XPrinter XP-80")
 */
export async function printViaQZByName(
  printerName: string,
  receiptData: QZReceiptData
): Promise<void> {
  if (!qz || !qz.websocket.isActive()) {
    throw new Error('QZ Tray not connected');
  }

  const escpos = buildESCPOS(receiptData);
  const config = qz.configs.create(printerName);

  await qz.print(config, [
    { type: 'raw', format: 'base64', data: bufToBase64(escpos) },
  ]);
}

/** List printers available through QZ Tray */
export async function listQZPrinters(): Promise<string[]> {
  if (!qz || !qz.websocket.isActive()) return [];
  try {
    return await qz.printers.find();
  } catch {
    return [];
  }
}

// ── Types ─────────────────────────────────────────────────────

export interface QZReceiptData {
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  saleId: number;
  invoiceNo?: string;
  tokenNo?: string;
  date: string;
  cashierName: string;
  customerName?: string;
  currencySymbol: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  subtotal: number;
  discount: number;
  taxAmount: number;
  taxPercent: number;
  chargesAmount: number;
  totalAmount: number;
  amountPaid: number;
  changeDue: number;
  paymentMethod: string;
  footer: string;
}

// ── ESC/POS Builder ───────────────────────────────────────────

function buildESCPOS(d: QZReceiptData): Uint8Array {
  const lines: string[] = [];
  const w = 32; // 80mm paper = 32 chars at 12cpi

  const center = (s: string) => s.padStart(Math.floor((w + s.length) / 2)).padEnd(w);
  const left   = (s: string) => s.padEnd(w);
  const split  = (l: string, r: string) => l + r.padStart(w - l.length);
  const dashes = '-'.repeat(w);

  // Header
  lines.push(center(d.storeName.toUpperCase()));
  if (d.storeAddress) lines.push(center(d.storeAddress));
  if (d.storePhone)   lines.push(center('Tel: ' + d.storePhone));
  lines.push(dashes);

  // Meta
  if (d.invoiceNo) lines.push(split('Invoice:', d.invoiceNo));
  else             lines.push(split('Receipt #:', String(d.saleId)));
  if (d.tokenNo)   lines.push(split('Token:', d.tokenNo));
  lines.push(split('Date:', d.date));
  lines.push(split('Cashier:', d.cashierName));
  if (d.customerName) lines.push(split('Customer:', d.customerName));
  lines.push(dashes);

  // Items
  lines.push(left('Item                Qty   Price'));
  lines.push(dashes);
  for (const item of d.items) {
    const name  = item.name.substring(0, 20).padEnd(20);
    const qty   = String(item.quantity).padStart(3);
    const price = (d.currencySymbol + item.price.toFixed(0)).padStart(8);
    lines.push(`${name}${qty}  ${price}`);
  }
  lines.push(dashes);

  // Totals
  const cs = d.currencySymbol;
  if (d.discount > 0)     lines.push(split('Discount:', `-${cs}${d.discount.toFixed(0)}`));
  if (d.taxAmount > 0)    lines.push(split(`Tax (${d.taxPercent}%):`, `${cs}${d.taxAmount.toFixed(0)}`));
  if (d.chargesAmount > 0) lines.push(split('Charges:', `${cs}${d.chargesAmount.toFixed(0)}`));
  lines.push('='.repeat(w));
  lines.push(split('TOTAL:', `${cs}${d.totalAmount.toFixed(0)}`));
  lines.push('='.repeat(w));
  lines.push(split(`Paid (${d.paymentMethod}):`, `${cs}${d.amountPaid.toFixed(0)}`));
  if (d.changeDue > 0) lines.push(split('Change Due:', `${cs}${d.changeDue.toFixed(0)}`));
  lines.push(dashes);

  // Footer
  lines.push(center(d.footer));
  lines.push('');
  lines.push('');
  lines.push('');

  // Encode to bytes
  const text = lines.join('\n');
  const encoder = new TextEncoder();
  const textBytes = encoder.encode(text);

  // ESC/POS commands
  const ESC_INIT   = [0x1B, 0x40];         // Initialize
  const CUT        = [0x1D, 0x56, 0x41, 0x05]; // Partial cut

  const buf = new Uint8Array(ESC_INIT.length + textBytes.length + CUT.length);
  buf.set(ESC_INIT, 0);
  buf.set(textBytes, ESC_INIT.length);
  buf.set(CUT, ESC_INIT.length + textBytes.length);
  return buf;
}

function bufToBase64(buf: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buf.length; i++) {
    binary += String.fromCharCode(buf[i]);
  }
  return btoa(binary);
}
