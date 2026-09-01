import { useState, useEffect, useCallback } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';

const SlowMovingStock = () => {
  const [data, setData]       = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [days, setDays]       = useState(30);
  const { error } = useToast();

  const fetchReport = useCallback(async (d: number) => {
    setLoading(true);
    try {
      const res = await api.get('/inventory-reports/slow-moving', { params: { days: d } });
      setData(res.data.data || []);
    } catch { error('Failed to load report'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchReport(days); }, [days]);

  const fmt3 = (n: any) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const fmt2 = (n: any) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = (d: string) => { try { return new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; } };

  const totalValue  = data.reduce((s, r) => s + Number(r.value_at_risk || 0), 0);
  const activeItems = data.filter(r => r.days_inactive !== null);
  const avgDays     = activeItems.length
    ? Math.round(activeItems.reduce((s, r) => s + Number(r.days_inactive || 0), 0) / activeItems.length)
    : 0;

  const badge = (days_inactive: number | null) => {
    if (days_inactive === null)  return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">Never Active</span>;
    if (days_inactive > 90)      return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">{days_inactive} days</span>;
    if (days_inactive > 60)      return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700">{days_inactive} days</span>;
    return                              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">{days_inactive} days</span>;
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Clock size={20} className="text-orange-600" /> Slow Moving / Dead Stock
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Products with no activity for the selected period</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5 flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-gray-700">Inactive for:</span>
        {[7, 30, 60, 90].map(d => (
          <button key={d} onClick={() => setDays(d)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${days === d ? 'bg-orange-600 text-white shadow-sm' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {d} Days
          </button>
        ))}
      </div>

      {data.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Items Found</p>
            <p className="text-2xl font-bold text-orange-900 mt-1">{data.length}</p>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Value at Risk</p>
            <p className="text-2xl font-bold text-red-900 mt-1">{fmt2(totalValue)}</p>
          </div>
          <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-yellow-600 uppercase tracking-wide">Avg Days Inactive</p>
            <p className="text-2xl font-bold text-yellow-900 mt-1">{avgDays}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" /></div>
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
                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Last Activity</th>
                <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">Days Inactive</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Value at Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-16 text-center text-gray-400">
                  <AlertTriangle size={40} className="mx-auto mb-2 opacity-20" />
                  <p>No slow-moving products found for {days} days</p>
                </td></tr>
              ) : data.map((row, i) => (
                <tr key={row.product_id || i} className={`hover:bg-gray-50 transition ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                  <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{row.product_name}</td>
                  <td className="px-4 py-2.5 text-gray-500">{row.category_name || '—'}</td>
                  <td className="px-4 py-2.5 text-center text-gray-500 text-xs">{row.unit || '—'}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-gray-700">{fmt3(row.current_stock)}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{row.last_activity_date ? fmtDate(row.last_activity_date) : '—'}</td>
                  <td className="px-4 py-2.5 text-center">{badge(row.days_inactive)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-red-700">{fmt2(row.value_at_risk)}</td>
                </tr>
              ))}
            </tbody>
            {data.length > 0 && (
              <tfoot>
                <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
                  <td colSpan={7} className="px-4 py-3 text-right text-gray-700">Total Value at Risk</td>
                  <td className="px-4 py-3 text-right text-red-700">{fmt2(totalValue)}</td>
                </tr>
              </tfoot>
            )}
          </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SlowMovingStock;
