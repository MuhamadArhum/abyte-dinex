// Converts raw API data of any bill type into a unified ReceiptData object

import type { ReceiptData } from './ReceiptView';

interface StoreSettings {
  store_name?: string;
  address?: string;
  phone?: string;
  receipt_logo?: string;
  receipt_footer?: string;
  currency_symbol?: string;
  receipt_paper_width?: string;
}

function paperWidth(settings?: StoreSettings): 58 | 80 {
  return settings?.receipt_paper_width === '58mm' ? 58 : 80;
}

function logoUrl(settings?: StoreSettings): string | undefined {
  if (!settings?.receipt_logo) return undefined;
  return `${window.location.origin}${settings.receipt_logo}`;
}

function storeBase(settings?: StoreSettings) {
  return {
    storeName:      settings?.store_name      || 'AByte ERP',
    storeAddress:   settings?.address         || undefined,
    storePhone:     settings?.phone           || undefined,
    logoUrl:        logoUrl(settings),
    footer:         settings?.receipt_footer  || 'Thank you!',
    currencySymbol: settings?.currency_symbol || 'Rs.',
    paperWidth:     paperWidth(settings),
  };
}

function parseNum(v: any): number {
  return typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.-]/g, '')) || 0;
}

const ORDER_TYPE_LABELS: Record<string, string> = {
  dine_in:   'Dine-In',
  takeaway:  'Takeaway',
  delivery:  'Delivery',
  walk_in:   'Walk-In',
};

// ── POS Sale / Walk-in Sale ───────────────────────────────────

export function buildSaleReceipt(sale: any, settings?: StoreSettings, cashierName?: string, customerName?: string): ReceiptData {
  const total    = parseNum(sale.total_amount);
  const tax      = parseNum(sale.tax_amount);
  const charges  = parseNum(sale.additional_charges_amount);
  const discount = parseNum(sale.discount);
  const paid     = parseNum(sale.amount_paid);

  return {
    ...storeBase(settings),
    docType:       'sale',
    docNumber:     sale.invoice_no || String(sale.sale_id || ''),
    tokenNo:       sale.token_no   || undefined,
    date:          sale.sale_date  ? new Date(sale.sale_date).toLocaleString() : new Date().toLocaleString(),
    cashierName:   cashierName || sale.cashier_name || undefined,
    customerName:  customerName || sale.customer_name || undefined,
    tableNo:       sale.table_name || undefined,
    orderType:     sale.order_type ? (ORDER_TYPE_LABELS[sale.order_type] || sale.order_type) : undefined,
    items: (sale.items || []).map((item: any) => ({
      name:     item.product_name || item.name,
      quantity: item.quantity,
      price:    parseNum(item.unit_price ?? item.price),
      note:     item.note || undefined,
    })),
    subtotal:      total - tax - charges + discount,
    discount:      discount || undefined,
    taxAmount:     tax     || undefined,
    taxPercent:    parseNum(sale.tax_percent) || undefined,
    chargesAmount: charges || undefined,
    totalAmount:   total,
    amountPaid:    paid    || undefined,
    changeDue:     paid > total ? paid - total : undefined,
    paymentMethod: sale.payment_method || undefined,
    status: sale.status === 'completed' ? 'PAID'
          : sale.status === 'refunded'  ? 'REFUNDED'
          : sale.status === 'pending'   ? 'UNPAID'
          : sale.status?.toUpperCase()  || undefined,
  };
}

// ── Quotation ─────────────────────────────────────────────────

export function buildQuotationReceipt(quotation: any, settings?: StoreSettings): ReceiptData {
  return {
    ...storeBase(settings),
    docType:      'quotation',
    docNumber:    quotation.quotation_number || String(quotation.quotation_id),
    date:         quotation.created_at ? new Date(quotation.created_at).toLocaleString() : new Date().toLocaleString(),
    cashierName:  quotation.created_by_name || undefined,
    customerName: quotation.customer_name   || undefined,
    status:       quotation.valid_until ? `Valid until: ${new Date(quotation.valid_until).toLocaleDateString()}` : undefined,
    items: (quotation.items || []).map((i: any) => ({
      name:     i.product_name,
      quantity: i.quantity,
      price:    parseNum(i.unit_price),
    })),
    subtotal:     parseNum(quotation.subtotal)   || undefined,
    discount:     parseNum(quotation.discount)   || undefined,
    taxAmount:    parseNum(quotation.tax_amount) || undefined,
    totalAmount:  parseNum(quotation.total_amount),
    footer:       quotation.notes || settings?.receipt_footer || 'Thank you!',
  };
}

// ── Credit Sale ───────────────────────────────────────────────

export function buildCreditSaleReceipt(cs: any, settings?: StoreSettings): ReceiptData {
  return {
    ...storeBase(settings),
    docType:      'credit_sale',
    docNumber:    cs.invoice_no || String(cs.sale_id || cs.credit_sale_id),
    date:         cs.sale_date || cs.created_at ? new Date(cs.sale_date || cs.created_at).toLocaleString() : new Date().toLocaleString(),
    customerName: cs.customer_name  || undefined,
    cashierName:  cs.cashier_name   || undefined,
    status:       cs.status?.toUpperCase() || undefined,
    dueDate:      cs.due_date ? new Date(cs.due_date).toLocaleDateString() : undefined,
    items: (cs.items || []).map((i: any) => ({
      name:     i.product_name || i.name,
      quantity: i.quantity,
      price:    parseNum(i.unit_price ?? i.price),
    })),
    subtotal:     parseNum(cs.subtotal)    || undefined,
    totalAmount:  parseNum(cs.total_amount),
    amountPaid:   parseNum(cs.paid_amount) || undefined,
    balanceDue:   parseNum(cs.balance_due) || undefined,
    paymentMethod: cs.payment_method || undefined,
  };
}

// ── Return Receipt ────────────────────────────────────────────

export function buildReturnReceipt(ret: any, settings?: StoreSettings): ReceiptData {
  return {
    ...storeBase(settings),
    docType:      'return',
    docNumber:    ret.return_number || String(ret.return_id || ret.sale_id || ''),
    date:         ret.created_at ? new Date(ret.created_at).toLocaleString() : new Date().toLocaleString(),
    customerName: ret.customer_name || undefined,
    cashierName:  ret.cashier_name  || undefined,
    reason:       ret.reason        || undefined,
    items: (ret.items || []).map((i: any) => ({
      name:     i.product_name || i.name,
      quantity: i.quantity,
      price:    parseNum(i.unit_price ?? i.price),
    })),
    totalAmount:  parseNum(ret.refund_amount || ret.total_amount || 0),
    refundAmount: parseNum(ret.refund_amount) || undefined,
    refundMethod: ret.refund_method || undefined,
  };
}

// ── Delivery Order ────────────────────────────────────────────

export function buildDeliveryReceipt(delivery: any, settings?: StoreSettings): ReceiptData {
  return {
    ...storeBase(settings),
    docType:      'delivery',
    docNumber:    delivery.delivery_number || String(delivery.delivery_id),
    date:         delivery.created_at ? new Date(delivery.created_at).toLocaleString() : new Date().toLocaleString(),
    customerName: delivery.customer_name   || undefined,
    cashierName:  delivery.created_by_name || undefined,
    tableNo:      delivery.delivery_address || undefined,
    riderName:    delivery.rider_name       || undefined,
    status:       delivery.status?.toUpperCase() || undefined,
    items: (delivery.items || []).map((i: any) => ({
      name:     i.product_name || i.name,
      quantity: i.quantity,
      price:    parseNum(i.unit_price ?? i.price),
    })),
    chargesAmount: parseNum(delivery.delivery_charges) || undefined,
    totalAmount:   parseNum(delivery.total_amount || delivery.delivery_charges || 0),
  };
}

// ── KOT ──────────────────────────────────────────────────────

export function buildKOTReceipt(
  items: { name: string; quantity: number | string; category_name?: string; note?: string }[],
  opts: { tokenNo?: string; tableNo?: string; orderType?: string; cashierName?: string; date?: string; settings?: StoreSettings }
): ReceiptData {
  return {
    ...storeBase(opts.settings),
    docType:     'kot',
    tokenNo:     opts.tokenNo,
    tableNo:     opts.tableNo,
    orderType:   opts.orderType ? (ORDER_TYPE_LABELS[opts.orderType] || opts.orderType) : undefined,
    cashierName: opts.cashierName,
    date:        opts.date || new Date().toLocaleString(),
    items: items.map(i => ({
      name:     i.name,
      quantity: i.quantity,
      category: i.category_name || 'General',
      note:     i.note,
    })),
    totalAmount: 0,
  };
}
