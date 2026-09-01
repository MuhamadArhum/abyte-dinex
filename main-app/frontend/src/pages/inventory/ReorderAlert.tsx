import { useState, useCallback, useEffect } from 'react';
import { AlertTriangle, RefreshCw, Printer, Download } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';

const ReorderAlert = () => {
  const [data, setData]       = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { error } = useToast();

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory-reports/reorder-alert');
      setData(res.data.data || []);
    } catch { error('Failed to load report'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchReport(); }, []);

  const fmt3 = (n: any) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  const exportCSV = () => {
    const headers = ['#', 'Product', 'Category', 'Unit', 'Current Stock', 'Reorder Level', 'Avg Daily Usage', 'Days Remaining', 'Status'];
    const getStatus = (row: any) => {
      const stock = Number(row.current_stock || 0);
      const days  = row.days_remaining !== null ? Number(row.days_remaining) : null;
      if (stock <= 0) return 'Out of Stock';
      if (days !== null && days < 3) return 'Critical';
      return 'Low';
    };
    const rows = data.map((row, i) => [
      i + 1, row.product_name, row.category_name || '', row.unit || '',
      Number(row.current_stock || 0), Number(row.reorder_level || 0),
      Number(row.avg_daily_usage || 0),
      row.days_remaining !== null ? Number(row.days_remaining) : 'N/A',
      getStatus(row)
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url; a.download = 'reorder-alert.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const belowReorder = data.filter(r => Number(r.current_stock || 0) <= Number(r.reorder_level || 0)).length;
  const outOfStock   = data.filter(r => Number(r.current_stock || 0) <= 0).length;
  const critical     = data.filter(r => r.days_remaining !== null && Number(r.days_remaining) < 3 && Number(r.current_stock || 0) > 0).length;

  const daysCell = (days: any) => {
    if (days === null || days === undefined) return <span className="text-gray-400 text-xs">N/A</span>;
    const d = Number(days);
    if (d <= 0)  return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">Out</span>;
    if (d < 3)   return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">{d}d</span>;
    if (d < 7)   return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700">{d}d</span>;
    return              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">{d}d</span>;
  };

  const statusBadge = (row: any) => {
    const stock = Number(row.current_stock || 0);
    const days  = row.days_remaining !== null ? Number(row.days_remaining) : null;
    if (stock <= 0)                               return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">Out of Stock</span>;
    if (days !== null && days < 3)                return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">Critical</span>;
    return                                               <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">Low</span>;
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <AlertTriangle size={20} className="text-red-600" /> Reorder / Stock Alert
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Products at or below reorder level</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={exportCSV} disabled={loading || data.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition shadow-sm disabled:opacity-50">
            <Download size={14} /> <span className="hidden sm:inline">Export CSV</span>
          </button>
          <button onClick={() => window.print()} disabled={loading || data.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition shadow-sm disabled:opacity-50">
            <Printer size={14} /> <span className="hidden sm:inline">Print</span>
          </button>
          <button onClick={fetchReport} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition shadow-sm disabled:opacity-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> <span className="hidden sm:inline">Reload</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-yellow-600 uppercase tracking-wide">Below Reorder Level</p>
          <p className="text-2xl font-bold text-yellow-900 mt-1">{belowReorder}</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Out of Stock</p>
          <p className="text-2xl font-bold text-red-900 mt-1">{outOfStock}</p>
        </div>
        <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Critical (&lt;3 Days)</p>
          <p className="text-2xl font-bold text-orange-900 mt-1">{critical}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600" /></div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">#</th>
                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Product</th>
                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Category</th>
                <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">Unit</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Current Stock</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Reorder Level</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Avg Daily Usage</th>
                <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">Days Remaining</th>
                <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-16 text-center text-gray-400">
                  <AlertTriangle size={40} className="mx-auto mb-2 opacity-20" />
                  <p>No products below reorder level</p>
                </td></tr>
              ) : data.map((row, i) => (
                <tr key={row.product_id || i} className={`hover:bg-gray-50 transition ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                  <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{row.product_name}</td>
                  <td className="px-4 py-2.5 text-gray-500">{row.category_name || '—'}</td>
                  <td className="px-4 py-2.5 text-center text-gray-500 text-xs">{row.unit || '—'}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${Number(row.current_stock || 0) <= 0 ? 'text-red-600' : 'text-gray-800'}`}>
                    {fmt3(row.current_stock)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{fmt3(row.reorder_level)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{fmt3(row.avg_daily_usage)}</td>
                  <td className="px-4 py-2.5 text-center">{daysCell(row.days_remaining)}</td>
                  <td className="px-4 py-2.5 text-center">{statusBadge(row)}</td>
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

export default ReorderAlert;
