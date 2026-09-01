import api from '../utils/api';
import type { ReceiptData } from './ReceiptView';

interface ReceiptSale {
  sale_id: number;
  total_amount: number | string;
  discount: number | string;
  tax_percent: number | string;
  tax_amount: number | string;
  additional_charges_percent: number | string;
  additional_charges_amount: number | string;
  payment_method: string;
  amount_paid: number | string;
  sale_date?: string;
  note?: string;
  token_no?: string;
  invoice_no?: string;
  order_type?: string;
  table_name?: string;
  cashier_name?: string;
  items: Array<{
    product_name: string;
    quantity: number;
    unit_price: number | string;
    discount?: number | string;
    subtotal?: number | string;
    variant_name?: string;
  }>;
}

interface ReceiptSettings {
  store_name?: string;
  address?: string;
  phone?: string;
  email?: string;
  receipt_footer?: string;
  currency_symbol?: string;
}

function parseNumber(value: number | string): number {
  if (typeof value === 'number') return value;
  const parsed = parseFloat(String(value).replace(/[^\d.-]/g, ''));
  return isNaN(parsed) ? 0 : parsed;
}

// ── Send to thermal printer via print queue ───────────────────

export async function printToThermalPrinter(
  sale: ReceiptSale,
  settings: ReceiptSettings | null,
  cashierName: string,
  customerName?: string
): Promise<boolean> {
  const totalAmount   = parseNumber(sale.total_amount);
  const discount      = parseNumber(sale.discount);
  const taxAmount     = parseNumber(sale.tax_amount);
  const taxPercent    = parseNumber(sale.tax_percent);
  const chargesAmount = parseNumber(sale.additional_charges_amount);
  const amountPaid    = parseNumber(sale.amount_paid);

  const receiptData = {
    storeName:      settings?.store_name || 'AByte ERP',
    storeAddress:   settings?.address || '',
    storePhone:     settings?.phone || '',
    saleId:         sale.sale_id,
    invoiceNo:      sale.invoice_no,
    tokenNo:        sale.token_no,
    date:           sale.sale_date ? new Date(sale.sale_date).toLocaleString() : new Date().toLocaleString(),
    cashierName,
    customerName:   customerName || '',
    currencySymbol: settings?.currency_symbol || 'Rs.',
    items: (sale.items || []).map(item => ({
      name:     item.product_name,
      quantity: item.quantity,
      price:    parseNumber(item.unit_price),
    })),
    subtotal:      totalAmount - taxAmount - chargesAmount + discount,
    discount,
    taxAmount,
    taxPercent,
    chargesAmount,
    totalAmount,
    amountPaid,
    changeDue:     Math.max(0, amountPaid - totalAmount),
    paymentMethod: sale.payment_method,
    footer:        settings?.receipt_footer || 'Thank you for shopping!',
  };

  try {
    await api.post('/settings/print-queue', { type: 'invoice', receiptData });
    return true;
  } catch {
    return false;
  }
}

// ── Print Cash / Card bill (recalculates tax at given rate) ───

export async function printBillWithTax(
  sale: ReceiptSale,
  settings: ReceiptSettings | null,
  cashierName: string,
  customerName: string | undefined,
  taxType: 'cash' | 'card' | 'online',
  taxRate: number
): Promise<void> {
  const parseNum = (v: any) => parseFloat(String(v).replace(/[^\d.-]/g, '')) || 0;

  const origTaxAmount     = parseNum(sale.tax_amount);
  const origChargesAmount = parseNum(sale.additional_charges_amount);
  const origDiscount      = parseNum(sale.discount);
  const origTotal         = parseNum(sale.total_amount);
  const subtotal          = origTotal - origTaxAmount - origChargesAmount + origDiscount;

  const newTaxAmount = subtotal * taxRate / 100;
  const newTotal     = subtotal + newTaxAmount + origChargesAmount - origDiscount;
  const billLabel    = taxType === 'cash' ? 'CASH BILL' : taxType === 'card' ? 'CARD BILL' : 'ONLINE BILL';

  const receiptData = {
    storeName:      settings?.store_name || 'AByte ERP',
    storeAddress:   settings?.address || '',
    storePhone:     settings?.phone || '',
    saleId:         sale.sale_id,
    invoiceNo:      sale.invoice_no,
    tokenNo:        sale.token_no,
    date:           sale.sale_date ? new Date(sale.sale_date).toLocaleString() : new Date().toLocaleString(),
    cashierName,
    customerName:   customerName || '',
    currencySymbol: settings?.currency_symbol || 'Rs.',
    items: (sale.items || []).map((item: any) => ({
      name:     item.product_name,
      quantity: item.quantity,
      price:    parseNum(item.unit_price),
    })),
    subtotal,
    discount:      origDiscount,
    taxAmount:     newTaxAmount,
    taxPercent:    taxRate,
    chargesAmount: origChargesAmount,
    totalAmount:   newTotal,
    amountPaid:    newTotal,
    changeDue:     0,
    paymentMethod: taxType,
    status:        'PAID',
    footer:        `★ ${billLabel} ★\n${settings?.receipt_footer || 'Thank you for shopping!'}`,
  };

  await api.post('/settings/print-queue', { type: 'invoice', receiptData });
}

// ── Browser HTML print — fallback if DOM ref unavailable ─────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtAmt(n: number | undefined, cs: string): string {
  if (n == null) return '';
  return `${esc(cs)} ${Number(n).toFixed(2)}`;
}

export function printReceiptAsBrowser(data: ReceiptData): void {
  const cs = data.currencySymbol || 'Rs.';

  const DOC_LABELS: Record<string, string> = {
    sale: 'SALES RECEIPT', quotation: 'QUOTATION', credit_sale: 'CREDIT SALE',
    return: 'RETURN RECEIPT', delivery: 'DELIVERY ORDER',
  };
  const docLabel = DOC_LABELS[data.docType] || 'RECEIPT';

  const metaRow = (label: string, value: string, bold = false) =>
    `<div class="meta-row">
      <span class="meta-label">${esc(label)}:</span>
      <span class="${bold ? 'meta-val-bold' : 'meta-val'}">${esc(value)}</span>
    </div>`;

  const totalRow = (label: string, value: number | undefined, color = '') => {
    if (value == null || value === 0) return '';
    return `<div class="total-row ${color}">
      <span>${esc(label)}</span>
      <span>${fmtAmt(value, cs)}</span>
    </div>`;
  };

  const metaRows = [
    data.docNumber    ? metaRow(data.docType === 'quotation' ? 'Quote #' : data.docType === 'return' ? 'Return #' : 'Invoice', data.docNumber) : '',
    data.status       ? metaRow('Status',   data.status.toUpperCase()) : '',
    data.tokenNo      ? metaRow('Token',    data.tokenNo, true) : '',
    data.date         ? metaRow('Date',     data.date) : '',
    data.cashierName  ? metaRow('Cashier',  data.cashierName) : '',
    data.customerName ? metaRow('Customer', data.customerName) : '',
    data.tableNo      ? metaRow('Table',    data.tableNo) : '',
    data.orderType    ? metaRow('Type',     data.orderType) : '',
    data.riderName    ? metaRow('Rider',    data.riderName) : '',
    data.dueDate      ? metaRow('Due Date', data.dueDate) : '',
    data.reason       ? metaRow('Reason',   data.reason) : '',
  ].join('');

  const itemRows = data.items.map(item => `
    <tr>
      <td class="item-name">${esc(String(item.name))}${item.note ? `<br><span class="item-note">* ${esc(item.note)}</span>` : ''}</td>
      <td class="item-qty">${esc(String(item.quantity))}</td>
      <td class="item-price">${item.price != null ? fmtAmt(item.price, cs) : '—'}</td>
    </tr>`).join('');

  const changeDue = (data.changeDue ?? 0) > 0
    ? `<div class="total-row">Change Due: ${fmtAmt(data.changeDue, cs)}</div>` : '';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${esc(docLabel)} - ${esc(data.docNumber || '')}</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; color: #000; background: #fff; }
    .center { text-align: center; }
    .store-name { font-size: 15px; font-weight: 900; letter-spacing: 1px; }
    .store-sub  { font-size: 10px; color: #6B7280; margin-top: 1px; }
    .divider    { border-top: 1px dashed #D1D5DB; margin: 5px 0; }
    .divider2   { border-top: 2px solid #000; margin: 4px 0; }
    .badge      { display: inline-block; border-radius: 20px; padding: 1px 10px; font-size: 10px; font-weight: 900; letter-spacing: 2px; margin: 4px 0; }
    .meta-row   { display: flex; justify-content: space-between; padding: 1px 0; font-size: 11px; }
    .meta-label { color: #9CA3AF; }
    .meta-val   { color: #374151; }
    .meta-val-bold { font-weight: 900; font-size: 13px; color: #111827; }
    table       { width: 100%; border-collapse: collapse; margin: 4px 0; }
    th          { font-size: 10px; font-weight: 700; border-bottom: 1px dashed #D1D5DB; padding: 2px 0; text-align: left; color: #6B7280; }
    th.r, td.item-qty, td.item-price { text-align: right; }
    td.item-qty { text-align: center; width: 28px; }
    td.item-price { width: 70px; }
    td          { font-size: 11px; padding: 2px 0; border-bottom: 1px dotted #E5E7EB; vertical-align: top; color: #1F2937; }
    .item-note  { font-size: 9px; color: #9CA3AF; font-style: italic; }
    .total-row  { display: flex; justify-content: space-between; font-size: 12px; padding: 2px 0; color: #4B5563; }
    .total-grand { font-size: 15px; font-weight: 900; color: #111827; padding: 3px 0; }
    .total-paid  { border-top: 1px dashed #D1D5DB; padding-top: 3px; margin-top: 2px; }
    .total-red   { color: #DC2626; font-weight: 700; }
    .total-green { color: #059669; font-weight: 700; }
    .footer     { text-align: center; font-size: 10px; color: #6B7280; margin-top: 6px; white-space: pre-line; }
    ${data.logoUrl ? '.logo { text-align: center; margin-bottom: 4px; } .logo img { max-height: 18mm; max-width: 50mm; object-fit: contain; }' : ''}
    @media print { body { margin: 0; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  ${data.logoUrl ? `<div class="logo"><img src="${esc(data.logoUrl)}" alt="logo" onerror="this.style.display='none'"/></div>` : ''}

  <div class="center">
    <div class="store-name">${esc(data.storeName.toUpperCase())}</div>
    ${data.storeAddress ? `<div class="store-sub">${esc(data.storeAddress)}</div>` : ''}
    ${data.storePhone   ? `<div class="store-sub">Tel: ${esc(data.storePhone)}</div>` : ''}
  </div>

  <div class="divider"></div>
  <div class="center"><span class="badge">${esc(docLabel)}</span></div>

  <div style="margin: 4px 0;">${metaRows}</div>

  <div class="divider"></div>
  <table>
    <thead><tr>
      <th>Item</th>
      <th style="text-align:center;width:28px;">Qty</th>
      <th class="r" style="width:70px;">Price</th>
    </tr></thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div class="divider"></div>

  <div style="margin: 4px 0;">
    ${totalRow('Subtotal', data.subtotal)}
    ${data.discount ? totalRow('Discount', -(data.discount!)) : ''}
    ${data.taxAmount ? totalRow(`Tax (${data.taxPercent ?? 0}%)`, data.taxAmount) : ''}
    ${data.chargesAmount ? totalRow('Service Charges', data.chargesAmount) : ''}
    <div class="divider2"></div>
    <div class="total-row total-grand"><span>TOTAL</span><span>${fmtAmt(data.totalAmount, cs)}</span></div>
    <div class="divider2"></div>
    ${data.paymentMethod ? `<div class="total-paid">
      <div class="total-row">
        <span>Paid (${esc(data.paymentMethod.toUpperCase())})</span>
        <span>${fmtAmt(data.amountPaid, cs)}</span>
      </div>
      ${changeDue}
    </div>` : ''}
    ${data.balanceDue != null ? `<div class="total-row total-red"><span>Balance Due</span><span>${fmtAmt(data.balanceDue, cs)}</span></div>` : ''}
    ${data.refundAmount != null ? `<div class="total-row total-green"><span>Refund (${esc(data.refundMethod || 'Cash')})</span><span>${fmtAmt(data.refundAmount, cs)}</span></div>` : ''}
  </div>

  ${data.footer ? `<div class="divider"></div><div class="footer">${esc(data.footer)}</div>` : ''}

  <script>window.onload = function(){ window.print(); };</script>
</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:0;height:0;border:none;';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument!;
  doc.open(); doc.write(html); doc.close();
  iframe.contentWindow!.focus();
  setTimeout(() => {
    iframe.contentWindow!.print();
    setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 8000);
  }, 300);
}
