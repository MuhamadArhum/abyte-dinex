import { useState, useEffect, useCallback } from 'react';
import { Plus, Eye, Trash2, X, Search, RotateCcw } from 'lucide-react';
import api from '../../utils/api';
import { localToday } from '../../utils/dateUtils';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import DateRangeFilter from '../../components/DateRangeFilter';
import Pagination from '../../components/Pagination';

interface Supplier { supplier_id: number; supplier_name: string; }
interface PV { pv_id: number; pv_number: string; supplier_id: number; supplier_name: string; }
interface Product { product_id: number; product_name: string; barcode?: string; }
interface ReturnItem { product_id: number; product_name: string; quantity_returned: number; unit_price: number; }

const PurchaseReturn = () => {
  const [returns, setReturns]     = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [viewReturn, setViewReturn] = useState<any>(null);
  const [dateFrom, setDateFrom]   = useState(localToday());
  const [dateTo, setDateTo]       = useState(localToday());
  const [supplierFilter, setSupplierFilter] = useState('');
  const [page, setPage]           = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const { error, success } = useToast();
  const confirm = useConfirm();

  // Form
  const [mode, setMode]           = useState<'pv' | 'manual'>('manual');
  const [pvs, setPVs]             = useState<PV[]>([]);
  const [selectedPV, setSelectedPV] = useState('');
  const [formSupplier, setFormSupplier] = useState('');
  const [formDate, setFormDate]   = useState(localToday());
  const [formNotes, setFormNotes] = useState('');
  const [items, setItems]         = useState<ReturnItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [saving, setSaving]       = useState(false);

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { from_date: dateFrom, to_date: dateTo, page, limit: 20 };
      if (supplierFilter) params.supplier_id = supplierFilter;
      const res = await api.get('/purchase-returns', { params });
      setReturns(res.data.data || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
      setTotalItems(res.data.pagination?.total || 0);
    } catch { error('Failed to load'); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo, supplierFilter, page]);

  useEffect(() => {
    api.get('/suppliers', { params: { limit: 200 } }).then(r => setSuppliers(r.data.data || []));
    api.get('/purchase-vouchers', { params: { limit: 200 } }).then(r => setPVs(r.data.data || []));
  }, []);
  useEffect(() => { fetchReturns(); }, [fetchReturns]);

  const loadPVItems = async (pvId: string) => {
    if (!pvId) { setItems([]); setFormSupplier(''); return; }
    try {
      const res = await api.get(`/purchase-vouchers/${pvId}`);
      const pv = res.data;
      if (pv.supplier_id) setFormSupplier(String(pv.supplier_id));
      setItems((pv.items || []).map((i: any) => ({
        product_id: i.product_id,
        product_name: i.product_name,
        quantity_returned: Number(i.quantity_received),
        unit_price: Number(i.unit_price),
      })));
    } catch { error('Failed to load PV items'); }
  };

  const searchProducts = async (q: string) => {
    setProductSearch(q);
    if (q.length < 2) { setProductResults([]); return; }
    const res = await api.get('/products', { params: { search: q, limit: 10 } });
    setProductResults(res.data.data || []);
  };

  const addItem = (p: Product) => {
    if (items.find(i => i.product_id === p.product_id)) return;
    setItems(prev => [...prev, { product_id: p.product_id, product_name: p.product_name, quantity_returned: 1, unit_price: 0 }]);
    setProductSearch(''); setProductResults([]);
  };

  const updateItem = (id: number, field: 'quantity_returned' | 'unit_price', val: number) =>
    setItems(prev => prev.map(i => i.product_id === id ? { ...i, [field]: val } : i));

  const resetForm = () => {
    setMode('manual'); setSelectedPV(''); setFormSupplier('');
    setFormDate(localToday()); setFormNotes(''); setItems([]);
    setProductSearch(''); setProductResults([]);
  };

  const handleSubmit = async () => {
    if (!items.length) return error('Add at least one item');
    setSaving(true);
    try {
      const payload: any = {
        supplier_id: formSupplier || null,
        return_date: formDate,
        notes: formNotes,
        items,
      };
      if (mode === 'pv' && selectedPV) payload.pv_id = selectedPV;
      const res = await api.post('/purchase-returns', payload);
      success(`Purchase Return ${res.data.pr_number} created`);
      setShowForm(false); resetForm(); fetchReturns();
    } catch (err: any) { error(err.response?.data?.message || 'Error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({ title: 'Delete Return', message: 'Delete this return? Stock will be restored.', type: 'danger' });
    if (!ok) return;
    try { await api.delete(`/purchase-returns/${id}`); success('Deleted'); fetchReturns(); }
    catch (err: any) { error(err.response?.data?.message || 'Error'); }
  };

  const openView = async (id: number) => {
    const res = await api.get(`/purchase-returns/${id}`);
    setViewReturn(res.data);
  };

  const fmt = (n: any) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <RotateCcw size={20} className="text-rose-600" /> Purchase Return
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Return purchased goods back to supplier</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 text-sm font-medium">
          <Plus size={18} /> <span className="hidden sm:inline">New Return</span>
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h2 className="font-semibold text-gray-800 text-lg">New Purchase Return</h2>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {/* Mode tabs */}
              <div className="flex gap-2 mb-5">
                <button onClick={() => { setMode('manual'); setSelectedPV(''); setItems([]); setFormSupplier(''); }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border ${mode === 'manual' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                  Manual Entry
                </button>
                <button onClick={() => setMode('pv')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border ${mode === 'pv' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                  From Purchase Voucher
                </button>
              </div>

              {mode === 'pv' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Purchase Voucher *</label>
                  <select value={selectedPV} onChange={e => { setSelectedPV(e.target.value); loadPVItems(e.target.value); }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 outline-none">
                    <option value="">-- Select PV --</option>
                    {pvs.map(p => <option key={p.pv_id} value={p.pv_id}>{p.pv_number} — {p.supplier_name || 'No Supplier'}</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                  <select value={formSupplier} onChange={e => setFormSupplier(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 outline-none">
                    <option value="">-- Select Supplier --</option>
                    {suppliers.map(s => <option key={s.supplier_id} value={s.supplier_id}>{s.supplier_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Return Date *</label>
                  <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <input type="text" value={formNotes} onChange={e => setFormNotes(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" placeholder="Optional" />
                </div>
              </div>

              {mode === 'manual' && (
                <div className="relative mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Add Products</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input type="text" value={productSearch} onChange={e => searchProducts(e.target.value)}
                      placeholder="Search by name or barcode..."
                      className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-rose-500 outline-none" />
                  </div>
                  {productResults.length > 0 && (
                    <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                      {productResults.map(p => (
                        <button key={p.product_id} onClick={() => addItem(p)}
                          className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm border-b last:border-0">
                          {p.product_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {items.length > 0 && (
                <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase w-28">Qty Returned</th>
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
                          <input type="number" min="0.001" step="0.001" value={item.quantity_returned}
                            onChange={e => updateItem(item.product_id, 'quantity_returned', parseFloat(e.target.value) || 0)}
                            className="w-full text-right border border-gray-200 rounded px-2 py-1 text-sm outline-none" />
                        </td>
                        <td className="px-4 py-2.5">
                          <input type="number" min="0" step="0.01" value={item.unit_price}
                            onChange={e => updateItem(item.product_id, 'unit_price', parseFloat(e.target.value) || 0)}
                            className="w-full text-right border border-gray-200 rounded px-2 py-1 text-sm outline-none" />
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium">{fmt(item.quantity_returned * item.unit_price)}</td>
                        <td className="px-4 py-2.5">
                          <button onClick={() => setItems(p => p.filter(i => i.product_id !== item.product_id))}
                            className="text-red-500 hover:text-red-700 text-xs">✕</button>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-semibold">
                      <td colSpan={3} className="px-4 py-2.5 text-right text-gray-700">Grand Total</td>
                      <td className="px-4 py-2.5 text-right text-rose-700">
                        {fmt(items.reduce((s, i) => s + i.quantity_returned * i.unit_price, 0))}
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">Cancel</button>
              <button onClick={handleSubmit} disabled={saving}
                className="px-5 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 disabled:opacity-60">
                {saving ? 'Saving...' : 'Create Return'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewReturn && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h2 className="font-semibold text-gray-800">Return: {viewReturn.pr_number}</h2>
              <button onClick={() => setViewReturn(null)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-sm">
                <div><span className="text-gray-500">Supplier:</span> <span className="font-medium">{viewReturn.supplier_name || '—'}</span></div>
                <div><span className="text-gray-500">Date:</span> <span className="font-medium">{viewReturn.return_date}</span></div>
                {viewReturn.pv_number && <div><span className="text-gray-500">PV:</span> <span className="font-medium">{viewReturn.pv_number}</span></div>}
                <div><span className="text-gray-500">By:</span> <span className="font-medium">{viewReturn.created_by_name}</span></div>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(viewReturn.items || []).map((item: any) => (
                    <tr key={item.item_id}>
                      <td className="px-4 py-2">{item.product_name}</td>
                      <td className="px-4 py-2 text-right">{item.quantity_returned}</td>
                      <td className="px-4 py-2 text-right">{fmt(item.unit_price)}</td>
                      <td className="px-4 py-2 text-right font-medium">{fmt(Number(item.quantity_returned) * Number(item.unit_price))}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold">
                    <td colSpan={3} className="px-4 py-2 text-right">Total</td>
                    <td className="px-4 py-2 text-right text-rose-700">{fmt(viewReturn.total_amount)}</td>
                  </tr>
                </tbody>
              </table>
              {viewReturn.notes && <p className="mt-3 text-sm text-gray-500">Notes: {viewReturn.notes}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} onApply={fetchReturns} />
        <select value={supplierFilter} onChange={e => { setSupplierFilter(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
          <option value="">All Suppliers</option>
          {suppliers.map(s => <option key={s.supplier_id} value={s.supplier_id}>{s.supplier_name}</option>)}
        </select>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600" /></div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Return #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PV #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Items</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">By</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {returns.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No purchase returns found</td></tr>
              ) : returns.map(r => (
                <tr key={r.pr_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-rose-700">{r.pr_number}</td>
                  <td className="px-4 py-3 text-gray-500">{r.pv_number || '—'}</td>
                  <td className="px-4 py-3 text-gray-800">{r.supplier_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{r.return_date}</td>
                  <td className="px-4 py-3 text-right">{r.item_count}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{fmt(r.total_amount)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{r.created_by_name}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openView(r.pr_id)} className="text-rose-600 hover:text-rose-800"><Eye size={15} /></button>
                      <button onClick={() => handleDelete(r.pr_id)} className="text-red-500 hover:text-red-700"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={totalItems} itemsPerPage={20} onItemsPerPageChange={() => {}} />
      </div>
    </div>
  );
};

export default PurchaseReturn;
