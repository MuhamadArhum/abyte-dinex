import { useState, useEffect, useCallback, useRef } from 'react';
import { ClipboardCheck, Search, RefreshCw, CheckCircle, XCircle, AlertTriangle, Package, Download, Plus, Minus, Save, BarChart2 } from 'lucide-react';
import Pagination from '../../components/Pagination';
import api from '../../utils/api';
import { localToday } from '../../utils/dateUtils';
import { useConfirm } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';

interface RawProduct {
  product_id: number;
  product_name: string;
  barcode: string | null;
  sku: string | null;
  category_name: string | null;
  available_stock?: number;
  stock_quantity?: number;
}

interface PageItem {
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
  const { error, success } = useToast();
  const barcodeRef = useRef<HTMLInputElement>(null);

  // Current page raw products
  const [items, setItems] = useState<RawProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<{ category_id: number; category_name: string }[]>([]);

  // Physical counts entered by user — persisted across page changes
  const [countsMap, setCountsMap] = useState<Record<number, number | null>>({});
  // System stock cache for all products ever loaded — needed for cross-page stats
  const [systemStockCache, setSystemStockCache] = useState<Record<number, number>>({});

  // Server-side pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>(''); // holds category_id as string

  // UI state
  const [applying, setApplying] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [categoriesFetched, setCategoriesFetched] = useState(false);

  const fetchProducts = useCallback(async (resetPage = false) => {
    setLoading(true);
    try {
      const page = resetPage ? 1 : currentPage;
      const params: Record<string, any> = { page, limit: itemsPerPage };
      if (search) params.search = search;
      if (categoryFilter) params.category = categoryFilter;

      const [productsRes, catRes] = await Promise.all([
        api.get('/products', { params }),
        categoriesFetched ? Promise.resolve(null) : api.get('/products/categories'),
      ]);

      const products: RawProduct[] = productsRes.data.data || productsRes.data || [];
      const pagination = productsRes.data.pagination || {};

      setItems(products);
      setTotalProducts(pagination.total ?? products.length);
      setTotalPages(pagination.totalPages ?? 1);
      if (resetPage) setCurrentPage(1);

      // Cache system stock for every product we load (accumulates across pages)
      setSystemStockCache(prev => {
        const next = { ...prev };
        for (const p of products) {
          next[p.product_id] = p.available_stock ?? p.stock_quantity ?? 0;
        }
        return next;
      });

      if (catRes) {
        setCategories(catRes.data.data || catRes.data || []);
        setCategoriesFetched(true);
      }
    } catch (err) {
      console.error('Failed to fetch products', err);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, itemsPerPage, search, categoryFilter, categoriesFetched]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const setCount = (productId: number, value: number | null) => {
    setCountsMap(prev => ({
      ...prev,
      [productId]: value === null ? null : Math.max(0, value),
    }));
  };

  const handleBarcodeSearch = async (code: string) => {
    if (!code.trim()) return;
    setBarcodeInput('');

    // First check current page
    const onPage = items.find(i => i.barcode === code.trim() || i.sku === code.trim());
    if (onPage) {
      const input = document.getElementById(`count-${onPage.product_id}`);
      if (input) { input.focus(); (input as HTMLInputElement).select(); }
      document.getElementById(`row-${onPage.product_id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Search server-side for this barcode
    try {
      const res = await api.get('/products', { params: { search: code.trim(), limit: 1 } });
      const products: RawProduct[] = res.data.data || res.data || [];
      if (products.length > 0) {
        // Cache its system stock and navigate to it via search
        setSystemStockCache(prev => ({
          ...prev,
          [products[0].product_id]: products[0].available_stock ?? products[0].stock_quantity ?? 0,
        }));
        setSearch(code.trim());
        setCurrentPage(1);
        success(`Found: ${products[0].product_name}`);
      } else {
        error(`Product not found: ${code}`);
      }
    } catch {
      error(`Product not found: ${code}`);
    }
  };

  const applyAdjustments = async () => {
    // Collect all counted discrepancies across all pages using cached system stock
    const discrepancies = Object.entries(countsMap)
      .filter(([id, count]) => count !== null && count !== (systemStockCache[+id] ?? 0))
      .map(([id, count]) => ({
        product_id: +id,
        physical_count: count as number,
        system_stock: systemStockCache[+id] ?? 0,
      }));

    if (discrepancies.length === 0) {
      error('No discrepancies to apply. Count products first, or there are no differences.');
      return;
    }
    const ok = await confirm({
      title: 'Apply Adjustments',
      message: `Apply ${discrepancies.length} stock adjustment(s) for counted items with discrepancies?`,
      type: 'warning',
    });
    if (!ok) return;

    setApplying(true);
    try {
      for (const item of discrepancies) {
        await api.post('/stock-adjustments', {
          product_id: item.product_id,
          adjustment_type: 'correction',
          quantity_adjusted: item.physical_count,
          reason: `Physical stock count — system: ${item.system_stock}, counted: ${item.physical_count}`,
        });
      }
      setApplySuccess(true);
      setTimeout(() => setApplySuccess(false), 3000);
      // Refresh current page (system stocks will have changed)
      fetchProducts();
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to apply adjustments');
    } finally {
      setApplying(false);
    }
  };

  const exportCSV = () => {
    const countedEntries = Object.entries(countsMap).filter(([, v]) => v !== null);
    if (countedEntries.length === 0) { error('No counted items to export.'); return; }

    const headers = ['Product ID', 'System Stock', 'Physical Count', 'Discrepancy', 'Status'];
    const rows = countedEntries.map(([id, count]) => {
      const systemStock = systemStockCache[+id] ?? 0;
      const diff = (count as number) - systemStock;
      return [id, systemStock, count, diff, diff === 0 ? 'Match' : diff > 0 ? 'Surplus' : 'Shortage'];
    });
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-count-${localToday()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Cross-page stats computed from countsMap + systemStockCache
  const countedIds = Object.keys(countsMap)
    .map(Number)
    .filter(id => countsMap[id] !== null);
  const countedItems = countedIds.length;
  const matchedItems = countedIds.filter(id => countsMap[id] === (systemStockCache[id] ?? 0)).length;
  const discrepancyItems = countedIds.filter(id => countsMap[id] !== (systemStockCache[id] ?? 0)).length;

  // Merge current page products with countsMap for display
  const pageItems: PageItem[] = items.map(p => {
    const systemStock = p.available_stock ?? p.stock_quantity ?? 0;
    const physical = countsMap[p.product_id] ?? null;
    const discrepancy = physical !== null ? physical - systemStock : null;
    return {
      product_id: p.product_id,
      product_name: p.product_name,
      barcode: p.barcode,
      sku: p.sku,
      category_name: p.category_name,
      system_stock: systemStock,
      physical_count: physical,
      discrepancy,
    };
  });

  // Status filter applied client-side to current page rows
  const displayItems = statusFilter
    ? pageItems.filter(item => {
        if (statusFilter === 'counted') return item.physical_count !== null;
        if (statusFilter === 'uncounted') return item.physical_count === null;
        if (statusFilter === 'match') return item.discrepancy === 0 && item.physical_count !== null;
        if (statusFilter === 'discrepancy') return item.discrepancy !== null && item.discrepancy !== 0;
        return true;
      })
    : pageItems;

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
            onClick={() => fetchProducts()}
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
          { label: 'Total Products', value: totalProducts.toLocaleString(), color: 'gray', icon: Package },
          { label: 'Counted', value: `${countedItems}/${totalProducts.toLocaleString()}`, color: 'blue', icon: ClipboardCheck },
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
      {totalProducts > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Count Progress</span>
            <span className="text-sm text-gray-500">
              {countedItems} of {totalProducts.toLocaleString()} products counted ({Math.round(countedItems / totalProducts * 100)}%)
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${(countedItems / totalProducts) * 100}%` }}
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
          {categories.map(c => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
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
                  {displayItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-gray-400 text-sm">
                        No products found
                      </td>
                    </tr>
                  ) : displayItems.map(item => (
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

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={totalProducts}
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
