import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, Package, Calendar, ToggleLeft, ToggleRight, X, Search, ChevronDown, ChevronUp, Percent, DollarSign, Gift } from 'lucide-react';
import api from '../../utils/api';
import Pagination from '../../components/Pagination';
import { useConfirm } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';

interface BundleItem {
  bundle_item_id?: number;
  product_id: number;
  variant_id?: number | null;
  quantity_required: number;
  product_name?: string;
  variant_name?: string;
  price?: number;
}

interface Bundle {
  bundle_id: number;
  bundle_name: string;
  description: string | null;
  discount_type: 'percentage' | 'fixed' | 'buy_x_get_y';
  discount_value: number;
  start_date: string | null;
  end_date: string | null;
  is_active: number;
  created_at: string;
  items: BundleItem[];
}

interface Product {
  product_id: number;
  product_name: string;
  price: number;
}

const DISCOUNT_LABELS: Record<string, string> = {
  percentage: 'Percentage %',
  fixed: 'Fixed Amount',
  buy_x_get_y: 'Buy X Get Y',
};

const DISCOUNT_COLORS: Record<string, string> = {
  percentage: 'bg-blue-100 text-blue-700',
  fixed: 'bg-emerald-100 text-emerald-700',
  buy_x_get_y: 'bg-purple-100 text-purple-700',
};

const emptyForm = {
  bundle_name: '',
  description: '',
  discount_type: 'percentage' as 'percentage' | 'fixed' | 'buy_x_get_y',
  discount_value: '',
  start_date: '',
  end_date: '',
  items: [] as BundleItem[],
};

const Bundles = () => {
  const confirm = useConfirm();
  const { error, success } = useToast();
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [expandedBundle, setExpandedBundle] = useState<number | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editBundle, setEditBundle] = useState<Bundle | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Products for item picker
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState('');

  const fetchBundles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/bundles');
      setBundles(res.data || []);
    } catch (err) {
      console.error('Failed to fetch bundles', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products', { params: { limit: 100 } });
      setProducts(res.data.data || res.data || []);
    } catch (err) {
      console.error('Failed to fetch products', err);
    }
  };

  useEffect(() => {
    fetchBundles();
    fetchProducts();
  }, [fetchBundles]);

  const openCreate = () => {
    setEditBundle(null);
    setForm({ ...emptyForm });
    setFormError('');
    setProductSearch('');
    setIsModalOpen(true);
  };

  const openEdit = (bundle: Bundle) => {
    setEditBundle(bundle);
    setForm({
      bundle_name: bundle.bundle_name,
      description: bundle.description || '',
      discount_type: bundle.discount_type,
      discount_value: bundle.discount_value.toString(),
      start_date: bundle.start_date ? bundle.start_date.split('T')[0] : '',
      end_date: bundle.end_date ? bundle.end_date.split('T')[0] : '',
      items: bundle.items.map(i => ({
        product_id: i.product_id,
        variant_id: i.variant_id || null,
        quantity_required: i.quantity_required,
        product_name: i.product_name,
        variant_name: i.variant_name,
      })),
    });
    setFormError('');
    setProductSearch('');
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.bundle_name.trim()) { setFormError('Bundle name is required'); return; }
    if (!form.discount_value || parseFloat(form.discount_value) <= 0) { setFormError('Discount value must be > 0'); return; }
    if (form.items.length === 0) { setFormError('Add at least one product to the bundle'); return; }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        bundle_name: form.bundle_name.trim(),
        description: form.description.trim() || null,
        discount_type: form.discount_type,
        discount_value: parseFloat(form.discount_value),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        items: form.items.map(i => ({
          product_id: i.product_id,
          variant_id: i.variant_id || null,
          quantity_required: i.quantity_required,
        })),
      };
      if (editBundle) {
        await api.put(`/bundles/${editBundle.bundle_id}`, payload);
      } else {
        await api.post('/bundles', payload);
      }
      setIsModalOpen(false);
      fetchBundles();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save bundle');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (bundleId: number, name: string) => {
    const ok = await confirm({ title: 'Delete Bundle', message: `Delete bundle "${name}"?`, type: 'danger' });
    if (!ok) return;
    try {
      await api.delete(`/bundles/${bundleId}`);
      success('Bundle deleted');
      fetchBundles();
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to delete bundle');
    }
  };

  const toggleActive = async (bundle: Bundle) => {
    try {
      await api.put(`/bundles/${bundle.bundle_id}`, { is_active: bundle.is_active ? 0 : 1 });
      fetchBundles();
    } catch (err) {
      console.error('Failed to toggle bundle status', err);
    }
  };

  const addItemToForm = (product: Product) => {
    const already = form.items.find(i => i.product_id === product.product_id && !i.variant_id);
    if (already) return;
    setForm(prev => ({
      ...prev,
      items: [...prev.items, {
        product_id: product.product_id,
        variant_id: null,
        quantity_required: 1,
        product_name: product.product_name,
      }],
    }));
    setProductSearch('');
  };

  const updateItemQty = (idx: number, qty: number) => {
    setForm(prev => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], quantity_required: Math.max(1, qty) };
      return { ...prev, items };
    });
  };

  const removeItem = (idx: number) => {
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  const filteredBundles = bundles.filter(b => {
    const matchSearch = !search || b.bundle_name.toLowerCase().includes(search.toLowerCase());
    const matchActive = !activeFilter || (activeFilter === 'active' ? b.is_active : !b.is_active);
    return matchSearch && matchActive;
  });

  const totalPages = Math.ceil(filteredBundles.length / itemsPerPage);
  const paginated = filteredBundles.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const filteredProductOptions = products.filter(p =>
    p.product_name.toLowerCase().includes(productSearch.toLowerCase()) &&
    !form.items.find(i => i.product_id === p.product_id && !i.variant_id)
  ).slice(0, 8);

  const stats = {
    total: bundles.length,
    active: bundles.filter(b => b.is_active).length,
    percentage: bundles.filter(b => b.discount_type === 'percentage').length,
    fixed: bundles.filter(b => b.discount_type === 'fixed').length,
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Bundles</h1>
          <p className="text-sm text-gray-500 mt-1">Create combo deals and bundle discounts for the POS</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-indigo-700 shadow-lg shadow-purple-200 transition-all"
        >
          <Plus size={18} />
          <span className="hidden sm:inline">New Bundle</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Bundles', value: stats.total, icon: Gift, color: 'indigo' },
          { label: 'Active', value: stats.active, icon: ToggleRight, color: 'emerald' },
          { label: 'Percentage Disc.', value: stats.percentage, icon: Percent, color: 'blue' },
          { label: 'Fixed Disc.', value: stats.fixed, icon: DollarSign, color: 'orange' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 bg-${s.color}-100 rounded-lg flex items-center justify-center`}>
                <s.icon size={20} className={`text-${s.color}-600`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search bundles..."
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
          />
        </div>
        <select
          value={activeFilter}
          onChange={e => { setActiveFilter(e.target.value); setCurrentPage(1); }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Bundles List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-600 border-t-transparent" />
          </div>
        ) : paginated.length === 0 ? (
          <div className="text-center py-16">
            <Gift size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No bundles found</p>
            <p className="text-gray-400 text-sm mt-1">Create your first product bundle deal</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {paginated.map(bundle => (
              <div key={bundle.bundle_id} className="hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-4 px-6 py-4">
                  {/* Toggle */}
                  <button onClick={() => toggleActive(bundle)} className="flex-shrink-0">
                    {bundle.is_active ? (
                      <ToggleRight size={28} className="text-emerald-500" />
                    ) : (
                      <ToggleLeft size={28} className="text-gray-400" />
                    )}
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{bundle.bundle_name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${DISCOUNT_COLORS[bundle.discount_type]}`}>
                        {DISCOUNT_LABELS[bundle.discount_type]}
                      </span>
                      {!bundle.is_active && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">Inactive</span>
                      )}
                    </div>
                    {bundle.description && (
                      <p className="text-sm text-gray-500 truncate mt-0.5">{bundle.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Package size={12} />
                        {bundle.items.length} products
                      </span>
                      {bundle.start_date && (
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {bundle.start_date.split('T')[0]} → {bundle.end_date?.split('T')[0] || '∞'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Discount Value */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-purple-600">
                      {bundle.discount_type === 'percentage' ? `${bundle.discount_value}%` : `Rs. ${bundle.discount_value}`}
                    </p>
                    <p className="text-xs text-gray-400">discount</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setExpandedBundle(expandedBundle === bundle.bundle_id ? null : bundle.bundle_id)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      {expandedBundle === bundle.bundle_id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <button
                      onClick={() => openEdit(bundle)}
                      className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(bundle.bundle_id, bundle.bundle_name)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Expanded items */}
                {expandedBundle === bundle.bundle_id && (
                  <div className="px-6 pb-4 bg-gray-50 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 mt-3">Bundle Items</p>
                    <div className="flex flex-wrap gap-2">
                      {bundle.items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
                          <Package size={14} className="text-purple-500" />
                          <span className="font-medium text-gray-700">{item.product_name}</span>
                          {item.variant_name && <span className="text-gray-400">({item.variant_name})</span>}
                          <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-xs font-bold">×{item.quantity_required}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-100">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredBundles.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={() => {}}
            />
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {editBundle ? 'Edit Bundle' : 'Create Bundle'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{formError}</div>
              )}

              {/* Name & Description */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bundle Name *</label>
                  <input
                    type="text"
                    value={form.bundle_name}
                    onChange={e => setForm(p => ({ ...p, bundle_name: e.target.value }))}
                    placeholder="e.g. Weekend Special"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    rows={2}
                    placeholder="Optional description..."
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none"
                  />
                </div>
              </div>

              {/* Discount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount Type *</label>
                  <select
                    value={form.discount_type}
                    onChange={e => setForm(p => ({ ...p, discount_type: e.target.value as any }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (Rs.)</option>
                    <option value="buy_x_get_y">Buy X Get Y</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount Value *</label>
                  <input
                    type="number"
                    value={form.discount_value}
                    onChange={e => setForm(p => ({ ...p, discount_value: e.target.value }))}
                    placeholder={form.discount_type === 'percentage' ? '10' : '500'}
                    min="0.01"
                    step="0.01"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
              </div>

              {/* Items */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bundle Products *</label>

                {/* Product search */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={e => setProductSearch(e.target.value)}
                    placeholder="Search & add products..."
                    className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                  />
                  {productSearch && filteredProductOptions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                      {filteredProductOptions.map(p => (
                        <button
                          key={p.product_id}
                          onClick={() => addItemToForm(p)}
                          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-purple-50 text-sm text-left transition-colors"
                        >
                          <span className="font-medium text-gray-700">{p.product_name}</span>
                          <span className="text-gray-400">Rs. {parseFloat(String(p.price)).toFixed(0)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected items */}
                {form.items.length === 0 ? (
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center text-sm text-gray-400">
                    No products added yet. Search above to add products.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {form.items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 bg-purple-50 border border-purple-100 rounded-xl px-4 py-2.5">
                        <Package size={16} className="text-purple-500 flex-shrink-0" />
                        <span className="flex-1 text-sm font-medium text-gray-700">{item.product_name}</span>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-500">Qty:</label>
                          <input
                            type="number"
                            value={item.quantity_required}
                            onChange={e => updateItemQty(idx, parseInt(e.target.value) || 1)}
                            min="1"
                            className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-sm text-center focus:ring-2 focus:ring-purple-500 outline-none"
                          />
                        </div>
                        <button
                          onClick={() => removeItem(idx)}
                          className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-semibold rounded-lg hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-sm"
              >
                {saving ? 'Saving...' : editBundle ? 'Save Changes' : 'Create Bundle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Bundles;
