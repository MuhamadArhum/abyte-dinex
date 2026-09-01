import { useState, useEffect, useCallback } from 'react';
import { Plus, Eye, X, ArrowDownToLine, Search, Trash2 } from 'lucide-react';
import api from '../../utils/api';
import { localToday } from '../../utils/dateUtils';
import { useToast } from '../../components/Toast';
import DateRangeFilter from '../../components/DateRangeFilter';
import Pagination from '../../components/Pagination';

interface Section { section_id: number; section_name: string; is_active?: number; }
interface Product { product_id: number; product_name: string; }

const StockReturnIssuance = () => {
  const [returns, setReturns]   = useState<any[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [viewReturn, setViewReturn] = useState<any>(null);
  const [dateFrom, setDateFrom] = useState(localToday());
  const [dateTo, setDateTo]     = useState(localToday());
  const [sectionFilter, setSectionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const { showToast } = useToast();

  // Form
  const [formSection, setFormSection] = useState('');
  const [formDate, setFormDate]       = useState(localToday());
  const [formNotes, setFormNotes]     = useState('');
  const [items, setItems]             = useState<{ product_id: number; product_name: string; quantity: number }[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { from_date: dateFrom, to_date: dateTo, page, limit: 20 };
      if (sectionFilter) params.section_id = sectionFilter;
      const res = await api.get('/issuance/returns', { params });
      setReturns(res.data.data || []);
      setTotalPages(res.data.pagination?.totalPages || 1);
      setTotalItems(res.data.pagination?.total || 0);
    } catch { showToast('error', 'Failed to load'); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo, sectionFilter, page]);

  const fetchSections = () => api.get('/sections').then(r => setSections(r.data.data || []));
  useEffect(() => { fetchSections(); }, []);
  useEffect(() => { fetchReturns(); }, [fetchReturns]);

  const searchProducts = async (q: string) => {
    setProductSearch(q);
    if (q.length < 2) { setProductResults([]); return; }
    const res = await api.get('/products', { params: { search: q, limit: 10 } });
    setProductResults(res.data.data || []);
  };

  const addItem = (p: Product) => {
    if (items.find(i => i.product_id === p.product_id)) return;
    setItems(prev => [...prev, { product_id: p.product_id, product_name: p.product_name, quantity: 1 }]);
    setProductSearch(''); setProductResults([]);
  };

  const handleSubmit = async () => {
    if (!formSection) return showToast('error', 'Select a section');
    if (!items.length) return showToast('error', 'Add at least one item');
    setSaving(true);
    try {
      const res = await api.post('/issuance/returns', {
        section_id: formSection, return_date: formDate, notes: formNotes, items
      });
      showToast('success', `Return ${res.data.return_number} created`);
      setShowForm(false); setItems([]); setFormSection(''); setFormNotes('');
      fetchReturns();
    } catch (err: any) { showToast(err.response?.data?.message || 'Error', 'error'); }
    finally { setSaving(false); }
  };

  const openView = async (id: number) => {
    const res = await api.get(`/issuance/returns/${id}`);
    setViewReturn(res.data);
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2"><ArrowDownToLine size={20} className="text-blue-600" /> Stock Return (Issuance)</h1>
          <p className="text-sm text-gray-500 mt-0.5">Return stock from sections back to warehouse</p>
        </div>
        <button onClick={() => { fetchSections(); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus size={18} /> <span className="hidden sm:inline">New Return</span>
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h2 className="font-semibold text-gray-800">New Stock Return</h2>
              <button onClick={() => setShowForm(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Section *</label>
                  <select value={formSection} onChange={e => setFormSection(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="">-- Select --</option>
                    {sections.filter(s => s.is_active !== 0).map(s => <option key={s.section_id} value={s.section_id}>{s.section_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Return Date *</label>
                  <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <input type="text" value={formNotes} onChange={e => setFormNotes(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none" placeholder="Optional" />
                </div>
              </div>
              <div className="relative mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Add Items</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input type="text" value={productSearch} onChange={e => searchProducts(e.target.value)}
                    placeholder="Search product..." className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm outline-none" />
                </div>
                {productResults.length > 0 && (
                  <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
                    {productResults.map(p => (
                      <button key={p.product_id} onClick={() => addItem(p)} className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm border-b last:border-0">
                        {p.product_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {items.length > 0 && (
                <table className="w-full text-sm border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase w-28">Qty</th>
                      <th className="px-4 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map(item => (
                      <tr key={item.product_id}>
                        <td className="px-4 py-2">{item.product_name}</td>
                        <td className="px-4 py-2">
                          <input type="number" min="0.001" step="0.001" value={item.quantity}
                            onChange={e => setItems(prev => prev.map(i => i.product_id === item.product_id ? { ...i, quantity: parseFloat(e.target.value) || 0 } : i))}
                            className="w-full text-right border border-gray-200 rounded px-2 py-1 text-sm outline-none" />
                        </td>
                        <td className="px-4 py-2">
                          <button onClick={() => setItems(p => p.filter(i => i.product_id !== item.product_id))} className="text-red-500"><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm">Cancel</button>
              <button onClick={handleSubmit} disabled={saving} className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                {saving ? 'Saving...' : 'Create Return'}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewReturn && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h2 className="font-semibold">Return: {viewReturn.return_number}</h2>
              <button onClick={() => setViewReturn(null)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-sm">
                <div><span className="text-gray-500">Section:</span> <span className="font-medium">{viewReturn.section_name}</span></div>
                <div><span className="text-gray-500">Date:</span> <span className="font-medium">{viewReturn.return_date}</span></div>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                  </tr>
                </thead>
                <tbody>{(viewReturn.items || []).map((i: any) => (
                  <tr key={i.item_id} className="border-b">
                    <td className="px-4 py-2">{i.product_name}</td>
                    <td className="px-4 py-2 text-right">{i.quantity}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-3 items-center">
        <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} onApply={fetchReturns} />
        <select value={sectionFilter} onChange={e => { setSectionFilter(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
          <option value="">All Sections</option>
          {sections.map(s => <option key={s.section_id} value={s.section_id}>{s.section_name}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div> : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Return #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Section</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Items</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {returns.length === 0 ? <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">No returns found</td></tr> : returns.map(r => (
                <tr key={r.return_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-blue-700">{r.return_number}</td>
                  <td className="px-4 py-3">{r.section_name}</td>
                  <td className="px-4 py-3 text-gray-600">{r.return_date}</td>
                  <td className="px-4 py-3 text-right">{r.item_count}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => openView(r.return_id)} className="text-blue-600 hover:text-blue-800"><Eye size={15} /></button>
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

export default StockReturnIssuance;
