import { Banknote, CreditCard, Smartphone, X } from 'lucide-react';
import { KOTView, KOTModal }         from './KOTView';
import { InvoiceView, InvoiceModal } from './InvoiceView';

// ── Types ──────────────────────────────────────────────────────
// These are the shared types used across the whole receipt system.

export type DocType = 'sale' | 'quotation' | 'credit_sale' | 'return' | 'delivery' | 'kot';

export interface ReceiptItem {
  name: string;
  quantity: number | string;
  price?: number;
  note?: string;
  category?: string;
}

export interface ReceiptData {
  docType: DocType;
  docNumber?: string;
  tokenNo?: string;
  date?: string;

  // Store
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  logoUrl?: string;
  currencySymbol?: string;
  footer?: string;

  // People
  cashierName?: string;
  customerName?: string;
  tableNo?: string;
  orderType?: string;
  riderName?: string;

  // Items
  items: ReceiptItem[];

  // Amounts
  subtotal?: number;
  discount?: number;
  taxAmount?: number;
  taxPercent?: number;
  chargesAmount?: number;
  totalAmount: number;

  // Payment
  amountPaid?: number;
  changeDue?: number;
  paymentMethod?: string;

  // Credit sale
  balanceDue?: number;
  dueDate?: string;
  status?: string;

  // Return
  refundAmount?: number;
  refundMethod?: string;
  reason?: string;

  // Paper width for ESC/POS
  paperWidth?: 58 | 80;
}

// ── ReceiptView ───────────────────────────────────────────────
// Delegates to KOTView or InvoiceView based on docType.

export function ReceiptView({ data }: { data: ReceiptData }) {
  if (data.docType === 'kot') {
    return (
      <KOTView
        data={{
          storeName:   data.storeName,
          tokenNo:     data.tokenNo,
          tableNo:     data.tableNo,
          orderType:   data.orderType,
          cashierName: data.cashierName,
          date:        data.date,
          items:       data.items.map(i => ({
            name:     i.name,
            quantity: i.quantity,
            category: i.category,
            note:     i.note,
          })),
        }}
      />
    );
  }

  return <InvoiceView data={data} />;
}

// ── ReceiptModal ──────────────────────────────────────────────
// Delegates to KOTModal or InvoiceModal based on docType.

interface ReceiptModalProps {
  data: ReceiptData;
  onClose: () => void;
}

export function ReceiptModal({ data, onClose }: ReceiptModalProps) {
  if (data.docType === 'kot') {
    return (
      <KOTModal
        onClose={onClose}
        data={{
          storeName:   data.storeName,
          tokenNo:     data.tokenNo,
          tableNo:     data.tableNo,
          orderType:   data.orderType,
          cashierName: data.cashierName,
          date:        data.date,
          items:       data.items.map(i => ({
            name:     i.name,
            quantity: i.quantity,
            category: i.category,
            note:     i.note,
          })),
        }}
      />
    );
  }

  return <InvoiceModal data={data} onClose={onClose} />;
}

// ── PaymentSelectModal ────────────────────────────────────────

const PAY_METHODS = [
  { value: 'cash'   as const, label: 'Cash',   desc: 'Physical cash',   Icon: Banknote,   color: 'emerald' },
  { value: 'card'   as const, label: 'Card',   desc: 'Debit / Credit',  Icon: CreditCard, color: 'blue'    },
  { value: 'online' as const, label: 'Online', desc: 'Online transfer', Icon: Smartphone, color: 'purple'  },
];

const PAY_COLOR: Record<string, { card: string; text: string; icon: string }> = {
  emerald: { card: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-400', text: 'text-emerald-700', icon: 'text-emerald-600' },
  blue:    { card: 'bg-blue-50 border-blue-200 hover:bg-blue-100 hover:border-blue-400',             text: 'text-blue-700',    icon: 'text-blue-600'    },
  purple:  { card: 'bg-purple-50 border-purple-200 hover:bg-purple-100 hover:border-purple-400',     text: 'text-purple-700',  icon: 'text-purple-600'  },
};

interface PaymentSelectModalProps {
  onSelect: (method: 'cash' | 'card' | 'online') => void;
  onClose: () => void;
}

export function PaymentSelectModal({ onSelect, onClose }: PaymentSelectModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-sm font-bold text-gray-800">Select Payment Type</p>
            <p className="text-xs text-gray-500 mt-0.5">How will the customer pay?</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
            <X size={18} />
          </button>
        </div>

        {/* Payment cards */}
        <div className="p-5 grid grid-cols-3 gap-3">
          {PAY_METHODS.map(({ value, label, desc, Icon, color }) => {
            const c = PAY_COLOR[color];
            return (
              <button
                key={value}
                onClick={() => onSelect(value)}
                className={`flex flex-col items-center gap-2.5 p-4 rounded-xl border-2 transition-all ${c.card}`}
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${c.card.split(' ')[0]}`}>
                  <Icon size={22} className={c.icon} />
                </div>
                <span className={`font-bold text-sm ${c.text}`}>{label}</span>
                <span className="text-xs text-gray-400 text-center leading-tight">{desc}</span>
              </button>
            );
          })}
        </div>

        <p className="text-center text-xs text-gray-400 pb-4">
          This will appear on the printed receipt
        </p>
      </div>
    </div>
  );
}
