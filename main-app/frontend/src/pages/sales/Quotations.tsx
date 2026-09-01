import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { FileText, Plus, Search, X, Send, Check, XCircle, ShoppingCart, Trash2, Eye, Printer, Pencil } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import Pagination from '../../components/Pagination';
import QuotationPrintModal from '../../components/QuotationPrintModal';

interface Quotation {
  quotation_id: number;
  quotation_number: string;
  customer_id?: number;
  customer_name: string;
  total_amount: number;
  status: string;
  valid_until: string;
  created_at: string;
  items?: any[];
  subtotal?: number;
  tax_amount?: number;
  discount?: number;
  notes?: string;
  phone_number?: string;
  email?: string;
}

const STATUS_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: 'Draft', bg: 'bg-gray-100', text: 'text-gray-700' },
  sent: { label: 'Sent', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  accepted: { label: 'Accepted', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  rejected: { label: 'Rejected', bg: 'bg-red-100', text: 'text-red-700' },
  expired: { label: 'Expired', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  converted: { label: 'Converted', bg: 'bg-emerald-100', text: 'text-emerald-700' },
};

const Quotations = () => {
  const { currencySymbol: currency } = useSettings();
  const toast = useToast();
  const confirm = useConfirm();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [stats, setStats] = useState({ total: 0, draft: 0, active: 0, converted: 0 });
  const [showModal, setShowModal] = useState(false);
  const [detailQt, setDetailQt] = useState<Quotation | null>(null);
  const [printQuotationId, setPrintQuotationId] = useState<number | null>(null);

  // Create form
  const [customers, setCustomers] = useState<any[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [formCustomer, setFormCustomer] = useState('');
  const [formItems, setFormItems] = useState<{ product_id: number; product_name: string; quantity: number; unit_price: number }[]>([]);
  const [formTax, setFormTax] = useState('0');
  const [formDiscount, setFormDiscount] = useState('0');
  const [formValidUntil, setFormValidUntil] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Edit form
  const [editingQt, setEditingQt] = useState<Quotation | null>(null);
  const [editFormCustomer, setEditFormCustomer] = useState('');
  const [editFormItems, setEditFormItems] = useState<{ product_id: number; product_name: string; quantity: number; unit_price: number }[]>([]);
  const [editFormTax, setEditFormTax] = useState('0');
  const [editFormDiscount, setEditFormDiscount] = useState('0');
  const [editFormValidUntil, setEditFormValidUntil] = useState('');
  const [editFormNotes, setEditFormNotes] = useState('');
  const [editProductSearch, setEditProductSearch] = useState('');

  const fetchQuotations = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await api.get('/quotations', { params });
      setQuotations(res.data.data);
      setTotalItems(res.data.pagination.total);
      setTotalPages(res.data.pagination.totalPages);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [page, limit, search, statusFilter, dateFrom, dateTo]);

  const fetchStats = async () => {
    try { const res = await api.get('/quotations/stats'); setStats(res.data); } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchStats(); }, []);
  useEffect(() => { fetchQuotations(); }, [fetchQuotations]);

  const openCreate = async () => {
    try {
      const [cRes, pRes] = await Promise.all([api.get('/customers?limit=100'), api.get('/products?limit=200')]);
      setCustomers(cRes.data.data || []);
      setAllProducts(pRes.data.data || []);
    } catch (err) { console.error(err); }
    setFormCustomer(''); setFormItems([]); setFormTax('0'); setFormDiscount('0'); setFormValidUntil(''); setFormNotes('');
    setShowModal(true);
  };

  const addProduct = (p: any) => {
    if (formItems.find(i => i.product_id === p.product_id)) return;
    setFormItems([...formItems, { product_id: p.product_id, product_name: p.product_name, quantity: 1, unit_price: parseFloat(p.price) }]);
    setProductSearch('');
  };

  const updateItem = (idx: number, field: string, value: number) => {
    const updated = [...formItems];
    (updated[idx] as any)[field] = value;
    setFormItems(updated);
  };

  const handleCreate = async () => {
    if (!formCustomer || formItems.length === 0) { toast.error('Select a customer and add items'); return; }
    try {
      await api.post('/quotations', {
        customer_id: parseInt(formCustomer),
        items: formItems.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price })),
        tax_amount: parseFloat(formTax) || 0, discount: parseFloat(formDiscount) || 0,
        valid_until: formValidUntil || null, notes: formNotes || null,
      });
      setShowModal(false); fetchQuotations(); fetchStats();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleStatusChange = async (id: number, status: string) => {
    try { await api.put(`/quotations/${id}/status`, { status }); fetchQuotations(); fetchStats(); }
    catch (err: any) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleConvert = async (id: number) => {
    const ok = await confirm({ title: 'Convert Quotation', message: 'Convert this quotation to a sale? Stock will be deducted.', type: 'warning' });
    if (!ok) return;
    try { await api.post(`/quotations/${id}/convert`); fetchQuotations(); fetchStats(); }
    catch (err: any) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({ title: 'Delete Quotation', message: 'Delete this draft quotation?', type: 'danger' });
    if (!ok) return;
    try { await api.delete(`/quotations/${id}`); fetchQuotations(); fetchStats(); }
    catch (err: any) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const openEdit = async (qt: Quotation) => {
    try {
      const [detailRes, cRes, pRes] = await Promise.all([
        api.get(`/quotations/${qt.quotation_id}`),
        api.get('/customers?limit=100'),
        api.get('/products?limit=200'),
      ]);
      const detail = detailRes.data;
      setCustomers(cRes.data.data || []);
      setAllProducts(pRes.data.data || []);
      setEditingQt(detail);
      setEditFormCustomer(detail.customer_id?.toString() || '');
      setEditFormItems((detail.items || []).map((i: any) => ({
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: Number(i.quantity),
        unit_price: Number(i.unit_price),
      })));
      setEditFormTax(detail.tax_amount?.toString() || '0');
      setEditFormDiscount(detail.discount?.toString() || '0');
      setEditFormValidUntil(detail.valid_until ? new Date(detail.valid_until).toISOString().split('T')[0] : '');
      setEditFormNotes(detail.notes || '');
      setEditProductSearch('');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load quotation: ' + (err.message || 'Unknown error'));
    }
  };

  const addEditProduct = (p: any) => {
    if (editFormItems.find(i => i.product_id === p.product_id)) return;
    setEditFormItems([...editFormItems, { product_id: p.product_id, product_name: p.product_name, quantity: 1, unit_price: parseFloat(p.price) }]);
    setEditProductSearch('');
  };

  const updateEditItem = (idx: number, field: string, value: number) => {
    const updated = [...editFormItems];
    (updated[idx] as any)[field] = value;
    setEditFormItems(updated);
  };

  const handleUpdate = async () => {
    if (!editingQt || editFormItems.length === 0) { toast.error('Add at least one item'); return; }
    try {
      await api.put(`/quotations/${editingQt.quotation_id}`, {
        customer_id: parseInt(editFormCustomer) || 1,
        items: editFormItems.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price })),
        tax_amount: parseFloat(editFormTax) || 0,
        discount: parseFloat(editFormDiscount) || 0,
        valid_until: editFormValidUntil || null,
        notes: editFormNotes || null,
      });
      setEditingQt(null);
      fetchQuotations();
      fetchStats();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Failed to update'); }
  };

  const viewDetail = async (id: number) => {
    try { const res = await api.get(`/quotations/${id}`); setDetailQt(res.data); } catch (err) { console.error(err); }
  };

  const subtotal = formItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const filteredProducts = allProducts.filter(p => p.product_name.toLowerCase().includes(productSearch.toLowerCase()));

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 flex items-center gap-3"><FileText className="text-emerald-600" size={20} /> Quotations</h1>
          <p className="text-gray-500 mt-1">Create and manage price quotations</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors"><Plus size={20} /> New Quotation</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: stats.total, bg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
          { label: 'Draft', value: stats.draft, bg: 'bg-gray-50', iconColor: 'text-gray-600' },
          { label: 'Sent/Accepted', value: stats.active, bg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
          { label: 'Converted', value: stats.converted, bg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-3">
              <div className={`p-3 ${s.bg} rounded-xl`}><FileText size={24} className={s.iconColor} /></div>
              <div><p className="text-2xl font-bold text-gray-800">{s.value}</p><p className="text-sm text-gray-500">{s.label}</p></div>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Search by QT# or customer..." className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
            <option value="">All Status</option>
            <option value="draft">Draft</option><option value="sent">Sent</option><option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option><option value="converted">Converted</option>
          </select>
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" title="Start Date" />
          <span className="text-gray-400 text-sm">to</span>
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" title="End Date" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">QT #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valid Until</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {quotations.map((q) => {
                  const badge = STATUS_BADGES[q.status] || STATUS_BADGES.draft;
                  return (
                    <tr key={q.quotation_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono font-medium text-emerald-700">{q.quotation_number}</td>
                      <td className="px-4 py-3 text-gray-700">{q.customer_name}</td>
                      <td className="px-4 py-3 text-right font-semibold">{currency}{Number(q.total_amount).toFixed(0)}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>{badge.label}</span></td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{q.valid_until ? new Date(q.valid_until).toLocaleDateString() : '-'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{new Date(q.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => viewDetail(q.quotation_id)} className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg" title="View"><Eye size={16} /></button>
                          <button onClick={() => setPrintQuotationId(q.quotation_id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg" title="Print"><Printer size={16} /></button>
                          {(q.status === 'draft' || q.status === 'sent') && <button onClick={() => openEdit(q)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Edit"><Pencil size={16} /></button>}
                          {q.status === 'draft' && <button onClick={() => handleStatusChange(q.quotation_id, 'sent')} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg" title="Send"><Send size={16} /></button>}
                          {q.status === 'sent' && <>
                            <button onClick={() => handleStatusChange(q.quotation_id, 'accepted')} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg" title="Accept"><Check size={16} /></button>
                            <button onClick={() => handleStatusChange(q.quotation_id, 'rejected')} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="Reject"><XCircle size={16} /></button>
                          </>}
                          {q.status === 'accepted' && <button onClick={() => handleConvert(q.quotation_id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg" title="Convert to Sale"><ShoppingCart size={16} /></button>}
                          {q.status === 'draft' && <button onClick={() => handleDelete(q.quotation_id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 size={16} /></button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {quotations.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400"><FileText size={40} className="mx-auto mb-3 text-gray-300" /><p>No quotations found</p></td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={totalItems} itemsPerPage={limit} onItemsPerPageChange={(v) => { setLimit(v); setPage(1); }} />
      </div>

      {/* Detail Modal */}
      {detailQt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <div><h2 className="text-base font-semibold">{detailQt.quotation_number}</h2><p className="text-sm text-gray-500">{detailQt.customer_name}</p></div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setDetailQt(null); setPrintQuotationId(detailQt.quotation_id); }} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"><Printer size={16} /> Print</button>
                <button onClick={() => setDetailQt(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
              </div>
            </div>
            <div className="p-6">
              <table className="w-full text-sm mb-4">
                <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">Product</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Price</th><th className="px-3 py-2 text-right">Total</th></tr></thead>
                <tbody className="divide-y">
                  {(detailQt.items || []).map((item: any, idx: number) => (
                    <tr key={idx}><td className="px-3 py-2">{item.product_name}</td><td className="px-3 py-2 text-right">{item.quantity}</td><td className="px-3 py-2 text-right">{currency}{Number(item.unit_price).toFixed(0)}</td><td className="px-3 py-2 text-right">{currency}{Number(item.total_price).toFixed(0)}</td></tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t pt-3 space-y-1 text-sm text-right">
                <p>Subtotal: <span className="font-medium">{currency}{Number(detailQt.subtotal || 0).toFixed(0)}</span></p>
                {Number(detailQt.tax_amount) > 0 && <p>Tax: <span className="font-medium">{currency}{Number(detailQt.tax_amount).toFixed(0)}</span></p>}
                {Number(detailQt.discount) > 0 && <p>Discount: <span className="font-medium text-red-600">-${Number(detailQt.discount).toFixed(0)}</span></p>}
                <p className="text-lg font-bold">Total: ${Number(detailQt.total_amount).toFixed(0)}</p>
              </div>
              {detailQt.notes && <p className="mt-4 text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">{detailQt.notes}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-base font-semibold">New Quotation</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                  <select value={formCustomer} onChange={(e) => setFormCustomer(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none">
                    <option value="">Select Customer</option>
                    {customers.map((c: any) => <option key={c.customer_id} value={c.customer_id}>{c.customer_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until</label>
                  <input type="date" value={formValidUntil} onChange={(e) => setFormValidUntil(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Add Products</label>
                <input type="text" placeholder="Search products..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
                {productSearch && (
                  <div className="border rounded-lg mt-1 max-h-32 overflow-y-auto bg-white shadow-lg">
                    {filteredProducts.slice(0, 10).map((p: any) => (
                      <button key={p.product_id} onClick={() => addProduct(p)} className="w-full text-left px-3 py-2 hover:bg-emerald-50 text-sm flex justify-between"><span>{p.product_name}</span><span className="text-gray-400">{currency}{Number(p.price).toFixed(0)}</span></button>
                    ))}
                  </div>
                )}
              </div>
              {formItems.length > 0 && (
                <table className="w-full text-sm border rounded-lg overflow-hidden">
                  <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">Product</th><th className="px-3 py-2 text-right w-24">Qty</th><th className="px-3 py-2 text-right w-32">Price</th><th className="px-3 py-2 text-right w-28">Total</th><th className="px-3 py-2 w-10"></th></tr></thead>
                  <tbody className="divide-y">
                    {formItems.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2">{item.product_name}</td>
                        <td className="px-3 py-2"><input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)} className="w-full px-2 py-1 border rounded text-right" /></td>
                        <td className="px-3 py-2"><input type="number" min="0" step="0.01" value={item.unit_price} onChange={(e) => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1 border rounded text-right" /></td>
                        <td className="px-3 py-2 text-right font-medium">{currency}{(item.quantity * item.unit_price).toFixed(0)}</td>
                        <td className="px-3 py-2"><button onClick={() => setFormItems(formItems.filter((_, i) => i !== idx))} className="text-red-500 hover:bg-red-50 rounded p-1"><Trash2 size={14} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Tax Amount</label><input type="number" min="0" step="0.01" value={formTax} onChange={(e) => setFormTax(e.target.value)} className="w-full px-3 py-2 border rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Discount</label><input type="number" min="0" step="0.01" value={formDiscount} onChange={(e) => setFormDiscount(e.target.value)} className="w-full px-3 py-2 border rounded-lg" /></div>
                <div className="flex items-end"><div className="w-full bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-center"><p className="text-xs text-emerald-600">Total</p><p className="text-lg font-bold text-emerald-800">{currency}{(subtotal + (parseFloat(formTax) || 0) - (parseFloat(formDiscount) || 0)).toFixed(0)}</p></div></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Notes</label><textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={2} className="w-full px-3 py-2 border rounded-lg" placeholder="Optional notes" /></div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleCreate} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Create Quotation</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingQt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-base font-semibold flex items-center gap-2"><Pencil size={16} className="text-indigo-600" /> Edit Quotation</h2>
                <p className="text-sm text-gray-500 font-mono">{editingQt.quotation_number}</p>
              </div>
              <button onClick={() => setEditingQt(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                  <select value={editFormCustomer} onChange={(e) => setEditFormCustomer(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                    <option value="">Select Customer</option>
                    {customers.map((c: any) => <option key={c.customer_id} value={c.customer_id}>{c.customer_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until</label>
                  <input type="date" value={editFormValidUntil} onChange={(e) => setEditFormValidUntil(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Add Products</label>
                <input type="text" placeholder="Search products..." value={editProductSearch} onChange={(e) => setEditProductSearch(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                {editProductSearch && (
                  <div className="border rounded-lg mt-1 max-h-32 overflow-y-auto bg-white shadow-lg">
                    {allProducts.filter(p => p.product_name.toLowerCase().includes(editProductSearch.toLowerCase())).slice(0, 10).map((p: any) => (
                      <button key={p.product_id} onClick={() => addEditProduct(p)} className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-sm flex justify-between"><span>{p.product_name}</span><span className="text-gray-400">Rs. {Number(p.price).toFixed(0)}</span></button>
                    ))}
                  </div>
                )}
              </div>
              {editFormItems.length > 0 && (
                <table className="w-full text-sm border rounded-lg overflow-hidden">
                  <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">Product</th><th className="px-3 py-2 text-right w-24">Qty</th><th className="px-3 py-2 text-right w-32">Price</th><th className="px-3 py-2 text-right w-28">Total</th><th className="px-3 py-2 w-10"></th></tr></thead>
                  <tbody className="divide-y">
                    {editFormItems.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-3 py-2">{item.product_name}</td>
                        <td className="px-3 py-2"><input type="number" min="1" value={item.quantity} onChange={(e) => updateEditItem(idx, 'quantity', parseInt(e.target.value) || 1)} className="w-full px-2 py-1 border rounded text-right" /></td>
                        <td className="px-3 py-2"><input type="number" min="0" step="0.01" value={item.unit_price} onChange={(e) => updateEditItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} className="w-full px-2 py-1 border rounded text-right" /></td>
                        <td className="px-3 py-2 text-right font-medium">Rs. {(item.quantity * item.unit_price).toFixed(0)}</td>
                        <td className="px-3 py-2"><button onClick={() => setEditFormItems(editFormItems.filter((_, i) => i !== idx))} className="text-red-500 hover:bg-red-50 rounded p-1"><Trash2 size={14} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Tax Amount</label><input type="number" min="0" step="0.01" value={editFormTax} onChange={(e) => setEditFormTax(e.target.value)} className="w-full px-3 py-2 border rounded-lg" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Discount</label><input type="number" min="0" step="0.01" value={editFormDiscount} onChange={(e) => setEditFormDiscount(e.target.value)} className="w-full px-3 py-2 border rounded-lg" /></div>
                <div className="flex items-end">
                  <div className="w-full bg-indigo-50 border border-indigo-200 rounded-lg p-2 text-center">
                    <p className="text-xs text-indigo-600">Total</p>
                    <p className="text-lg font-bold text-indigo-800">Rs. {(editFormItems.reduce((s, i) => s + i.quantity * i.unit_price, 0) + (parseFloat(editFormTax) || 0) - (parseFloat(editFormDiscount) || 0)).toFixed(0)}</p>
                  </div>
                </div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Notes</label><textarea value={editFormNotes} onChange={(e) => setEditFormNotes(e.target.value)} rows={2} className="w-full px-3 py-2 border rounded-lg" placeholder="Optional notes" /></div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <button onClick={() => setEditingQt(null)} className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleUpdate} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"><Pencil size={15} /> Update Quotation</button>
            </div>
          </div>
        </div>
      )}

      {/* Quotation Print Modal */}
      {printQuotationId && (
        <QuotationPrintModal quotationId={printQuotationId} onClose={() => setPrintQuotationId(null)} />
      )}
    </div>
  );
};

export default Quotations;
