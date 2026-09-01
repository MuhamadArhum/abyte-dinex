import { useState, useCallback, useEffect } from 'react';
import { Tag } from 'lucide-react';
import api from '../../utils/api';
import { localToday } from '../../utils/dateUtils';
import { useToast } from '../../components/Toast';
import DateRangeFilter from '../../components/DateRangeFilter';

const CategoryWisePurchase = () => {
  const [data, setData]           = useState<any[]>([]);
  const [grandTotal, setGrandTotal] = useState<any>(null);
  const [loading, setLoading]     = useState(false);
  const [dateFrom, setDateFrom]   = useState(localToday());
  const [dateTo, setDateTo]       = useState(localToday());
  const { error } = useToast();

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory-reports/category-wise-purchase', {
        params: { from_date: dateFrom, to_date: dateTo }
      });
      setData(res.data.data || []);
      setGrandTotal(res.data.grand_total ?? null);
    } catch { error('Failed to load report'); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo]);

  useEffect(() => { fetchReport(); }, []);

  const fmt3 = (n: any) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const fmt2 = (n: any) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const totalVouchers = data.reduce((s, r) => s + Number(r.voucher_count || 0), 0);
  const totalQty      = data.reduce((s, r) => s + Number(r.total_qty     || 0), 0);
  const totalAmount   = data.reduce((s, r) => s + Number(r.total_amount  || 0), 0);
  const gTotal        = grandTotal !== null ? Number(grandTotal) : totalAmount;

  const pct = (amount: any) => {
    if (!gTotal) return 0;
    return Math.min(100, (Number(amount || 0) / gTotal) * 100);
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Tag size={20} className="text-emerald-600" /> Category Wise Purchase
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Purchase summary grouped by category</p>
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
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Total Categories</p>
            <p className="text-2xl font-bold text-emerald-900 mt-1">{data.length}</p>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Total Vouchers</p>
            <p className="text-2xl font-bold text-blue-900 mt-1">{totalVouchers}</p>
          </div>
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Grand Total Amount</p>
            <p className="text-2xl font-bold text-indigo-900 mt-1">{fmt2(gTotal)}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">#</th>
                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Category</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Products</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Vouchers</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Total Qty</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Total Amount</th>
                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">% of Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-16 text-center text-gray-400">
                  <Tag size={40} className="mx-auto mb-2 opacity-20" />
                  <p>Select a date range and click Run Report</p>
                </td></tr>
              ) : data.map((row, i) => {
                const percentage = pct(row.total_amount);
                return (
                  <tr key={row.category_name || i} className={`hover:bg-gray-50 transition ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                    <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{row.category_name || '—'}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{row.product_count || 0}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{row.voucher_count || 0}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-blue-700">{fmt3(row.total_qty)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-indigo-700">{fmt2(row.total_amount)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${percentage}%` }} />
                        </div>
                        <span className="text-xs font-medium text-gray-600 w-10 text-right">{percentage.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {data.length > 0 && (
              <tfoot>
                <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
                  <td colSpan={3} className="px-4 py-3 text-right text-gray-700">Grand Total</td>
                  <td className="px-4 py-3 text-right text-gray-700">{totalVouchers}</td>
                  <td className="px-4 py-3 text-right text-blue-700">{fmt3(totalQty)}</td>
                  <td className="px-4 py-3 text-right text-indigo-700">{fmt2(gTotal)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-emerald-200 rounded-full" />
                      <span className="text-xs font-medium text-gray-600 w-10 text-right">100%</span>
                    </div>
                  </td>
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

export default CategoryWisePurchase;
