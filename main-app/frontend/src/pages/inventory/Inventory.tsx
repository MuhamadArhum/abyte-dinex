import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { Plus, Search, Edit, Trash2, Barcode, Package, DollarSign, AlertTriangle, XCircle, Download } from 'lucide-react';
import api from '../../utils/api';
import { localToday } from '../../utils/dateUtils';
import AddProductModal from '../../components/AddProductModal';
import BarcodeModal from '../../components/BarcodeModal';
import Pagination from '../../components/Pagination';
import EmptyState from '../../components/EmptyState';
import { useConfirm } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';

interface InventoryItem {
  product_id: number;
  product_name: string;
  category_id: number | null;
  category_name: string | null;
  price: string | number;
  cost_price?: string | number;
  stock_quantity?: number;
  available_stock?: number;
  min_stock_level?: number;
  barcode?: string;
  sku?: string;
  description?: string;
  image_url?: string;
  has_variants?: number;
  product_type?: 'finished_good' | 'raw_material' | 'semi_finished';
}

interface InventoryProps {
  productType?: 'finished_good' | 'raw_material' | 'semi_finished';
}

interface Category {
  category_id: number;
  category_name: string;
}

const Inventory = ({ productType }: InventoryProps = {}) => {
  const { currencySymbol: currency } = useSettings();
  const confirm = useConfirm();
  const { error } = useToast();
  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<InventoryItem | null>(null);
  const [barcodeProduct, setBarcodeProduct] = useState<InventoryItem | null>(null);

  // Filters
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Stats
  const [stats, setStats] = useState({
    total_products: 0, total_stock_value: 0, low_stock_count: 0, out_of_stock_count: 0
  });

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page: currentPage, limit: itemsPerPage };
      if (searchTerm) params.search = searchTerm;
      if (categoryFilter) params.category = categoryFilter;
      if (stockFilter) params.stock = stockFilter;
      if (productType) params.type = productType;

      const res = await api.get('/products', { params });
      if (res.data.pagination) {
        setProducts(res.data.data);
        setTotalItems(res.data.pagination.total);
        setTotalPages(res.data.pagination.totalPages);
      } else {
        setProducts(res.data);
      }
    } catch (error) {
      console.error('Failed to fetch inventory', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm, categoryFilter, stockFilter, productType]);

  const fetchCategories = async () => {
    try {
      const res = await api.get('/products/categories');
      setCategories(res.data.data || []);
    } catch (error) { console.error(error); }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get('/inventory-reports/summary');
      setStats(res.data);
    } catch (error) { console.error(error); }
  };

  useEffect(() => { fetchCategories(); fetchStats(); }, []);
  useEffect(() => { fetchInventory(); }, [fetchInventory]);

  const handleDelete = async (productId: number) => {
    const ok = await confirm({ title: 'Delete Product', message: 'Are you sure you want to delete this product?', type: 'danger' });
    if (!ok) return;
    try {
      await api.delete(`/products/${productId}`);
      fetchInventory();
      fetchStats();
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to delete product');
    }
  };

  const handleModalClose = () => {
    setIsAddModalOpen(false);
    setEditProduct(null);
  };

  const handleModalSuccess = () => {
    fetchInventory();
    fetchStats();
  };

  const exportCSV = () => {
    const headers = ['Product Name', 'Category', 'Price', 'Cost Price', 'Stock', 'Barcode', 'SKU'];
    const rows = products.map(p => [
      p.product_name,
      p.category_name || 'Uncategorized',
      Number(p.price).toFixed(0),
      p.cost_price ? Number(p.cost_price).toFixed(0) : '',
      String(p.available_stock ?? p.stock_quantity ?? 0),
      p.barcode || '',
      p.sku || '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const typeLabel = productType === 'raw_material' ? 'raw-materials' : productType === 'finished_good' ? 'finished-goods' : 'inventory';
    a.download = `${typeLabel}-${localToday()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStock = (p: InventoryItem) => p.available_stock ?? p.stock_quantity ?? 0;
  const getMargin = (p: InventoryItem) => {
    const price = Number(p.price);
    const cost = Number(p.cost_price || 0);
    if (!cost || cost <= 0) return null;
    return ((price - cost) / price * 100).toFixed(1);
  };

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-start gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="text-lg md:text-xl font-semibold tracking-tight text-gray-900 flex items-center gap-2">
            <Package className="text-emerald-600" size={20} />
            {productType === 'raw_material' ? 'Raw Materials' : productType === 'finished_good' ? 'Finished Goods' : 'Inventory'}
          </h1>
          <p className="text-gray-500 mt-0.5 text-sm hidden sm:block">
            {productType === 'raw_material' ? 'Manage raw materials and input stock' : productType === 'finished_good' ? 'Products available for sale' : 'Track stock, manage products'}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={exportCSV}
            className="bg-white border border-gray-200 text-gray-700 px-3 md:px-4 py-2 md:py-2.5 rounded-lg font-medium hover:bg-gray-50 flex items-center gap-1.5 transition-colors text-sm">
            <Download size={16} /> <span className="hidden sm:inline">Export CSV</span>
          </button>
          <button onClick={() => { setEditProduct(null); setIsAddModalOpen(true); }}
            className="bg-emerald-600 text-white px-3 md:px-5 py-2 md:py-2.5 rounded-lg font-medium hover:bg-emerald-700 flex items-center gap-1.5 transition-colors text-sm">
            <Plus size={18} /> <span className="hidden sm:inline">{productType === 'raw_material' ? 'Add Raw Material' : productType === 'finished_good' ? 'Add Finished Good' : 'Add Product'}</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      <AddProductModal
        isOpen={isAddModalOpen}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
        productToEdit={editProduct}
        productType={productType}
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 rounded-xl"><Package size={24} className="text-emerald-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{stats.total_products}</p>
              <p className="text-sm text-gray-500">Total Products</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 rounded-xl"><DollarSign size={24} className="text-emerald-600" /></div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{currency}{Number(stats.total_stock_value).toLocaleString()}</p>
              <p className="text-sm text-gray-500">Stock Value</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-50 rounded-xl"><AlertTriangle size={24} className="text-yellow-600" /></div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{stats.low_stock_count}</p>
              <p className="text-sm text-gray-500">Low Stock</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-50 rounded-xl"><XCircle size={24} className="text-red-600" /></div>
            <div>
              <p className="text-2xl font-bold text-red-600">{stats.out_of_stock_count}</p>
              <p className="text-sm text-gray-500">Out of Stock</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Search products..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
          </div>
          <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none min-w-[160px]">
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
          </select>
          <select value={stockFilter} onChange={(e) => { setStockFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none min-w-[140px]">
            <option value="">All Stock</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Cost</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Margin</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Stock</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((product) => {
                  const stock = getStock(product);
                  const margin = getMargin(product);
                  return (
                    <tr key={product.product_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-sm">
                            {product.product_name.charAt(0)}
                          </div>
                          <div className="ml-3">
                            <div className="font-medium text-gray-900">{product.product_name}</div>
                            <div className="text-xs text-gray-400">{product.barcode || product.sku || 'No Code'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{product.category_name || 'Uncategorized'}</td>
                      <td className="px-4 py-3 text-right text-gray-900 font-medium">{currency}{Number(product.price).toFixed(0)}</td>
                      <td className="px-4 py-3 text-right text-gray-500">
                        {product.cost_price ? `${currency}${Number(product.cost_price).toFixed(0)}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {margin ? (
                          <span className={`text-xs font-medium ${Number(margin) > 30 ? 'text-emerald-600' : Number(margin) > 10 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {margin}%
                          </span>
                        ) : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          stock === 0 ? 'bg-red-100 text-red-700' :
                          stock < 10 ? 'bg-yellow-100 text-yellow-700' :
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          {stock} units
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button className="text-emerald-600 hover:text-emerald-800" title="Edit"
                            onClick={() => { setEditProduct(product); setIsAddModalOpen(true); }}>
                            <Edit size={16} />
                          </button>
                          <button className="text-emerald-600 hover:text-emerald-800" title="Barcode"
                            onClick={() => setBarcodeProduct(product)}>
                            <Barcode size={16} />
                          </button>
                          <button className="text-red-600 hover:text-red-800" title="Delete"
                            onClick={() => handleDelete(product.product_id)}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState
                        icon={Package}
                        title="No products found"
                        description="Try adjusting your search or add a new product"
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage}
          totalItems={totalItems} itemsPerPage={itemsPerPage} onItemsPerPageChange={(v) => { setItemsPerPage(v); setCurrentPage(1); }} />
      </div>

      {barcodeProduct && (
        <BarcodeModal
          isOpen={!!barcodeProduct}
          onClose={() => setBarcodeProduct(null)}
          product={{ ...barcodeProduct, price: String(barcodeProduct.price) }}
        />
      )}
    </div>
  );
};

export default Inventory;
