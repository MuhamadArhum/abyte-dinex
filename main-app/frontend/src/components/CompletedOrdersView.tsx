/**
 * CompletedOrdersView — shared component used in:
 *  - Orders.tsx        (page content, no close button)
 *  - WalkInOrders.tsx  (Done Orders history tab)
 *  - POS.tsx           (full-screen overlay, Done Orders button)
 */
import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import {
  Search, Package, Calendar, User, DollarSign, CreditCard,
  Eye, Printer, RotateCcw, Archive, X, Lock, EyeOff, RefreshCw,
  Clock, CheckCircle, AlertCircle, CloudUpload, Loader2,
  UtensilsCrossed, Coffee, Truck, ShoppingBag, Mail,
} from 'lucide-react';
import DateRangeFilter from './DateRangeFilter';
import Pagination from './Pagination';
import { ReceiptModal } from '../printing/ReceiptView';
import { buildSaleReceipt } from '../printing/receiptBuilder';
import api from '../utils/api';
import { localToday } from '../utils/dateUtils';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmDialog';
import SendInvoiceEmailModal from './SendInvoiceEmailModal';

// ─── Password Gate Modal ────────────────────────────────────────────────────
const PasswordModal = ({ title, passwordType, onSuccess, onClose }: {
  title: string; passwordType: 'view_completed' | 'refund'; onSuccess: () => void; onClose: () => void;
}) => {
  const [input, setInput] = useState('');
  const [show, setShow]   = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const verify = async () => {
    setChecking(true);
    setError('');
    try {
      const res = await api.post('/settings/verify-password', { type: passwordType, password: input });
      if (res.data.valid) { onSuccess(); }
      else { setError('Incorrect password.'); setInput(''); }
    } catch { setError('Verification failed. Please try again.'); }
    finally { setChecking(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center"><Lock size={20} className="text-amber-600" /></div>
          <div><h3 className="font-semibold text-gray-800">{title}</h3><p className="text-xs text-gray-500">Enter password to continue</p></div>
        </div>
        <div className="relative mb-3">
          <input type={show ? 'text' : 'password'} value={input} autoFocus
            onChange={e => { setInput(e.target.value); setError(''); }}
            onKeyDown={e => { if (e.key === 'Enter') verify(); }}
            placeholder="Enter password..."
            className="w-full pl-4 pr-10 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
            disabled={checking}
          />
          <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-medium transition-colors">Cancel</button>
          <button onClick={verify} disabled={checking} className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl font-semibold transition-colors">{checking ? 'Verifying...' : 'Unlock'}</button>
        </div>
      </div>
    </div>
  );
};

// ─── Token badge helper ─────────────────────────────────────────────────────
const TokenBadge = ({ token }: { token: string }) => {
  const isDelivery = token.startsWith('DL-');
  return (
    <span className={`ml-1.5 px-1.5 py-0.5 rounded text-xs font-bold border ${
      isDelivery ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200'
    }`}>{token}</span>
  );
};

// ─── Shift info type ────────────────────────────────────────────────────────
interface ShiftInfo {
  register_id: number;
  status: 'open' | 'closed';
  opened_at: string;   // ISO datetime
  closed_at: string | null;
  opened_by_name?: string;
  label: string;
}

// ─── Format datetime for display ───────────────────────────────────────────
const fmtDt = (iso: string) =>
  new Date(iso).toLocaleString('en-PK', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

// ─── Main component ─────────────────────────────────────────────────────────
interface CompletedOrdersViewProps {
  onClose?: () => void;
  title?: string;
}

const CompletedOrdersView: React.FC<CompletedOrdersViewProps> = ({
  onClose,
  title = 'Completed Orders',
}) => {
  const isOverlay = Boolean(onClose);
  const toast = useToast();
  const confirm = useConfirm();

  // View mode: 'shift' uses register boundaries; 'date' uses manual date range
  const [viewMode, setViewMode] = useState<'shift' | 'date'>('shift');
  const [shiftInfo, setShiftInfo]     = useState<ShiftInfo | null>(null);
  const [shiftLoading, setShiftLoading] = useState(true);

  // Filters
  const [typeFilter, setTypeFilter] = useState<'all' | 'dine_in' | 'takeaway' | 'delivery' | 'on_spot'>('all');
  const [cashierSearch, setCashierSearch] = useState('');
  const [fbrFilter, setFbrFilter] = useState<'all' | 'synced' | 'not_synced'>('all');
  const [search,   setSearch]   = useState('');
  const [dateFrom, setDateFrom] = useState(localToday);
  const [dateTo,   setDateTo]   = useState(localToday);

  // Data
  const [sales,      setSales]      = useState<any[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [page,       setPage]       = useState(1);
  const [perPage,    setPerPage]    = useState(15);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [summary,    setSummary]    = useState<{ order_count: number; total_amount: number } | null>(null);
  const [cs,         setCs]         = useState('Rs.');

  // Modals
  const [receiptData,    setReceiptData]    = useState<any>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [unlocked,       setUnlocked]       = useState(false);
  const [pwModal,      setPwModal]      = useState<{ type: 'unlock' | 'refund'; refundId?: number } | null>(null);
  const [passwords,    setPasswords]    = useState({ view_completed: false, refund: false });
  const [syncingSaleId, setSyncingSaleId] = useState<number | null>(null);
  const [syncedIds,    setSyncedIds]    = useState<Set<number>>(new Set());
  const [emailModal,   setEmailModal]   = useState<{ saleId: number; invoiceNo?: string; customerEmail?: string } | null>(null);
  const [posMode,      setPosMode]      = useState<'simple' | 'category'>('simple');

  // ── Fetch settings ──────────────────────────────────────────────────────
  useEffect(() => {
    api.get('/settings').then(res => {
      setCs(res.data.currency_symbol || 'Rs.');
      setPasswords({ view_completed: !!res.data.view_completed_orders_password_set, refund: !!res.data.refund_password_set });
      setPosMode(res.data.pos_mode === 'category' ? 'category' : 'simple');
      if (isOverlay && res.data.view_completed_orders_password_set) setPwModal({ type: 'unlock' });
    }).catch(() => {});
  }, [isOverlay]);

  // ── Fetch current shift info on mount ───────────────────────────────────
  useEffect(() => {
    const loadShift = async () => {
      setShiftLoading(true);
      try {
        // Try open register first
        const res = await api.get('/register/current');
        const reg = res.data;
        setShiftInfo({
          register_id: reg.register_id,
          status: 'open',
          opened_at: reg.opened_at,
          closed_at: null,
          opened_by_name: reg.opened_by_name,
          label: 'Current Shift (Open)',
        });
      } catch {
        // No open register — get last closed shift
        try {
          const hist = await api.get('/register/history', { params: { page: 1, limit: 1 } });
          const regs: any[] = hist.data.registers || [];
          if (regs.length > 0) {
            const last = regs[0];
            setShiftInfo({
              register_id: last.register_id,
              status: 'closed',
              opened_at: last.opened_at,
              closed_at: last.closed_at,
              opened_by_name: last.opened_by_name,
              label: 'Last Shift (Closed)',
            });
          } else {
            // No register at all — fall back to date mode showing today
            setViewMode('date');
          }
        } catch {
          setViewMode('date');
        }
      } finally {
        setShiftLoading(false);
      }
    };
    loadShift();
  }, []);

  // ── Build API params based on view mode ─────────────────────────────────
  const buildParams = useCallback((): Record<string, any> => {
    const base: Record<string, any> = {
      page, limit: perPage,
      status: 'completed,refunded',
    };
    if (search.trim()) base.search = search.trim();
    if (typeFilter !== 'all') base.order_type = typeFilter;
    if (cashierSearch.trim()) base.cashier = cashierSearch.trim();
    if (fbrFilter === 'synced') base.is_synced = '1';
    else if (fbrFilter === 'not_synced') base.is_synced = '0';

    if (viewMode === 'shift' && shiftInfo) {
      base.shift_start = shiftInfo.opened_at;
      base.shift_end   = shiftInfo.closed_at || new Date().toISOString();
    } else {
      base.date_from = dateFrom;
      base.date_to   = dateTo;
    }
    return base;
  }, [page, perPage, search, viewMode, shiftInfo, dateFrom, dateTo, typeFilter, cashierSearch, fbrFilter]);

  // ── Fetch sales ──────────────────────────────────────────────────────────
  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/sales', { params: buildParams() });
      setSales(res.data.data || res.data);
      if (res.data.pagination) {
        setTotalItems(res.data.pagination.total);
        setTotalPages(res.data.pagination.totalPages);
      }
      if (res.data.summary) setSummary(res.data.summary);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [buildParams]);

  // Trigger fetch after shift loaded (or when mode/filters change)
  useEffect(() => {
    if (shiftLoading) return;
    if (!passwords.view_completed || unlocked || !isOverlay) fetchSales();
  }, [fetchSales, unlocked, passwords.view_completed, isOverlay, shiftLoading]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [search, dateFrom, dateTo, typeFilter, cashierSearch, fbrFilter, viewMode, shiftInfo]);

  const handleRefund = async (saleId: number) => {
    const ok = await confirm({ title: 'Refund Order', message: `Refund Order #${saleId}? Stock will be restored.`, type: 'danger' });
    if (!ok) return;
    try { await api.post(`/sales/${saleId}/refund`); fetchSales(); }
    catch { toast.error('Failed to refund order'); }
  };

  const handleRefundClick = (saleId: number) => {
    if (passwords.refund) setPwModal({ type: 'refund', refundId: saleId });
    else handleRefund(saleId);
  };

  const handleSyncTax = async (saleId: number) => {
    setSyncingSaleId(saleId);
    try {
      await api.post(`/sales/${saleId}/sync-tax`);
      setSyncedIds(prev => new Set(prev).add(saleId));
    } catch {
      toast.error('Sync to tax system failed');
    } finally {
      setSyncingSaleId(null);
    }
  };

  const openReceipt = async (saleId: number) => {
    setReceiptLoading(true);
    try {
      const [sRes, stRes] = await Promise.all([api.get(`/sales/${saleId}`), api.get('/settings')]);
      setReceiptData(buildSaleReceipt(sRes.data, stRes.data));
    } catch { /* silent */ }
    finally { setReceiptLoading(false); }
  };

  // ── Shift info banner ───────────────────────────────────────────────────
  const shiftBanner = shiftInfo && viewMode === 'shift' && (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border ${
      shiftInfo.status === 'open'
        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
        : 'bg-gray-100 border-gray-300 text-gray-600'
    }`}>
      {shiftInfo.status === 'open'
        ? <CheckCircle size={14} className="text-emerald-600 shrink-0" />
        : <AlertCircle size={14} className="text-gray-400 shrink-0" />}
      <span>{shiftInfo.label}</span>
      <span className="text-gray-400 font-normal">
        {fmtDt(shiftInfo.opened_at)}
        {shiftInfo.closed_at ? ` → ${fmtDt(shiftInfo.closed_at)}` : ' → Now'}
      </span>
      {shiftInfo.opened_by_name && (
        <span className="ml-1 text-gray-400 font-normal hidden sm:inline">· {shiftInfo.opened_by_name}</span>
      )}
    </div>
  );

  // ── Render content ───────────────────────────────────────────────────────
  const content = (
    <div className={isOverlay ? 'flex flex-col h-full overflow-hidden' : 'space-y-4'}>

      {/* Overlay header */}
      {isOverlay && (
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-200 bg-gray-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center shrink-0">
              <Package size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-800">{title}</h2>
              <p className="text-xs text-gray-500">{totalItems} orders found</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchSales} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors" title="Refresh">
              <RefreshCw size={16} />
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Filters bar */}
      <div className={`space-y-2 ${isOverlay ? 'px-4 sm:px-6 py-3 border-b border-gray-100 bg-white shrink-0' : ''}`}>

        {/* Row 1: View mode toggle + Type filter tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Shift / Date toggle */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('shift')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'shift' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Clock size={13} /> Shift View
            </button>
            <button
              onClick={() => setViewMode('date')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'date' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Calendar size={13} /> Date Range
            </button>
          </div>

          {/* Type filter — only in category mode */}
          {posMode === 'category' && (
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl flex-wrap">
              {([
                { key: 'all',      label: 'All',       Icon: Package,         activeClass: 'bg-emerald-600 text-white' },
                { key: 'dine_in',  label: 'Dine-In',   Icon: UtensilsCrossed, activeClass: 'bg-orange-500 text-white' },
                { key: 'takeaway', label: 'Takeaway',   Icon: Coffee,          activeClass: 'bg-yellow-500 text-white' },
                { key: 'delivery', label: 'Delivery',   Icon: Truck,           activeClass: 'bg-blue-600 text-white'   },
                { key: 'on_spot',  label: 'Walk-In',    Icon: ShoppingBag,     activeClass: 'bg-indigo-600 text-white' },
              ] as const).map(({ key, label, Icon, activeClass }) => (
                <button
                  key={key}
                  onClick={() => setTypeFilter(key)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    typeFilter === key ? activeClass + ' shadow-sm' : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <Icon size={11} /> {label}
                </button>
              ))}
            </div>
          )}

          {/* Refresh */}
          {!isOverlay && (
            <button onClick={fetchSales} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200" title="Refresh">
              <RefreshCw size={15} />
            </button>
          )}
        </div>

        {/* Row 2: Shift banner OR date range + FBR filter */}
        <div className="flex flex-wrap items-center gap-2">
          {viewMode === 'shift' ? (
            shiftLoading
              ? <div className="flex items-center gap-2 text-xs text-gray-400 py-1"><div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-emerald-500"></div> Loading shift info...</div>
              : shiftBanner
          ) : (
            <DateRangeFilter
              standalone={false}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onFromChange={d => setDateFrom(d)}
              onToChange={d => setDateTo(d)}
            />
          )}

          {/* FBR Sync filter */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl ml-auto">
            {([
              { key: 'all',       label: 'All'       },
              { key: 'synced',    label: 'FBR Synced' },
              { key: 'not_synced',label: 'Not Synced' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFbrFilter(key)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  fbrFilter === key
                    ? key === 'synced' ? 'bg-green-600 text-white shadow-sm'
                      : key === 'not_synced' ? 'bg-red-500 text-white shadow-sm'
                      : 'bg-gray-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 3: Search invoice + Cashier search */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Invoice No, Customer, Token..."
              className="w-full pl-9 pr-4 py-2 bg-white border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="relative sm:w-48">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              placeholder="Cashier / Order Taker..."
              className="w-full pl-9 pr-4 py-2 bg-white border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-sm"
              value={cashierSearch}
              onChange={e => setCashierSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Table area
          KEY: flex-1 min-h-0 lets the div shrink in a flex-col parent so
          overflow-y-auto actually triggers. Without min-h-0 the div expands
          to its content height and never scrolls.                           */}
      <div className={isOverlay ? 'flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-3' : ''}>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-200 border-t-emerald-600 mx-auto mb-3"></div>
              <p className="text-gray-500 font-medium text-sm">Loading orders...</p>
            </div>
          </div>
        ) : sales.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="bg-gray-100 p-6 rounded-full mb-3"><Archive size={48} className="opacity-30" /></div>
            <p className="text-base font-semibold text-gray-500">No Completed Orders Found</p>
            <p className="text-sm text-gray-400 mt-1">
              {viewMode === 'shift' && shiftInfo
                ? `No orders in ${shiftInfo.label.toLowerCase()}`
                : 'Try adjusting the date range or search'}
            </p>
          </div>
        ) : (
          <>
            {/* Table: overflow-x-auto on the outer container so the border-radius
                wraps correctly and horizontal scroll is not clipped.          */}
            <div className="border border-gray-200 rounded-xl shadow-sm overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm" style={{ minWidth: '960px' }}>
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-3 font-bold border-b border-gray-200 whitespace-nowrap bg-gray-50">
                      <div className="flex items-center gap-1"><Package size={13} /> Invoice</div>
                    </th>
                    <th className="px-3 py-3 font-bold border-b border-gray-200 whitespace-nowrap bg-gray-50">
                      <div className="flex items-center gap-1"><Calendar size={13} /> Date &amp; Time</div>
                    </th>
                    <th className="px-3 py-3 font-bold border-b border-gray-200 whitespace-nowrap bg-gray-50">
                      <div className="flex items-center gap-1"><User size={13} /> Customer</div>
                    </th>
                    {posMode === 'category' && <th className="px-3 py-3 font-bold border-b border-gray-200 whitespace-nowrap bg-gray-50">Type</th>}
                    <th className="px-3 py-3 font-bold border-b border-gray-200 whitespace-nowrap bg-gray-50">Cashier</th>
                    <th className="px-3 py-3 font-bold border-b border-gray-200 text-right whitespace-nowrap bg-gray-50">Sub Total</th>
                    <th className="px-3 py-3 font-bold border-b border-gray-200 text-right whitespace-nowrap bg-gray-50">Tax</th>
                    <th className="px-3 py-3 font-bold border-b border-gray-200 text-right whitespace-nowrap bg-gray-50">Service</th>
                    <th className="px-3 py-3 font-bold border-b border-gray-200 text-right whitespace-nowrap bg-gray-50">Delivery</th>
                    <th className="px-3 py-3 font-bold border-b border-gray-200 text-right whitespace-nowrap bg-gray-50">
                      <div className="flex items-center justify-end gap-1"><DollarSign size={13} /> Grand Total</div>
                    </th>
                    <th className="px-3 py-3 font-bold border-b border-gray-200 whitespace-nowrap bg-gray-50">
                      <div className="flex items-center gap-1"><CreditCard size={13} /> Payment</div>
                    </th>
                    <th className="px-3 py-3 font-bold border-b border-gray-200 whitespace-nowrap bg-gray-50">Status</th>
                    <th className="px-3 py-3 font-bold border-b border-gray-200 whitespace-nowrap bg-gray-50">FBR</th>
                    <th className="px-3 py-3 font-bold border-b border-gray-200 text-center whitespace-nowrap bg-gray-50">Actions</th>
                  </tr>
                </thead>

                {/* Summary footer */}
                {summary && (
                  <tfoot className="bg-emerald-50 border-t-2 border-emerald-200">
                    <tr>
                      <td className="px-3 py-2.5 font-bold text-emerald-800 text-xs" colSpan={posMode === 'category' ? 5 : 4}>
                        {summary.order_count} orders
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-gray-700 text-xs">
                        {cs} {sales.reduce((s, r) => s + parseFloat(r.sub_total || 0), 0).toFixed(0)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-blue-700 text-xs">
                        {cs} {sales.reduce((s, r) => s + parseFloat(r.tax_amount || 0), 0).toFixed(0)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-purple-700 text-xs">
                        {cs} {sales.reduce((s, r) => s + parseFloat(r.additional_charges_amount || 0), 0).toFixed(0)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-blue-700 text-xs">
                        {cs} {sales.reduce((s, r) => s + parseFloat(r.delivery_charges || 0), 0).toFixed(0)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold text-emerald-800">
                        {cs} {summary.total_amount.toFixed(0)}
                      </td>
                      <td colSpan={4}></td>
                    </tr>
                  </tfoot>
                )}

                <tbody className="divide-y divide-gray-100 bg-white">
                  {sales.map(sale => {
                    const orderType = sale.order_type || 'on_spot';
                    const typeConfig: Record<string, { label: string; cls: string }> = {
                      dine_in:  { label: 'Dine-In',  cls: 'bg-orange-50 text-orange-700 border-orange-200' },
                      takeaway: { label: 'Takeaway', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
                      delivery: { label: 'Delivery', cls: 'bg-blue-50 text-blue-700 border-blue-200'       },
                      on_spot:  { label: 'Walk-In',  cls: 'bg-gray-50 text-gray-600 border-gray-200'       },
                    };
                    const tc = typeConfig[orderType] || typeConfig.on_spot;
                    return (
                      <tr key={sale.sale_id} className="hover:bg-emerald-50/40 transition-colors">
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="font-bold text-emerald-700 text-xs">
                            {sale.invoice_no || `#${sale.sale_id}`}
                          </span>
                          {sale.token_no && <TokenBadge token={sale.token_no} />}
                        </td>
                        <td className="px-3 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                          {new Date(sale.sale_date).toLocaleString('en-US', {
                            month: 'short', day: 'numeric', year: '2-digit',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </td>
                        <td className="px-3 py-2.5 text-gray-700 font-medium text-xs whitespace-nowrap">
                          <div className="max-w-[110px] truncate">{sale.customer_name || 'Walk-in'}</div>
                        </td>
                        {posMode === 'category' && (
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold border ${tc.cls}`}>
                              {tc.label}
                            </span>
                          </td>
                        )}
                        <td className="px-3 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                          <div className="max-w-[90px] truncate">{sale.cashier_name || '—'}</div>
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-600 text-xs whitespace-nowrap">
                          {cs} {parseFloat(sale.sub_total || 0).toFixed(0)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-blue-600 text-xs whitespace-nowrap">
                          {parseFloat(sale.tax_amount || 0) > 0
                            ? `${cs} ${parseFloat(sale.tax_amount).toFixed(0)}`
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right text-purple-600 text-xs whitespace-nowrap">
                          {parseFloat(sale.additional_charges_amount || 0) > 0
                            ? `${cs} ${parseFloat(sale.additional_charges_amount).toFixed(0)}`
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right text-blue-600 text-xs whitespace-nowrap">
                          {parseFloat(sale.delivery_charges || 0) > 0
                            ? `${cs} ${parseFloat(sale.delivery_charges).toFixed(0)}`
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold text-emerald-700 whitespace-nowrap">
                          {cs} {parseFloat(sale.total_amount || 0).toFixed(0)}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs rounded-full font-semibold capitalize border border-emerald-200">
                            {sale.payment_method?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`px-2 py-1 text-xs rounded-full font-semibold capitalize border ${
                            sale.status === 'refunded'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            {sale.status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {sale.is_synced
                            ? <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">Synced</span>
                            : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openReceipt(sale.sale_id)}
                              disabled={receiptLoading}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-all disabled:opacity-50"
                              title="View Bill"
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              onClick={() => openReceipt(sale.sale_id)}
                              disabled={receiptLoading}
                              className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-all disabled:opacity-50"
                              title="Print Receipt"
                            >
                              <Printer size={15} />
                            </button>
                            <button
                              onClick={() => handleRefundClick(sale.sale_id)}
                              disabled={sale.status === 'refunded'}
                              className={`p-1.5 rounded-lg transition-all ${
                                sale.status === 'refunded'
                                  ? 'text-gray-300 cursor-not-allowed'
                                  : 'text-red-500 hover:bg-red-100'
                              }`}
                              title={sale.status === 'refunded' ? 'Already Refunded' : 'Refund Order'}
                            >
                              <RotateCcw size={15} />
                            </button>
                            <button
                              onClick={() => handleSyncTax(sale.sale_id)}
                              disabled={syncingSaleId === sale.sale_id || syncedIds.has(sale.sale_id)}
                              className={`p-1.5 rounded-lg transition-all ${
                                syncedIds.has(sale.sale_id)
                                  ? 'text-green-600 bg-green-50'
                                  : 'text-purple-500 hover:bg-purple-50'
                              }`}
                              title={syncedIds.has(sale.sale_id) ? 'Synced to FBR' : 'Sync to FBR / Tax Dept'}
                            >
                              {syncingSaleId === sale.sale_id
                                ? <Loader2 size={15} className="animate-spin" />
                                : <CloudUpload size={15} />}
                            </button>
                            <button
                              onClick={() => setEmailModal({ saleId: sale.sale_id, invoiceNo: sale.invoice_no, customerEmail: sale.customer_email || undefined })}
                              className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                              title="Email Invoice"
                            >
                              <Mail size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 0 && (
              <div className="mt-3 bg-white rounded-xl p-3 border border-gray-200">
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  totalItems={totalItems}
                  itemsPerPage={perPage}
                  onItemsPerPageChange={v => { setPerPage(v); setPage(1); }}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {receiptData && <ReceiptModal data={receiptData} onClose={() => setReceiptData(null)} />}
      {receiptLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-2xl p-8 flex items-center gap-3 shadow-2xl">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
            <span className="text-gray-600 font-medium">Loading receipt...</span>
          </div>
        </div>
      )}

      {pwModal && (
        <PasswordModal
          title={pwModal.type === 'unlock' ? 'Completed Orders' : 'Refund Authorization'}
          passwordType={pwModal.type === 'unlock' ? 'view_completed' : 'refund'}
          onSuccess={() => {
            if (pwModal.type === 'unlock') { setUnlocked(true); fetchSales(); }
            else if (pwModal.refundId)     { handleRefund(pwModal.refundId); }
            setPwModal(null);
          }}
          onClose={() => { if (pwModal.type === 'unlock' && onClose) onClose(); else setPwModal(null); }}
        />
      )}

      {emailModal && (
        <SendInvoiceEmailModal
          isOpen={!!emailModal}
          onClose={() => setEmailModal(null)}
          saleId={emailModal.saleId}
          invoiceNo={emailModal.invoiceNo}
          customerEmail={emailModal.customerEmail}
        />
      )}
    </div>
  );

  // ── Full-screen overlay wrapper (for POS) ─────────────────────────────────
  // Portal to document.body so framer-motion transforms on parent Layout
  // motion.div do NOT create a new fixed-positioning containing block.
  // Without portal, fixed inset-0 only covers the content column, not sidebar.
  if (isOverlay) {
    return ReactDOM.createPortal(
      <div className="fixed inset-0 z-[9999]">
        <div className="bg-white w-full h-full flex flex-col">
          {content}
        </div>
      </div>,
      document.body
    );
  }

  return content;
};

export default CompletedOrdersView;
