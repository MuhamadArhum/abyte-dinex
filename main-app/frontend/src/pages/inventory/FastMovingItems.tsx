import { useState, useCallback, useEffect } from 'react';
import { TrendingUp } from 'lucide-react';
import api from '../../utils/api';
import { localToday } from '../../utils/dateUtils';
import { useToast } from '../../components/Toast';
import DateRangeFilter from '../../components/DateRangeFilter';

const FastMovingItems = () => {
  const [data, setData]       = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(localToday());
  const [dateTo, setDateTo]     = useState(localToday());
  const { error } = useToast();

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory-reports/fast-moving', {
        params: { from_date: dateFrom, to_date: dateTo }
      });
      setData(res.data.data || []);
    } catch { error('Failed to load report'); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo]);

  useEffect(() => { fetchReport(); }, []);

  const fmt3 = (n: any) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  const totalPurchased = data.reduce((s, r) => s + Number(r.total_purchased || 0), 0);
  const totalIssued    = data.reduce((s, r) => s + Number(r.total_issued    || 0), 0);

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <TrendingUp size={20} className="text-indigo-600" /> Fast Moving Items
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Products with highest purchase and issuance activity</p>
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
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Total Products</p>
            <p className="text-2xl font-bold text-indigo-900 mt-1">{data.length}</p>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Total Purchased Qty</p>
            <p className="text-2xl font-bold text-blue-900 mt-1">{fmt3(totalPurchased)}</p>
          </div>
          <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Total Issued Qty</p>
            <p className="text-2xl font-bold text-purple-900 mt-1">{fmt3(totalIssued)}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">#</th>
                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Product</th>
                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Category</th>
                <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">Unit</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Purchased Qty</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">PV Count</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Issued Qty</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Issue Txns</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Total Movement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-16 text-center text-gray-400">
                  <TrendingUp size={40} className="mx-auto mb-2 opacity-20" />
                  <p>Select a date range and click Run Report</p>
                </td></tr>
              ) : data.map((row, i) => (
                <tr key={row.product_id || i} className={`hover:bg-gray-50 transition ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                  <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{row.product_name}</td>
                  <td className="px-4 py-2.5 text-gray-500">{row.category_name || '—'}</td>
                  <td className="px-4 py-2.5 text-center text-gray-500 text-xs">{row.unit || '—'}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-blue-700">{fmt3(row.total_purchased)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{row.purchase_vouchers || 0}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-purple-700">{fmt3(row.total_issued)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{row.issue_transactions || 0}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-indigo-700">{fmt3(row.total_movement)}</td>
                </tr>
              ))}
            </tbody>
            {data.length > 0 && (
              <tfoot>
                <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
                  <td colSpan={4} className="px-4 py-3 text-right text-gray-700">Grand Total</td>
                  <td className="px-4 py-3 text-right text-blue-700">{fmt3(totalPurchased)}</td>
                  <td></td>
                  <td className="px-4 py-3 text-right text-purple-700">{fmt3(totalIssued)}</td>
                  <td></td>
                  <td className="px-4 py-3 text-right text-indigo-700">{fmt3(totalPurchased + totalIssued)}</td>
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

export default FastMovingItems;
