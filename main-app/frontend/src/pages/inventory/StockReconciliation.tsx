import { useState, useCallback } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';

const StockReconciliation = () => {
  const [data, setData]       = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch]   = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const { showToast } = useToast();

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory-reports/stock-reconciliation');
      setData(res.data.data || []);
      setFiltered(res.data.data || []);
    } catch { showToast('error', 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  const applyFilters = (rows: any[], q: string, type: string) => {
    return rows.filter(r => {
      const matchQ = !q || r.product_name.toLowerCase().includes(q.toLowerCase()) || (r.barcode || '').includes(q);
      const matchT = !type || r.product_type === type;
      return matchQ && matchT;
    });
  };

  const handleSearch = (q: string) => {
    setSearch(q);
    setFiltered(applyFilters(data, q, typeFilter));
  };

  const handleType = (t: string) => {
    setTypeFilter(t);
    setFiltered(applyFilters(data, search, t));
  };

  const fmt = (n: any) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  const typeLabel = (t: string) => {
    if (t === 'raw_material')  return <span className="px-2 py-0.5 text-xs bg-orange-50 text-orange-700 rounded">Raw</span>;
    if (t === 'semi_finished') return <span className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded">Semi</span>;
    return <span className="px-2 py-0.5 text-xs bg-emerald-50 text-emerald-700 rounded">Finished</span>;
  };

  const stockStatus = (row: any) => {
    if (row.current_stock < 0) return 'text-red-600 font-semibold';
    if (row.current_stock === 0) return 'text-gray-400';
    if (row.min_stock > 0 && row.current_stock <= row.min_stock) return 'text-orange-600 font-medium';
    return 'text-gray-900';
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <RefreshCw size={20} className="text-cyan-600" /> Stock Reconciliation
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Compare current stock vs transaction totals for all products</p>
        </div>
        <button onClick={fetchReport}
          className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-700">
          <RefreshCw size={15} /> <span className="hidden sm:inline">Reload</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
          <input type="text" value={search} onChange={e => handleSearch(e.target.value)}
            placeholder="Search product..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none" />
        </div>
        <select value={typeFilter} onChange={e => handleType(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none">
          <option value="">All Types</option>
          <option value="raw_material">Raw Material</option>
          <option value="semi_finished">Semi-Finished</option>
          <option value="finished_good">Finished Good</option>
        </select>
        <span className="text-sm text-gray-500">{filtered.length} products</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Purchased</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Pur. Return</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Issued</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Iss. Return</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Raw Sold</th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase bg-cyan-50">Current Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">
                    {data.length === 0 ? 'Click Reload to load stock data' : 'No products match the filter'}
                  </td></tr>
                ) : filtered.map((row, i) => (
                  <tr key={row.product_id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-2.5">
                      <span className="font-medium text-gray-900">{row.product_name}</span>
                      {row.barcode && <span className="block text-xs text-gray-400">{row.barcode}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">{typeLabel(row.product_type)}</td>
                    <td className="px-3 py-2.5 text-right text-emerald-700">{fmt(row.total_purchased)}</td>
                    <td className="px-3 py-2.5 text-right text-rose-600">{fmt(row.total_purchase_returns)}</td>
                    <td className="px-3 py-2.5 text-right text-orange-600">{fmt(row.total_issued)}</td>
                    <td className="px-3 py-2.5 text-right text-blue-600">{fmt(row.total_issue_returns)}</td>
                    <td className="px-3 py-2.5 text-right text-purple-600">{fmt(row.total_raw_sold)}</td>
                    <td className={`px-3 py-2.5 text-right bg-cyan-50 ${stockStatus(row)}`}>
                      {fmt(row.current_stock)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 inline-block"></span> Negative stock</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-100 inline-block"></span> Below min level</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100 inline-block"></span> Zero stock</span>
      </div>
    </div>
  );
};

export default StockReconciliation;
