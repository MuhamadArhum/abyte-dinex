import { useState, useCallback, useRef } from 'react';
import { History, Search } from 'lucide-react';
import api from '../../utils/api';
import { localToday } from '../../utils/dateUtils';
import { useToast } from '../../components/Toast';
import DateRangeFilter from '../../components/DateRangeFilter';

interface Product { product_id: number; product_name: string; barcode?: string; }

const RateHistory = () => {
  const [productSearch,   setProductSearch]   = useState('');
  const [productResults,  setProductResults]  = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [dateFrom, setDateFrom] = useState(localToday());
  const [dateTo,   setDateTo]   = useState(localToday());
  const [data,      setData]      = useState<any[]>([]);
  const [productInfo, setProductInfo] = useState<any>(null);
  const [loading,   setLoading]   = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const { error } = useToast();

  const searchProducts = async (q: string) => {
    setProductSearch(q);
    if (q.length < 2) { setProductResults([]); return; }
    try {
      const res = await api.get('/products', { params: { search: q, limit: 10 } });
      setProductResults(res.data.data || []);
    } catch { /* ignore */ }
  };

  const selectProduct = (p: Product) => {
    setSelectedProduct(p);
    setProductSearch(p.product_name);
    setProductResults([]);
  };

  const fetchReport = useCallback(async () => {
    if (!selectedProduct) return error('Select a product first');
    setLoading(true);
    try {
      const res = await api.get('/inventory-reports/rate-history', {
        params: { product_id: selectedProduct.product_id, from_date: dateFrom, to_date: dateTo }
      });
      setData(res.data.data || []);
      setProductInfo(res.data.product || null);
    } catch { error('Failed to load report'); }
    finally { setLoading(false); }
  }, [selectedProduct, dateFrom, dateTo]);

  const fmt3 = (n: any) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const fmt2 = (n: any) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = (d: string) => { try { return new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; } };

  const totalQty  = data.reduce((s, r) => s + Number(r.qty    || 0), 0);
  const totalAmt  = data.reduce((s, r) => s + Number(r.amount || 0), 0);
  const rates     = data.map(r => Number(r.rate || 0)).filter(n => n > 0);
  const minRate   = rates.length ? Math.min(...rates) : 0;
  const maxRate   = rates.length ? Math.max(...rates) : 0;

  const rateColor = (rate: any) => {
    const r = Number(rate || 0);
    if (r === minRate && rates.length > 1) return 'text-green-700 font-bold';
    if (r === maxRate && rates.length > 1) return 'text-red-600 font-bold';
    return 'text-gray-700';
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <History size={20} className="text-violet-600" /> Item Rate History
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Purchase rate history for a selected product</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5 flex flex-wrap gap-4 items-center">
        {/* Product search */}
        <div className="relative min-w-[260px] max-w-sm flex-1" ref={searchRef}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Product *</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
            <input
              type="text"
              value={productSearch}
              onChange={e => searchProducts(e.target.value)}
              placeholder="Search product by name..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 outline-none"
            />
            {productResults.length > 0 && (
              <div className="absolute z-20 left-0 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                {productResults.map(p => (
                  <button key={p.product_id} onClick={() => selectProduct(p)}
                    className="w-full text-left px-4 py-2.5 hover:bg-violet-50 text-sm border-b last:border-0 flex items-center justify-between">
                    <span className="font-medium text-gray-800">{p.product_name}</span>
                    {p.barcode && <span className="text-gray-400 text-xs ml-2">{p.barcode}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-end pt-5">
          <DateRangeFilter
            dateFrom={dateFrom} dateTo={dateTo}
            onFromChange={setDateFrom} onToChange={setDateTo}
            onApply={fetchReport} standalone={false}
          />
        </div>
      </div>

      {data.length > 0 && productInfo && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide">Total Purchases</p>
            <p className="text-2xl font-bold text-violet-900 mt-1">{data.length}</p>
            <p className="text-xs text-violet-600 mt-0.5">Total Qty: {fmt3(totalQty)}</p>
          </div>
          <div className="bg-green-50 border border-green-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-green-600 uppercase tracking-wide">Min Rate</p>
            <p className="text-2xl font-bold text-green-900 mt-1">{fmt2(minRate)}</p>
          </div>
          <div className="bg-red-50 border border-red-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Max Rate</p>
            <p className="text-2xl font-bold text-red-900 mt-1">{fmt2(maxRate)}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" /></div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">#</th>
                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Date</th>
                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">PV #</th>
                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Supplier</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Qty</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Rate</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-16 text-center text-gray-400">
                  <History size={40} className="mx-auto mb-2 opacity-20" />
                  <p>{selectedProduct ? 'No rate history found for selected period' : 'Select a product to view its rate history'}</p>
                </td></tr>
              ) : data.map((row, i) => (
                <tr key={i} className={`hover:bg-gray-50 transition ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                  <td className="px-4 py-2.5 text-gray-400">{i + 1}</td>
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{fmtDate(row.voucher_date)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-blue-700 font-semibold">{row.pv_number || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-700 max-w-[200px] truncate">{row.supplier_name || '—'}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-gray-700">{fmt3(row.qty)}</td>
                  <td className={`px-4 py-2.5 text-right ${rateColor(row.rate)}`}>{fmt2(row.rate)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-700">{fmt2(row.amount)}</td>
                </tr>
              ))}
            </tbody>
            {data.length > 0 && (
              <tfoot>
                <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
                  <td colSpan={4} className="px-4 py-3 text-right text-gray-700">Totals</td>
                  <td className="px-4 py-3 text-right text-gray-800">{fmt3(totalQty)}</td>
                  <td className="px-4 py-3 text-right text-gray-500 text-xs font-normal">
                    avg {fmt2(totalQty ? totalAmt / totalQty : 0)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-800">{fmt2(totalAmt)}</td>
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

export default RateHistory;
