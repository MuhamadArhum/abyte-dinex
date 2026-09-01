import { useState, useEffect, useCallback } from 'react';
import { ArrowLeftRight, Plus, Search, X, Check, Ban, Clock, CheckCircle, XCircle } from 'lucide-react';
import api from '../../utils/api';
import Pagination from '../../components/Pagination';
import { useConfirm } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';

interface Transfer {
  transfer_id: number;
  from_store_id: number;
  from_store_name: string;
  to_store_id: number;
  to_store_name: string;
  product_id: number;
  product_name: string;
  quantity: number;
  status: 'pending' | 'completed' | 'cancelled';
  notes: string | null;
  created_by_name: string;
  transfer_date: string;
}

interface StoreOption {
  store_id: number;
  store_name: string;
  store_code: string;
}

interface ProductOption {
  product_id: number;
  product_name: string;
  stock_quantity: number;
  available_stock: number;
}

const STATUS_BADGES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
};

const StockTransfers = () => {
  const confirm = useConfirm();
  const { error } = useToast();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [stats, setStats] = useState<{ total: number; by_status: { status: string; count: number }[] }>({ total: 0, by_status: [] });

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [formFrom, setFormFrom] = useState('');
  const [formTo, setFormTo] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const [formQty, setFormQty] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchTransfers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(limit) };
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/stock-transfers', { params });
      setTransfers(res.data.data);
      setTotalPages(res.data.pagination.totalPages);
      setTotalItems(res.data.pagination.total);
    } catch (error) {
      console.error('Failed to fetch transfers', error);
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter]);

  const fetchStats = async () => {
    try {
      const res = await api.get('/stock-transfers/stats');
      setStats(res.data);
    } catch (error) { console.error(error); }
  };

  const fetchStores = async () => {
    try {
      const res = await api.get('/stores');
      setStores(res.data.data || []);
    } catch (error) { console.error(error); }
  };

  useEffect(() => { fetchStats(); fetchStores(); }, []);
  useEffect(() => { fetchTransfers(); }, [fetchTransfers]);

  // Product search
  useEffect(() => {
    if (!showModal) return;
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/products', { params: { search: productSearch, limit: 20 } });
        setProducts(res.data.data || []);
      } catch (error) { console.error(error); }
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch, showModal]);

  const getStatusCount = (status: string) => {
    const found = stats.by_status.find(s => s.status === status);
    return found ? Number(found.count) : 0;
  };

  const handleCreate = async () => {
    if (!formFrom || !formTo) { setFormError('Select source and destination stores'); return; }
    if (formFrom === formTo) { setFormError('Source and destination must be different'); return; }
    if (!selectedProduct) { setFormError('Select a product'); return; }
    if (!formQty || parseInt(formQty) <= 0) { setFormError('Enter valid quantity'); return; }

    setSaving(true);
    setFormError('');
    try {
      await api.post('/stock-transfers', {
        from_store_id: parseInt(formFrom),
        to_store_id: parseInt(formTo),
        product_id: selectedProduct.product_id,
        quantity: parseInt(formQty),
        notes: formNotes || null,
      });
      setShowModal(false);
      resetForm();
      fetchTransfers();
      fetchStats();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to create transfer');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (id: number) => {
    const ok = await confirm({ title: 'Approve Transfer', message: 'Approve this transfer? Stock will be moved between stores.', type: 'warning' });
    if (!ok) return;
    try {
      await api.put(`/stock-transfers/${id}/approve`);
      fetchTransfers();
      fetchStats();
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to approve');
    }
  };

  const handleCancel = async (id: number) => {
    const ok = await confirm({ title: 'Cancel Transfer', message: 'Cancel this transfer?', type: 'danger' });
    if (!ok) return;
    try {
      await api.put(`/stock-transfers/${id}/cancel`);
      fetchTransfers();
      fetchStats();
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to cancel');
    }
  };

  const resetForm = () => {
    setFormFrom('');
    setFormTo('');
    setSelectedProduct(null);
    setProductSearch('');
    setFormQty('');
    setFormNotes('');
    setFormError('');
  };

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 flex items-center gap-3">
            <ArrowLeftRight className="text-emerald-600" size={20} />
            Stock Transfers
          </h1>
          <p className="text-gray-500 mt-1">Transfer stock between store locations</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <Plus size={20} />
          <span className="hidden sm:inline">New Transfer</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 rounded-xl"><ArrowLeftRight size={24} className="text-emerald-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
              <p className="text-sm text-gray-500">Total Transfers</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-50 rounded-xl"><Clock size={24} className="text-yellow-600" /></div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{getStatusCount('pending')}</p>
              <p className="text-sm text-gray-500">Pending</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 rounded-xl"><CheckCircle size={24} className="text-emerald-600" /></div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{getStatusCount('completed')}</p>
              <p className="text-sm text-gray-500">Completed</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-50 rounded-xl"><XCircle size={24} className="text-red-600" /></div>
            <div>
              <p className="text-2xl font-bold text-red-600">{getStatusCount('cancelled')}</p>
              <p className="text-sm text-gray-500">Cancelled</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none min-w-[160px]"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
          </div>
        ) : transfers.length === 0 ? (
          <div className="p-12 text-center">
            <ArrowLeftRight size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No stock transfers found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 font-medium">
                <tr>
                  <th className="p-4">Date</th>
                  <th className="p-4">From</th>
                  <th className="p-4">To</th>
                  <th className="p-4">Product</th>
                  <th className="p-4 text-right">Qty</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">By</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transfers.map((t) => (
                  <tr key={t.transfer_id} className="hover:bg-gray-50">
                    <td className="p-4 whitespace-nowrap text-gray-500">{new Date(t.transfer_date).toLocaleDateString()}</td>
                    <td className="p-4 font-medium text-gray-700">{t.from_store_name}</td>
                    <td className="p-4 font-medium text-gray-700">{t.to_store_name}</td>
                    <td className="p-4 text-gray-800">{t.product_name}</td>
                    <td className="p-4 text-right font-bold text-gray-800">{t.quantity}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGES[t.status]}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="p-4 text-gray-600">{t.created_by_name}</td>
                    <td className="p-4">
                      {t.status === 'pending' && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleApprove(t.transfer_id)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Approve"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => handleCancel(t.transfer_id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Cancel"
                          >
                            <Ban size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {transfers.length > 0 && (
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={totalItems} itemsPerPage={limit} onItemsPerPageChange={(v) => { setLimit(v); setPage(1); }} />
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                <ArrowLeftRight size={22} className="text-emerald-600" />
                New Stock Transfer
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">{formError}</div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">From Store *</label>
                  <select value={formFrom} onChange={(e) => setFormFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none">
                    <option value="">Select Source</option>
                    {stores.map(s => <option key={s.store_id} value={s.store_id}>{s.store_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">To Store *</label>
                  <select value={formTo} onChange={(e) => setFormTo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none">
                    <option value="">Select Destination</option>
                    {stores.filter(s => String(s.store_id) !== formFrom).map(s =>
                      <option key={s.store_id} value={s.store_id}>{s.store_name}</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Product */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product *</label>
                {selectedProduct ? (
                  <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <span className="font-medium text-gray-800">{selectedProduct.product_name}</span>
                    <button onClick={() => setSelectedProduct(null)} className="text-gray-400 hover:text-gray-600">
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input type="text" value={productSearch} onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Search products..." autoFocus
                        className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>
                    {products.length > 0 && (
                      <div className="mt-1 max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                        {products.map(p => (
                          <button key={p.product_id} onClick={() => { setSelectedProduct(p); setProductSearch(''); }}
                            className="w-full flex items-center justify-between p-2.5 hover:bg-gray-50 text-left text-sm">
                            <span className="font-medium">{p.product_name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                <input type="number" min="1" value={formQty} onChange={(e) => setFormQty(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="Enter quantity" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                  placeholder="Optional notes..." />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button onClick={() => setShowModal(false)} className="px-5 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={handleCreate} disabled={saving}
                  className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 font-medium">
                  {saving ? 'Creating...' : 'Create Transfer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockTransfers;
