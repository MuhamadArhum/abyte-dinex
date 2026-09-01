import { useState, useCallback, useRef } from 'react';
import { Search, BookOpen, TrendingUp, TrendingDown, Package } from 'lucide-react';
import api from '../../utils/api';
import { localToday } from '../../utils/dateUtils';
import { useToast } from '../../components/Toast';
import DateRangeFilter from '../../components/DateRangeFilter';

interface Product { product_id: number; product_name: string; barcode?: string; }

const ItemsLedger = () => {
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [dateFrom, setDateFrom] = useState(localToday());
  const [dateTo, setDateTo]     = useState(localToday());
  const [ledger, setLedger]     = useState<any[]>([]);
  const [productInfo, setProductInfo] = useState<any>(null);
  const [loading, setLoading]   = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const { error } = useToast();

  const searchProducts = async (q: string) => {
    setProductSearch(q);
    if (q.length < 2) { setProductResults([]); return; }
    const res = await api.get('/products', { params: { search: q, limit: 10 } });
    setProductResults(res.data.data || []);
  };

  const selectProduct = (p: Product) => {
    setSelectedProduct(p); setProductSearch(p.product_name); setProductResults([]);
  };

  const fetchLedger = useCallback(async () => {
    if (!selectedProduct) return error('Select a product first');
    setLoading(true);
    try {
      const res = await api.get('/inventory-reports/items-ledger', {
        params: { product_id: selectedProduct.product_id, from_date: dateFrom, to_date: dateTo }
      });
      setLedger(res.data.ledger || []);
      setProductInfo(res.data.product);
    } catch { error('Failed to load ledger'); }
    finally { setLoading(false); }
  }, [selectedProduct, dateFrom, dateTo]);

  const fmt    = (n: any) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  const fmtAmt = (n: any) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = (d: string) => { try { return new Date(d).toLocaleDateString('en-PK', { day:'2-digit', month:'short', year:'numeric' }); } catch { return d; } };

  const totalIn  = ledger.filter(r => r.direction === 'IN').reduce((s, r) => s + Number(r.qty || 0), 0);
  const totalOut = ledger.filter(r => r.direction === 'OUT').reduce((s, r) => s + Number(r.qty || 0), 0);
  const totalAmt = ledger.reduce((s, r) => s + Number(r.amount || 0), 0);

  const typeColor: Record<string, string> = {
    'Purchase':        'bg-blue-50 text-blue-700',
    'Purchase Return': 'bg-orange-50 text-orange-700',
    'Stock Issue':     'bg-purple-50 text-purple-700',
    'Issue Return':    'bg-teal-50 text-teal-700',
    'Sale':            'bg-emerald-50 text-emerald-700',
    'Adjustment':      'bg-gray-100 text-gray-700',
    'Opening':         'bg-yellow-50 text-yellow-700',
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <BookOpen size={20} className="text-purple-600" /> Items Ledger
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Full transaction history for any product</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5 flex flex-wrap gap-4 items-center">
        <div className="relative min-w-[260px] max-w-sm flex-1" ref={searchRef}>
          <label className="block text-sm font-medium text-gray-700 mb-1">Product *</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
            <input type="text" value={productSearch} onChange={e => searchProducts(e.target.value)}
              placeholder="Search product by name or barcode..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 outline-none" />
            {productResults.length > 0 && (
              <div className="absolute z-20 left-0 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                {productResults.map(p => (
                  <button key={p.product_id} onClick={() => selectProduct(p)}
                    className="w-full text-left px-4 py-2.5 hover:bg-purple-50 text-sm border-b last:border-0 flex items-center justify-between">
                    <span className="font-medium text-gray-800">{p.product_name}</span>
                    {p.barcode && <span className="text-gray-400 text-xs ml-2">{p.barcode}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 items-end pt-5">
          <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} onApply={fetchLedger} standalone={false} />
        </div>
      </div>

      {/* Product info + summary */}
      {productInfo && ledger.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
          <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 col-span-1">
            <div className="flex items-center gap-2 mb-1">
              <Package size={16} className="text-purple-600" />
              <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Product</p>
            </div>
            <p className="font-bold text-gray-900 text-sm">{productInfo.product_name}</p>
            {productInfo.barcode && <p className="text-xs text-gray-400 mt-0.5">{productInfo.barcode}</p>}
            <p className="text-xs text-purple-700 mt-1">Stock: <strong>{fmt(productInfo.stock_quantity)}</strong></p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={16} className="text-emerald-600" />
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Total IN</p>
            </div>
            <p className="text-2xl font-bold text-emerald-900">{fmt(totalIn)}</p>
          </div>
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown size={16} className="text-rose-600" />
              <p className="text-xs font-semibold text-rose-600 uppercase tracking-wide">Total OUT</p>
            </div>
            <p className="text-2xl font-bold text-rose-900">{fmt(totalOut)}</p>
          </div>
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-1">Total Amount</p>
            <p className="text-2xl font-bold text-indigo-900">{fmtAmt(totalAmt)}</p>
          </div>
        </div>
      )}

      {/* Ledger table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" /></div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Date</th>
                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Type</th>
                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Ref #</th>
                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Party</th>
                <th className="px-4 py-3 text-center font-semibold whitespace-nowrap">Dir</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Qty</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Amount</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {ledger.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-16 text-center text-gray-400">
                  <BookOpen size={40} className="mx-auto mb-2 opacity-20" />
                  <p>{selectedProduct ? 'No transactions found for selected period' : 'Select a product to view its ledger'}</p>
                </td></tr>
              ) : ledger.map((row, idx) => (
                <tr key={idx} className={`hover:bg-gray-50 transition ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{fmtDate(row.txn_date)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColor[row.txn_type] || 'bg-gray-100 text-gray-600'}`}>
                      {row.txn_type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-blue-700 font-semibold">{row.ref_number}</td>
                  <td className="px-4 py-2.5 text-gray-600 max-w-[160px] truncate">{row.party || '—'}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${row.direction === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {row.direction}
                    </span>
                  </td>
                  <td className={`px-4 py-2.5 text-right font-medium ${row.direction === 'IN' ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {fmt(row.qty)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-700">{fmtAmt(row.amount)}</td>
                  <td className={`px-4 py-2.5 text-right font-bold ${Number(row.running_balance) < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {fmt(row.running_balance)}
                  </td>
                </tr>
              ))}
            </tbody>
            {ledger.length > 0 && (
              <tfoot>
                <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
                  <td colSpan={4} className="px-4 py-3 text-right text-gray-700">Totals</td>
                  <td></td>
                  <td className="px-4 py-3 text-right text-gray-800">{fmt(totalIn - totalOut)} net</td>
                  <td className="px-4 py-3 text-right text-gray-800">{fmtAmt(totalAmt)}</td>
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

export default ItemsLedger;
