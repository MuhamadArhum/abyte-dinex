import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck, Search, X, Edit2, Trash2, CheckCircle,
  Clock, MapPin, Phone, User, Calendar, DollarSign, Loader2,
  RefreshCw, Package, XCircle, Navigation, ChevronRight,
  Save, ShoppingCart, CreditCard,
  LayoutGrid, List,
} from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import CheckoutModal from '../../components/CheckoutModal';

type Status = 'pending' | 'assigned' | 'dispatched' | 'in_transit' | 'delivered' | 'failed' | 'cancelled';

interface Delivery {
  delivery_id: number;
  delivery_number: string;
  sale_id: number | null;
  customer_id: number;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  delivery_city: string;
  delivery_phone: string;
  rider_name: string;
  rider_phone: string;
  status: Status;
  delivery_charges: number;
  estimated_delivery: string | null;
  actual_delivery: string | null;
  notes: string;
  created_by_name: string;
  created_at: string;
  // Linked sale fields
  sale_status?: string;
  sale_invoice_no?: string;
  sale_total_amount?: number;
  sale_sub_total?: number;
  sale_tax_amount?: number;
  sale_service_amount?: number;
  sale_payment_method?: string;
}

interface Stats {
  total: number; pending: number; assigned: number;
  dispatched: number; in_transit: number; delivered: number;
  failed: number; cancelled: number;
  delivered_today: number; monthly_charges: number;
}

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string; border: string; icon: any }> = {
  pending:    { label: 'Pending',    color: 'text-gray-600',    bg: 'bg-gray-100',    border: 'border-gray-300',   icon: Clock },
  assigned:   { label: 'Assigned',   color: 'text-blue-700',    bg: 'bg-blue-100',    border: 'border-blue-500',   icon: User },
  dispatched: { label: 'Dispatched', color: 'text-amber-700',   bg: 'bg-amber-100',   border: 'border-amber-500',  icon: Package },
  in_transit: { label: 'In Transit', color: 'text-orange-700',  bg: 'bg-orange-100',  border: 'border-orange-500', icon: Navigation },
  delivered:  { label: 'Delivered',  color: 'text-emerald-700', bg: 'bg-emerald-100', border: 'border-emerald-500',icon: CheckCircle },
  failed:     { label: 'Failed',     color: 'text-red-700',     bg: 'bg-red-100',     border: 'border-red-400',    icon: XCircle },
  cancelled:  { label: 'Cancelled',  color: 'text-gray-500',    bg: 'bg-gray-100',    border: 'border-gray-300',   icon: X },
};

const RUNNING: Status[] = ['pending', 'assigned', 'dispatched', 'in_transit'];

const StatusBadge = ({ status }: { status: Status }) => {
  const c = STATUS_CONFIG[status];
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${c.bg} ${c.color}`}>
      <Icon size={11} />{c.label}
    </span>
  );
};

const emptyForm = () => ({
  customer_id: '', sale_id: '', delivery_address: '', delivery_city: '',
  delivery_phone: '', rider_name: '', rider_phone: '',
  delivery_charges: '', estimated_delivery: '', notes: '',
});

// ── Stat Card ──────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) => (
  <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center gap-4 shadow-sm">
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
      <Icon size={20} className="text-white" />
    </div>
    <div>
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className="text-xl font-bold text-gray-800 leading-tight">{value}</p>
    </div>
  </div>
);

// ── Running Order Card ───────────────────────────────────────────────────────
interface CardProps {
  delivery: Delivery;
  onStatusChange: (id: number, status: Status) => void;
  onEdit: (d: Delivery) => void;
  onDelete: (d: Delivery) => void;
  onRefresh: () => void;
  onEditOrder: (d: Delivery) => void;
  onCheckout: (d: Delivery) => void;
  updatingStatus: number | null;
}

const RunningCard = ({ delivery: d, onStatusChange, onEdit, onDelete, onRefresh, onEditOrder, onCheckout, updatingStatus }: CardProps) => {
  const toast = useToast();
  const [showRiderForm, setShowRiderForm] = useState(false);
  const [riderName, setRiderName] = useState('');
  const [riderPhone, setRiderPhone] = useState('');
  const [savingRider, setSavingRider] = useState(false);

  const cfg = STATUS_CONFIG[d.status];
  const isUpdating = updatingStatus === d.delivery_id;

  const saveRider = async () => {
    if (!riderName.trim()) return;
    setSavingRider(true);
    try {
      await api.put(`/deliveries/${d.delivery_id}`, {
        delivery_address: d.delivery_address,
        delivery_city: d.delivery_city,
        delivery_phone: d.delivery_phone,
        rider_name: riderName.trim(),
        rider_phone: riderPhone.trim(),
        delivery_charges: d.delivery_charges,
        estimated_delivery: d.estimated_delivery,
        notes: d.notes,
        status: d.status,
      });
      toast.success('Rider assigned');
      setShowRiderForm(false);
      onRefresh();
    } catch {
      toast.error('Failed to assign rider');
    } finally {
      setSavingRider(false);
    }
  };

  const openRiderForm = (prefill = false) => {
    setRiderName(prefill ? d.rider_name : '');
    setRiderPhone(prefill ? d.rider_phone : '');
    setShowRiderForm(true);
  };

  const nextStatuses: { status: Status; label: string; cls: string }[] = [];
  if (d.status === 'pending' || d.status === 'assigned')
    nextStatuses.push({ status: 'dispatched', label: 'Dispatch →', cls: 'bg-amber-500 hover:bg-amber-600 text-white' });
  if (d.status === 'dispatched')
    nextStatuses.push({ status: 'in_transit', label: 'In Transit →', cls: 'bg-orange-500 hover:bg-orange-600 text-white' });
  if (d.status === 'in_transit') {
    nextStatuses.push({ status: 'delivered', label: '✓ Delivered', cls: 'bg-emerald-600 hover:bg-emerald-700 text-white' });
    nextStatuses.push({ status: 'failed',    label: '✗ Failed',    cls: 'bg-red-500 hover:bg-red-600 text-white' });
  }

  const fmtDate = (v: string | null) =>
    v ? new Date(v).toLocaleDateString('en-PK', { day: '2-digit', month: 'short' }) : null;

  return (
    <div className={`bg-white rounded-xl border border-gray-200 border-l-4 shadow-sm hover:shadow-xl hover:border-emerald-300 transition-all duration-200 hover:-translate-y-1 flex flex-col ${cfg.border}`}>
      {/* Header */}
      <div className="px-4 pt-3.5 pb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-mono text-xs font-bold text-emerald-600">{d.delivery_number}</span>
            {d.sale_id && (
              <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">Sale #{d.sale_id}</span>
            )}
          </div>
          <p className="font-bold text-gray-900 text-sm truncate">{d.customer_name}</p>
        </div>
        <StatusBadge status={d.status} />
      </div>

      {/* Address */}
      <div className="px-4 py-2 border-t border-gray-50 space-y-1">
        <div className="flex items-start gap-2">
          <MapPin size={13} className="text-gray-400 mt-0.5 shrink-0" />
          <p className="text-xs text-gray-700 leading-snug">
            {d.delivery_address}
            {d.delivery_city && <span className="text-gray-400">, {d.delivery_city}</span>}
          </p>
        </div>
        {(d.delivery_phone || d.customer_phone) && (
          <div className="flex items-center gap-2">
            <Phone size={11} className="text-gray-400 shrink-0" />
            <span className="text-xs text-gray-500">{d.delivery_phone || d.customer_phone}</span>
          </div>
        )}
      </div>

      {/* Rider */}
      <div className="px-4 py-2.5 border-t border-gray-50">
        {!showRiderForm ? (
          d.rider_name ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs shrink-0">
                  {d.rider_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{d.rider_name}</p>
                  {d.rider_phone && <p className="text-xs text-gray-400">{d.rider_phone}</p>}
                </div>
              </div>
              <button onClick={() => openRiderForm(true)} className="text-xs text-blue-500 hover:text-blue-700 font-medium transition-colors">
                Change
              </button>
            </div>
          ) : (
            <button
              onClick={() => openRiderForm(false)}
              className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-blue-300 text-blue-500 hover:bg-blue-50 rounded-lg text-xs font-semibold transition-all"
            >
              <User size={13} /> Assign Rider
            </button>
          )
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input
                className="form-input text-xs py-1.5"
                placeholder="Rider name *"
                value={riderName}
                onChange={e => setRiderName(e.target.value)}
                autoFocus
              />
              <input
                className="form-input text-xs py-1.5"
                placeholder="Phone"
                value={riderPhone}
                onChange={e => setRiderPhone(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowRiderForm(false)}
                className="flex-1 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={saveRider}
                disabled={!riderName.trim() || savingRider}
                className="flex-1 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {savingRider ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                Save
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer meta */}
      <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {Number(d.delivery_charges) > 0 && (
            <span className="flex items-center gap-1 font-semibold text-gray-600">
              <DollarSign size={11} />Rs. {Number(d.delivery_charges).toLocaleString()}
            </span>
          )}
          {d.estimated_delivery && (
            <span className="flex items-center gap-1">
              <Calendar size={11} />Est. {fmtDate(d.estimated_delivery)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {d.sale_status !== 'completed' && (
            <button onClick={() => onEdit(d)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Edit delivery details">
              <Edit2 size={13} />
            </button>
          )}
          {['pending', 'cancelled'].includes(d.status) && (
            <button onClick={() => onDelete(d)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Delete">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Sale Actions */}
      {d.sale_id && (
        <div className="px-3 pb-2 flex gap-2 border-t border-gray-50 pt-2">
          {d.sale_status !== 'completed' && (
            <button
              onClick={() => onEditOrder(d)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-800 rounded-lg transition-all"
            >
              <ShoppingCart size={12} /> Edit Order
            </button>
          )}
          {d.sale_status === 'pending' && (
            <button
              onClick={() => onCheckout(d)}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all shadow-sm"
            >
              <CreditCard size={12} /> Checkout
            </button>
          )}
          {d.sale_status === 'completed' && (
            <span className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-200">
              <CheckCircle size={12} /> Paid
            </span>
          )}
        </div>
      )}

      {/* Status Progression */}
      {nextStatuses.length > 0 && (
        <div className="px-3 pb-3 flex gap-2">
          {nextStatuses.map(ns => (
            <button
              key={ns.status}
              onClick={() => onStatusChange(d.delivery_id, ns.status)}
              disabled={isUpdating}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 ${ns.cls}`}
            >
              {isUpdating ? <Loader2 size={11} className="animate-spin" /> : <ChevronRight size={12} />}
              {ns.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Edit Drawer ──────────────────────────────────────────────────────────────
interface DrawerProps {
  delivery: Delivery;
  form: ReturnType<typeof emptyForm>;
  setForm: (f: ReturnType<typeof emptyForm>) => void;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}

const EditDrawer = ({ delivery: d, form, setForm, saving, onSave, onClose }: DrawerProps) => {
  const set = (k: string, v: string) => setForm({ ...form, [k]: v });
  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-96 bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50 shrink-0">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
              <Truck size={16} className="text-emerald-600" />{d.delivery_number}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">{d.customer_name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg transition-all"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="form-label">Delivery Address <span className="text-red-500">*</span></label>
            <textarea className="form-input resize-none" rows={2} value={form.delivery_address} onChange={e => set('delivery_address', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">City</label>
              <input className="form-input" value={form.delivery_city} onChange={e => set('delivery_city', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Contact Phone</label>
              <input className="form-input" value={form.delivery_phone} onChange={e => set('delivery_phone', e.target.value)} />
            </div>
          </div>

          <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 space-y-3">
            <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5"><User size={13} />Rider Info</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Rider Name</label>
                <input className="form-input" placeholder="Full name" value={form.rider_name} onChange={e => set('rider_name', e.target.value)} />
              </div>
              <div>
                <label className="form-label">Rider Phone</label>
                <input className="form-input" placeholder="03xx-xxxxxxx" value={form.rider_phone} onChange={e => set('rider_phone', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Delivery Charges (Rs.)</label>
              <input className="form-input" type="number" min="0" value={form.delivery_charges} onChange={e => set('delivery_charges', e.target.value)} />
            </div>
            <div>
              <label className="form-label">Est. Delivery Date</label>
              <input className="form-input" type="date" value={form.estimated_delivery} onChange={e => set('estimated_delivery', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="form-label">Notes</label>
            <textarea className="form-input resize-none" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-3 shrink-0">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl transition-all">
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl transition-all disabled:opacity-60"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </>
  );
};


// ════════════════════════════════════════════════════════════════════════════
const Deliveries = () => {
  const toast = useToast();
  const navigate = useNavigate();

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [stats, setStats]           = useState<Stats | null>(null);
  const [loading, setLoading]       = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [layout, setLayout]         = useState<'card' | 'table'>(() => (localStorage.getItem('delivery_layout') as 'card' | 'table') || 'card');
  const [cs, setCs]                 = useState('Rs.');

  const switchLayout = (l: 'card' | 'table') => { setLayout(l); localStorage.setItem('delivery_layout', l); };

  const [search, setSearch] = useState('');

  const [editItem, setEditItem] = useState<Delivery | null>(null);
  const [form, setForm]             = useState(emptyForm());
  const [saving, setSaving]         = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);

  // Checkout modal state
  const [checkoutDelivery, setCheckoutDelivery] = useState<Delivery | null>(null);
  const [checkoutSale, setCheckoutSale]         = useState<any>(null);
  const [checkoutSaleLoading, setCheckoutSaleLoading] = useState(false);

  const fetchDeliveries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/deliveries', { params: { limit: 200, search } });
      const all = (res.data.data || []).filter((d: Delivery) => RUNNING.includes(d.status));
      setDeliveries(all);
    } catch {
      toast.error('Failed to load deliveries');
    } finally {
      setLoading(false);
    }
  }, [search]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await api.get('/deliveries/stats');
      setStats(res.data);
    } catch { } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { fetchDeliveries(); }, [fetchDeliveries]);
  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => {
    api.get('/settings').then(r => setCs(r.data.currency_symbol || 'Rs.')).catch(() => {});
  }, []);

  const handleUpdate = async () => {
    if (!editItem) return;
    setSaving(true);
    try {
      await api.put(`/deliveries/${editItem.delivery_id}`, {
        ...form,
        delivery_charges: parseFloat(form.delivery_charges || '0'),
      });
      toast.success('Delivery updated');
      setEditItem(null);
      fetchDeliveries(); fetchStats();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to update delivery');
    } finally { setSaving(false); }
  };

  const handleStatusChange = async (id: number, status: Status) => {
    setUpdatingStatus(id);
    try {
      await api.patch(`/deliveries/${id}/status`, { status });
      toast.success(`→ ${STATUS_CONFIG[status].label}`);
      fetchDeliveries(); fetchStats();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed');
    } finally { setUpdatingStatus(null); }
  };

  const handleDelete = async (d: Delivery) => {
    if (!confirm(`Delete ${d.delivery_number}?`)) return;
    try {
      await api.delete(`/deliveries/${d.delivery_id}`);
      toast.success('Deleted');
      fetchDeliveries(); fetchStats();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Cannot delete');
    }
  };

  const openEdit = (d: Delivery) => {
    setEditItem(d);
    setForm({
      customer_id: String(d.customer_id),
      sale_id: d.sale_id ? String(d.sale_id) : '',
      delivery_address: d.delivery_address,
      delivery_city: d.delivery_city,
      delivery_phone: d.delivery_phone,
      rider_name: d.rider_name,
      rider_phone: d.rider_phone,
      delivery_charges: String(d.delivery_charges),
      estimated_delivery: d.estimated_delivery ? d.estimated_delivery.split('T')[0] : '',
      notes: d.notes,
    });
  };

  const handleEditOrder = (d: Delivery) => {
    if (!d.sale_id) return;
    navigate('/pos', { state: { editOrder: { sale_id: d.sale_id, token_no: d.delivery_number } } });
  };

  const openCheckout = async (d: Delivery) => {
    if (!d.sale_id) return;
    setCheckoutDelivery(d);
    setCheckoutSale(null);
    setCheckoutSaleLoading(true);
    try {
      const res = await api.get(`/sales/${d.sale_id}`);
      setCheckoutSale(res.data);
    } catch {
      toast.error('Failed to load order details');
      setCheckoutDelivery(null);
    } finally {
      setCheckoutSaleLoading(false);
    }
  };


  const sortedRunning = [...deliveries].sort((a, b) => RUNNING.indexOf(a.status) - RUNNING.indexOf(b.status));

  return (
    <div className="min-h-screen bg-gray-100">

      {/* ── Sticky Header ─────────────────────────────────────────────────── */}
      <div className="bg-white border-b-2 border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-[1920px] mx-auto px-3 md:px-6 py-3 md:py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-2 md:p-2.5 rounded-xl shadow-lg">
                <Truck size={20} className="text-white md:hidden" />
                <Truck size={26} className="text-white hidden md:block" />
              </div>
              <div>
                <h1 className="text-base md:text-xl font-semibold tracking-tight text-gray-900">Deliveries</h1>
                <p className="text-xs md:text-sm text-gray-500 hidden sm:block">Assign riders · Track shipments · Update status</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/pos')}
                className="flex items-center gap-1.5 px-3 md:px-4 py-1.5 md:py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm"
              >
                <ShoppingCart size={15} /> <span className="hidden sm:inline">New Sale</span>
              </button>
              <button
                onClick={() => { fetchDeliveries(); fetchStats(); }}
                className="flex items-center gap-1.5 px-3 md:px-4 py-1.5 md:py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
              >
                <RefreshCw size={15} /> <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="max-w-[1920px] mx-auto px-3 md:px-6 py-3 md:py-6 space-y-4 md:space-y-6">

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard icon={Clock}       label="Pending"        value={statsLoading ? '—' : stats?.pending ?? 0}         color="bg-gray-400" />
          <StatCard icon={User}        label="Assigned"       value={statsLoading ? '—' : stats?.assigned ?? 0}        color="bg-blue-500" />
          <StatCard icon={Package}     label="Dispatched"     value={statsLoading ? '—' : stats?.dispatched ?? 0}      color="bg-amber-500" />
          <StatCard icon={Navigation}  label="In Transit"     value={statsLoading ? '—' : stats?.in_transit ?? 0}      color="bg-orange-500" />
          <StatCard icon={CheckCircle} label="Delivered Today" value={statsLoading ? '—' : stats?.delivered_today ?? 0} color="bg-emerald-500" />
        </div>

        {/* Search + Date Filter */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="form-input pl-9"
              placeholder="Search delivery #, customer, rider, city..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center bg-white border border-gray-200 rounded-lg p-1 gap-1">
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

        {/* ── Running Orders ───────────────────────────────────────────── */}
        {loading ? (
            <div className="flex items-center justify-center h-[55vh]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-14 w-14 border-4 border-emerald-200 border-t-emerald-600 mx-auto mb-4"></div>
                <p className="text-gray-500 font-medium">Loading deliveries...</p>
              </div>
            </div>
          ) : sortedRunning.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[55vh] text-gray-400">
              <div className="bg-emerald-50 p-8 rounded-full mb-4 border-2 border-emerald-100">
                <CheckCircle size={56} className="text-emerald-300" />
              </div>
              <p className="text-xl font-semibold text-gray-500">All Clear!</p>
              <p className="text-sm text-gray-400 mt-1">No running deliveries right now</p>
              <button
                onClick={() => navigate('/pos')}
                className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors"
              >
                <ShoppingCart size={16} /> Create New Sale
              </button>
            </div>
          ) : (
            <>
              {layout === 'card' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {sortedRunning.map(d => (
                    <RunningCard
                      key={d.delivery_id}
                      delivery={d}
                      onStatusChange={handleStatusChange}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                      onRefresh={fetchDeliveries}
                      onEditOrder={handleEditOrder}
                      onCheckout={openCheckout}
                      updatingStatus={updatingStatus}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Delivery #</th>
                          <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
                          <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Address</th>
                          <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Rider</th>
                          <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                          <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Charges</th>
                          <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {sortedRunning.map(d => {
                          const isUpd = updatingStatus === d.delivery_id;
                          const nextStatuses: { status: Status; label: string; cls: string }[] = [];
                          if (d.status === 'pending' || d.status === 'assigned')
                            nextStatuses.push({ status: 'dispatched', label: 'Dispatch', cls: 'bg-amber-500 hover:bg-amber-600 text-white' });
                          if (d.status === 'dispatched')
                            nextStatuses.push({ status: 'in_transit', label: 'In Transit', cls: 'bg-orange-500 hover:bg-orange-600 text-white' });
                          if (d.status === 'in_transit') {
                            nextStatuses.push({ status: 'delivered', label: 'Delivered', cls: 'bg-emerald-600 hover:bg-emerald-700 text-white' });
                            nextStatuses.push({ status: 'failed', label: 'Failed', cls: 'bg-red-500 hover:bg-red-600 text-white' });
                          }
                          return (
                            <tr key={d.delivery_id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-bold">
                                  <Truck size={11} />{d.delivery_number}
                                </span>
                                {d.sale_id && (
                                  <span className="ml-1 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">#{d.sale_id}</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <p className="text-sm font-semibold text-gray-800">{d.customer_name}</p>
                                {(d.delivery_phone || d.customer_phone) && (
                                  <p className="text-xs text-gray-400 flex items-center gap-1"><Phone size={10} />{d.delivery_phone || d.customer_phone}</p>
                                )}
                              </td>
                              <td className="px-4 py-3 max-w-[180px]">
                                <p className="text-sm text-gray-700 truncate">{d.delivery_address}</p>
                                {d.delivery_city && <p className="text-xs text-gray-400">{d.delivery_city}</p>}
                              </td>
                              <td className="px-4 py-3">
                                {d.rider_name
                                  ? <><p className="text-sm text-gray-700 font-medium">{d.rider_name}</p>{d.rider_phone && <p className="text-xs text-gray-400">{d.rider_phone}</p>}</>
                                  : <span className="text-xs text-gray-400 italic">Unassigned</span>
                                }
                              </td>
                              <td className="px-4 py-3">
                                <StatusBadge status={d.status} />
                              </td>
                              <td className="px-4 py-3 text-right">
                                {Number(d.delivery_charges) > 0
                                  ? <span className="text-sm font-semibold text-gray-700">{cs} {Number(d.delivery_charges).toLocaleString()}</span>
                                  : <span className="text-gray-300 text-sm">—</span>
                                }
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-1 flex-wrap">
                                  {nextStatuses.map(ns => (
                                    <button
                                      key={ns.status}
                                      onClick={() => handleStatusChange(d.delivery_id, ns.status)}
                                      disabled={isUpd}
                                      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 ${ns.cls}`}
                                    >
                                      {isUpd ? <Loader2 size={10} className="animate-spin" /> : <ChevronRight size={10} />}
                                      {ns.label}
                                    </button>
                                  ))}
                                  {d.sale_id && d.sale_status !== 'completed' && (
                                    <button onClick={() => handleEditOrder(d)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Edit Order">
                                      <ShoppingCart size={13} />
                                    </button>
                                  )}
                                  {d.sale_id && d.sale_status === 'pending' && (
                                    <button onClick={() => openCheckout(d)} className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" title="Checkout">
                                      <CreditCard size={13} />
                                    </button>
                                  )}
                                  {d.sale_status !== 'completed' && (
                                    <button onClick={() => openEdit(d)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Edit Delivery">
                                      <Edit2 size={13} />
                                    </button>
                                  )}
                                  {['pending', 'cancelled'].includes(d.status) && (
                                    <button onClick={() => handleDelete(d)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Delete">
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Running summary footer */}
              <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 border-2 border-emerald-200 rounded-xl px-6 py-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-emerald-700 flex items-center gap-2">
                  <Truck size={16} /> Running Deliveries: <strong>{sortedRunning.length}</strong>
                </span>
                <span className="text-sm font-bold text-emerald-800">
                  Total Charges: {cs} {sortedRunning.reduce((s, d) => s + parseFloat(String(d.delivery_charges || 0)), 0).toFixed(0)}
                </span>
              </div>
            </>
          )
        }

      </div>

      {/* ── Edit Drawer ──────────────────────────────────────────────────── */}
      {editItem && (
        <EditDrawer
          delivery={editItem} form={form} setForm={setForm}
          saving={saving} onSave={handleUpdate}
          onClose={() => { setEditItem(null); setForm(emptyForm()); }}
        />
      )}


      <CheckoutModal
        isOpen={!!checkoutDelivery && !checkoutSaleLoading && !!checkoutSale}
        onClose={() => { setCheckoutDelivery(null); setCheckoutSale(null); }}
        onSuccess={() => { fetchDeliveries(); fetchStats(); }}
        pendingSale={checkoutSale}
        deliveryId={checkoutDelivery?.delivery_id}
        deliveryCharges={parseFloat(String(checkoutDelivery?.delivery_charges || 0))}
      />
    </div>
  );
};

export default Deliveries;
