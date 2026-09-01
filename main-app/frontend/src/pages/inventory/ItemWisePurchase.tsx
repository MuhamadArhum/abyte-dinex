import { useState, useCallback } from 'react';
import { PackageSearch, ShoppingCart, Hash, Weight, DollarSign } from 'lucide-react';
import api from '../../utils/api';
import { localToday } from '../../utils/dateUtils';
import { useToast } from '../../components/Toast';
import DateRangeFilter from '../../components/DateRangeFilter';

const ItemWisePurchase = () => {
  const [data, setData]       = useState<any[]>([]);
  const [totals, setTotals]   = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(localToday());
  const [dateTo, setDateTo]     = useState(localToday());
  const { error } = useToast();

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory-reports/item-wise-purchase', {
        params: { from_date: dateFrom, to_date: dateTo }
      });
      setData(res.data.data || []);
      setTotals(res.data.totals);
    } catch { error('Failed to load report'); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo]);

  const fmt    = (n: any) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const fmtAmt = (n: any) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const typeLabel = (t: string) => {
    if (t === 'raw_material')  return <span className="px-2 py-0.5 text-xs bg-orange-50 text-orange-700 rounded font-medium">Raw Material</span>;
    if (t === 'semi_finished') return <span className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded font-medium">Semi-Finished</span>;
    return <span className="px-2 py-0.5 text-xs bg-emerald-50 text-emerald-700 rounded font-medium">Finished Good</span>;
  };

  const totalVouchers = data.reduce((s, r) => s + Number(r.voucher_count || 0), 0);

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <PackageSearch size={20} className="text-indigo-600" /> Item Wise Purchase
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Purchase summary grouped by product</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
        <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} onApply={fetchReport} />
      </div>

      {totals && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Hash size={15} className="text-indigo-600" />
              <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Products</p>
            </div>
            <p className="text-2xl font-bold text-indigo-900">{data.length}</p>
          </div>
          <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart size={15} className="text-purple-600" />
              <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Vouchers</p>
            </div>
            <p className="text-2xl font-bold text-purple-900">{totalVouchers}</p>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Weight size={15} className="text-blue-600" />
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Total Qty</p>
            </div>
            <p className="text-2xl font-bold text-blue-900">{fmt(totals.grand_qty)}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign size={15} className="text-emerald-600" />
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Total Amount</p>
            </div>
            <p className="text-2xl font-bold text-emerald-900">{fmtAmt(totals.grand_total)}</p>
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
                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Type</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Vouchers</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Total Qty</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Avg Price</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Total Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-16 text-center text-gray-400">
                  <PackageSearch size={40} className="mx-auto mb-2 opacity-20" />
                  <p>Select filters and click Run Report to view data</p>
                </td></tr>
              ) : data.map((row, i) => (
                <tr key={row.product_id} className={`hover:bg-gray-50 transition ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                  <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{row.product_name}</td>
                  <td className="px-4 py-2.5">{typeLabel(row.product_type)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{row.voucher_count}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-blue-700">{fmt(row.total_qty)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{fmtAmt(row.avg_unit_price)}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-indigo-700">{fmtAmt(row.total_amount)}</td>
                </tr>
              ))}
            </tbody>
            {data.length > 0 && totals && (
              <tfoot>
                <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
                  <td colSpan={4} className="px-4 py-3 text-right text-gray-700">Grand Total</td>
                  <td className="px-4 py-3 text-right text-blue-700">{fmt(totals.grand_qty)}</td>
                  <td></td>
                  <td className="px-4 py-3 text-right text-indigo-700">{fmtAmt(totals.grand_total)}</td>
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

export default ItemWisePurchase;
