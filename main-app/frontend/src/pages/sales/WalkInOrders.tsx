import { useState, useEffect, useCallback } from 'react';
import {
  ShoppingBag, Clock, DollarSign, User, Calendar, CreditCard,
  Package, RefreshCw, Edit2, X, Hash, Printer, Archive, LayoutGrid, List,
  UtensilsCrossed, Coffee, Truck, Filter, Eye,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import Pagination from '../../components/Pagination';
import { useAuth } from '../../context/AuthContext';
import { ReceiptModal, PaymentSelectModal } from '../../printing/ReceiptView';
import { buildSaleReceipt } from '../../printing/receiptBuilder';
import { KOTModal } from '../../printing/KOTView';
import type { KOTData } from '../../printing/KOTView';

// ─── Stat Card ──────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) => (
  <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center gap-4 shadow-sm">
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
      <Icon size={22} className="text-white" />
    </div>
    <div>
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className="text-xl font-bold text-gray-800 leading-tight">{value}</p>
    </div>
  </div>
);

// ─── Main Component ─────────────────────────────────────────────────────────
const WalkInOrders = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const isAdmin = user?.role_name === 'Admin';
  const [cs, setCs] = useState('Rs.');

  // Category filter
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Orders state
  const [activeSales, setActiveSales] = useState<any[]>([]);
  const [activeLoading, setActiveLoading] = useState(false);
  const [activePage, setActivePage] = useState(1);
  const [activePerPage, setActivePerPage] = useState(12);
  const [activeTotalItems, setActiveTotalItems] = useState(0);
  const [activeTotalPages, setActiveTotalPages] = useState(0);
  const [activeSummary, setActiveSummary] = useState<{ order_count: number; total_amount: number } | null>(null);

  // Payment select → receipt modal flow
  const [paySelectSale, setPaySelectSale]   = useState<any | null>(null);
  const [receiptData,   setReceiptData]     = useState<any | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  // KOT view modal
  const [kotViewData,    setKotViewData]    = useState<KOTData | null>(null);
  const [kotViewLoading, setKotViewLoading] = useState(false);

  const onPaymentSelected = async (payMethod: 'cash' | 'card' | 'online') => {
    const sale = paySelectSale;
    setPaySelectSale(null);
    setReceiptLoading(true);
    try {
      const [sRes, stRes] = await Promise.all([
        api.get(`/sales/${sale.sale_id}`),
        api.get('/settings'),
      ]);
      const saleData = sRes.data;
      const st = stRes.data;

      // Pick tax rate from settings based on selected payment method
      const taxPct =
        payMethod === 'card'   ? parseFloat(st.tax_on_card   ?? st.tax_rate ?? 0)
        : payMethod === 'online' ? parseFloat(st.tax_on_online ?? st.tax_rate ?? 0)
        : parseFloat(st.tax_on_cash ?? st.tax_rate ?? 0);

      // Derive item subtotal from stored sale, then recompute tax & total
      const storedTotal    = parseFloat(saleData.total_amount       || 0);
      const storedTax      = parseFloat(saleData.tax_amount         || 0);
      const storedCharges  = parseFloat(saleData.additional_charges_amount || 0);
      const storedDiscount = parseFloat(saleData.discount           || 0);
      const itemsSubtotal  = storedTotal - storedTax - storedCharges + storedDiscount;

      const newTaxAmount   = parseFloat((itemsSubtotal * taxPct / 100).toFixed(2));
      const newTotal       = parseFloat((itemsSubtotal + newTaxAmount + storedCharges - storedDiscount).toFixed(2));

      const overriddenSale = {
        ...saleData,
        tax_percent:              taxPct,
        tax_amount:               newTaxAmount,
        additional_charges_amount: storedCharges,
        total_amount:             newTotal,
        payment_method:           payMethod,
      };

      const rd = buildSaleReceipt(overriddenSale, st, saleData.cashier_name, saleData.customer_name);
      setReceiptData(rd);
    } catch (e) {
      console.error('Receipt load failed:', e);
    } finally {
      setReceiptLoading(false);
    }
  };

  // Layout toggle
  const [layout, setLayout] = useState<'card' | 'table'>(() =>
    (localStorage.getItem('walkin_layout') as 'card' | 'table') || 'card'
  );
  const switchLayout = (l: 'card' | 'table') => { setLayout(l); localStorage.setItem('walkin_layout', l); };

  const [posMode, setPosMode] = useState<'simple' | 'category'>('simple');

  useEffect(() => {
    api.get('/settings').then(res => {
      setCs(res.data.currency_symbol || 'Rs.');
      setPosMode(res.data.pos_mode === 'category' ? 'category' : 'simple');
    }).catch(() => {});
  }, []);

  const fetchActive = useCallback(async () => {
    setActiveLoading(true);
    try {
      const params: any = { page: activePage, limit: activePerPage };
      if (categoryFilter !== 'all') params.order_type = categoryFilter;
      const res = await api.get('/sales/pending', { params });
      setActiveSales(res.data.data || res.data);
      if (res.data.pagination) {
        setActiveTotalItems(res.data.pagination.total);
        setActiveTotalPages(res.data.pagination.totalPages);
      }
      if (res.data.summary) setActiveSummary(res.data.summary);
    } catch (err) {
      console.error('Failed to fetch active orders', err);
    } finally {
      setActiveLoading(false);
    }
  }, [activePage, activePerPage, categoryFilter]);

  useEffect(() => { fetchActive(); }, [fetchActive, categoryFilter]);

  const handleDeleteActive = async (sale: any) => {
    const ok = await confirm({ title: 'Delete Order', message: `Delete Order${sale.token_no ? ` Token ${sale.token_no}` : ` #${sale.sale_id}`}? Stock will be restored.`, type: 'danger' });
    if (!ok) return;
    try {
      await api.delete(`/sales/${sale.sale_id}`);
      fetchActive();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete order');
    }
  };

  const handleViewKOT = async (sale: any) => {
    setKotViewLoading(true);
    try {
      const [sRes, stRes] = await Promise.all([
        api.get(`/sales/${sale.sale_id}`),
        api.get('/settings'),
      ]);
      const fullSale = sRes.data;
      const st = stRes.data;
      const items: any[] = fullSale.items || [];

      const orderTypeLabel =
        fullSale.order_type === 'takeaway' ? 'Takeaway'
        : fullSale.order_type === 'delivery' ? 'Delivery'
        : 'Dine-In';

      setKotViewData({
        storeName:   st.store_name || 'AByte ERP',
        tokenNo:     String(sale.token_no || sale.sale_id),
        tableNo:     fullSale.table_name || orderTypeLabel,
        orderType:   orderTypeLabel,
        cashierName: fullSale.cashier_name || 'Staff',
        date:        new Date(fullSale.sale_date).toLocaleString(),
        items: items.map((item: any) => ({
          name:     item.product_name + (item.variant_name ? ` (${item.variant_name})` : ''),
          quantity: item.quantity,
          category: item.category_name || 'General',
          note:     item.note,
        })),
      });
    } catch {
      /* silent */
    } finally {
      setKotViewLoading(false);
    }
  };

  const handleReprintKOT = async (sale: any) => {
    let fullSale = sale;
    try {
      const res = await api.get(`/sales/${sale.sale_id}`);
      fullSale = { ...sale, ...res.data };
    } catch { /* fallback to header-only data */ }

    const tableName = fullSale.table_name || (fullSale.order_type === 'takeaway' ? 'TAKEAWAY' : 'DINE-IN');
    const items: any[] = fullSale.items || [];

    await api.post('/settings/print-queue', {
      type: 'kot',
      kotData: {
        tokenNo:     String(sale.token_no || sale.sale_id),
        tableNo:     tableName,
        date:        new Date().toLocaleString(),
        cashierName: fullSale.cashier_name || 'Staff',
        items: items.map((item: any) => ({
          name:          item.product_name + (item.variant_name ? ` (${item.variant_name})` : ''),
          quantity:      item.quantity,
          category_id:   item.category_id,
          category_name: item.category_name,
        })),
      },
    }).catch(console.error);

    await api.patch(`/sales/${sale.sale_id}/kot-printed`).catch(() => {});
  };


  return (
    <div className="min-h-screen bg-gray-100">

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="bg-white border-b-2 border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-2.5 rounded-xl shadow-lg">
                <ShoppingBag size={26} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-gray-900">Running Orders</h1>
                <p className="text-sm text-gray-500">On-spot customer orders management</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/pos')}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm"
              >
                <ShoppingBag size={16} /> <span className="hidden sm:inline">New Sale</span>
              </button>
              <button
                onClick={() => fetchActive()}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
              >
                <RefreshCw size={16} /> <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────── */}
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-6">

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <StatCard icon={Clock} label="Running Orders" value={activeTotalItems} color="bg-emerald-500" />
          <StatCard icon={DollarSign} label="Active Value" value={activeSummary ? `${cs} ${activeSummary.total_amount.toFixed(0)}` : `${cs} 0`} color="bg-emerald-600" />
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
            <Filter size={14} className="text-gray-400 shrink-0" />
            {[
              { key: 'all',      label: 'All Orders',  icon: Package,        color: 'gray'    },
              ...(posMode === 'category' ? [
                { key: 'dine_in',  label: 'Dine-In',     icon: UtensilsCrossed,color: 'orange'  },
                { key: 'takeaway', label: 'Takeaway',     icon: Coffee,         color: 'yellow'  },
                { key: 'delivery', label: 'Delivery',     icon: Truck,          color: 'blue'    },
              ] : []),
              { key: 'on_spot',  label: 'Walk-In',      icon: ShoppingBag,    color: 'emerald' },
            ].map(f => {
              const Icon = f.icon;
              const active = categoryFilter === f.key;
              const colorMap: Record<string, string> = {
                gray:    active ? 'bg-gray-700 text-white border-gray-700'        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400',
                orange:  active ? 'bg-orange-500 text-white border-orange-500'   : 'bg-white text-orange-600 border-orange-200 hover:border-orange-400',
                yellow:  active ? 'bg-yellow-500 text-white border-yellow-500'   : 'bg-white text-yellow-600 border-yellow-200 hover:border-yellow-400',
                blue:    active ? 'bg-blue-500 text-white border-blue-500'       : 'bg-white text-blue-600 border-blue-200 hover:border-blue-400',
                emerald: active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-600 border-emerald-200 hover:border-emerald-400',
              };
              return (
                <button
                  key={f.key}
                  onClick={() => { setCategoryFilter(f.key); setActivePage(1); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-semibold text-sm transition-all ${colorMap[f.color]}`}
                >
                  <Icon size={14} /> {f.label}
                </button>
              );
            })}
        </div>
        {activeLoading ? (
            <div className="flex items-center justify-center h-[55vh]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-14 w-14 border-4 border-emerald-200 border-t-emerald-600 mx-auto mb-4"></div>
                <p className="text-gray-500 font-medium">Loading active orders...</p>
              </div>
            </div>
          ) : activeSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[55vh] text-gray-400">
              <div className="bg-emerald-50 p-8 rounded-full mb-4 border-2 border-emerald-100">
                <Archive size={56} className="text-emerald-300" />
              </div>
              <p className="text-xl font-semibold text-gray-500">No Active Orders</p>
              <p className="text-sm text-gray-400 mt-1">All orders have been completed</p>
              <button
                onClick={() => navigate('/pos')}
                className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors"
              >
                <ShoppingBag size={16} /> Create New Sale
              </button>
            </div>
          ) : (
            <>
              {/* Layout Toggle */}
              <div className="flex items-center justify-end mb-4">
                <div className="flex items-center bg-white border border-gray-200 rounded-lg p-1 gap-1 shadow-sm">
                  <button
                    onClick={() => switchLayout('card')}
                    title="Card View"
                    className={`p-1.5 rounded-md transition-colors ${layout === 'card' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    <LayoutGrid size={16} />
                  </button>
                  <button
                    onClick={() => switchLayout('table')}
                    title="Table View"
                    className={`p-1.5 rounded-md transition-colors ${layout === 'table' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-gray-600'}`}
                  >
                    <List size={16} />
                  </button>
                </div>
              </div>

              {/* ── CARD VIEW ── */}
              {layout === 'card' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
                  {activeSales.map(sale => (
                    <div
                      key={sale.sale_id}
                      className="bg-white border-2 border-gray-200 rounded-xl p-5 hover:shadow-xl hover:border-emerald-300 transition-all duration-200 hover:-translate-y-1 flex flex-col"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          {sale.token_no && (
                            <p className="text-2xl font-black text-emerald-600 leading-tight">Token {sale.token_no}</p>
                          )}
                          <p className="text-xs font-bold text-emerald-700 mt-0.5 flex items-center gap-1">
                            <Hash size={11} />{sale.invoice_no || `Order #${sale.sale_id}`}
                          </p>
                          <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                            <Calendar size={11} />
                            {new Date(sale.sale_date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className="bg-emerald-100 text-emerald-700 text-xs px-2.5 py-1 rounded-full font-bold border border-emerald-200">Active</span>
                          {/* Order type badge — only in category mode */}
                          {posMode === 'category' && sale.order_type === 'dine_in' && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 bg-orange-100 text-orange-700 border border-orange-200">
                              <UtensilsCrossed size={10} /> Dine-In {sale.table_name ? `· ${sale.table_name}` : ''}
                            </span>
                          )}
                          {posMode === 'category' && sale.order_type === 'takeaway' && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 bg-yellow-100 text-yellow-700 border border-yellow-200">
                              <Coffee size={10} /> Takeaway
                            </span>
                          )}
                          {posMode === 'category' && sale.order_type === 'delivery' && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 bg-blue-100 text-blue-700 border border-blue-200">
                              <Truck size={10} /> Delivery
                            </span>
                          )}
                          {posMode === 'category' && (sale.order_type === 'dine_in' || sale.order_type === 'takeaway') && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 ${
                              sale.kot_printed ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'
                            }`}>
                              <UtensilsCrossed size={10} />{sale.kot_printed ? 'KOT Sent' : 'KOT Pending'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="py-3 border-t border-b border-gray-100 space-y-2 flex-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500 flex items-center gap-1.5"><User size={14} className="text-emerald-500" /> Customer</span>
                          <span className="font-semibold text-gray-800 truncate max-w-[120px]">{sale.customer_name || 'Walk-in'}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500 flex items-center gap-1.5"><User size={14} className="text-blue-500" /> Waiter</span>
                          <span className="font-semibold text-blue-700 truncate max-w-[120px]">{sale.cashier_name || 'Staff'}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500 flex items-center gap-1.5"><DollarSign size={14} className="text-emerald-500" /> Total</span>
                          <span className="font-bold text-lg text-emerald-600">{cs} {parseFloat(sale.total_amount).toFixed(0)}</span>
                        </div>
                        {sale.note && (
                          <div className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 mt-1">
                            <p className="text-xs text-gray-600 italic truncate">📝 {sale.note}</p>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2 mt-4">
                        <div className="flex gap-2">
                          <button onClick={() => navigate('/pos', { state: { editOrder: sale } })}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all border border-blue-200 font-medium text-sm">
                            <Edit2 size={14} /> Edit
                          </button>
                          <button onClick={() => setPaySelectSale(sale)}
                            className="p-2 bg-gray-50 text-gray-500 rounded-lg hover:bg-gray-100 transition-all border border-gray-200">
                            <Eye size={14} />
                          </button>
                          <button onClick={() => setPaySelectSale(sale)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-all border border-emerald-200 font-medium text-sm">
                            <Printer size={14} /> Print
                          </button>
                          {isAdmin && (
                            <button onClick={() => handleDeleteActive(sale)}
                              className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-all border border-red-200">
                              <X size={14} />
                            </button>
                          )}
                        </div>
                        {isAdmin && (sale.order_type === 'dine_in' || sale.order_type === 'takeaway') && (
                          <div className="flex gap-2">
                            <button onClick={() => handleViewKOT(sale)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-all border border-orange-200 font-medium text-sm">
                              <Eye size={14} /> View KOT
                            </button>
                            <button onClick={() => handleReprintKOT(sale)}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-all border border-orange-200 font-medium text-sm">
                              <UtensilsCrossed size={14} /> Reprint KOT
                            </button>
                          </div>
                        )}
                        <button onClick={() => navigate('/pos', { state: { pendingSale: sale } })}
                          className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white py-2.5 rounded-lg font-bold hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-md flex items-center justify-center gap-2 text-sm">
                          <CreditCard size={16} /> Checkout
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ── TABLE VIEW ── */}
              {layout === 'table' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Token</th>
                          {posMode === 'category' && <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Type</th>}
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Invoice</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Customer</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Cashier</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Total</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Date & Time</th>
                          {posMode === 'category' && <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">KOT</th>}
                          <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {activeSales.map(sale => (
                          <tr key={sale.sale_id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              {sale.token_no
                                ? <span className="font-bold text-emerald-600">{sale.token_no}</span>
                                : <span className="text-gray-400 text-sm">—</span>}
                            </td>
                            {posMode === 'category' && (
                              <td className="px-4 py-3">
                                {sale.order_type === 'dine_in' && <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-orange-100 text-orange-700 flex items-center gap-1 w-fit"><UtensilsCrossed size={9}/> Dine</span>}
                                {sale.order_type === 'takeaway' && <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-yellow-100 text-yellow-700 flex items-center gap-1 w-fit"><Coffee size={9}/> TA</span>}
                                {sale.order_type === 'delivery' && <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-700 flex items-center gap-1 w-fit"><Truck size={9}/> DL</span>}
                                {(!sale.order_type || sale.order_type === 'on_spot') && <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-600 flex items-center gap-1 w-fit"><ShoppingBag size={9}/> WI</span>}
                              </td>
                            )}
                            <td className="px-4 py-3 text-sm text-gray-600 font-medium">{sale.invoice_no || `#${sale.sale_id}`}</td>
                            <td className="px-4 py-3 text-sm text-gray-800">{sale.customer_name || 'Walk-in'}</td>
                            <td className="px-4 py-3">
                              <span className="text-sm font-semibold text-blue-700">{sale.cashier_name || 'Staff'}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-semibold text-emerald-600">{cs} {parseFloat(sale.total_amount).toFixed(0)}</span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {new Date(sale.sale_date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 max-w-[150px] truncate">{sale.note || '—'}</td>
                            {posMode === 'category' && (
                              <td className="px-4 py-3">
                                {(sale.order_type === 'dine_in' || sale.order_type === 'takeaway') ? (
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 w-fit ${
                                    sale.kot_printed ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                  }`}>
                                    <UtensilsCrossed size={10} />{sale.kot_printed ? 'Sent' : 'Pending'}
                                  </span>
                                ) : <span className="text-gray-300 text-xs">—</span>}
                              </td>
                            )}
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-1.5">
                                <button onClick={() => navigate('/pos', { state: { editOrder: sale } })}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit">
                                  <Edit2 size={15} />
                                </button>
                                <button onClick={() => setPaySelectSale(sale)}
                                  className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition" title="View Bill">
                                  <Eye size={15} />
                                </button>
                                <button onClick={() => setPaySelectSale(sale)}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition" title="Print Bill">
                                  <Printer size={15} />
                                </button>
                                {isAdmin && (sale.order_type === 'dine_in' || sale.order_type === 'takeaway') && (
                                  <button onClick={() => handleViewKOT(sale)}
                                    className="p-1.5 text-orange-500 hover:bg-orange-50 rounded-lg transition" title="View KOT">
                                    <Eye size={15} />
                                  </button>
                                )}
                                {isAdmin && (sale.order_type === 'dine_in' || sale.order_type === 'takeaway') && (
                                  <button onClick={() => handleReprintKOT(sale)}
                                    className="p-1.5 text-orange-500 hover:bg-orange-50 rounded-lg transition" title="Reprint KOT (Admin)">
                                    <UtensilsCrossed size={15} />
                                  </button>
                                )}
                                <button onClick={() => navigate('/pos', { state: { pendingSale: sale } })}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition" title="Checkout">
                                  <CreditCard size={15} />
                                </button>
                                {isAdmin && (
                                  <button onClick={() => handleDeleteActive(sale)}
                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition" title="Delete">
                                    <X size={15} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTotalPages > 1 && (
                <div className="mt-6 bg-white rounded-xl p-4 border border-gray-200">
                  <Pagination
                    currentPage={activePage}
                    totalPages={activeTotalPages}
                    onPageChange={setActivePage}
                    totalItems={activeTotalItems}
                    itemsPerPage={activePerPage}
                    onItemsPerPageChange={(v) => { setActivePerPage(v); setActivePage(1); }}
                  />
                </div>
              )}

              {activeSummary && (
                <div className="mt-4 bg-gradient-to-r from-emerald-50 to-emerald-100 border-2 border-emerald-200 rounded-xl px-6 py-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-emerald-700 flex items-center gap-2">
                    <Package size={16} /> Total Active: <strong>{activeSummary.order_count}</strong>
                  </span>
                  <span className="text-base font-bold text-emerald-800">
                    Pending Amount: {cs} {activeSummary.total_amount.toFixed(0)}
                  </span>
                </div>
              )}
            </>
          )}
      </div>

      {/* ── Payment select → Receipt modal ──────────────────── */}
      {paySelectSale && (
        <PaymentSelectModal
          onSelect={onPaymentSelected}
          onClose={() => setPaySelectSale(null)}
        />
      )}
      {receiptLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 flex items-center gap-3 shadow-2xl">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
            <span className="text-gray-600 font-medium">Loading receipt...</span>
          </div>
        </div>
      )}
      {receiptData && (
        <ReceiptModal data={receiptData} onClose={() => setReceiptData(null)} />
      )}

      {/* ── KOT view modal ──────────────────────────────────── */}
      {kotViewLoading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 flex items-center gap-3 shadow-2xl">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500" />
            <span className="text-gray-600 font-medium">Loading KOT...</span>
          </div>
        </div>
      )}
      {kotViewData && (
        <KOTModal data={kotViewData} onClose={() => setKotViewData(null)} />
      )}
    </div>
  );
};

export default WalkInOrders;
