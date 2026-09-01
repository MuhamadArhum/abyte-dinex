// Print utility — generates HTML and opens browser print dialog
import api from './api';

const getStoreSettings = async (): Promise<{ store_name?: string; address?: string; phone?: string; email?: string }> => {
  try {
    const res = await api.get('/settings');
    return res.data || {};
  } catch {
    return {};
  }
};

const styles = `
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 20px; }
    .doc-header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 16px; }
    .company-name { font-size: 22px; font-weight: bold; letter-spacing: 1px; }
    .doc-title { font-size: 15px; font-weight: bold; margin-top: 4px; text-transform: uppercase; letter-spacing: 2px; color: #333; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 30px; margin-bottom: 16px; font-size: 12px; }
    .meta-grid span { color: #555; }
    .meta-grid strong { color: #111; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }
    thead th { background: #f3f4f6; border: 1px solid #ccc; padding: 7px 10px; text-align: left; font-weight: bold; text-transform: uppercase; font-size: 11px; }
    tbody td { border: 1px solid #ddd; padding: 6px 10px; }
    tbody tr:nth-child(even) { background: #fafafa; }
    .text-right { text-align: right; }
    .total-row td { font-weight: bold; background: #f3f4f6; border-top: 2px solid #999; font-size: 13px; }
    .notes { font-size: 11px; color: #555; margin-bottom: 20px; }
    .sig-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 30px; margin-top: 40px; }
    .sig-box { text-align: center; }
    .sig-line { border-top: 1px solid #555; margin-bottom: 5px; padding-top: 4px; font-size: 11px; color: #444; }
    @media print { @page { margin: 15mm; } }
  </style>
`;

const openPrintWindow = (bodyHtml: string, title: string) => {
  const w = window.open('', '_blank', 'width=820,height=650');
  if (!w) { alert('Allow popups to print.'); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>${styles}</head><body>${bodyHtml}</body></html>`);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 400);
};

// Opens window synchronously (required for popup blocker), then populates async
const openPrintWindowAsync = async (buildHtml: (settings: Awaited<ReturnType<typeof getStoreSettings>>) => string, title: string) => {
  const w = window.open('', '_blank', 'width=820,height=650');
  if (!w) { alert('Allow popups to print.'); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>${styles}</head><body><p style="padding:30px;font-family:Arial">Loading...</p></body></html>`);
  const settings = await getStoreSettings();
  const bodyHtml = buildHtml(settings);
  w.document.open();
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>${styles}</head><body>${bodyHtml}</body></html>`);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 400);
};

const getCompanyName = () => {
  try { return localStorage.getItem('company_name') || 'AByte Manufacturing'; } catch { return 'AByte Manufacturing'; }
};

const fmt3 = (n: any) => Number(n || 0).toFixed(3);
const fmt2 = (n: any) => Number(n || 0).toFixed(0);

// ─── GRN (Goods Received Note) ────────────────────────────────
export const printGRN = (voucher: any) => {
  const title = `GRN - ${voucher.pv_number}`;

  openPrintWindowAsync((settings) => {
    const companyName = settings.store_name || getCompanyName();
    const address     = settings.address || '';
    const phone       = settings.phone   || '';

    // Date + time: use created_at if available, else voucher_date + current time
    const printDateTime = (() => {
      const d = voucher.created_at ? new Date(voucher.created_at) : new Date();
      const date = d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
      const time = d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true });
      return `${date} ${time}`;
    })();

    // Supplier: prefer supplier_name from PO link, fallback to payable account name
    const supplierDisplay = voucher.supplier_name
      || voucher.payable_account_name
      || '—';

    const totalQty = (voucher.items || []).reduce((s: number, i: any) => s + Number(i.quantity_received || 0), 0);

    const rows = (voucher.items || []).map((item: any) => `
      <tr>
        <td>${item.product_name}</td>
        <td class="text-right">${fmt3(item.quantity_received)}</td>
        <td class="text-right">${fmt2(item.unit_price)}</td>
        <td class="text-right">${fmt2(Number(item.quantity_received) * Number(item.unit_price))}</td>
      </tr>`).join('');

    const shipping        = Number(voucher.shipping_cost)    || 0;
    const extra           = Number(voucher.extra_charges)    || 0;
    const other           = Number(voucher.other_charges)    || 0;
    const discount_pct    = Number(voucher.discount_percent) || 0;
    const discount_amount = Number(voucher.discount_amount)  || 0;
    const tax_pct         = Number(voucher.tax_percent)      || 0;
    const tax_amount      = Number(voucher.tax_amount)       || 0;

    const chargeRows = [
      shipping > 0        ? `<tr><td colspan="3" class="text-right" style="color:#555">Shipping Cost</td><td class="text-right">${fmt2(shipping)}</td></tr>` : '',
      extra    > 0        ? `<tr><td colspan="3" class="text-right" style="color:#555">Extra Charges</td><td class="text-right">${fmt2(extra)}</td></tr>` : '',
      other    > 0        ? `<tr><td colspan="3" class="text-right" style="color:#555">Other Charges</td><td class="text-right">${fmt2(other)}</td></tr>` : '',
      discount_amount > 0 ? `<tr><td colspan="3" class="text-right" style="color:#c00">Discount (${fmt2(discount_pct)}%)</td><td class="text-right" style="color:#c00">- ${fmt2(discount_amount)}</td></tr>` : '',
      tax_amount      > 0 ? `<tr><td colspan="3" class="text-right" style="color:#555">Tax (${fmt2(tax_pct)}%)</td><td class="text-right">${fmt2(tax_amount)}</td></tr>` : '',
    ].join('');

    return `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #111; padding-bottom:12px; margin-bottom:16px;">
        <div>
          <div style="font-size:22px;font-weight:bold;letter-spacing:1px;">${companyName}</div>
          ${address ? `<div style="font-size:12px;color:#444;margin-top:4px;">${address}</div>` : ''}
          ${phone   ? `<div style="font-size:12px;color:#444;">Tel: ${phone}</div>` : ''}
        </div>
        <div style="text-align:left;">
          <div style="font-size:15px;font-weight:bold;text-transform:uppercase;letter-spacing:2px;color:#333;margin-bottom:8px;">Goods Received Note</div>
          <table style="margin-left:auto;font-size:12px;border:none;margin-bottom:0;">
            <tbody>
              <tr><td style="color:#555;padding:2px 8px 2px 0;border:none;text-align:left;">GRN # :</td><td style="font-weight:bold;border:none;padding:2px 0;">${voucher.pv_number}</td></tr>
              <tr><td style="color:#555;padding:2px 8px 2px 0;border:none;text-align:left;">Date &amp; Time :</td><td style="font-weight:bold;border:none;padding:2px 0;">${printDateTime}</td></tr>
              <tr><td style="color:#555;padding:2px 8px 2px 0;border:none;text-align:left;">Supplier :</td><td style="font-weight:bold;border:none;padding:2px 0;">${supplierDisplay}</td></tr>
              <tr><td style="color:#555;padding:2px 8px 2px 0;border:none;text-align:left;">PO Reference :</td><td style="font-weight:bold;border:none;padding:2px 0;">${voucher.po_number || '—'}</td></tr>
              <tr><td style="color:#555;padding:2px 8px 2px 0;border:none;text-align:left;">Created By :</td><td style="font-weight:bold;border:none;padding:2px 0;">${voucher.created_by_name || '—'}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <table>
        <thead><tr>
          <th>Product</th>
          <th class="text-right">Qty Received</th>
          <th class="text-right">Unit Price</th>
          <th class="text-right">Amount</th>
        </tr></thead>
        <tbody>
          ${rows}
          <tr style="background:#f0f9ff;font-weight:bold;border-top:2px solid #bbb;">
            <td>Total</td>
            <td class="text-right">${fmt3(totalQty)}</td>
            <td></td>
            <td></td>
          </tr>
          ${chargeRows}
          <tr class="total-row">
            <td colspan="3" class="text-right">Grand Total</td>
            <td class="text-right">${fmt2(voucher.total_amount)}</td>
          </tr>
        </tbody>
      </table>
      ${voucher.notes ? `<p class="notes">Notes: ${voucher.notes}</p>` : ''}

      <br><br><br>
      <div class="sig-row">
        <div class="sig-box"><div class="sig-line">Received By</div></div>
        <div class="sig-box"><div class="sig-line">Store Keeper</div></div>
        <div class="sig-box"><div class="sig-line">Authorized By</div></div>
      </div>`;
  }, title);
};

// ─── Stock Issue Challan ──────────────────────────────────────
export const printChallan = (issue: any) => {
  const rows = (issue.items || []).map((item: any) => `
    <tr>
      <td>${item.product_name}</td>
      <td class="text-right">${fmt3(item.quantity)}</td>
      <td class="text-right">${fmt2(item.unit_cost)}</td>
      <td class="text-right">${fmt2(Number(item.quantity) * Number(item.unit_cost))}</td>
    </tr>`).join('');

  const html = `
    <div class="doc-header">
      <div class="company-name">${getCompanyName()}</div>
      <div class="doc-title">Stock Issue Challan</div>
    </div>
    <div class="meta-grid">
      <div><span>Challan # : </span><strong>${issue.issue_number}</strong></div>
      <div><span>Date : </span><strong>${issue.issue_date}</strong></div>
      <div><span>Section : </span><strong>${issue.section_name}</strong></div>
      <div><span>Issued By : </span><strong>${issue.created_by_name || ''}</strong></div>
    </div>
    <table>
      <thead><tr>
        <th>Product</th>
        <th class="text-right">Quantity</th>
        <th class="text-right">Unit Cost</th>
        <th class="text-right">Total Cost</th>
      </tr></thead>
      <tbody>
        ${rows}
        <tr class="total-row">
          <td colspan="3" class="text-right">Total Cost</td>
          <td class="text-right">${fmt2(issue.total_cost || (issue.items || []).reduce((s: number, i: any) => s + Number(i.quantity) * Number(i.unit_cost), 0))}</td>
        </tr>
      </tbody>
    </table>
    ${issue.notes ? `<p class="notes">Notes: ${issue.notes}</p>` : ''}
    <div class="sig-row">
      <div class="sig-box"><div class="sig-line">Issued By</div></div>
      <div class="sig-box"><div class="sig-line">Received By (Section)</div></div>
      <div class="sig-box"><div class="sig-line">Store Keeper</div></div>
    </div>`;
  openPrintWindow(html, `Challan - ${issue.issue_number}`);
};

// ─── Raw Sale Invoice ─────────────────────────────────────────
export const printRawSaleInvoice = (sale: any) => {
  const rows = (sale.items || []).map((item: any) => `
    <tr>
      <td>${item.product_name}</td>
      <td class="text-right">${fmt3(item.quantity)}</td>
      <td class="text-right">${fmt2(item.unit_price)}</td>
      <td class="text-right">${fmt2(Number(item.quantity) * Number(item.unit_price))}</td>
    </tr>`).join('');

  const html = `
    <div class="doc-header">
      <div class="company-name">${getCompanyName()}</div>
      <div class="doc-title">Raw Material Sale Invoice</div>
    </div>
    <div class="meta-grid">
      <div><span>Invoice # : </span><strong>${sale.sale_number}</strong></div>
      <div><span>Date : </span><strong>${sale.sale_date}</strong></div>
      <div><span>Customer : </span><strong>${sale.customer_name || '—'}</strong></div>
      <div><span>Section : </span><strong>${sale.section_name}</strong></div>
    </div>
    <table>
      <thead><tr>
        <th>Product</th>
        <th class="text-right">Quantity</th>
        <th class="text-right">Unit Price</th>
        <th class="text-right">Amount</th>
      </tr></thead>
      <tbody>
        ${rows}
        <tr class="total-row">
          <td colspan="3" class="text-right">Grand Total</td>
          <td class="text-right">${fmt2(sale.total_amount)}</td>
        </tr>
      </tbody>
    </table>
    ${sale.notes ? `<p class="notes">Notes: ${sale.notes}</p>` : ''}
    <div class="sig-row">
      <div class="sig-box"><div class="sig-line">Prepared By</div></div>
      <div class="sig-box"><div class="sig-line">Customer Signature</div></div>
      <div class="sig-box"><div class="sig-line">Authorized By</div></div>
    </div>`;
  openPrintWindow(html, `Invoice - ${sale.sale_number}`);
};












