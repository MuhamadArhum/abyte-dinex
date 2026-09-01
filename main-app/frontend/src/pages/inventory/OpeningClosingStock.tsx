import { useState, useCallback, useEffect } from 'react';
import { Package } from 'lucide-react';
import api from '../../utils/api';
import { localToday } from '../../utils/dateUtils';
import { useToast } from '../../components/Toast';
import DateRangeFilter from '../../components/DateRangeFilter';

const OpeningClosingStock = () => {
  const [data, setData]       = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(localToday());
  const [dateTo, setDateTo]     = useState(localToday());
  const { error } = useToast();

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory-reports/opening-closing', {
        params: { from_date: dateFrom, to_date: dateTo }
      });
      setData(res.data.data || []);
    } catch { error('Failed to load report'); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo]);

  useEffect(() => { fetchReport(); }, []);

  const fmt3 = (n: any) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const fmt2 = (n: any) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const closingColor = (opening: any, closing: any) => {
    const o = Number(opening || 0);
    const c = Number(closing || 0);
    if (c > o) return 'text-green-700 font-bold';
    if (c < o) return 'text-red-600 font-bold';
    return 'text-gray-700 font-bold';
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Package size={20} className="text-blue-600" /> Opening vs Closing Stock
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Stock movement summary for the selected period</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5 flex flex-wrap gap-4 items-center">
        <DateRangeFilter
          dateFrom={dateFrom} dateTo={dateTo}
          onFromChange={setDateFrom} onToChange={setDateTo}
          onApply={fetchReport} standalone={false}
        />
      </div>

      {data.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Total Products</p>
            <p className="text-2xl font-bold text-blue-900 mt-1">{data.length}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Total Opening Stock</p>
            <p className="text-2xl font-bold text-emerald-900 mt-1">
              {fmt3(data.reduce((s, r) => s + Number(r.opening_stock || 0), 0))}
            </p>
          </div>
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Total Closing Stock</p>
            <p className="text-2xl font-bold text-indigo-900 mt-1">
              {fmt3(data.reduce((s, r) => s + Number(r.closing_stock || 0), 0))}
            </p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">#</th>
                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Product</th>
                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Category</th>
                <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">Unit</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Opening Stock</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">+ Purchases</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">- Issues</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">- Sales</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Closing Stock</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Cost Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-16 text-center text-gray-400">
                  <Package size={40} className="mx-auto mb-2 opacity-20" />
                  <p>Select a date range and click Run Report</p>
                </td></tr>
              ) : data.map((row, i) => (
                <tr key={row.product_id || i} className={`hover:bg-gray-50 transition ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                  <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{row.product_name}</td>
                  <td className="px-4 py-2.5 text-gray-500">{row.category_name || '—'}</td>
                  <td className="px-4 py-2.5 text-center text-gray-500 text-xs">{row.unit || '—'}</td>
                  <td className="px-4 py-2.5 text-right text-gray-700">{fmt3(row.opening_stock)}</td>
                  <td className="px-4 py-2.5 text-right text-blue-700">+{fmt3(row.purchases_in_period)}</td>
                  <td className="px-4 py-2.5 text-right text-purple-700">-{fmt3(row.issues_in_period)}</td>
                  <td className="px-4 py-2.5 text-right text-orange-700">-{fmt3(row.sales_in_period)}</td>
                  <td className={`px-4 py-2.5 text-right ${closingColor(row.opening_stock, row.closing_stock)}`}>
                    {fmt3(row.closing_stock)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{fmt2(row.cost_price)}</td>
                </tr>
              ))}
            </tbody>
            {data.length > 0 && (
              <tfoot>
                <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
                  <td colSpan={4} className="px-4 py-3 text-right text-gray-700">Grand Total</td>
                  <td className="px-4 py-3 text-right text-gray-800">{fmt3(data.reduce((s, r) => s + Number(r.opening_stock || 0), 0))}</td>
                  <td className="px-4 py-3 text-right text-blue-700">{fmt3(data.reduce((s, r) => s + Number(r.purchases_in_period || 0), 0))}</td>
                  <td className="px-4 py-3 text-right text-purple-700">{fmt3(data.reduce((s, r) => s + Number(r.issues_in_period || 0), 0))}</td>
                  <td className="px-4 py-3 text-right text-orange-700">{fmt3(data.reduce((s, r) => s + Number(r.sales_in_period || 0), 0))}</td>
                  <td className="px-4 py-3 text-right text-gray-800">{fmt3(data.reduce((s, r) => s + Number(r.closing_stock || 0), 0))}</td>
                  <td></td>
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

export default OpeningClosingStock;
