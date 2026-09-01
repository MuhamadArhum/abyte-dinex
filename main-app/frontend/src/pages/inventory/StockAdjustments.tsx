import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Plus, Search, X, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import DateRangeFilter from '../../components/DateRangeFilter';
import api from '../../utils/api';
import Pagination from '../../components/Pagination';
import { localToday } from '../../utils/dateUtils';
import ReportPasswordGate from '../../components/ReportPasswordGate';

interface Adjustment {
  adjustment_id: number;
  product_id: number;
  product_name: string;
  barcode: string;
  adjustment_type: string;
  quantity_before: number;
  quantity_adjusted: number;
  quantity_after: number;
  reason: string | null;
  reference_number: string;
  created_by_name: string;
  created_at: string;
}

interface ProductOption {
  product_id: number;
  product_name: string;
  stock_quantity: number;
  available_stock: number;
  barcode: string;
}

const TYPE_BADGES: Record<string, string> = {
  addition: 'bg-emerald-100 text-emerald-700',
  subtraction: 'bg-red-100 text-red-700',
  correction: 'bg-emerald-100 text-emerald-700',
  damage: 'bg-orange-100 text-orange-700',
  theft: 'bg-red-100 text-red-800',
  return: 'bg-emerald-100 text-emerald-700',
  opening_stock: 'bg-gray-100 text-gray-700',
  expired: 'bg-yellow-100 text-yellow-700',
};

const StockAdjustments = () => {
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState(localToday);
  const [dateTo, setDateTo] = useState(localToday);
  const [types, setTypes] = useState<string[]>([]);

  // Stats
  const [stats, setStats] = useState<{ total: number; by_type: { adjustment_type: string; count: number; total_qty: number }[] }>({ total: 0, by_type: [] });

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const [formType, setFormType] = useState('');
  const [formQty, setFormQty] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formRef, setFormRef] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchAdjustments = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(limit) };
      if (search) params.search = search;
      if (typeFilter) params.type = typeFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const res = await api.get('/stock-adjustments', { params });
      setAdjustments(res.data.data);
      setTotalPages(res.data.pagination.totalPages);
      setTotalItems(res.data.pagination.total);
    } catch (error) {
      console.error('Failed to fetch adjustments', error);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, typeFilter, dateFrom, dateTo]);

  const fetchTypes = async () => {
    try {
      const res = await api.get('/stock-adjustments/types');
      setTypes(res.data);
    } catch (error) {
      console.error('Failed to fetch types', error);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get('/stock-adjustments/stats');
      setStats(res.data);
    } catch (error) {
      console.error('Failed to fetch stats', error);
    }
  };

  useEffect(() => {
    fetchTypes();
    fetchStats();
  }, []);

  useEffect(() => {
    fetchAdjustments();
  }, [fetchAdjustments]);

  // Product search for modal
  useEffect(() => {
    if (!showModal) return;
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/products', { params: { search: productSearch, limit: 20 } });
        setProducts(res.data.data || []);
      } catch (error) {
        console.error(error);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch, showModal]);

  const getStatCount = (type: string) => {
    const found = stats.by_type.find(s => s.adjustment_type === type);
    return found ? Number(found.count) : 0;
  };

  const additionsCount = getStatCount('addition') + getStatCount('return') + getStatCount('opening_stock');
  const subtractionsCount = getStatCount('subtraction') + getStatCount('damage') + getStatCount('theft') + getStatCount('expired');

  const calculateAfter = () => {
    if (!selectedProduct || !formQty || !formType) return null;
    const qty = parseInt(formQty);
    if (isNaN(qty) || qty <= 0) return null;
    const before = selectedProduct.stock_quantity ?? selectedProduct.available_stock ?? 0;
    if (formType === 'correction') return qty;
    if (['subtraction', 'damage', 'theft', 'expired'].includes(formType)) return before - qty;
    return before + qty;
  };

  const handleCreate = async () => {
    if (!selectedProduct) { setFormError('Select a product'); return; }
    if (!formType) { setFormError('Select adjustment type'); return; }
    if (!formQty || parseInt(formQty) <= 0) { setFormError('Enter valid quantity'); return; }

    const afterQty = calculateAfter();
    if (afterQty !== null && afterQty < 0) { setFormError('Insufficient stock for this adjustment'); return; }

    setSaving(true);
    setFormError('');
    try {
      await api.post('/stock-adjustments', {
        product_id: selectedProduct.product_id,
        adjustment_type: formType,
        quantity_adjusted: parseInt(formQty),
        reason: formReason || null,
        reference_number: formRef || null,
      });
      setShowModal(false);
      resetForm();
      fetchAdjustments();
      fetchStats();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to create adjustment');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setSelectedProduct(null);
    setProductSearch('');
    setFormType('');
    setFormQty('');
    setFormReason('');
    setFormRef('');
    setFormError('');
  };

  const afterQty = calculateAfter();

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 flex items-center gap-3">
            <ClipboardList className="text-emerald-600" size={20} />
            Stock Adjustments
          </h1>
          <p className="text-gray-500 mt-1">Track stock corrections, damages, and inventory changes</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowModal(true); }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <Plus size={20} />
          <span className="hidden sm:inline">New Adjustment</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 rounded-xl">
              <ClipboardList size={24} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
              <p className="text-sm text-gray-500">This Month</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 rounded-xl">
              <TrendingUp size={24} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{additionsCount}</p>
              <p className="text-sm text-gray-500">Additions</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-50 rounded-xl">
              <TrendingDown size={24} className="text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{subtractionsCount}</p>
              <p className="text-sm text-gray-500">Subtractions</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-50 rounded-xl">
              <AlertTriangle size={24} className="text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600">{getStatCount('damage') + getStatCount('theft')}</p>
              <p className="text-sm text-gray-500">Damage/Theft</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search product, reference, reason..."
              className="w-full pl-10 pr-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
        </div>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none min-w-[160px]"
        >
          <option value="">All Types</option>
          {types.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ').toUpperCase()}</option>)}
        </select>
        <DateRangeFilter
          standalone={false}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onFromChange={(d) => { setDateFrom(d); setPage(1); }}
          onToChange={(d) => { setDateTo(d); setPage(1); }}
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
          </div>
        ) : adjustments.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">No stock adjustments found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 font-medium">
                <tr>
                  <th className="p-4">Date</th>
                  <th className="p-4">Reference</th>
                  <th className="p-4">Product</th>
                  <th className="p-4">Type</th>
                  <th className="p-4 text-right">Before</th>
                  <th className="p-4 text-right">Adjusted</th>
                  <th className="p-4 text-right">After</th>
                  <th className="p-4">Reason</th>
                  <th className="p-4">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {adjustments.map((adj) => (
                  <tr key={adj.adjustment_id} className="hover:bg-gray-50">
                    <td className="p-4 whitespace-nowrap text-gray-500">
                      {new Date(adj.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4 font-mono text-xs text-gray-600">{adj.reference_number}</td>
                    <td className="p-4 font-medium text-gray-800">{adj.product_name}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGES[adj.adjustment_type] || 'bg-gray-100 text-gray-700'}`}>
                        {adj.adjustment_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-4 text-right text-gray-600">{adj.quantity_before}</td>
                    <td className="p-4 text-right font-medium">
                      <span className={['subtraction', 'damage', 'theft', 'expired'].includes(adj.adjustment_type) ? 'text-red-600' : 'text-emerald-600'}>
                        {['subtraction', 'damage', 'theft', 'expired'].includes(adj.adjustment_type) ? '-' : adj.adjustment_type === 'correction' ? '=' : '+'}
                        {adj.quantity_adjusted}
                      </span>
                    </td>
                    <td className="p-4 text-right font-bold text-gray-800">{adj.quantity_after}</td>
                    <td className="p-4 text-gray-500 max-w-[200px] truncate">{adj.reason || '-'}</td>
                    <td className="p-4 text-gray-600">{adj.created_by_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {adjustments.length > 0 && (
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={totalItems} itemsPerPage={limit} onItemsPerPageChange={(v) => { setLimit(v); setPage(1); }} />
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                <ClipboardList size={22} className="text-emerald-600" />
                New Stock Adjustment
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">{formError}</div>
              )}

              {/* Product Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product *</label>
                {selectedProduct ? (
                  <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-800">{selectedProduct.product_name}</p>
                      <p className="text-sm text-gray-500">Current Stock: {selectedProduct.stock_quantity ?? selectedProduct.available_stock ?? 0}</p>
                    </div>
                    <button onClick={() => setSelectedProduct(null)} className="text-gray-400 hover:text-gray-600">
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input
                        type="text"
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Search products..."
                        className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                        autoFocus
                      />
                    </div>
                    {products.length > 0 && (
                      <div className="mt-1 max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                        {products.map(p => (
                          <button
                            key={p.product_id}
                            onClick={() => { setSelectedProduct(p); setProductSearch(''); }}
                            className="w-full flex items-center justify-between p-2.5 hover:bg-gray-50 text-left text-sm"
                          >
                            <span className="font-medium text-gray-800">{p.product_name}</span>
                            <span className="text-gray-500">Stock: {p.stock_quantity ?? p.available_stock ?? 0}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adjustment Type *</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="">Select Type</option>
                  {types.map(t => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {formType === 'correction' ? 'New Stock Quantity *' : 'Quantity *'}
                </label>
                <input
                  type="number"
                  min="1"
                  value={formQty}
                  onChange={(e) => setFormQty(e.target.value)}
                  placeholder={formType === 'correction' ? 'Set exact stock level' : 'Enter quantity'}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Live Preview */}
              {selectedProduct && formType && formQty && afterQty !== null && (
                <div className={`p-3 rounded-lg border text-sm ${afterQty < 0 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                  <div className="flex justify-between">
                    <span>Before: <strong>{selectedProduct.stock_quantity ?? selectedProduct.available_stock ?? 0}</strong></span>
                    <span>After: <strong>{afterQty}</strong></span>
                  </div>
                </div>
              )}

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <textarea
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  placeholder="Describe the reason for this adjustment..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                />
              </div>

              {/* Reference */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number (optional)</label>
                <input
                  type="text"
                  value={formRef}
                  onChange={(e) => setFormRef(e.target.value)}
                  placeholder="Auto-generated if empty"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button onClick={() => setShowModal(false)} className="px-5 py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={saving}
                  className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 font-medium"
                >
                  {saving ? 'Saving...' : 'Create Adjustment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const StockAdjustmentsWithGate = () => <ReportPasswordGate><StockAdjustments /></ReportPasswordGate>;
export default StockAdjustmentsWithGate;
