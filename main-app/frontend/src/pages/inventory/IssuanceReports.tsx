import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, ArrowUpRight, ArrowDownLeft, ShoppingBag, TrendingUp } from 'lucide-react';
import api from '../../utils/api';
import { localToday } from '../../utils/dateUtils';
import { useToast } from '../../components/Toast';
import DateRangeFilter from '../../components/DateRangeFilter';

interface Section { section_id: number; section_name: string; }

const IssuanceReports = () => {
  const [summary, setSummary]     = useState<any>(null);
  const [topIssued, setTopIssued] = useState<any[]>([]);
  const [loading, setLoading]     = useState(false);
  const [dateFrom, setDateFrom]   = useState(localToday());
  const [dateTo, setDateTo]       = useState(localToday());
  const [sections, setSections]   = useState<Section[]>([]);
  const [sectionFilter, setSectionFilter] = useState('');
  const { error } = useToast();

  useEffect(() => {
    api.get('/sections').then(r => setSections(r.data.data || []));
  }, []);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory-reports/issuance-summary', {
        params: { from_date: dateFrom, to_date: dateTo, section_id: sectionFilter || undefined }
      });
      setSummary(res.data.summary);
      setTopIssued(res.data.top_issued_products || []);
    } catch { error('Failed to load report'); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo, sectionFilter]);

  const fmt    = (n: any) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtQty = (n: any) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <ClipboardList size={20} className="text-emerald-600" /> Stock Issuance Report
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Summary of stock issues, returns, and raw sales</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
            <select value={sectionFilter} onChange={e => setSectionFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">All Sections</option>
              {sections.map(s => <option key={s.section_id} value={s.section_id}>{s.section_name}</option>)}
            </select>
          </div>
          <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} onApply={fetchReport} standalone={false} />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
        </div>
      ) : summary ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <ArrowUpRight size={16} className="text-emerald-600" />
                <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Stock Issues</p>
              </div>
              <p className="text-3xl font-bold text-emerald-900">{summary.issues.count}</p>
              <p className="text-sm text-emerald-700 font-medium mt-1">
                Cost: <span className="font-bold">{fmt(summary.issues.amount)}</span>
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <ArrowDownLeft size={16} className="text-blue-600" />
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Issue Returns</p>
              </div>
              <p className="text-3xl font-bold text-blue-900">{summary.returns.count}</p>
              <p className="text-sm text-blue-700 font-medium mt-1">Return transactions</p>
            </div>
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShoppingBag size={16} className="text-orange-600" />
                <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Raw Sales</p>
              </div>
              <p className="text-3xl font-bold text-orange-900">{summary.raw_sales.count}</p>
              <p className="text-sm text-orange-700 font-medium mt-1">
                Revenue: <span className="font-bold">{fmt(summary.raw_sales.amount)}</span>
              </p>
            </div>
          </div>

          {/* Top Issued Products */}
          {topIssued.length > 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b flex items-center gap-2">
                <TrendingUp size={16} className="text-emerald-600" />
                <h2 className="font-semibold text-gray-800">Top Issued Products</h2>
                <span className="text-xs text-gray-400 ml-1">by quantity</span>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="bg-gray-800 text-white">
                    <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">#</th>
                    <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Product</th>
                    <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Total Qty Issued</th>
                    <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Total Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {topIssued.map((row, i) => (
                    <tr key={i} className={`hover:bg-gray-50 transition ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                      <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-900">{row.product_name}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-emerald-700">{fmtQty(row.total_qty)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-indigo-700">{fmt(row.total_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center text-gray-400">
              No issuance transactions found for the selected period
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center">
          <ClipboardList size={40} className="mx-auto mb-3 text-gray-200" />
          <p className="text-gray-400">Select filters and click Run Report to view issuance summary</p>
        </div>
      )}
    </div>
  );
};

export default IssuanceReports;
