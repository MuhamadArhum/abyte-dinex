import { useState, useEffect, useRef } from 'react';
import { X, Printer, Loader2 } from 'lucide-react';
import { printInvoice, rasterizeLogoForEscPos } from './agentPrinter';
import { printReceiptAsBrowser } from './receiptPrinter';
import type { ReceiptData } from './ReceiptView';

// ── Helpers ───────────────────────────────────────────────────

function fmt(n?: number, cs = 'Rs.') {
  if (n == null) return '';
  return `${cs} ${Number(n).toFixed(2)}`;
}

function Divider() {
  return <div className="border-t border-dashed border-gray-300 my-1.5" />;
}

function MetaRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-gray-400">{label}:</span>
      <span className={`text-gray-700 ${bold ? 'font-bold text-sm' : ''}`}>{value}</span>
    </div>
  );
}

function TotalRow({
  label, value, bold, color, cs,
}: {
  label: string; value?: number; bold?: boolean; color?: string; cs: string;
}) {
  if (value == null || value === 0) return null;
  return (
    <div className={`flex justify-between text-sm py-0.5 ${bold ? 'font-bold' : ''} ${color || ''}`}>
      <span className="text-gray-600">{label}</span>
      <span className={bold ? 'text-gray-900' : 'text-gray-800'}>{fmt(value, cs)}</span>
    </div>
  );
}

// ── Doc type labels ───────────────────────────────────────────

const DOC_LABELS: Record<string, string> = {
  sale:        'SALES RECEIPT',
  quotation:   'QUOTATION',
  credit_sale: 'CREDIT SALE',
  return:      'RETURN RECEIPT',
  delivery:    'DELIVERY ORDER',
};

const DOC_COLORS: Record<string, string> = {
  sale:        'bg-emerald-100 text-emerald-700',
  quotation:   'bg-blue-100 text-blue-700',
  credit_sale: 'bg-amber-100 text-amber-700',
  return:      'bg-red-100 text-red-700',
  delivery:    'bg-purple-100 text-purple-700',
};

// ── InvoiceView ───────────────────────────────────────────────

export function InvoiceView({ data }: { data: ReceiptData }) {
  const cs    = data.currencySymbol || 'Rs.';
  const label = DOC_LABELS[data.docType] || 'RECEIPT';
  const badge = DOC_COLORS[data.docType] || 'bg-gray-100 text-gray-700';

  return (
    <div className="bg-white font-mono text-sm select-text" style={{ minWidth: 280, maxWidth: 380 }}>

      {/* Logo */}
      {data.logoUrl && (
        <div className="flex justify-center mb-3">
          <img src={data.logoUrl} alt="Logo" className="max-h-20 max-w-[160px] object-contain" />
        </div>
      )}

      {/* Store Header */}
      <div className="text-center mb-3">
        <p className="text-base font-extrabold text-gray-900 tracking-wide">
          {data.storeName.toUpperCase()}
        </p>
        {data.storeAddress && (
          <p className="text-xs text-gray-500 mt-0.5">{data.storeAddress}</p>
        )}
        {data.storePhone && (
          <p className="text-xs text-gray-500">Tel: {data.storePhone}</p>
        )}
      </div>

      <Divider />

      {/* Doc type badge */}
      <div className="flex justify-center my-2">
        <span className={`px-3 py-0.5 rounded-full text-xs font-extrabold tracking-widest ${badge}`}>
          {label}
        </span>
      </div>

      {/* Meta info */}
      <div className="space-y-0.5 mb-2">
        {data.docNumber && (
          <MetaRow
            label={
              data.docType === 'quotation' ? 'Quote #'
              : data.docType === 'return'  ? 'Return #'
              : 'Invoice'
            }
            value={data.docNumber}
          />
        )}

        {data.status      && <MetaRow label="Status"   value={data.status.toUpperCase()} />}
        {data.tokenNo     && <MetaRow label="Token"    value={data.tokenNo}    bold />}
        {data.date        && <MetaRow label="Date"     value={data.date} />}
        {data.cashierName && <MetaRow label="Cashier"  value={data.cashierName} />}
        {data.customerName && <MetaRow label="Customer" value={data.customerName} />}
        {data.tableNo     && <MetaRow label="Table"    value={data.tableNo} />}
        {data.orderType   && <MetaRow label="Type"     value={data.orderType} />}
        {data.riderName   && <MetaRow label="Rider"    value={data.riderName} />}
        {data.dueDate     && <MetaRow label="Due Date" value={data.dueDate} />}
        {data.reason      && <MetaRow label="Reason"   value={data.reason} />}
      </div>

      <Divider />

      {/* Items table */}
      <div className="my-2 space-y-1">
        <div className="flex text-xs font-bold text-gray-500 pb-1 border-b border-dashed border-gray-300">
          <span className="flex-1">Item</span>
          <span className="w-8 text-center">Qty</span>
          <span className="w-20 text-right">Price</span>
        </div>

        {data.items.map((item, i) => (
          <div key={i}>
            <div className="flex items-start text-xs">
              <span className="flex-1 text-gray-800 leading-tight">{item.name}</span>
              <span className="w-8 text-center text-gray-700">{item.quantity}</span>
              <span className="w-20 text-right text-gray-800">
                {item.price != null ? fmt(item.price, cs) : '—'}
              </span>
            </div>
            {item.note && (
              <p className="text-xs text-gray-400 pl-2 leading-tight">* {item.note}</p>
            )}
          </div>
        ))}
      </div>

      <Divider />

      {/* Totals */}
      <div className="my-2 space-y-0.5">
        {data.subtotal != null && (
          <TotalRow label="Subtotal" value={data.subtotal} cs={cs} />
        )}
        {!!data.discount && (
          <TotalRow label="Discount" value={-data.discount} cs={cs} />
        )}
        {!!data.taxAmount && (
          <TotalRow label={`GST (${data.taxPercent ?? 0}%)`} value={data.taxAmount} cs={cs} />
        )}
        {!!data.chargesAmount && (
          <TotalRow label="Service Charges" value={data.chargesAmount} cs={cs} />
        )}
        
        
        <div className="border-t-2 border-gray-800 mt-1 pt-1">
          <div className="flex justify-between font-extrabold text-base">
            <span>TOTAL</span>
            <span>{fmt(data.totalAmount, cs)}</span>
          </div>
        </div>

        {/* Payment */}
        {data.paymentMethod && (
          <div className="mt-1 space-y-0.5 border-t border-dashed border-gray-300 pt-1">
            <TotalRow label={`Paid (${data.paymentMethod.toUpperCase()})`} value={data.amountPaid} cs={cs} />
            {(data.changeDue ?? 0) > 0 && (
              <TotalRow label="Change Due" value={data.changeDue} cs={cs} />
            )}
          </div>
        )}

        {/* Credit sale balance */}
        {data.balanceDue != null && (
          <div className="mt-1 border-t border-dashed border-gray-300 pt-1">
            <div className="flex justify-between text-sm font-bold text-red-600">
              <span>Balance Due</span>
              <span>{fmt(data.balanceDue, cs)}</span>
            </div>
          </div>
        )}

        {/* Return refund */}
        {data.refundAmount != null && (
          <div className="mt-1 border-t border-dashed border-gray-300 pt-1">
            <div className="flex justify-between text-sm font-bold text-emerald-600">
              <span>Refund ({data.refundMethod || 'Cash'})</span>
              <span>{fmt(data.refundAmount, cs)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      {data.footer && (
        <>
          <Divider />
          <p className="text-center text-xs text-gray-500 mt-2 leading-relaxed">{data.footer}</p>
        </>
      )}
    </div>
  );
}

// ── InvoiceModal ──────────────────────────────────────────────

interface InvoiceModalProps {
  data: ReceiptData;
  onClose: () => void;
}

export function InvoiceModal({ data, onClose }: InvoiceModalProps) {
  const [printing, setPrinting] = useState(false);
  const [msg, setMsg]           = useState('');
  const invoiceRef              = useRef<HTMLDivElement>(null);

  const handlePrintRef = useRef<() => void>(() => {});
  useEffect(() => { handlePrintRef.current = () => { if (!printing) handlePrint(); }; });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        handlePrintRef.current();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const printFromDOM = () => {
    if (!invoiceRef.current) { printReceiptAsBrowser(data); return; }
    const content = invoiceRef.current.outerHTML;
    const styleLinks   = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(el => el.outerHTML).join('\n');
    const inlineStyles = Array.from(document.querySelectorAll('style')).map(el => `<style>${(el as HTMLStyleElement).textContent}</style>`).join('\n');
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">${styleLinks}${inlineStyles}<style>@page{size:80mm auto;margin:4mm;}body{margin:0;padding:4px;background:white;}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}</style></head><body>${content}<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},150);});</script></body></html>`;
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:0;height:0;border:none;';
    document.body.appendChild(iframe);
    iframe.contentDocument!.open();
    iframe.contentDocument!.write(html);
    iframe.contentDocument!.close();
    setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 15000);
  };

  const handlePrint = async () => {
    setPrinting(true);
    setMsg('');
    try {
      // Print the actual rendered InvoiceView DOM — view and print are identical
      printFromDOM();

      // Also send to thermal printer queue (if agent is running on cashier PC)
      const paperWidth = data.paperWidth ?? 80;
      const logoEscPosData = data.logoUrl
        ? await rasterizeLogoForEscPos(data.logoUrl, paperWidth).catch(() => null) ?? undefined
        : undefined;

      printInvoice({
        storeName:      data.storeName,
        storeAddress:   data.storeAddress,
        storePhone:     data.storePhone,
        logoEscPosData,
        saleId:         data.docNumber,
        invoiceNo:      data.docNumber,
        tokenNo:        data.tokenNo,
        tableNo:        data.tableNo,
        date:           data.date,
        cashierName:    data.cashierName,
        customerName:   data.customerName,
        currencySymbol: data.currencySymbol,
        items:          data.items.map(i => ({
          name:     i.name,
          quantity: i.quantity,
          price:    i.price ?? 0,
          note:     i.note,
        })),
        subtotal:       data.subtotal,
        discount:       data.discount,
        taxAmount:      data.taxAmount,
        taxPercent:     data.taxPercent,
        chargesAmount:  data.chargesAmount,
        totalAmount:    data.totalAmount,
        amountPaid:     data.amountPaid,
        changeDue:      data.changeDue,
        paymentMethod:  data.paymentMethod,
        footer:         data.footer,
      }).catch(() => {/* thermal silently fails if agent not running */});

      setMsg('✓ Printing...');
    } catch (e: any) {
      setMsg(`✗ ${e.message}`);
    } finally {
      setPrinting(false);
    }
  };

  const label = DOC_LABELS[data.docType] || 'RECEIPT';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col"
           style={{ width: '100%', maxWidth: 420, maxHeight: '92vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="text-sm font-bold text-gray-800">{label}</span>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
            <X size={18} />
          </button>
        </div>

        {/* Invoice scroll area */}
        <div className="flex-1 overflow-y-auto p-5">
          <div ref={invoiceRef}>
            <InvoiceView data={data} />
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-4 py-3 border-t border-gray-100 space-y-2">
          {msg && (
            <p className={`text-xs text-center font-medium ${msg.startsWith('✓') ? 'text-emerald-600' : 'text-red-500'}`}>
              {msg}
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
              Close
            </button>
            <button onClick={handlePrint} disabled={printing}
              className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-emerald-700 disabled:opacity-60 transition">
              {printing ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}
              {printing ? 'Printing...' : 'Print Bill'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
