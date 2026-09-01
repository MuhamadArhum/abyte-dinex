// Abyte ERP Printer Agent bridge
// Jobs go via the print queue — cashier browser picks them up and forwards to localhost:3001

import api from '../utils/api';

export interface AgentHealth {
  status: string;
  version: string;
  printers: number;
  invoice: number;
  kot: number;
}

export interface InvoiceData {
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  logoEscPosData?: string;   // base64 encoded ESC/POS raster bitmap
  saleId?: number | string;
  invoiceNo?: string;
  tokenNo?: string;
  tableNo?: string;
  date?: string;
  cashierName?: string;
  customerName?: string;
  currencySymbol?: string;
  items: { name: string; quantity: number | string; price: number; note?: string }[];
  subtotal?: number;
  discount?: number;
  taxAmount?: number;
  taxPercent?: number;
  chargesAmount?: number;
  totalAmount: number;
  amountPaid?: number;
  changeDue?: number;
  paymentMethod?: string;
  footer?: string;
}

// Converts a logo image URL to an ESC/POS raster bitmap (base64 encoded).
// Uses the browser Canvas API — no extra dependencies needed.
export async function rasterizeLogoForEscPos(
  logoUrl: string,
  paperWidth: 58 | 80 = 80
): Promise<string | null> {
  try {
    const targetWidth = paperWidth === 58 ? 256 : 384;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload  = () => resolve();
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = logoUrl;
    });

    const ratio        = img.naturalHeight / img.naturalWidth;
    const targetHeight = Math.round(targetWidth * ratio);

    const canvas = document.createElement('canvas');
    canvas.width  = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const { data, width, height } = ctx.getImageData(0, 0, targetWidth, targetHeight);

    const widthBytes = Math.ceil(width / 8);
    const bmp        = new Uint8Array(widthBytes * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i    = (y * width + x) * 4;
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        if (gray < 128) {
          bmp[y * widthBytes + Math.floor(x / 8)] |= (1 << (7 - (x % 8)));
        }
      }
    }

    // GS v 0 — ESC/POS raster image command
    const header = new Uint8Array([
      0x1D, 0x76, 0x30, 0x00,
      widthBytes & 0xFF, (widthBytes >> 8) & 0xFF,
      height     & 0xFF, (height     >> 8) & 0xFF,
    ]);
    const combined = new Uint8Array(header.length + bmp.length);
    combined.set(header);
    combined.set(bmp, header.length);

    return btoa(String.fromCharCode(...combined));
  } catch {
    return null;
  }
}

export interface KOTItem {
  name: string;
  quantity: number | string;
  category_id?: number;
  category_name?: string;
  note?: string;
}

export interface KOTData {
  tokenNo?: string;
  tableNo?: string;
  date?: string;
  cashierName?: string;
  items: KOTItem[];
}

export interface PrintResult {
  success: boolean;
  error?: string;
  printer?: string;
}

// Always returns true for health so callers don't need to change
export async function checkAgentHealth(): Promise<AgentHealth | null> {
  return { status: 'ok', version: '3.0.0', printers: 1, invoice: 1, kot: 1 };
}

export async function printInvoice(receiptData: InvoiceData): Promise<PrintResult> {
  try {
    await api.post('/settings/print-queue', { type: 'invoice', receiptData });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.response?.data?.message || e.message };
  }
}

export async function printKOT(kotData: KOTData): Promise<PrintResult> {
  try {
    await api.post('/settings/print-queue', { type: 'kot', kotData });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.response?.data?.message || e.message };
  }
}
