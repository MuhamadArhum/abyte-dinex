import { useState, useCallback } from 'react';
import { Truck, ChevronDown, ChevronRight } from 'lucide-react';
import api from '../../utils/api';
import { localToday } from '../../utils/dateUtils';
import { useToast } from '../../components/Toast';
import DateRangeFilter from '../../components/DateRangeFilter';

const SupplierWisePurchase = () => {
  const [data, setData]             = useState<any[]>([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [grandItems, setGrandItems] = useState(0);
  const [grandCarriage, setGrandCarriage] = useState(0);
  const [loading, setLoading]       = useState(false);
  const [dateFrom, setDateFrom]     = useState(localToday());
  const [dateTo, setDateTo]         = useState(localToday());
  const [collapsed, setCollapsed]   = useState<Record<string, boolean>>({});
  const { error } = useToast();

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory-reports/supplier-wise', {
        params: { from_date: dateFrom, to_date: dateTo }
      });
      setData(res.data.data || []);
      setGrandTotal(res.data.grand_total || 0);
      setGrandItems(res.data.grand_items || 0);
      setGrandCarriage(res.data.grand_carriage || 0);
      setCollapsed({});
    } catch { error('Failed to load report'); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo]);

  const fmt    = (n: any) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const fmtDec = (n: any) => Number(n || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const toggle = (id: any) => setCollapsed(c => ({ ...c, [id]: !c[id] }));

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <Truck size={20} className="text-teal-600" /> Supplier Wise Purchase
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Purchase detail grouped by supplier / payable account</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-5">
        <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} onApply={fetchReport} />
      </div>

      {data.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
            <p className="text-xs text-indigo-600 font-semibold uppercase tracking-wide">Total Items Amount</p>
            <p className="text-2xl font-bold text-indigo-900 mt-1">{fmt(grandItems)}</p>
          </div>
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
            <p className="text-xs text-orange-600 font-semibold uppercase tracking-wide">Total Carriage</p>
            <p className="text-2xl font-bold text-orange-900 mt-1">{fmt(grandCarriage)}</p>
          </div>
          <div className="bg-teal-50 border border-teal-100 rounded-xl p-4">
            <p className="text-xs text-teal-600 font-semibold uppercase tracking-wide">Grand Total</p>
            <p className="text-2xl font-bold text-teal-900 mt-1">{fmt(grandTotal)}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600" />
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="px-4 py-3 text-left font-semibold whitespace-nowrap">Item Description</th>
                <th className="px-3 py-3 text-center font-semibold whitespace-nowrap">Unit</th>
                <th className="px-3 py-3 text-right font-semibold whitespace-nowrap">Qty</th>
                <th className="px-3 py-3 text-right font-semibold whitespace-nowrap">Rate</th>
                <th className="px-3 py-3 text-right font-semibold whitespace-nowrap">Amount</th>
                <th className="px-3 py-3 text-right font-semibold whitespace-nowrap">Discount</th>
                <th className="px-3 py-3 text-right font-semibold whitespace-nowrap">Tax</th>
                <th className="px-3 py-3 text-right font-semibold whitespace-nowrap">Carriage</th>
                <th className="px-3 py-3 text-right font-semibold whitespace-nowrap">Net Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center text-gray-400">
                    <Truck size={40} className="mx-auto mb-2 opacity-20" />
                    <p>Select date range and click Run Report</p>
                  </td>
                </tr>
              ) : data.map((supplier) => (
                <>
                  {/* Supplier header row */}
                  <tr key={`s-${supplier.supplier_id}`}
                    className="bg-gray-100 border-t-2 border-gray-300 cursor-pointer hover:bg-gray-200"
                    onClick={() => toggle(supplier.supplier_id)}>
                    <td className="px-4 py-2.5 font-bold text-gray-900" colSpan={4}>
                      <span className="flex items-center gap-2">
                        {collapsed[supplier.supplier_id]
                          ? <ChevronRight size={15} className="text-gray-500" />
                          : <ChevronDown size={15} className="text-gray-500" />}
                        {supplier.supplier_name}
                        <span className="text-xs font-normal text-gray-500 ml-1">({supplier.pv_count} voucher{supplier.pv_count !== 1 ? 's' : ''})</span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-gray-900">
                      {fmt(supplier.items.filter((i: any) => !i.is_carriage).reduce((s: number, i: any) => s + i.amount, 0))}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-gray-500">0</td>
                    <td className="px-3 py-2.5 text-right font-bold text-gray-500">0</td>
                    <td className="px-3 py-2.5 text-right font-bold text-orange-700">
                      {fmt(supplier.items.filter((i: any) => i.is_carriage).reduce((s: number, i: any) => s + i.carriage, 0))}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-teal-700">{fmt(supplier.total_amount)}</td>
                  </tr>

                  {/* Item rows */}
                  {!collapsed[supplier.supplier_id] && supplier.items.map((item: any, idx: number) => (
                    item.is_carriage ? (
                      <tr key={`c-${supplier.supplier_id}-${idx}`} className="bg-orange-50/50 border-b border-gray-100">
                        <td className="px-4 py-2 pl-10 text-orange-700 italic text-xs" colSpan={4}>{item.product_name}</td>
                        <td className="px-3 py-2 text-right text-gray-400">—</td>
                        <td className="px-3 py-2 text-right text-gray-400">0</td>
                        <td className="px-3 py-2 text-right text-gray-400">0</td>
                        <td className="px-3 py-2 text-right text-orange-700 font-medium">{fmt(item.carriage)}</td>
                        <td className="px-3 py-2 text-right text-orange-700 font-medium">{fmt(item.carriage)}</td>
                      </tr>
                    ) : (
                      <tr key={`i-${supplier.supplier_id}-${idx}`}
                        className={`border-b border-gray-50 hover:bg-teal-50/30 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                        <td className="px-4 py-2 pl-10 text-gray-800">{item.product_name}</td>
                        <td className="px-3 py-2 text-center text-gray-500 text-xs">{item.unit}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{fmtDec(item.qty)}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{fmtDec(item.rate)}</td>
                        <td className="px-3 py-2 text-right text-gray-800 font-medium">{fmt(item.amount)}</td>
                        <td className="px-3 py-2 text-right text-gray-400">0</td>
                        <td className="px-3 py-2 text-right text-gray-400">0</td>
                        <td className="px-3 py-2 text-right text-gray-400">0</td>
                        <td className="px-3 py-2 text-right text-gray-800 font-medium">{fmt(item.net_amount)}</td>
                      </tr>
                    )
                  ))}
                </>
              ))}
            </tbody>
            {data.length > 0 && (
              <tfoot>
                <tr className="bg-gray-800 text-white font-bold border-t-2 border-gray-600">
                  <td colSpan={4} className="px-4 py-3 text-right">Grand Total</td>
                  <td className="px-3 py-3 text-right">{fmt(grandItems)}</td>
                  <td className="px-3 py-3 text-right">0</td>
                  <td className="px-3 py-3 text-right">0</td>
                  <td className="px-3 py-3 text-right">{fmt(grandCarriage)}</td>
                  <td className="px-3 py-3 text-right">{fmt(grandTotal)}</td>
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

export default SupplierWisePurchase;
