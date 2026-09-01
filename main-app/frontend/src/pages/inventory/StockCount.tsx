import { useState, useEffect, useCallback, useRef } from 'react';
import { ClipboardCheck, Search, RefreshCw, CheckCircle, XCircle, AlertTriangle, Package, Download, Plus, Minus, Save, BarChart2 } from 'lucide-react';
import Pagination from '../../components/Pagination';
import api from '../../utils/api';
import { localToday } from '../../utils/dateUtils';
import { useConfirm } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';

interface StockCountItem {
  product_id: number;
  product_name: string;
  barcode: string | null;
  sku: string | null;
  category_name: string | null;
  system_stock: number;
  physical_count: number | null;
  discrepancy: number | null;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Products' },
  { value: 'counted', label: 'Counted' },
  { value: 'uncounted', label: 'Not Counted' },
  { value: 'match', label: 'Matched' },
  { value: 'discrepancy', label: 'Discrepancy' },
];

const StockCount = () => {
  const confirm = useConfirm();
  const { error } = useToast();
  const [items, setItems] = useState<StockCountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState<{ category_id: number; category_name: string }[]>([]);
  const [applying, setApplying] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodeRef = useRef<HTMLInputElement>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const [productsRes, catRes] = await Promise.all([
        api.get('/products', { params: { limit: 500 } }),
        api.get('/products/categories'),
      ]);
      const products = productsRes.data.data || productsRes.data || [];
      setCategories(catRes.data.data || catRes.data || []);
      // Initialize with system stock, physical_count = null
      setItems(products.map((p: any) => ({
        product_id: p.product_id,
        product_name: p.product_name,
        barcode: p.barcode || null,
        sku: p.sku || null,
        category_name: p.category_name || null,
        system_stock: p.available_stock ?? p.stock_quantity ?? 0,
        physical_count: null,
        discrepancy: null,
      })));
    } catch (err) {
      console.error('Failed to fetch products', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const setCount = (productId: number, value: number | null) => {
    setItems(prev => prev.map(item => {
      if (item.product_id !== productId) return item;
      if (value === null) return { ...item, physical_count: null, discrepancy: null };
      const count = Math.max(0, value);
      return { ...item, physical_count: count, discrepancy: count - item.system_stock };
    }));
  };

  const handleBarcodeSearch = (code: string) => {
    if (!code.trim()) return;
    const found = items.find(i => i.barcode === code.trim() || i.sku === code.trim());
    if (found) {
      // Auto-focus the count input for this item
      const input = document.getElementById(`count-${found.product_id}`);
      if (input) {
        input.focus();
        (input as HTMLInputElement).select();
      }
      // Scroll to the item
      document.getElementById(`row-${found.product_id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      error(`Product not found: ${code}`);
    }
    setBarcodeInput('');
  };

  const applyAdjustments = async () => {
    const discrepancies = items.filter(i => i.physical_count !== null && i.discrepancy !== 0);
    if (discrepancies.length === 0) {
      error('No discrepancies to apply. Count all products first, or there are no differences.');
      return;
    }
    const ok = await confirm({ title: 'Apply Adjustments', message: `Apply ${discrepancies.length} stock adjustment(s) for counted items with discrepancies?`, type: 'warning' });
    if (!ok) return;
    setApplying(true);
    try {
      for (const item of discrepancies) {
        // 'correction' type sets stock to absolute quantity_adjusted value
        await api.post('/stock-adjustments', {
          product_id: item.product_id,
          adjustment_type: 'correction',
          quantity_adjusted: item.physical_count,
          reason: `Physical stock count — system: ${item.system_stock}, counted: ${item.physical_count}`,
        });
      }
      setApplySuccess(true);
      setTimeout(() => setApplySuccess(false), 3000);
      fetchProducts();
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to apply adjustments');
    } finally {
      setApplying(false);
    }
  };

  const exportCSV = () => {
    const counted = items.filter(i => i.physical_count !== null);
    if (counted.length === 0) { error('No counted items to export.'); return; }
    const headers = ['Product', 'Category', 'Barcode', 'SKU', 'System Stock', 'Physical Count', 'Discrepancy', 'Status'];
    const rows = counted.map(i => [
      i.product_name,
      i.category_name || '',
      i.barcode || '',
      i.sku || '',
      i.system_stock,
      i.physical_count,
      i.discrepancy,
      i.discrepancy === 0 ? 'Match' : i.discrepancy! > 0 ? 'Surplus' : 'Shortage',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-count-${localToday()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Stats
  const totalItems = items.length;
  const countedItems = items.filter(i => i.physical_count !== null).length;
  const matchedItems = items.filter(i => i.discrepancy === 0 && i.physical_count !== null).length;
  const discrepancyItems = items.filter(i => i.discrepancy !== null && i.discrepancy !== 0).length;

  // Filter
  const filtered = items.filter(item => {
    const matchSearch = !search || item.product_name.toLowerCase().includes(search.toLowerCase()) ||
      item.barcode?.toLowerCase().includes(search.toLowerCase()) || item.sku?.toLowerCase().includes(search.toLowerCase());
    const matchCat = !categoryFilter || item.category_name === categoryFilter;
    const matchStatus = !statusFilter ||
      (statusFilter === 'counted' && item.physical_count !== null) ||
      (statusFilter === 'uncounted' && item.physical_count === null) ||
      (statusFilter === 'match' && item.discrepancy === 0 && item.physical_count !== null) ||
      (statusFilter === 'discrepancy' && item.discrepancy !== null && item.discrepancy !== 0);
    return matchSearch && matchCat && matchStatus;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Physical Stock Count</h1>
          <p className="text-sm text-gray-500 mt-1">Compare system stock with physical counts and apply corrections</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors text-sm"
          >
            <Download size={15} />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
          <button
            onClick={fetchProducts}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors text-sm"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={applyAdjustments}
            disabled={applying || discrepancyItems === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-semibold hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 shadow-lg shadow-emerald-200 transition-all text-sm"
          >
            {applying ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
            {applying ? 'Applying...' : `Apply ${discrepancyItems} Adjustment${discrepancyItems !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {applySuccess && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-5 py-3">
          <CheckCircle size={18} />
          <span className="font-medium">Adjustments applied successfully! Stock has been updated.</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Products', value: totalItems, color: 'gray', icon: Package },
          { label: 'Counted', value: `${countedItems}/${totalItems}`, color: 'blue', icon: ClipboardCheck },
          { label: 'Matched', value: matchedItems, color: 'emerald', icon: CheckCircle },
          { label: 'Discrepancies', value: discrepancyItems, color: discrepancyItems > 0 ? 'red' : 'gray', icon: AlertTriangle },
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

      {/* Progress Bar */}
      {totalItems > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Count Progress</span>
            <span className="text-sm text-gray-500">{countedItems} of {totalItems} products counted ({Math.round(countedItems / totalItems * 100)}%)</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${totalItems > 0 ? (countedItems / totalItems) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Barcode Scanner */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-4">
        <BarChart2 size={20} className="text-gray-400 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-xs font-medium text-gray-500 mb-1">Barcode Scanner — Scan or type a barcode/SKU to jump to that product</p>
          <input
            ref={barcodeRef}
            type="text"
            value={barcodeInput}
            onChange={e => setBarcodeInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleBarcodeSearch(barcodeInput); }}
            placeholder="Scan barcode or enter SKU..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
          />
        </div>
        <button
          onClick={() => handleBarcodeSearch(barcodeInput)}
          className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors flex-shrink-0"
        >
          Find
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
          <input
            type="text"
            placeholder="Search by name, barcode, SKU..."
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={e => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none min-w-[150px]"
        >
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.category_id} value={c.category_name}>{c.category_name}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none min-w-[140px]"
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Stock Count Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase">Product</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Category</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">System Stock</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Physical Count</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Discrepancy</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginated.map(item => (
                    <tr
                      key={item.product_id}
                      id={`row-${item.product_id}`}
                      className={`transition-colors hover:bg-gray-50 ${
                        item.discrepancy !== null && item.discrepancy !== 0 ? 'bg-red-50/30' :
                        item.discrepancy === 0 ? 'bg-emerald-50/20' : ''
                      }`}
                    >
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-800">{item.product_name}</p>
                        {item.barcode && <p className="text-xs text-gray-400 mt-0.5">{item.barcode}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-sm">{item.category_name || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-gray-700">{item.system_stock}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setCount(item.product_id, (item.physical_count ?? item.system_stock) - 1)}
                            className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                          >
                            <Minus size={12} />
                          </button>
                          <input
                            id={`count-${item.product_id}`}
                            type="number"
                            value={item.physical_count ?? ''}
                            onChange={e => {
                              const val = e.target.value;
                              setCount(item.product_id, val === '' ? null : parseInt(val));
                            }}
                            min="0"
                            placeholder="—"
                            className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-semibold"
                          />
                          <button
                            onClick={() => setCount(item.product_id, (item.physical_count ?? item.system_stock) + 1)}
                            className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {item.discrepancy !== null ? (
                          <span className={`font-bold ${item.discrepancy > 0 ? 'text-emerald-600' : item.discrepancy < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                            {item.discrepancy > 0 ? '+' : ''}{item.discrepancy}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.physical_count === null ? (
                          <span className="px-2.5 py-1 bg-gray-100 text-gray-400 rounded-full text-xs">Pending</span>
                        ) : item.discrepancy === 0 ? (
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium flex items-center gap-1 w-fit mx-auto">
                            <CheckCircle size={11} />
                            Match
                          </span>
                        ) : item.discrepancy! > 0 ? (
                          <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium flex items-center gap-1 w-fit mx-auto">
                            <AlertTriangle size={11} />
                            Surplus +{item.discrepancy}
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium flex items-center gap-1 w-fit mx-auto">
                            <XCircle size={11} />
                            Short {item.discrepancy}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={filtered.length}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={(limit) => { setItemsPerPage(limit); setCurrentPage(1); }}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default StockCount;
