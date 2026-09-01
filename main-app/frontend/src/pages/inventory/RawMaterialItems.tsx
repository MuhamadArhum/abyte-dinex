import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit, Trash2, Package, AlertTriangle, XCircle, X, Save, FlaskConical } from 'lucide-react';
import api from '../../utils/api';
import Pagination from '../../components/Pagination';
import { useConfirm } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';

interface RawMaterial {
  product_id: number;
  product_name: string;
  category_id: number | null;
  category_name: string | null;
  unit: string;
  cost_price: string | number;
  stock_quantity?: number;
  available_stock?: number;
  min_stock_level?: number;
  barcode?: string;
  sku?: string;
  description?: string;
}

interface Category {
  category_id: number;
  category_name: string;
  category_type: string;
}

const UNITS = ['pcs', 'kg', 'g', 'mg', 'L', 'mL', 'box', 'dozen', 'meter', 'cm', 'pack', 'roll', 'sheet', 'bag', 'bottle', 'can'];

const emptyForm = {
  product_name: '',
  category_id: '',
  unit: 'pcs',
  cost_price: '',
  stock_quantity: '',
  min_stock_level: '',
  sku: '',
  barcode: '',
  description: '',
};

const RawMaterialItems = () => {
  const confirm = useConfirm();
  const { error, success } = useToast();
  const [items, setItems] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [stats, setStats] = useState({ total: 0, low_stock: 0, out_of_stock: 0 });

  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<RawMaterial | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const getStock = (item: RawMaterial) => item.available_stock ?? item.stock_quantity ?? 0;

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page: currentPage, limit: itemsPerPage, type: 'raw_material' };
      if (search) params.search = search;
      if (categoryFilter) params.category = categoryFilter;
      if (stockFilter) params.stock = stockFilter;

      const res = await api.get('/products', { params });
      const data = res.data.pagination ? res.data.data : (res.data.data || res.data);
      if (res.data.pagination) {
        setTotalItems(res.data.pagination.total);
        setTotalPages(res.data.pagination.totalPages);
      }
      setItems(data);
      setStats({
        total: res.data.pagination?.total ?? data.length,
        low_stock: data.filter((i: RawMaterial) => getStock(i) > 0 && getStock(i) < 10).length,
        out_of_stock: data.filter((i: RawMaterial) => getStock(i) === 0).length,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, search, categoryFilter, stockFilter]);

  const fetchCategories = async () => {
    try {
      const res = await api.get('/products/categories');
      const all: Category[] = res.data.data || [];
      setCategories(all.filter(c => c.category_type === 'raw_material'));
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchCategories(); }, []);
  useEffect(() => { fetchItems(); }, [fetchItems]);

  const openAdd = () => {
    setEditItem(null);
    setForm({ ...emptyForm });
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (item: RawMaterial) => {
    setEditItem(item);
    setForm({
      product_name: item.product_name,
      category_id: item.category_id ? String(item.category_id) : '',
      unit: item.unit || 'pcs',
      cost_price: String(item.cost_price ?? ''),
      stock_quantity: String(getStock(item)),
      min_stock_level: String(item.min_stock_level ?? 0),
      sku: item.sku || '',
      barcode: item.barcode || '',
      description: item.description || '',
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.product_name.trim()) { setFormError('Item name is required'); return; }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        product_name: form.product_name.trim(),
        category_id: form.category_id ? Number(form.category_id) : null,
        unit: form.unit,
        cost_price: Number(form.cost_price) || 0,
        price: 0,
        stock_quantity: Number(form.stock_quantity) || 0,
        min_stock_level: Number(form.min_stock_level) || 0,
        sku: form.sku.trim() || null,
        barcode: form.barcode.trim() || null,
        description: form.description.trim() || null,
        product_type: 'raw_material',
      };
      if (editItem) {
        await api.put(`/products/${editItem.product_id}`, payload);
      } else {
        await api.post('/products', payload);
      }
      setShowModal(false);
      fetchItems();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: RawMaterial) => {
    const ok = await confirm({ title: 'Delete Raw Material', message: `Delete "${item.product_name}"?`, type: 'danger' });
    if (!ok) return;
    try {
      await api.delete(`/products/${item.product_id}`);
      success('Item deleted');
      fetchItems();
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to delete');
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <FlaskConical className="text-orange-500" size={20} /> Raw Materials
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Input items used to produce finished goods</p>
        </div>
        <button onClick={openAdd} className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors">
          <Plus size={18} /> <span className="hidden sm:inline">Add Raw Material</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="p-2.5 bg-orange-50 rounded-xl"><Package size={20} className="text-orange-500" /></div>
          <div><p className="text-xl font-bold text-gray-800">{stats.total}</p><p className="text-xs text-gray-500">Total Items</p></div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="p-2.5 bg-yellow-50 rounded-xl"><AlertTriangle size={20} className="text-yellow-500" /></div>
          <div><p className="text-xl font-bold text-yellow-600">{stats.low_stock}</p><p className="text-xs text-gray-500">Low Stock</p></div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="p-2.5 bg-red-50 rounded-xl"><XCircle size={20} className="text-red-500" /></div>
          <div><p className="text-xl font-bold text-red-600">{stats.out_of_stock}</p><p className="text-xs text-gray-500">Out of Stock</p></div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
            <input type="text" placeholder="Search items..." value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
          <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 min-w-[150px]">
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
          </select>
          <select value={stockFilter} onChange={e => { setStockFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 min-w-[130px]">
            <option value="">All Stock</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cost</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Stock</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Min Stock</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map(item => {
                  const stock = getStock(item);
                  const isOut = stock === 0;
                  const isLow = !isOut && stock < 10;
                  return (
                    <tr key={item.product_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-sm">
                            {item.product_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{item.product_name}</div>
                            {item.barcode && <div className="text-xs text-gray-400">{item.barcode}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-sm">{item.category_name || <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-orange-50 text-orange-700 text-xs font-medium rounded">{item.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800">
                        {Number(item.cost_price) > 0 ? `Rs. ${Number(item.cost_price).toFixed(0)}` : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${isOut ? 'bg-red-100 text-red-700' : isLow ? 'bg-yellow-100 text-yellow-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {stock} {item.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500 text-sm">
                        {(item.min_stock_level ?? 0) > 0 ? `${item.min_stock_level} ${item.unit}` : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{item.sku || <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => openEdit(item)} className="text-orange-500 hover:text-orange-700" title="Edit"><Edit size={15} /></button>
                          <button onClick={() => handleDelete(item)} className="text-red-400 hover:text-red-600" title="Delete"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">No raw materials found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage}
          totalItems={totalItems} itemsPerPage={itemsPerPage} onItemsPerPageChange={v => { setItemsPerPage(v); setCurrentPage(1); }} />
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <FlaskConical size={18} className="text-orange-500" />
                {editItem ? 'Edit Raw Material' : 'Add Raw Material'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {formError && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg">{formError}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item Name *</label>
                <input type="text" value={form.product_name} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))}
                  placeholder="e.g. Wheat Flour" autoFocus
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                    <option value="">Select Category</option>
                    {categories.map(c => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit *</label>
                  <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cost Price</label>
                  <input type="number" min="0" step="0.01" value={form.cost_price} onChange={e => setForm(f => ({ ...f, cost_price: e.target.value }))}
                    placeholder="0.00" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Opening Stock</label>
                  <input type="number" min="0" value={form.stock_quantity} onChange={e => setForm(f => ({ ...f, stock_quantity: e.target.value }))}
                    placeholder="0" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Stock Level</label>
                  <input type="number" min="0" value={form.min_stock_level} onChange={e => setForm(f => ({ ...f, min_stock_level: e.target.value }))}
                    placeholder="0" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                  <input type="text" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                    placeholder="e.g. RM-001" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
                <input type="text" value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
                  placeholder="Optional" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Optional notes..." rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2 font-medium">
                <Save size={15} /> {saving ? 'Saving...' : editItem ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RawMaterialItems;
