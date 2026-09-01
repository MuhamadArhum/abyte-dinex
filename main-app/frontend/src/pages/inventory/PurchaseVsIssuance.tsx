import { useState, useCallback, useEffect } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import api from '../../utils/api';
import { localToday } from '../../utils/dateUtils';
import { useToast } from '../../components/Toast';
import DateRangeFilter from '../../components/DateRangeFilter';

const PurchaseVsIssuance = () => {
  const [data, setData]       = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(localToday());
  const [dateTo, setDateTo]     = useState(localToday());
  const { error } = useToast();

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory-reports/purchase-vs-issuance', {
        params: { from_date: dateFrom, to_date: dateTo }
      });
      setData(res.data.data || []);
    } catch { error('Failed to load report'); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo]);

  useEffect(() => { fetchReport(); }, []);

  const fmt3 = (n: any) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const fmt2 = (n: any) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const totalPurchasedQty = data.reduce((s, r) => s + Number(r.purchased       || 0), 0);
  const totalIssuedQty    = data.reduce((s, r) => s + Number(r.issued          || 0), 0);
  const totalPurchaseAmt  = data.reduce((s, r) => s + Number(r.purchase_amount || 0), 0);
  const totalIssueAmt     = data.reduce((s, r) => s + Number(r.issue_amount    || 0), 0);
  const netDiff           = totalPurchasedQty - totalIssuedQty;

  const diffBadge = (diff: number) => {
    if (diff > 0) return (
      <span className="inline-flex items-center gap-1">
        <span className="font-semibold text-green-700">{fmt3(diff)}</span>
        <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700">Surplus</span>
      </span>
    );
    if (diff < 0) return (
      <span className="inline-flex items-center gap-1">
        <span className="font-semibold text-red-600">{fmt3(diff)}</span>
        <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700">Deficit</span>
      </span>
    );
    return <span className="font-semibold text-gray-500">{fmt3(diff)}</span>;
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <ArrowLeftRight size={20} className="text-teal-600" /> Purchase vs Issuance
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Compare purchased quantity against issued quantity per product</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5 flex flex-wrap gap-4 items-center">
        <DateRangeFilter
          dateFrom={dateFrom} dateTo={dateTo}
          onFromChange={setDateFrom} onToChange={setDateTo}
          onApply={fetchReport} standalone={false}
        />
      </div>

      {data.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
          <div className="bg-teal-50 border border-teal-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide">Total Products</p>
            <p className="text-2xl font-bold text-teal-900 mt-1">{data.length}</p>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Total Purchased Qty</p>
            <p className="text-2xl font-bold text-blue-900 mt-1">{fmt3(totalPurchasedQty)}</p>
          </div>
          <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Total Issued Qty</p>
            <p className="text-2xl font-bold text-purple-900 mt-1">{fmt3(totalIssuedQty)}</p>
          </div>
          <div className={`rounded-xl p-4 border ${netDiff >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
            <p className={`text-xs font-semibold uppercase tracking-wide ${netDiff >= 0 ? 'text-green-600' : 'text-red-600'}`}>Net Difference</p>
            <p className={`text-2xl font-bold mt-1 ${netDiff >= 0 ? 'text-green-900' : 'text-red-900'}`}>{fmt3(netDiff)}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" /></div>
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
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Purchase Amount</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Issued Qty</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Issue Amount</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Difference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-16 text-center text-gray-400">
                  <ArrowLeftRight size={40} className="mx-auto mb-2 opacity-20" />
                  <p>Select a date range and click Run Report</p>
                </td></tr>
              ) : data.map((row, i) => (
                <tr key={row.product_id || i} className={`hover:bg-gray-50 transition ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                  <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{row.product_name}</td>
                  <td className="px-4 py-2.5 text-gray-500">{row.category_name || '—'}</td>
                  <td className="px-4 py-2.5 text-center text-gray-500 text-xs">{row.unit || '—'}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-blue-700">{fmt3(row.purchased)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-700">{fmt2(row.purchase_amount)}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-purple-700">{fmt3(row.issued)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-700">{fmt2(row.issue_amount)}</td>
                  <td className="px-4 py-2.5 text-right">{diffBadge(Number(row.difference || 0))}</td>
                </tr>
              ))}
            </tbody>
            {data.length > 0 && (
              <tfoot>
                <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
                  <td colSpan={4} className="px-4 py-3 text-right text-gray-700">Grand Total</td>
                  <td className="px-4 py-3 text-right text-blue-700">{fmt3(totalPurchasedQty)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{fmt2(totalPurchaseAmt)}</td>
                  <td className="px-4 py-3 text-right text-purple-700">{fmt3(totalIssuedQty)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{fmt2(totalIssueAmt)}</td>
                  <td className="px-4 py-3 text-right">{diffBadge(netDiff)}</td>
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

export default PurchaseVsIssuance;
