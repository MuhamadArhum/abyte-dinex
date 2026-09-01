import { useState, useEffect, useRef } from 'react';
import { X, Printer, Loader2 } from 'lucide-react';
import { printKOT } from './agentPrinter';

// ── Types ──────────────────────────────────────────────────────

export interface KOTItem {
  name: string;
  quantity: number | string;
  category?: string;
  note?: string;
}

export interface KOTData {
  tokenNo?: string;
  tableNo?: string;
  orderType?: string;
  cashierName?: string;
  date?: string;
  storeName?: string;
  items: KOTItem[];
}

// ── Helpers ───────────────────────────────────────────────────

function groupByCategory(items: KOTItem[]): Record<string, KOTItem[]> {
  const groups: Record<string, KOTItem[]> = {};
  for (const item of items) {
    const cat = item.category || 'General';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  }
  return groups;
}

function Divider() {
  return <div className="border-t-2 border-dashed border-gray-800 my-2" />;
}

// ── KOTView ───────────────────────────────────────────────────

export function KOTView({ data }: { data: KOTData }) {
  const groups = groupByCategory(data.items);

  return (
    <div className="bg-white font-mono text-sm select-text" style={{ minWidth: 280, maxWidth: 380 }}>

      {/* Store Name */}
      {data.storeName && (
        <div className="text-center mb-2">
          <p className="text-sm font-bold text-gray-700 tracking-wide">
            {data.storeName.toUpperCase()}
          </p>
        </div>
      )}

      {/* KOT Header Badge */}
      <div className="bg-gray-900 text-white text-center py-2 mb-3 rounded">
        <p className="text-xl font-black tracking-widest">KOT</p>
        <p className="text-xs text-gray-400 tracking-wider">KITCHEN ORDER TICKET</p>
      </div>

      {/* Token — very large, most important info for kitchen */}
      {data.tokenNo && (
        <div className="text-center mb-3 bg-gray-50 border-2 border-gray-800 rounded py-2 px-4">
          <p className="text-xs text-gray-500 tracking-widest uppercase mb-0.5">Token</p>
          <p className="text-4xl font-black text-gray-900 tracking-wider">{data.tokenNo}</p>
        </div>
      )}

      {/* Order info */}
      <div className="space-y-1 text-xs mb-3">
        {data.orderType && (
          <div className="flex justify-between items-center">
            <span className="text-gray-500 font-semibold uppercase tracking-wide">Type</span>
            <span className="font-extrabold text-base text-gray-900 uppercase tracking-wide">
              {data.orderType}
            </span>
          </div>
        )}
        {data.tableNo && (
          <div className="flex justify-between items-center">
            <span className="text-gray-500 font-semibold uppercase tracking-wide">Table</span>
            <span className="font-bold text-gray-800">{data.tableNo}</span>
          </div>
        )}
        {data.cashierName && (
          <div className="flex justify-between">
            <span className="text-gray-500">Cashier</span>
            <span className="text-gray-700">{data.cashierName}</span>
          </div>
        )}
        {data.date && (
          <div className="flex justify-between">
            <span className="text-gray-500">Time</span>
            <span className="text-gray-700">{data.date}</span>
          </div>
        )}
      </div>

      <Divider />

      {/* Items grouped by category */}
      <div className="my-2 space-y-3">
        {Object.entries(groups).map(([cat, catItems]) => (
          <div key={cat}>
            {/* Category header */}
            <div className="bg-gray-800 text-white px-2 py-1 rounded mb-1">
              <p className="text-xs font-bold uppercase tracking-widest">{cat}</p>
            </div>

            {catItems.map((item, i) => (
              <div key={i} className="flex items-start py-1 border-b border-dashed border-gray-200 last:border-0">
                {/* Qty — big and bold */}
                <span className="text-2xl font-black text-gray-900 w-12 shrink-0 leading-tight">
                  {item.quantity}x
                </span>
                <div className="flex-1 pl-1">
                  <p className="text-base font-bold text-gray-800 leading-tight">{item.name}</p>
                  {item.note && (
                    <p className="text-xs text-gray-500 mt-0.5 italic">* {item.note}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <Divider />

      <p className="text-center text-xs text-gray-400 mt-1">
        {data.items.length} item{data.items.length !== 1 ? 's' : ''}
      </p>
    </div>
  );
}

// ── KOTModal ──────────────────────────────────────────────────

interface KOTModalProps {
  data: KOTData;
  onClose: () => void;
}

export function KOTModal({ data, onClose }: KOTModalProps) {
  const [printing, setPrinting] = useState(false);
  const [msg, setMsg]           = useState('');

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

  const handlePrint = async () => {
    setPrinting(true);
    setMsg('');
    try {
      const result = await printKOT({
        tokenNo:     data.tokenNo,
        tableNo:     data.tableNo,
        date:        data.date,
        cashierName: data.cashierName,
        items: data.items.map(i => ({
          name:          i.name,
          quantity:      i.quantity,
          category_name: i.category,
          note:          i.note,
        })),
      });
      setMsg(result.success ? '✓ Sent to printer' : `✗ ${result.error}`);
    } catch (e: any) {
      setMsg(`✗ ${e.message}`);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col"
           style={{ width: '100%', maxWidth: 420, maxHeight: '92vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="text-sm font-bold text-gray-800">Kitchen Order Ticket</span>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
            <X size={18} />
          </button>
        </div>

        {/* KOT scroll area */}
        <div className="flex-1 overflow-y-auto p-5">
          <KOTView data={data} />
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
              className="flex-1 py-2 rounded-xl bg-orange-500 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-orange-600 disabled:opacity-60 transition">
              {printing ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}
              {printing ? 'Printing...' : 'Print KOT'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
