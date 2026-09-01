import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Edit, Trash2, Package, Tag, X, Layers, DollarSign, Hash, BarChart2, AlertTriangle } from 'lucide-react';
import api from '../../utils/api';
import { useConfirm } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';

interface VariantType {
  variant_type_id: number;
  variant_name: string;
}

interface ProductVariant {
  variant_id: number;
  product_id: number;
  product_name?: string;
  variant_name: string;
  sku: string | null;
  barcode: string | null;
  price_adjustment: number;
  available_stock: number;
  combinations?: { type_name: string; value_name: string }[];
}

interface Product {
  product_id: number;
  product_name: string;
  price: number;
  has_variants: number;
}

const ProductVariants = () => {
  const confirm = useConfirm();
  const { error, success } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [variantTypes, setVariantTypes] = useState<VariantType[]>([]);
  const [, setLoadingProducts] = useState(true);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [showProductDrop, setShowProductDrop] = useState(false);

  // Variant type management
  const [newTypeName, setNewTypeName] = useState('');
  const [addingType, setAddingType] = useState(false);

  // Create/Edit variant modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editVariant, setEditVariant] = useState<ProductVariant | null>(null);
  const [form, setForm] = useState({
    variant_name: '',
    sku: '',
    barcode: '',
    price_adjustment: '0',
    initial_stock: '0',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Stock adjust modal
  const [stockVariant, setStockVariant] = useState<ProductVariant | null>(null);
  const [stockQty, setStockQty] = useState('');
  const [stockReason, setStockReason] = useState('correction');
  const [adjustingStock, setAdjustingStock] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const res = await api.get('/products', { params: { limit: 100 } });
      setProducts(res.data.data || res.data || []);
    } catch (err) {
      console.error('Failed to fetch products', err);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  const fetchVariantTypes = useCallback(async () => {
    try {
      const res = await api.get('/variants/types');
      setVariantTypes(res.data || []);
    } catch (err) {
      console.error('Failed to fetch variant types', err);
    }
  }, []);

  const fetchVariants = useCallback(async (productId: number) => {
    setLoadingVariants(true);
    try {
      const res = await api.get(`/variants/product/${productId}`);
      setVariants(res.data || []);
    } catch (err) {
      console.error('Failed to fetch variants', err);
    } finally {
      setLoadingVariants(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchVariantTypes();
  }, [fetchProducts, fetchVariantTypes]);

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setShowProductDrop(false);
    setProductSearch(product.product_name);
    fetchVariants(product.product_id);
  };

  const addVariantType = async () => {
    if (!newTypeName.trim()) return;
    setAddingType(true);
    try {
      await api.post('/variants/types', { variant_name: newTypeName.trim() });
      setNewTypeName('');
      fetchVariantTypes();
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to add variant type');
    } finally {
      setAddingType(false);
    }
  };

  const openCreate = () => {
    if (!selectedProduct) { error('Select a product first'); return; }
    setEditVariant(null);
    setForm({ variant_name: '', sku: '', barcode: '', price_adjustment: '0', initial_stock: '0' });
    setFormError('');
    setIsModalOpen(true);
  };

  const openEdit = (variant: ProductVariant) => {
    setEditVariant(variant);
    setForm({
      variant_name: variant.variant_name,
      sku: variant.sku || '',
      barcode: variant.barcode || '',
      price_adjustment: variant.price_adjustment.toString(),
      initial_stock: '0',
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.variant_name.trim()) { setFormError('Variant name is required'); return; }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        product_id: selectedProduct!.product_id,
        variant_name: form.variant_name.trim(),
        sku: form.sku.trim() || null,
        barcode: form.barcode.trim() || null,
        price_adjustment: parseFloat(form.price_adjustment) || 0,
        initial_stock: editVariant ? undefined : (parseInt(form.initial_stock) || 0),
        combinations: [],
      };
      if (editVariant) {
        await api.put(`/variants/${editVariant.variant_id}`, payload);
      } else {
        await api.post('/variants', payload);
      }
      setIsModalOpen(false);
      fetchVariants(selectedProduct!.product_id);
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save variant');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (variantId: number, name: string) => {
    const ok = await confirm({ title: 'Delete Variant', message: `Delete variant "${name}"?`, type: 'danger' });
    if (!ok) return;
    try {
      await api.delete(`/variants/${variantId}`);
      fetchVariants(selectedProduct!.product_id);
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to delete variant');
    }
  };

  const handleAdjustStock = async () => {
    if (!stockVariant) return;
    const qty = parseInt(stockQty);
    if (isNaN(qty)) { error('Enter valid quantity'); return; }
    setAdjustingStock(true);
    try {
      await api.post(`/variants/${stockVariant.variant_id}/stock/adjust`, {
        quantity: qty,
        reason: stockReason,
      });
      success('Stock adjusted');
      setStockVariant(null);
      fetchVariants(selectedProduct!.product_id);
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to adjust stock');
    } finally {
      setAdjustingStock(false);
    }
  };

  const filteredProducts = products.filter(p =>
    p.product_name.toLowerCase().includes(productSearch.toLowerCase())
  ).slice(0, 8);

  const totalStock = variants.reduce((sum, v) => sum + (v.available_stock || 0), 0);
  const lowStock = variants.filter(v => (v.available_stock || 0) < 5).length;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Product Variants</h1>
        <p className="text-sm text-gray-500 mt-1">Manage sizes, colors, and other product variations</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Variant Types + Product Selector */}
        <div className="space-y-4">
          {/* Variant Types Card */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Layers size={16} className="text-purple-500" />
              Variant Types
            </h3>
            <div className="space-y-1.5 mb-3 max-h-48 overflow-y-auto">
              {variantTypes.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-2">No variant types yet</p>
              ) : (
                variantTypes.map(vt => (
                  <div key={vt.variant_type_id} className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 rounded-lg">
                    <Tag size={12} className="text-purple-500" />
                    <span className="text-sm font-medium text-gray-700">{vt.variant_name}</span>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTypeName}
                onChange={e => setNewTypeName(e.target.value)}
                placeholder="e.g. Size, Color"
                onKeyDown={e => e.key === 'Enter' && addVariantType()}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none"
              />
              <button
                onClick={addVariantType}
                disabled={addingType || !newTypeName.trim()}
                className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Product Selector */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Package size={16} className="text-blue-500" />
              Select Product
            </h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                value={productSearch}
                onChange={e => { setProductSearch(e.target.value); setShowProductDrop(true); }}
                onFocus={() => setShowProductDrop(true)}
                placeholder="Search product..."
                className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              {showProductDrop && productSearch && filteredProducts.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                  {filteredProducts.map(p => (
                    <button
                      key={p.product_id}
                      onClick={() => handleSelectProduct(p)}
                      className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-blue-50 text-sm text-left transition-colors"
                    >
                      <Package size={14} className="text-blue-400 flex-shrink-0" />
                      <span className="font-medium text-gray-700">{p.product_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedProduct && (
              <div className="mt-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-sm font-semibold text-blue-800">{selectedProduct.product_name}</p>
                <p className="text-xs text-blue-600 mt-0.5">Base price: Rs. {parseFloat(String(selectedProduct.price)).toFixed(0)}</p>
              </div>
            )}
          </div>

          {/* Stats (when product selected) */}
          {selectedProduct && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-3">
              <h3 className="font-semibold text-gray-800">Variant Stats</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-gray-900">{variants.length}</p>
                  <p className="text-xs text-gray-500">Variants</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-gray-900">{totalStock}</p>
                  <p className="text-xs text-gray-500">Total Stock</p>
                </div>
              </div>
              {lowStock > 0 && (
                <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-100 rounded-lg px-3 py-2">
                  <AlertTriangle size={14} className="text-yellow-500" />
                  <span className="text-xs text-yellow-700">{lowStock} variant{lowStock > 1 ? 's' : ''} low on stock</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Variants Table */}
        <div className="col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">
                {selectedProduct ? `Variants — ${selectedProduct.product_name}` : 'Select a product to view variants'}
              </h3>
              {selectedProduct && (
                <button
                  onClick={openCreate}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Plus size={15} />
                  Add Variant
                </button>
              )}
            </div>

            {!selectedProduct ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Layers size={48} className="text-gray-200 mb-3" />
                <p className="text-gray-400">Select a product from the left panel</p>
              </div>
            ) : loadingVariants ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-600 border-t-transparent" />
              </div>
            ) : variants.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Tag size={40} className="text-gray-200 mb-3" />
                <p className="text-gray-500 font-medium">No variants yet</p>
                <p className="text-gray-400 text-sm mt-1">Click "Add Variant" to create the first one</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Variant</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">SKU</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Price Adj.</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stock</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {variants.map(variant => (
                      <tr key={variant.variant_id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-medium text-gray-800">{variant.variant_name}</p>
                          {variant.barcode && (
                            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                              <Hash size={10} />
                              {variant.barcode}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{variant.sku || '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-medium ${parseFloat(String(variant.price_adjustment)) >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {parseFloat(String(variant.price_adjustment)) >= 0 ? '+' : ''}
                            Rs. {parseFloat(String(variant.price_adjustment)).toFixed(0)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            (variant.available_stock || 0) === 0
                              ? 'bg-red-100 text-red-700'
                              : (variant.available_stock || 0) < 5
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {variant.available_stock || 0}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => { setStockVariant(variant); setStockQty(''); setStockReason('correction'); }}
                              className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Adjust Stock"
                            >
                              <BarChart2 size={14} />
                            </button>
                            <button
                              onClick={() => openEdit(variant)}
                              className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(variant.variant_id, variant.variant_name)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create/Edit Variant Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {editVariant ? 'Edit Variant' : 'Add Variant'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {formError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{formError}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Variant Name *</label>
                <input
                  type="text"
                  value={form.variant_name}
                  onChange={e => setForm(p => ({ ...p, variant_name: e.target.value }))}
                  placeholder="e.g. Red - Large"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                  <input
                    type="text"
                    value={form.sku}
                    onChange={e => setForm(p => ({ ...p, sku: e.target.value }))}
                    placeholder="SKU-001"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
                  <input
                    type="text"
                    value={form.barcode}
                    onChange={e => setForm(p => ({ ...p, barcode: e.target.value }))}
                    placeholder="1234567890"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price Adjustment (+ or − from base price)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                  <input
                    type="number"
                    value={form.price_adjustment}
                    onChange={e => setForm(p => ({ ...p, price_adjustment: e.target.value }))}
                    step="0.01"
                    className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
              </div>
              {!editVariant && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Initial Stock</label>
                  <input
                    type="number"
                    value={form.initial_stock}
                    onChange={e => setForm(p => ({ ...p, initial_stock: e.target.value }))}
                    min="0"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving...' : editVariant ? 'Save Changes' : 'Add Variant'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Adjust Modal */}
      {stockVariant && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Adjust Stock</h2>
              <button onClick={() => setStockVariant(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-sm font-semibold text-gray-800">{stockVariant.variant_name}</p>
                <p className="text-xs text-gray-500 mt-0.5">Current stock: <span className="font-bold text-gray-700">{stockVariant.available_stock || 0}</span></p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adjustment Quantity</label>
                <p className="text-xs text-gray-400 mb-2">Use positive (add) or negative (remove) value</p>
                <input
                  type="number"
                  value={stockQty}
                  onChange={e => setStockQty(e.target.value)}
                  placeholder="e.g. +10 or -5"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <select
                  value={stockReason}
                  onChange={e => setStockReason(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="correction">Correction</option>
                  <option value="addition">Stock Addition</option>
                  <option value="damage">Damage</option>
                  <option value="return">Return</option>
                  <option value="theft">Theft</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
              <button onClick={() => setStockVariant(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button
                onClick={handleAdjustStock}
                disabled={adjustingStock || !stockQty}
                className="px-5 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {adjustingStock ? 'Saving...' : 'Apply Adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductVariants;
