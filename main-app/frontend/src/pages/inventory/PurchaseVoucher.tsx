import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Eye, Trash2, X, Search, ShoppingCart, Printer, Pencil, ChevronDown } from 'lucide-react';
import api from '../../utils/api';
import { printGRN } from '../../utils/printUtils';
import { localToday } from '../../utils/dateUtils';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import DateRangeFilter from '../../components/DateRangeFilter';
import Pagination from '../../components/Pagination';

// ── AccountSelector — searchable Level 4 account picker ──────────────────────
const AccountSelector = ({
  value, onChange, accounts, placeholder = 'Select Account…',
}: {
  value: string; onChange: (id: string) => void; accounts: any[]; placeholder?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [hi, setHi] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const selected = accounts.find(a => String(a.account_id) === String(value));
  const filtered = accounts.filter(a =>
    !search ||
    a.account_name.toLowerCase().includes(search.toLowerCase()) ||
    (a.account_code || '').includes(search)
  );

  useEffect(() => { setHi(0); }, [search]);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (id: string) => { onChange(id); setOpen(false); setSearch(''); setHi(0); };

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-left transition">
        <span className={selected ? 'text-gray-900 font-medium truncate' : 'text-gray-400'}>
          {selected ? `${selected.account_code} — ${selected.account_name}` : placeholder}
        </span>
        <ChevronDown size={13} className="text-gray-400 shrink-0 ml-1" />
      </button>
      {open && (
        <div className="absolute z-50 left-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-xl shadow-2xl">
          <div className="p-2 border-b border-gray-100">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded-lg">
              <Search size={13} className="text-gray-400 shrink-0" />
              <input autoFocus type="text" value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(h + 1, filtered.length - 1)); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
                  else if (e.key === 'Enter') { e.preventDefault(); if (filtered[hi]) select(String(filtered[hi].account_id)); }
                  else if (e.key === 'Escape') setOpen(false);
                }}
                className="bg-transparent text-sm outline-none w-full placeholder-gray-400"
                placeholder="Search by name or code…" />
            </div>
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0
              ? <li className="px-3 py-3 text-sm text-gray-400 text-center">No accounts found</li>
              : filtered.map((a, idx) => (
                <li key={a.account_id}>
                  <button type="button" onClick={() => select(String(a.account_id))}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2 text-sm transition ${idx === hi ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50'}`}>
                    <span className="font-mono text-xs text-gray-400 shrink-0">{a.account_code}</span>
                    <span className="text-gray-800 truncate">{a.account_name}</span>
                  </button>
                </li>
              ))
            }
          </ul>
        </div>
      )}
    </div>
  );
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface PO { po_id: number; po_number: string; supplier_name: string; }
interface Product { product_id: number; product_name: string; barcode?: string; cost_price?: number; }
interface VoucherItem { product_id: number; product_name: string; quantity_received: number; unit_price: number; }

// ── Component ─────────────────────────────────────────────────────────────────
const PurchaseVoucher = () => {
  const [vouchers, setVouchers]   = useState<any[]>([]);
  const [accounts, setAccounts]   = useState<any[]>([]);   // Level 4 accounts
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editingPV, setEditingPV] = useState<any>(null);
  const [viewVoucher, setViewVoucher] = useState<any>(null);
  const [dateFrom, setDateFrom]   = useState(localToday());
  const [dateTo, setDateTo]       = useState(localToday());
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const { error, success } = useToast();
  const confirm = useConfirm();

  // Form state
  const [mode, setMode]             = useState<'po' | 'manual'>('manual');
  const [pos, setPOs]               = useState<PO[]>([]);
  const [selectedPO, setSelectedPO] = useState('');
  const [formDate, setFormDate]     = useState(localToday());
  const [formNotes, setFormNotes]   = useState('');
  const [formShipping, setFormShipping]       = useState<number>(0);
  const [formExtra, setFormExtra]             = useState<number>(0);
  const [formOther, setFormOther]             = useState<number>(0);
  const [formDiscountPct, setFormDiscountPct] = useState<number>(0);
  const [formTaxPct, setFormTaxPct]           = useState<number>(0);
  // Two accounts: DR (purchase) and CR (supplier)
  const [formPurchaseAccountId, setFormPurchaseAccountId] = useState(() => localStorage.getItem('pv_last_purchase_account') || '');
  const [formSupplierAccountId, setFormSupplierAccountId] = useState('');
  const [items, setItems]           = useState<VoucherItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [productSearchHi, setProductSearchHi] = useState(0);
  const [lastAddedProductId, setLastAddedProductId] = useState<number | null>(null);
  const [saving, setSaving]         = useState(false);

  // Refs for keyboard navigation
  const productSearchRef = useRef<HTMLInputElement>(null);
  const itemQtyRefs   = useRef<Record<number, HTMLInputElement>>({});
  const itemPriceRefs = useRef<Record<number, HTMLInputElement>>({});

  // Save last purchase account to localStorage whenever it changes
  useEffect(() => {
    if (formPurchaseAccountId) localStorage.setItem('pv_last_purchase_account', formPurchaseAccountId);
  }, [formPurchaseAccountId]);

  // Reset dropdown highlight when results change
  useEffect(() => { setProductSearchHi(0); }, [productResults]);

  // Focus qty field after new item is added
  useEffect(() => {
    if (lastAddedProductId !== null) {
      const el = itemQtyRefs.current[lastAddedProductId];
      if (el) { el.focus(); el.select(); setLastAddedProductId(null); }
    }
  }, [items, lastAddedProductId]);

  const fetchVouchers = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { from_date: dateFrom, to_date: dateTo, page, limit: 20 };
      const res = await api.get('/purchase-vouchers', { params });
      setVouchers(res.data.data || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
      setTotalItems(res.data.pagination?.total || 0);
    } catch { error('Failed to load'); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo, page]);

  useEffect(() => {
    // Fetch all Level 4 accounts (same as CPV/CRV)
    api.get('/accounting/accounts', { params: { tree: 1 } })
      .then(r => setAccounts((r.data.data || []).filter((a: any) => a.is_active && a.level === 4)));
    api.get('/purchase-orders', { params: { limit: 200 } })
      .then(r => setPOs((r.data.data || []).filter((p: any) => p.status !== 'received' && p.status !== 'cancelled')));
  }, []);
  useEffect(() => { fetchVouchers(); }, [fetchVouchers]);

  const loadPOItems = async (poId: string) => {
    if (!poId) { setItems([]); return; }
    try {
      const res = await api.get(`/purchase-vouchers/po-items/${poId}`);
      setItems((res.data.data || []).map((i: any) => ({
        product_id: i.product_id,
        product_name: i.product_name,
        quantity_received: Number(i.pending_qty) || 1,
        unit_price: Number(i.cost_price) || 0,
      })));
    } catch { error('Failed to load PO items'); }
  };

  const searchProducts = async (q: string) => {
    setProductSearch(q);
    if (q.length < 2) { setProductResults([]); return; }
    const res = await api.get('/products', { params: { search: q, limit: 10 } });
    setProductResults(res.data.data || []);
  };

  const addItem = (p: Product) => {
    if (items.find(i => i.product_id === p.product_id)) return;
    setItems(prev => [...prev, { product_id: p.product_id, product_name: p.product_name, quantity_received: 1, unit_price: Number(p.cost_price || 0) }]);
    setProductSearch(''); setProductResults([]); setProductSearchHi(0);
    setLastAddedProductId(p.product_id);
  };

  const updateItem = (id: number, field: 'quantity_received' | 'unit_price', val: number) =>
    setItems(prev => prev.map(i => i.product_id === id ? { ...i, [field]: val } : i));

  const resetForm = () => {
    setMode('manual'); setSelectedPO('');
    setFormDate(localToday()); setFormNotes('');
    setFormShipping(0); setFormExtra(0); setFormOther(0);
    setFormDiscountPct(0); setFormTaxPct(0);
    setFormPurchaseAccountId(localStorage.getItem('pv_last_purchase_account') || '');
    setFormSupplierAccountId('');
    setItems([]); setProductSearch(''); setProductResults([]); setProductSearchHi(0);
    setLastAddedProductId(null);
    setEditingPV(null);
  };

  const openCreate = () => { resetForm(); setShowForm(true); };

  const openEdit = async (pv: any) => {
    try {
      const res = await api.get(`/purchase-vouchers/${pv.pv_id}`);
      const data = res.data;
      setEditingPV(data);
      setMode('manual'); setSelectedPO('');
      setFormDate(data.voucher_date?.split('T')[0] || localToday());
      setFormNotes(data.notes || '');
      setFormShipping(Number(data.shipping_cost) || 0);
      setFormExtra(Number(data.extra_charges) || 0);
      setFormOther(Number(data.other_charges) || 0);
      setFormDiscountPct(Number(data.discount_percent) || 0);
      setFormTaxPct(Number(data.tax_percent) || 0);
      setFormPurchaseAccountId(data.purchase_account_id ? String(data.purchase_account_id) : '');
      setFormSupplierAccountId(data.payable_account_id ? String(data.payable_account_id) : '');
      setItems((data.items || []).map((i: any) => ({
        product_id: i.product_id,
        product_name: i.product_name,
        quantity_received: Number(i.quantity_received),
        unit_price: Number(i.unit_price),
      })));
      setProductSearch(''); setProductResults([]);
      setShowForm(true);
    } catch { error('Failed to load voucher'); }
  };

  // Totals
  const itemsTotal     = items.reduce((s, i) => s + i.quantity_received * i.unit_price, 0);
  const chargesTotal   = formShipping + formExtra + formOther;
  const subtotal       = itemsTotal + chargesTotal;
  const discountAmount = subtotal * formDiscountPct / 100;
  const taxable        = subtotal - discountAmount;
  const taxAmount      = taxable * formTaxPct / 100;
  const grandTotal     = taxable + taxAmount;

  const handleSubmit = async () => {
    if (!items.length) return error('Add at least one item');
    if (!formPurchaseAccountId) return error('Select a Purchase Account (Debit)');
    if (!formSupplierAccountId) return error('Select a Supplier Account (Credit)');
    setSaving(true);
    try {
      const payload: any = {
        voucher_date: formDate,
        notes: formNotes,
        shipping_cost: formShipping,
        extra_charges: formExtra,
        other_charges: formOther,
        discount_percent: formDiscountPct,
        tax_percent: formTaxPct,
        purchase_account_id: formPurchaseAccountId,
        payable_account_id: formSupplierAccountId,
        items,
      };
      if (!editingPV && mode === 'po' && selectedPO) payload.po_id = selectedPO;

      if (editingPV) {
        await api.put(`/purchase-vouchers/${editingPV.pv_id}`, payload);
        success(`Voucher ${editingPV.pv_number} updated`);
      } else {
        const res = await api.post('/purchase-vouchers', payload);
        success(`Purchase Voucher ${res.data.pv_number} created`);
      }
      setShowForm(false); resetForm(); fetchVouchers();
    } catch (err: any) { error(err.response?.data?.message || 'Error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({ title: 'Delete Voucher', message: 'Delete this voucher? Stock will be reversed.', type: 'danger' });
    if (!ok) return;
    try { await api.delete(`/purchase-vouchers/${id}`); success('Deleted'); fetchVouchers(); }
    catch (err: any) { error(err.response?.data?.message || 'Error'); }
  };

  const openView = async (id: number) => {
    const res = await api.get(`/purchase-vouchers/${id}`);
    setViewVoucher(res.data);
  };

  const handlePrint = async (pv: any) => {
    try {
      const res = await api.get(`/purchase-vouchers/${pv.pv_id}`);
      printGRN(res.data);
    } catch { error('Failed to load for print'); }
  };

  const fmt = (n: any) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const purchaseAccName = (pv: any) => pv.purchase_account_name || '—';
  const supplierAccName = (pv: any) => pv.payable_account_name || '—';
  const fmtDate = (d: string) => {
    if (!d) return '—';
    const dt = new Date(d);
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yyyy = dt.getFullYear();
    const hh = String(dt.getHours()).padStart(2, '0');
    const min = String(dt.getMinutes()).padStart(2, '0');
    const ss = String(dt.getSeconds()).padStart(2, '0');
    return `${dd}-${mm}-${yyyy} ${hh}:${min}:${ss}`;
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <ShoppingCart size={20} className="text-indigo-600" /> Purchase Voucher
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Receive goods and post double-entry journal via Level 4 accounts</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
          <Plus size={18} /> <span className="hidden sm:inline">New Voucher</span>
        </button>
      </div>

      {/* ── Create / Edit Modal ─────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h2 className="font-semibold text-gray-800 text-lg">
                {editingPV ? `Edit Voucher — ${editingPV.pv_number}` : 'New Purchase Voucher'}
              </h2>
              <button onClick={() => { setShowForm(false); resetForm(); }}><X size={20} className="text-gray-400" /></button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-5">

              {/* Mode tabs — new voucher only */}
              {!editingPV && (
                <div className="flex gap-2">
                  <button onClick={() => { setMode('manual'); setSelectedPO(''); setItems([]); }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border ${mode === 'manual' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                    Manual Entry
                  </button>
                  <button onClick={() => setMode('po')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border ${mode === 'po' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                    From Purchase Order
                  </button>
                </div>
              )}

              {!editingPV && mode === 'po' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Purchase Order *</label>
                  <select value={selectedPO} onChange={e => { setSelectedPO(e.target.value); loadPOItems(e.target.value); }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                    <option value="">— Select PO —</option>
                    {pos.map(p => <option key={p.po_id} value={p.po_id}>{p.po_number} — {p.supplier_name}</option>)}
                  </select>
                </div>
              )}

              {/* ── Double-Entry Accounts ─────────────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                <div>
                  <label className="block text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-1.5">
                    Purchase Account <span className="bg-indigo-200 text-indigo-800 px-1.5 py-0.5 rounded text-xs ml-1">DR</span>
                  </label>
                  <AccountSelector
                    value={formPurchaseAccountId}
                    onChange={setFormPurchaseAccountId}
                    accounts={accounts}
                    placeholder="Select Purchase Account…"
                  />
                  <p className="text-xs text-indigo-500 mt-1">e.g. Purchases, Inventory Expense</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-1.5">
                    Supplier Account <span className="bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded text-xs ml-1">CR</span>
                  </label>
                  <AccountSelector
                    value={formSupplierAccountId}
                    onChange={setFormSupplierAccountId}
                    accounts={accounts}
                    placeholder="Select Supplier Account…"
                  />
                  <p className="text-xs text-indigo-500 mt-1">e.g. Accounts Payable, Supplier A</p>
                </div>
              </div>

              {/* Date + Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Voucher Date *</label>
                  <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <input type="text" value={formNotes} onChange={e => setFormNotes(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" placeholder="Optional" />
                </div>
              </div>

              {/* Product Search */}
              {(editingPV || mode === 'manual') && (
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Add Products</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      ref={productSearchRef}
                      type="text" value={productSearch}
                      onChange={e => searchProducts(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'ArrowDown') { e.preventDefault(); setProductSearchHi(h => Math.min(h + 1, productResults.length - 1)); }
                        else if (e.key === 'ArrowUp') { e.preventDefault(); setProductSearchHi(h => Math.max(h - 1, 0)); }
                        else if (e.key === 'Enter' && productResults.length > 0) { e.preventDefault(); addItem(productResults[productSearchHi]); }
                        else if (e.key === 'Escape') { setProductResults([]); setProductSearch(''); }
                      }}
                      placeholder="Search by name or barcode…"
                      className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
                  </div>
                  {productResults.length > 0 && (
                    <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                      {productResults.map((p, idx) => (
                        <button key={p.product_id} onClick={() => addItem(p)}
                          className={`w-full text-left px-4 py-2.5 text-sm border-b last:border-0 ${idx === productSearchHi ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50'}`}>
                          {p.product_name}
                          {p.barcode && <span className="text-gray-400 ml-2 text-xs">{p.barcode}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Items Table */}
              {items.length > 0 && (
                <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase w-28">Qty Received</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase w-32">Unit Price</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase w-32">Total</th>
                      <th className="px-4 py-2.5 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map(item => (
                      <tr key={item.product_id}>
                        <td className="px-4 py-2.5 font-medium text-gray-800">{item.product_name}</td>
                        <td className="px-4 py-2.5">
                          <input type="number" min="0.001" step="0.001" value={item.quantity_received}
                            ref={el => { if (el) itemQtyRefs.current[item.product_id] = el; }}
                            onChange={e => updateItem(item.product_id, 'quantity_received', parseFloat(e.target.value) || 0)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); itemPriceRefs.current[item.product_id]?.focus(); } }}
                            className="w-full text-right border border-gray-200 rounded px-2 py-1 text-sm outline-none" />
                        </td>
                        <td className="px-4 py-2.5">
                          <input type="number" min="0" step="0.01" value={item.unit_price}
                            ref={el => { if (el) itemPriceRefs.current[item.product_id] = el; }}
                            onChange={e => updateItem(item.product_id, 'unit_price', parseFloat(e.target.value) || 0)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); productSearchRef.current?.focus(); } }}
                            className="w-full text-right border border-gray-200 rounded px-2 py-1 text-sm outline-none" />
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium">{fmt(item.quantity_received * item.unit_price)}</td>
                        <td className="px-4 py-2.5">
                          <button onClick={() => setItems(p => p.filter(i => i.product_id !== item.product_id))}
                            className="text-red-500 hover:text-red-700 text-xs">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Charges + Tax/Discount */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Charges, Discount & Tax</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-3">
                  {[
                    { label: 'Shipping Cost', value: formShipping, set: setFormShipping, cls: 'focus:ring-indigo-500 border-gray-300' },
                    { label: 'Extra Charges', value: formExtra,    set: setFormExtra,    cls: 'focus:ring-indigo-500 border-gray-300' },
                    { label: 'Other Charges', value: formOther,    set: setFormOther,    cls: 'focus:ring-indigo-500 border-gray-300' },
                    { label: 'Discount %',    value: formDiscountPct, set: setFormDiscountPct, cls: 'focus:ring-red-400 border-red-200' },
                    { label: 'Tax %',         value: formTaxPct,   set: setFormTaxPct,   cls: 'focus:ring-blue-400 border-blue-200' },
                  ].map(f => (
                    <div key={f.label}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                      <input type="number" min="0" step="0.01" value={f.value}
                        onChange={e => f.set(parseFloat(e.target.value) || 0)}
                        className={`w-full border rounded-lg px-3 py-2 text-sm text-right focus:ring-2 outline-none ${f.cls}`}
                        placeholder="0.00" />
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-200 pt-3 space-y-1 text-sm">
                  <div className="flex justify-end gap-6">
                    <span className="text-gray-600">Items Sub-total: <strong>{fmt(itemsTotal)}</strong></span>
                    {chargesTotal > 0 && <span className="text-gray-600">+ Charges: <strong>{fmt(chargesTotal)}</strong></span>}
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-end">
                      <span className="text-red-600">− Discount ({fmt(formDiscountPct)}%): <strong>{fmt(discountAmount)}</strong></span>
                    </div>
                  )}
                  {taxAmount > 0 && (
                    <div className="flex justify-end">
                      <span className="text-blue-600">+ Tax ({fmt(formTaxPct)}%): <strong>{fmt(taxAmount)}</strong></span>
                    </div>
                  )}
                  <div className="flex justify-end pt-1 border-t border-gray-300">
                    <span className="text-indigo-700 font-bold text-base">Grand Total: {fmt(grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t">
              <button onClick={() => { setShowForm(false); resetForm(); }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">Cancel</button>
              <button onClick={handleSubmit} disabled={saving}
                className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
                {saving ? 'Saving…' : editingPV ? 'Update Voucher' : 'Create Voucher'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── View Modal ──────────────────────────────────────────────── */}
      {viewVoucher && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h2 className="font-semibold text-gray-800">Voucher: {viewVoucher.pv_number}</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => printGRN(viewVoucher)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100">
                  <Printer size={15} /> Print GRN
                </button>
                <button onClick={() => setViewVoucher(null)}><X size={20} className="text-gray-400" /></button>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-sm">
                <div><span className="text-gray-500">Date:</span> <span className="font-medium">{viewVoucher.voucher_date}</span></div>
                <div><span className="text-gray-500">By:</span> <span className="font-medium">{viewVoucher.created_by_name}</span></div>
                {viewVoucher.po_number && (
                  <div className="col-span-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                    <span className="text-blue-600 text-xs font-semibold">Against PO:</span>
                    <span className="ml-2 font-bold text-blue-800">{viewVoucher.po_number}</span>
                  </div>
                )}
              </div>
              {/* Journal Entry summary */}
              <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3">
                  <p className="text-xs font-semibold text-indigo-500 uppercase mb-1">Purchase Account <span className="bg-indigo-200 text-indigo-800 px-1.5 py-0.5 rounded ml-1">DR</span></p>
                  <p className="font-bold text-indigo-900 text-sm">{purchaseAccName(viewVoucher)}</p>
                </div>
                <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
                  <p className="text-xs font-semibold text-amber-500 uppercase mb-1">Supplier Account <span className="bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded ml-1">CR</span></p>
                  <p className="font-bold text-amber-900 text-sm">{supplierAccName(viewVoucher)}</p>
                </div>
              </div>
              <table className="w-full text-sm mb-3">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(viewVoucher.items || []).map((item: any) => (
                    <tr key={item.item_id}>
                      <td className="px-4 py-2">{item.product_name}</td>
                      <td className="px-4 py-2 text-right">{item.quantity_received}</td>
                      <td className="px-4 py-2 text-right">{fmt(item.unit_price)}</td>
                      <td className="px-4 py-2 text-right font-medium">{fmt(Number(item.quantity_received) * Number(item.unit_price))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-gray-200 pt-2 text-sm space-y-1">
                {Number(viewVoucher.shipping_cost) > 0 && <div className="flex justify-between text-gray-600 px-4"><span>Shipping</span><span>{fmt(viewVoucher.shipping_cost)}</span></div>}
                {Number(viewVoucher.extra_charges) > 0 && <div className="flex justify-between text-gray-600 px-4"><span>Extra Charges</span><span>{fmt(viewVoucher.extra_charges)}</span></div>}
                {Number(viewVoucher.other_charges) > 0 && <div className="flex justify-between text-gray-600 px-4"><span>Other Charges</span><span>{fmt(viewVoucher.other_charges)}</span></div>}
                {Number(viewVoucher.discount_amount) > 0 && (
                  <div className="flex justify-between text-red-600 px-4">
                    <span>Discount ({fmt(viewVoucher.discount_percent)}%)</span><span>- {fmt(viewVoucher.discount_amount)}</span>
                  </div>
                )}
                {Number(viewVoucher.tax_amount) > 0 && (
                  <div className="flex justify-between text-blue-600 px-4">
                    <span>Tax ({fmt(viewVoucher.tax_percent)}%)</span><span>{fmt(viewVoucher.tax_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-indigo-700 px-4 pt-1 border-t border-gray-200">
                  <span>Grand Total</span><span>{fmt(viewVoucher.total_amount)}</span>
                </div>
              </div>
              {viewVoucher.notes && <p className="mt-3 text-sm text-gray-500">Notes: {viewVoucher.notes}</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── Filters ─────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} onApply={fetchVouchers} />
      </div>

      {/* ── List ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Voucher #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PO #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Purchase A/C (DR)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier A/C (CR)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Items</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vouchers.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No purchase vouchers found</td></tr>
              ) : vouchers.map(v => (
                <tr key={v.pv_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-indigo-700 font-semibold">{v.pv_number}</td>
                  <td className="px-4 py-3">
                    {v.po_number
                      ? <span className="text-blue-600 font-medium text-xs bg-blue-50 px-2 py-0.5 rounded">{v.po_number}</span>
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-800 text-xs font-semibold">{purchaseAccName(v)}</td>
                  <td className="px-4 py-3 text-gray-800 text-xs font-semibold">{supplierAccName(v)}</td>
                  <td className="px-4 py-3 text-gray-700 text-xs font-semibold whitespace-nowrap">{fmtDate(v.voucher_date)}</td>
                  <td className="px-4 py-3 text-right">{v.item_count}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{fmt(v.total_amount)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openView(v.pv_id)} title="View"
                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"><Eye size={15} /></button>
                      <button onClick={() => handlePrint(v)} title="Print GRN"
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"><Printer size={15} /></button>
                      <button onClick={() => openEdit(v)} title="Edit"
                        className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition"><Pencil size={15} /></button>
                      <button onClick={() => handleDelete(v.pv_id)} title="Delete"
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage}
          totalItems={totalItems} itemsPerPage={20} onItemsPerPageChange={() => {}} />
      </div>
    </div>
  );
};

export default PurchaseVoucher;
