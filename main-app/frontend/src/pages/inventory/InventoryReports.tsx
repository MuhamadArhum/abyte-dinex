import { useState, useEffect } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { BarChart3, Package, DollarSign, AlertTriangle, XCircle, TrendingUp, Tag, Clock, Layers, RotateCcw, ArrowLeftRight, Skull, SlidersHorizontal, Star, Download } from 'lucide-react';
import DateRangeFilter from '../../components/DateRangeFilter';
import api from '../../utils/api';
import { localToday } from '../../utils/dateUtils';
import ReportPasswordGate from '../../components/ReportPasswordGate';

interface TopProduct {
  product_id: number;
  product_name: string;
  category_name: string | null;
  units_sold: number;
  revenue: number;
}

interface CategoryData {
  category_id: number;
  category_name: string;
  product_count: number;
  total_stock: number;
  stock_value: number;
}

interface SlowMover {
  product_id: number;
  product_name: string;
  category_name: string | null;
  current_stock: number;
  last_sale_date: string | null;
  days_since_last_sale: number | null;
  value_at_risk: number;
}

const InventoryReports = () => {
  const { currencySymbol: currency } = useSettings();
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(localToday());
  const [dateTo, setDateTo] = useState(localToday());
  const [summary, setSummary] = useState({
    total_products: 0, total_stock_value: 0, total_units: 0, low_stock_count: 0, out_of_stock_count: 0
  });
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [slowMovers, setSlowMovers] = useState<SlowMover[]>([]);
  const [stockValuation,     setStockValuation]     = useState<{ summary: any; by_category: any[]; products: any[] }>({ summary: {}, by_category: [], products: [] });
  const [purchaseReturns,    setPurchaseReturns]    = useState<{ summary: any; data: any[]; by_supplier: any[] }>({ summary: {}, data: [], by_supplier: [] });
  const [stockTransfers,     setStockTransfers]     = useState<{ summary: any; data: any[] }>({ summary: {}, data: [] });
  const [deadStock,          setDeadStock]          = useState<{ summary: any; data: any[] }>({ summary: {}, data: [] });
  const [stockAdjustments,   setStockAdjustments]   = useState<{ summary: any; by_type: any[]; data: any[] }>({ summary: {}, by_type: [], data: [] });
  const [supplierPerformance,setSupplierPerformance]= useState<{ summary: any; data: any[] }>({ summary: {}, data: [] });

  const exportCSV = (rows: any[], filename: string) => {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]).join(',');
    const body    = rows.map(r => Object.values(r).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([headers + '\n' + body], { type: 'text/csv' }));
    a.download = filename; a.click();
  };

  const fetchAll = async (from = dateFrom, to = dateTo) => {
    setLoading(true);
    try {
      const params = { date_from: from, date_to: to };
      const [summaryRes, topRes, catRes, slowRes,
             valRes, prRes, trRes, deadRes, adjRes, supRes] = await Promise.all([
        api.get('/inventory-reports/summary'),
        api.get('/inventory-reports/top-products', { params: { limit: 10, date_from: from, date_to: to } }),
        api.get('/inventory-reports/category-breakdown'),
        api.get('/inventory-reports/slow-movers', { params: { days: 30 } }),
        api.get('/inventory-reports/stock-valuation'),
        api.get('/inventory-reports/purchase-returns', { params }),
        api.get('/inventory-reports/stock-transfers', { params }),
        api.get('/inventory-reports/dead-stock', { params: { days: 90 } }),
        api.get('/inventory-reports/stock-adjustments', { params }),
        api.get('/inventory-reports/supplier-performance', { params }),
      ]);
      setSummary(summaryRes.data);
      setTopProducts(topRes.data.data || []);
      setCategories(catRes.data.data || []);
      setSlowMovers(slowRes.data.data || []);
      setStockValuation({ summary: valRes.data.summary || {}, by_category: valRes.data.by_category || [], products: valRes.data.products || [] });
      setPurchaseReturns({ summary: prRes.data.summary || {}, data: prRes.data.data || [], by_supplier: prRes.data.by_supplier || [] });
      setStockTransfers({ summary: trRes.data.summary || {}, data: trRes.data.data || [] });
      setDeadStock({ summary: deadRes.data.summary || {}, data: deadRes.data.data || [] });
      setStockAdjustments({ summary: adjRes.data.summary || {}, by_type: adjRes.data.by_type || [], data: adjRes.data.data || [] });
      setSupplierPerformance({ summary: supRes.data.summary || {}, data: supRes.data.data || [] });
    } catch (error) {
      console.error('Failed to fetch reports', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  const maxUnitsSold = topProducts.length > 0 ? topProducts[0].units_sold : 1;

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900 flex items-center gap-3">
          <BarChart3 className="text-emerald-600" size={20} />
          Inventory Reports
        </h1>
        <p className="text-gray-500 mt-1">Stock analytics and performance insights</p>
      </div>

      <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} onApply={() => fetchAll()} />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 rounded-xl"><Package size={24} className="text-emerald-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{summary.total_products}</p>
              <p className="text-sm text-gray-500">Total Products</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 rounded-xl"><DollarSign size={24} className="text-emerald-600" /></div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{currency}{Number(summary.total_stock_value).toLocaleString()}</p>
              <p className="text-sm text-gray-500">Stock Value</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-50 rounded-xl"><AlertTriangle size={24} className="text-yellow-600" /></div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{summary.low_stock_count}</p>
              <p className="text-sm text-gray-500">Low Stock</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-50 rounded-xl"><XCircle size={24} className="text-red-600" /></div>
            <div>
              <p className="text-2xl font-bold text-red-600">{summary.out_of_stock_count}</p>
              <p className="text-sm text-gray-500">Out of Stock</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Top Selling Products */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center gap-2">
            <TrendingUp size={20} className="text-emerald-600" />
            <h2 className="font-semibold text-gray-800">Top Selling Products</h2>
          </div>
          {topProducts.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No sales data available</div>
          ) : (
            <div className="p-4 space-y-3">
              {topProducts.map((p, idx) => (
                <div key={p.product_id} className="flex items-center gap-3">
                  <span className="w-6 text-center font-bold text-gray-400 text-sm">#{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-800 text-sm truncate">{p.product_name}</span>
                      <span className="text-sm text-gray-500 ml-2 shrink-0">{Number(p.units_sold)} sold</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-emerald-500 h-2 rounded-full transition-all"
                        style={{ width: `${(Number(p.units_sold) / maxUnitsSold) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center gap-2">
            <Tag size={20} className="text-emerald-600" />
            <h2 className="font-semibold text-gray-800">Category Breakdown</h2>
          </div>
          {categories.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No categories found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="p-3 text-left">Category</th>
                    <th className="p-3 text-right">Products</th>
                    <th className="p-3 text-right">Stock</th>
                    <th className="p-3 text-right">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {categories.map((c) => (
                    <tr key={c.category_id} className="hover:bg-gray-50">
                      <td className="p-3 font-medium text-gray-800">{c.category_name}</td>
                      <td className="p-3 text-right text-gray-600">{Number(c.product_count)}</td>
                      <td className="p-3 text-right text-gray-600">{Number(c.total_stock)}</td>
                      <td className="p-3 text-right font-medium text-gray-800">{currency}{Number(c.stock_value).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Slow Movers */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center gap-2">
          <Clock size={20} className="text-orange-600" />
          <h2 className="font-semibold text-gray-800">Slow Moving Products</h2>
          <span className="text-sm text-gray-400 ml-1">(not sold in 30+ days)</span>
        </div>
        {slowMovers.length === 0 ? (
          <div className="p-8 text-center text-gray-400">All products are selling well</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 font-medium">
                <tr>
                  <th className="p-4 text-left">Product</th>
                  <th className="p-4 text-left">Category</th>
                  <th className="p-4 text-right">Current Stock</th>
                  <th className="p-4 text-right">Days Since Sale</th>
                  <th className="p-4 text-right">Value at Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {slowMovers.map((p) => (
                  <tr key={p.product_id} className="hover:bg-gray-50">
                    <td className="p-4 font-medium text-gray-800">{p.product_name}</td>
                    <td className="p-4 text-gray-500">{p.category_name || 'Uncategorized'}</td>
                    <td className="p-4 text-right text-gray-600">{Number(p.current_stock)}</td>
                    <td className="p-4 text-right">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.days_since_last_sale === null ? 'bg-red-100 text-red-700' :
                        Number(p.days_since_last_sale) > 90 ? 'bg-red-100 text-red-700' :
                        Number(p.days_since_last_sale) > 60 ? 'bg-orange-100 text-orange-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {p.days_since_last_sale === null ? 'Never sold' : `${p.days_since_last_sale} days`}
                      </span>
                    </td>
                    <td className="p-4 text-right font-medium text-red-600">{currency}{Number(p.value_at_risk).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Stock Valuation ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-6">
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-2"><Layers size={18} className="text-emerald-600" /><h3 className="font-semibold text-gray-800">Stock Valuation Report</h3></div>
          <button onClick={() => exportCSV(stockValuation.products, 'stock_valuation.csv')} className="text-xs text-gray-500 hover:text-emerald-600 flex items-center gap-1"><Download size={14} /> CSV</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-5">
          {[
            { label: 'Total Units', value: String(stockValuation.summary.total_units || 0), color: 'text-gray-800' },
            { label: 'Cost Value', value: `${currency}${Number(stockValuation.summary.total_cost_value || 0).toLocaleString()}`, color: 'text-red-600' },
            { label: 'Retail Value', value: `${currency}${Number(stockValuation.summary.total_retail_value || 0).toLocaleString()}`, color: 'text-emerald-600' },
            { label: 'Potential Profit', value: `${currency}${Number(stockValuation.summary.potential_profit || 0).toLocaleString()}`, color: 'text-blue-600' },
            { label: 'Margin %', value: `${stockValuation.summary.margin_pct || 0}%`, color: Number(stockValuation.summary.margin_pct) >= 30 ? 'text-emerald-600' : 'text-orange-500' },
            { label: 'Products', value: String(stockValuation.summary.total_products || 0), color: 'text-gray-800' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-4 text-center">
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-600 mb-3">By Category</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>
                {['Category', 'Products', 'Units', 'Cost Value', 'Retail Value'].map(h => <th key={h} className="px-4 py-2 text-left font-semibold text-gray-600">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {stockValuation.by_category.map(r => (
                  <tr key={r.category_name} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-800">{r.category_name}</td>
                    <td className="px-4 py-2 text-gray-600">{r.product_count}</td>
                    <td className="px-4 py-2 text-gray-600">{r.total_units}</td>
                    <td className="px-4 py-2 text-red-500">{currency}{Number(r.cost_value).toLocaleString()}</td>
                    <td className="px-4 py-2 font-bold text-emerald-600">{currency}{Number(r.retail_value).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Purchase Returns ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-6">
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-2"><RotateCcw size={18} className="text-orange-500" /><h3 className="font-semibold text-gray-800">Purchase Returns Report</h3></div>
          <button onClick={() => exportCSV(purchaseReturns.data, 'purchase_returns.csv')} className="text-xs text-gray-500 hover:text-emerald-600 flex items-center gap-1"><Download size={14} /> CSV</button>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-5">
          {[
            { label: 'Total Returns', value: String(purchaseReturns.summary.total_returns || 0), color: 'text-gray-800' },
            { label: 'Total Amount', value: `${currency}${Number(purchaseReturns.summary.total_amount || 0).toFixed(0)}`, color: 'text-red-600' },
            { label: 'Suppliers Involved', value: String(purchaseReturns.summary.unique_suppliers || 0), color: 'text-gray-800' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-4 text-center">
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
        {purchaseReturns.data.length === 0 ? <p className="text-center text-gray-400 py-6">No purchase returns in this period</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-gray-50"><tr>
                {['PR #', 'Date', 'Supplier', 'Original PV', 'Items', 'Amount', 'Created By'].map(h => <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {purchaseReturns.data.map(r => (
                  <tr key={r.pr_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-blue-600">{r.pr_number}</td>
                    <td className="px-4 py-3 text-gray-600">{new Date(r.return_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{r.supplier_name}</td>
                    <td className="px-4 py-3 text-gray-500">{r.original_voucher || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{r.item_count}</td>
                    <td className="px-4 py-3 font-bold text-red-600">{currency}{Number(r.total_amount).toFixed(0)}</td>
                    <td className="px-4 py-3 text-gray-500">{r.created_by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Stock Transfers ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-6">
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-2"><ArrowLeftRight size={18} className="text-teal-600" /><h3 className="font-semibold text-gray-800">Stock Transfer Report</h3></div>
          <button onClick={() => exportCSV(stockTransfers.data, 'stock_transfers.csv')} className="text-xs text-gray-500 hover:text-emerald-600 flex items-center gap-1"><Download size={14} /> CSV</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Transfers', value: String(stockTransfers.summary.total_transfers || 0), color: 'text-gray-800' },
            { label: 'Completed', value: String(stockTransfers.summary.completed || 0), color: 'text-emerald-600' },
            { label: 'Pending', value: String(stockTransfers.summary.pending || 0), color: 'text-yellow-600' },
            { label: 'Qty Moved', value: String(stockTransfers.summary.total_qty_moved || 0), color: 'text-teal-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-4 text-center">
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
        {stockTransfers.data.length === 0 ? <p className="text-center text-gray-400 py-6">No stock transfers in this period</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[750px]">
              <thead className="bg-gray-50"><tr>
                {['Date', 'Product', 'From Branch', 'To Branch', 'Qty', 'Value', 'Status', 'By'].map(h => <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {stockTransfers.data.map(r => (
                  <tr key={r.transfer_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">{new Date(r.transfer_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{r.product_name}</td>
                    <td className="px-4 py-3 text-gray-600">{r.from_branch}</td>
                    <td className="px-4 py-3 text-gray-600">{r.to_branch}</td>
                    <td className="px-4 py-3 font-bold text-teal-600">{r.quantity} {r.unit}</td>
                    <td className="px-4 py-3 text-gray-600">{currency}{Number(r.transfer_value).toFixed(0)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${r.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : r.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{r.status}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{r.created_by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Dead Stock ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-6">
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-2"><Skull size={18} className="text-red-600" /><h3 className="font-semibold text-gray-800">Dead Stock Report <span className="text-sm font-normal text-gray-400">(90+ days no movement)</span></h3></div>
          <button onClick={() => exportCSV(deadStock.data, 'dead_stock.csv')} className="text-xs text-gray-500 hover:text-emerald-600 flex items-center gap-1"><Download size={14} /> CSV</button>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-5">
          {[
            { label: 'Dead Stock Items', value: String(deadStock.summary.total_items || 0), color: 'text-red-600' },
            { label: 'Capital Locked', value: `${currency}${Number(deadStock.summary.total_dead_value || 0).toLocaleString()}`, color: 'text-red-600' },
            { label: 'Threshold', value: `${deadStock.summary.threshold_days || 90} days`, color: 'text-gray-800' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-4 text-center">
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
        {deadStock.data.length === 0 ? <p className="text-center text-gray-400 py-6">No dead stock — great!</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-gray-50"><tr>
                {['Product', 'SKU', 'Category', 'Stock', 'Cost Price', 'Dead Value', 'Last Movement', 'Days Inactive'].map(h => <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {deadStock.data.map(r => (
                  <tr key={r.product_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-800">{r.product_name}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{r.sku || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{r.category_name}</td>
                    <td className="px-4 py-3 font-bold text-gray-700">{r.current_stock} {r.unit}</td>
                    <td className="px-4 py-3 text-gray-600">{currency}{Number(r.cost_price).toFixed(0)}</td>
                    <td className="px-4 py-3 font-bold text-red-600">{currency}{Number(r.dead_stock_value).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-500">{r.last_movement_date ? new Date(r.last_movement_date).toLocaleDateString() : 'Never'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${!r.days_inactive || r.days_inactive > 180 ? 'bg-red-100 text-red-700' : r.days_inactive > 90 ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {r.days_inactive ? `${r.days_inactive}d` : 'Never moved'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Stock Adjustments ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-6">
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-2"><SlidersHorizontal size={18} className="text-indigo-600" /><h3 className="font-semibold text-gray-800">Stock Adjustment Report</h3></div>
          <button onClick={() => exportCSV(stockAdjustments.data, 'stock_adjustments.csv')} className="text-xs text-gray-500 hover:text-emerald-600 flex items-center gap-1"><Download size={14} /> CSV</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Adjustments', value: String(stockAdjustments.summary.total_adjustments || 0), color: 'text-gray-800' },
            { label: 'Net Adjustment', value: `${Number(stockAdjustments.summary.net_adjustment || 0) > 0 ? '+' : ''}${stockAdjustments.summary.net_adjustment || 0}`, color: Number(stockAdjustments.summary.net_adjustment) >= 0 ? 'text-emerald-600' : 'text-red-600' },
            { label: 'Total Added', value: `+${stockAdjustments.summary.total_additions || 0}`, color: 'text-emerald-600' },
            { label: 'Total Removed', value: `-${stockAdjustments.summary.total_subtractions || 0}`, color: 'text-red-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-4 text-center">
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
        {stockAdjustments.by_type.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {stockAdjustments.by_type.map(t => (
              <span key={t.adjustment_type} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-semibold capitalize">
                {t.adjustment_type}: {t.count} ({t.total_qty > 0 ? '+' : ''}{t.total_qty})
              </span>
            ))}
          </div>
        )}
        {stockAdjustments.data.length === 0 ? <p className="text-center text-gray-400 py-6">No adjustments in this period</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-gray-50"><tr>
                {['Date', 'Product', 'Type', 'Before', 'Adjusted', 'After', 'Reason', 'By'].map(h => <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {stockAdjustments.data.map(r => (
                  <tr key={r.adjustment_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{r.product_name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold capitalize ${['addition','return','opening_stock'].includes(r.adjustment_type) ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{r.adjustment_type.replace('_', ' ')}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.quantity_before}</td>
                    <td className="px-4 py-3 font-bold">
                      <span className={Number(r.quantity_adjusted) >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                        {Number(r.quantity_adjusted) > 0 ? '+' : ''}{r.quantity_adjusted}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-800">{r.quantity_after}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-[150px]">{r.reason || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{r.created_by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Supplier Performance ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-6">
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-2"><Star size={18} className="text-yellow-500" /><h3 className="font-semibold text-gray-800">Supplier Performance Report</h3></div>
          <button onClick={() => exportCSV(supplierPerformance.data, 'supplier_performance.csv')} className="text-xs text-gray-500 hover:text-emerald-600 flex items-center gap-1"><Download size={14} /> CSV</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          {[
            { label: 'Total Suppliers', value: String(supplierPerformance.summary.total_suppliers || 0), color: 'text-gray-800' },
            { label: 'Grand Total Purchased', value: `${currency}${Number(supplierPerformance.summary.grand_total || 0).toLocaleString()}`, color: 'text-emerald-600' },
            { label: 'Total Returned', value: `${currency}${Number(supplierPerformance.summary.grand_returned || 0).toLocaleString()}`, color: 'text-red-600' },
            { label: 'Return Rate', value: `${supplierPerformance.summary.overall_return_pct || 0}%`, color: Number(supplierPerformance.summary.overall_return_pct) > 5 ? 'text-red-600' : 'text-emerald-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-4 text-center">
              <p className={`text-xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
        {supplierPerformance.data.length === 0 ? <p className="text-center text-gray-400 py-6">No supplier purchase data in this period</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-gray-50"><tr>
                {['#', 'Supplier', 'Phone', 'Orders', 'Total Purchased', 'Avg Order', 'Returns', 'Returned Amount', 'Return Rate', 'Net'].map(h => <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {supplierPerformance.data.map((r, i) => (
                  <tr key={r.supplier_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800">{r.supplier_name}</td>
                    <td className="px-4 py-3 text-gray-500">{r.phone || '—'}</td>
                    <td className="px-4 py-3 font-bold text-indigo-600">{r.order_count}</td>
                    <td className="px-4 py-3 font-bold text-emerald-600">{currency}{Number(r.total_purchased).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-600">{currency}{Number(r.avg_order_value).toFixed(0)}</td>
                    <td className="px-4 py-3 text-gray-700">{r.return_count}</td>
                    <td className="px-4 py-3 text-red-500">{currency}{Number(r.total_returned).toFixed(0)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${r.return_rate_pct > 10 ? 'bg-red-100 text-red-700' : r.return_rate_pct > 5 ? 'bg-yellow-100 text-yellow-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {r.return_rate_pct}%
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-800">{currency}{Number(r.net_purchases).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const InventoryReportsWithGate = () => <ReportPasswordGate><InventoryReports /></ReportPasswordGate>;
export default InventoryReportsWithGate;
