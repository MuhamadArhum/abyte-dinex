import React, { useState, useEffect } from 'react';
import { X, Loader2, Save, Package, DollarSign, Boxes, Barcode, Tag, FileText, AlertCircle, PackagePlus } from 'lucide-react';
import api from '../utils/api';

type CategoryType = 'raw_material' | 'semi_finished' | 'finished_good';

interface Category {
  category_id: number;
  category_name: string;
  category_type: CategoryType;
}

const TYPE_LABELS: Record<CategoryType, string> = {
  raw_material: 'Raw Material',
  semi_finished: 'Semi-Finished',
  finished_good: 'Finished Good',
};

interface ProductToEdit {
  product_id: number;
  product_name: string;
  category_id: number | null;
  price: number | string;
  cost_price?: number | string;
  stock_quantity?: number;
  available_stock?: number;
  min_stock_level?: number;
  barcode?: string;
  sku?: string;
  description?: string;
  product_type?: 'finished_good' | 'raw_material' | 'semi_finished';
}

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  productToEdit?: ProductToEdit | null;
  productType?: 'finished_good' | 'raw_material' | 'semi_finished';
}

const AddProductModal: React.FC<AddProductModalProps> = ({ isOpen, onClose, onSuccess, productToEdit, productType = 'finished_good' }) => {
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [stock, setStock] = useState('');
  const [minStock, setMinStock] = useState('');
  const [barcode, setBarcode] = useState('');
  const [sku, setSku] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState({
    name: false,
    price: false,
    stock: false
  });

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
      if (productToEdit) {
        setName(productToEdit.product_name || '');
        setCategoryId(productToEdit.category_id ? String(productToEdit.category_id) : '');
        setPrice(productToEdit.price ? String(productToEdit.price) : '');
        setCostPrice(productToEdit.cost_price ? String(productToEdit.cost_price) : '');
        setStock(String(productToEdit.stock_quantity ?? productToEdit.available_stock ?? 0));
        setMinStock(productToEdit.min_stock_level ? String(productToEdit.min_stock_level) : '');
        setBarcode(productToEdit.barcode || '');
        setSku(productToEdit.sku || '');
        setDescription(productToEdit.description || '');
        setError('');
        setTouched({ name: false, price: false, stock: false });
      } else {
        resetForm();
      }
    }
  }, [isOpen, productToEdit]);

  const resetForm = () => {
    setName('');
    setCategoryId('');
    setPrice('');
    setCostPrice('');
    setStock('');
    setMinStock('');
    setBarcode('');
    setSku('');
    setDescription('');
    setError('');
    setTouched({ name: false, price: false, stock: false });
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get('/products/categories');
      setCategories(res.data.data || []);
    } catch (error) {
      console.error('Failed to fetch categories', error);
    }
  };

  // Validation
  const validatePrice = (value: string) => {
    const num = parseFloat(value);
    return !isNaN(num) && num > 0;
  };

  const validateStock = (value: string) => {
    const num = parseInt(value);
    return !isNaN(num) && num >= 0;
  };

  const isFormValid = () => {
    return (
      name.trim().length > 0 &&
      validatePrice(price) &&
      validateStock(stock)
    );
  };

  const calculateProfit = () => {
    if (costPrice && price) {
      const cost = parseFloat(costPrice);
      const sell = parseFloat(price);
      if (!isNaN(cost) && !isNaN(sell) && cost > 0) {
        const profit = sell - cost;
        const profitPercent = ((profit / cost) * 100).toFixed(0);
        return { profit: profit.toFixed(0), profitPercent };
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isFormValid()) {
      setError('Please fill all required fields correctly');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        product_name: name,
        category_id: categoryId ? parseInt(categoryId) : null,
        price: parseFloat(price),
        cost_price: costPrice ? parseFloat(costPrice) : null,
        stock_quantity: parseInt(stock),
        min_stock_level: minStock ? parseInt(minStock) : null,
        barcode: barcode || null,
        sku: sku || null,
        description: description || null,
        product_type: productToEdit?.product_type ?? productType
      };
      if (productToEdit) {
        await api.put(`/products/${productToEdit.product_id}`, payload);
      } else {
        await api.post('/products', payload);
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Failed to save product', error);
      setError(error.response?.data?.message || 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const profitInfo = calculateProfit();

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-300 border border-gray-200">
        {/* Header */}
        <div className="p-6 border-b-2 border-gray-100 bg-gradient-to-r from-emerald-50 via-white to-teal-50">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-2.5 rounded-xl shadow-lg">
                <PackagePlus size={28} className="text-white" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-800">{productToEdit ? 'Edit Product' : 'Add New Product'}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{productToEdit ? 'Update product details' : 'Fill in product details and inventory information'}</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-xl transition-all duration-200"
            >
              <X size={28} />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {error && (
            <div className="mb-5 p-4 bg-gradient-to-r from-red-50 to-red-100 text-red-700 border-2 border-red-200 rounded-xl text-sm font-medium flex items-start gap-3 shadow-sm animate-in slide-in-from-top-2 duration-300">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-5">
              {/* Product Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Package size={16} className="text-emerald-600" />
                  Product Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => setTouched({ ...touched, name: true })}
                    className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all shadow-sm ${
                      touched.name && !name.trim() ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
                    }`}
                    placeholder="Enter product name"
                  />
                </div>
                {touched.name && !name.trim() && (
                  <p className="text-red-500 text-xs mt-1.5 ml-1 flex items-center gap-1">
                    <span>⚠️</span> Product name is required
                  </p>
                )}
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Tag size={16} className="text-emerald-600" />
                  Category
                </label>
                <div className="relative">
                  <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 z-10" size={20} />
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white appearance-none transition-all shadow-sm"
                  >
                    <option value="">Select Category</option>
                    {(['raw_material', 'semi_finished', 'finished_good'] as CategoryType[]).map(type => {
                      const group = categories.filter(c => c.category_type === type);
                      if (group.length === 0) return null;
                      return (
                        <optgroup key={type} label={`── ${TYPE_LABELS[type]} ──`}>
                          {group.map(cat => (
                            <option key={cat.category_id} value={cat.category_id}>{cat.category_name}</option>
                          ))}
                        </optgroup>
                      );
                    })}
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Price & Cost Price */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <DollarSign size={16} className="text-green-600" />
                    Selling Price <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      onBlur={() => setTouched({ ...touched, price: true })}
                      className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all shadow-sm ${
                        touched.price && !validatePrice(price) ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
                      }`}
                      placeholder="0.00"
                    />
                  </div>
                  {touched.price && !validatePrice(price) && (
                    <p className="text-red-500 text-xs mt-1.5 ml-1 flex items-center gap-1">
                      <span>⚠️</span> Enter valid price
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <DollarSign size={16} className="text-orange-600" />
                    Cost Price
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="number"
                      step="0.01"
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all shadow-sm bg-white"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>

              {/* Profit Calculation */}
              {profitInfo && (
                <div className="p-3 bg-gradient-to-r from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-xl">
                  <p className="text-sm text-emerald-800 flex items-center justify-between">
                    <span className="font-semibold flex items-center gap-1">
                      💰 Profit Margin:
                    </span>
                    <span className="font-bold">
                      ${profitInfo.profit} ({profitInfo.profitPercent}%)
                    </span>
                  </p>
                </div>
              )}

              {/* Stock & Min Stock */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Boxes size={16} className="text-emerald-600" />
                    Initial Stock <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Boxes className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="number"
                      required
                      value={stock}
                      onChange={(e) => setStock(e.target.value)}
                      onBlur={() => setTouched({ ...touched, stock: true })}
                      className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all shadow-sm ${
                        touched.stock && !validateStock(stock) ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
                      }`}
                      placeholder="0"
                    />
                  </div>
                  {touched.stock && !validateStock(stock) && (
                    <p className="text-red-500 text-xs mt-1.5 ml-1 flex items-center gap-1">
                      <span>⚠️</span> Enter valid stock
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <AlertCircle size={16} className="text-red-600" />
                    Min Stock Alert
                  </label>
                  <div className="relative">
                    <AlertCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="number"
                      value={minStock}
                      onChange={(e) => setMinStock(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all shadow-sm bg-white"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-5">
              {/* Barcode */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Barcode size={16} className="text-emerald-600" />
                  Barcode
                </label>
                <div className="relative">
                  <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all shadow-sm bg-white"
                    placeholder="Scan or enter barcode"
                  />
                </div>
              </div>

              {/* SKU */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Tag size={16} className="text-emerald-600" />
                  SKU (Stock Keeping Unit)
                </label>
                <div className="relative">
                  <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all shadow-sm bg-white"
                    placeholder="e.g. PROD-001"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <FileText size={16} className="text-gray-600" />
                  Product Description
                </label>
                <div className="relative">
                  <FileText className="absolute left-4 top-4 text-gray-400" size={20} />
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none resize-none h-32 transition-all shadow-sm bg-white"
                    placeholder="Enter product description, features, specifications..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="mt-6 p-4 bg-gradient-to-r from-emerald-50 to-emerald-50 border-2 border-emerald-200 rounded-xl">
            <p className="text-sm text-emerald-800 flex items-start gap-2">
              <span className="text-lg">💡</span>
              <span>
                <strong>Required fields:</strong> Product Name, Selling Price, and Initial Stock. All other fields are optional and can be added later.
              </span>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6 pt-5 border-t-2 border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all duration-200 border-2 border-gray-200 hover:border-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !isFormValid()}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={20} />
                  <span>{productToEdit ? 'Update Product' : 'Save Product'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProductModal;