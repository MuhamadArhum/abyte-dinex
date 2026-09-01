import { useState, useEffect } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Download, UtensilsCrossed, Coffee, Truck, ShoppingBag, Layers, Percent, Tag, Receipt, RotateCcw, Clock, XCircle, Package, Users, CreditCard, Vault } from 'lucide-react';
import DateRangeFilter from '../../components/DateRangeFilter';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../utils/api';
import { localToday } from '../../utils/dateUtils';
import ReportPasswordGate from '../../components/ReportPasswordGate';

const SalesReports = () => {
  const { currencySymbol: currency } = useSettings();
  const [dateFrom, setDateFrom] = useState(localToday());
  const [dateTo, setDateTo] = useState(localToday());
  const [loading, setLoading] = useState(true);

  const [summary, setSummary] = useState({ total_sales: 0, total_orders: 0, avg_order: 0, total_discount: 0, total_tax: 0 });
  const [comparison, setComparison] = useState({ change_percent: 0, previous_period: { total: 0 } });
  const [hourly, setHourly] = useState<any[]>([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState<any[]>([]);
  const [cashierPerf, setCashierPerf] = useState<any[]>([]);
  const [dailyTrend, setDailyTrend] = useState<any[]>([]);
  const [topCustomers, setTopCustomers] = useState<any[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<any[]>([]);
  const [profitMargin, setProfitMargin]         = useState<{ summary: any; data: any[] }>({ summary: {}, data: [] });
  const [discountAnalysis, setDiscountAnalysis] = useState<{ summary: any; by_cashier: any[]; daily: any[] }>({ summary: {}, by_cashier: [], daily: [] });
  const [taxReport, setTaxReport]               = useState<{ summary: any; daily: any[] }>({ summary: {}, daily: [] });
  const [salesReturns, setSalesReturns]         = useState<{ summary: any; data: any[] }>({ summary: {}, data: [] });
  const [shiftReport, setShiftReport]           = useState<{ data: any[]; daily: any[] }>({ data: [], daily: [] });
  const [voidedSales, setVoidedSales]           = useState<{ summary: any; data: any[] }>({ summary: {}, data: [] });
  const [productPerf, setProductPerf]           = useState<{ summary: any; data: any[] }>({ summary: {}, data: [] });
  const [customerHistory, setCustomerHistory]   = useState<{ summary: any; data: any[] }>({ summary: {}, data: [] });
  const [creditAging, setCreditAging]           = useState<{ summary: any; aging_buckets: any; data: any[] }>({ summary: {}, aging_buckets: {}, data: [] });
  const [cashRecon, setCashRecon]               = useState<{ summary: any; data: any[] }>({ summary: {}, data: [] });

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = { date_from: dateFrom, date_to: dateTo };
      const [sumRes, compRes, hourRes, payRes, cashRes, trendRes, custRes, catRes, pmRes, daRes, taxRes,
             retRes, shiftRes, voidRes, perfRes, custHistRes, agingRes, reconRes] = await Promise.all([
        api.get('/sales-reports/summary', { params }),
        api.get('/sales-reports/comparison', { params }),
        api.get('/sales-reports/hourly', { params: { date: dateFrom } }),
        api.get('/sales-reports/payment-breakdown', { params }),
        api.get('/sales-reports/cashier-performance', { params }),
        api.get('/sales-reports/daily-trend', { params }),
        api.get('/sales-reports/top-customers', { params }),
        api.get('/sales-reports/category-breakdown', { params }),
        api.get('/sales-reports/profit-margin', { params }),
        api.get('/sales-reports/discount-analysis', { params }),
        api.get('/sales-reports/tax-report', { params }),
        api.get('/sales-reports/returns', { params }),
        api.get('/sales-reports/shift-report', { params }),
        api.get('/sales-reports/voided', { params }),
        api.get('/sales-reports/product-performance', { params }),
        api.get('/sales-reports/customer-history', { params }),
        api.get('/sales-reports/credit-aging'),
        api.get('/sales-reports/cash-reconciliation', { params }),
      ]);
      setSummary(sumRes.data);
      setComparison(compRes.data);
      setHourly(hourRes.data.data || []);
      setPaymentBreakdown(payRes.data.data || []);
      setCashierPerf(cashRes.data.data || []);
      setDailyTrend(trendRes.data.data || []);
      setTopCustomers(custRes.data.data || []);
      setCategoryBreakdown(catRes.data.data || []);
      setProfitMargin({ summary: pmRes.data.summary || {}, data: pmRes.data.data || [] });
      setDiscountAnalysis({ summary: daRes.data.summary || {}, by_cashier: daRes.data.by_cashier || [], daily: daRes.data.daily || [] });
      setTaxReport({ summary: taxRes.data.summary || {}, daily: taxRes.data.daily || [] });
      setSalesReturns({ summary: retRes.data.summary || {}, data: retRes.data.data || [] });
      setShiftReport({ data: shiftRes.data.data || [], daily: shiftRes.data.daily || [] });
      setVoidedSales({ summary: voidRes.data.summary || {}, data: voidRes.data.data || [] });
      setProductPerf({ summary: perfRes.data.summary || {}, data: perfRes.data.data || [] });
      setCustomerHistory({ summary: custHistRes.data.summary || {}, data: custHistRes.data.data || [] });
      setCreditAging({ summary: agingRes.data.summary || {}, aging_buckets: agingRes.data.aging_buckets || {}, data: agingRes.data.data || [] });
      setCashRecon({ summary: reconRes.data.summary || {}, data: reconRes.data.data || [] });
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchReports(); }, []);

  const METHOD_COLORS: Record<string, string> = { Cash: 'bg-emerald-500', Card: 'bg-emerald-500', Online: 'bg-emerald-500', Split: 'bg-orange-500' };

  const exportCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(r => Object.values(r).join(','));
    const blob = new Blob([headers + '\n' + rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 flex items-center gap-3"><BarChart3 className="text-emerald-600" size={20} /> Sales Reports</h1>
          <p className="text-gray-500 mt-1">Comprehensive sales analytics and insights</p>
        </div>
      </div>

      <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} onApply={fetchReports} />

      {loading ? (
        <div className="flex items-center justify-center p-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div></div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-3"><div className="p-3 bg-emerald-50 rounded-xl"><DollarSign size={24} className="text-emerald-600" /></div>
              <div><p className="text-2xl font-bold text-gray-800">{currency}{summary.total_sales.toFixed(0)}</p><p className="text-sm text-gray-500">Total Revenue</p></div></div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-3"><div className="p-3 bg-emerald-50 rounded-xl"><ShoppingCart size={24} className="text-emerald-600" /></div>
              <div><p className="text-2xl font-bold text-gray-800">{summary.total_orders}</p><p className="text-sm text-gray-500">Total Orders</p></div></div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-3"><div className="p-3 bg-emerald-50 rounded-xl"><BarChart3 size={24} className="text-emerald-600" /></div>
              <div><p className="text-2xl font-bold text-gray-800">{currency}{summary.avg_order.toFixed(0)}</p><p className="text-sm text-gray-500">Avg Order Value</p></div></div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${comparison.change_percent >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  {comparison.change_percent >= 0 ? <TrendingUp size={24} className="text-emerald-600" /> : <TrendingDown size={24} className="text-red-600" />}
                </div>
                <div><p className={`text-2xl font-bold ${comparison.change_percent >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{comparison.change_percent > 0 ? '+' : ''}{comparison.change_percent}%</p><p className="text-sm text-gray-500">vs Previous Period</p></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Hourly Sales */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Hourly Sales</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={hourly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11 }} tickFormatter={(h) => `${h}:00`} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number | undefined) => v !== undefined ? [`${currency}${v.toFixed(0)}`, 'Revenue'] : ['$0.00', 'Revenue']} labelFormatter={(h) => `${h}:00 - ${h}:59`} />
                  <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Daily Trend */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-800">Daily Trend</h3>
                <button onClick={() => exportCSV(dailyTrend, 'daily_trend.csv')} className="text-xs text-gray-500 hover:text-emerald-600 flex items-center gap-1"><Download size={14} /> CSV</button>
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric' })} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number | undefined) => v !== undefined ? [`${currency}${v.toFixed(0)}`, 'Revenue'] : ['$0.00', 'Revenue']} />
                  <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Payment Breakdown */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">Payment Methods</h3>
              {paymentBreakdown.length === 0 ? <p className="text-center text-gray-400 py-8">No data</p> : (
                <div className="space-y-3">{paymentBreakdown.map((p) => (
                  <div key={p.method}>
                    <div className="flex justify-between text-sm mb-1"><span className="font-medium">{p.method}</span><span className="text-gray-500">{currency}{Number(p.total).toFixed(0)} ({p.percentage}%)</span></div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5"><div className={`h-2.5 rounded-full ${METHOD_COLORS[p.method] || 'bg-gray-400'}`} style={{ width: `${p.percentage}%` }} /></div>
                  </div>
                ))}</div>
              )}
            </div>

            {/* Cashier Performance */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-800">Cashier Performance</h3>
                <button onClick={() => exportCSV(cashierPerf, 'cashier_performance.csv')} className="text-xs text-gray-500 hover:text-emerald-600 flex items-center gap-1"><Download size={14} /> CSV</button>
              </div>
              {cashierPerf.length === 0 ? <p className="text-center text-gray-400 py-8">No data</p> : (
                <div className="space-y-3">{cashierPerf.map((c, idx) => (
                  <div key={c.user_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm">{idx + 1}</div>
                    <div className="flex-1"><p className="font-medium text-sm">{c.cashier_name}</p><p className="text-xs text-gray-400">{c.order_count} orders</p></div>
                    <div className="text-right"><p className="font-bold text-sm">{currency}{Number(c.total_sales).toFixed(0)}</p><p className="text-xs text-gray-400">avg ${Number(c.avg_sale).toFixed(0)}</p></div>
                  </div>
                ))}</div>
              )}
            </div>

            {/* Top Customers */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-800">Top Customers</h3>
                <button onClick={() => exportCSV(topCustomers, 'top_customers.csv')} className="text-xs text-gray-500 hover:text-emerald-600 flex items-center gap-1"><Download size={14} /> CSV</button>
              </div>
              {topCustomers.length === 0 ? <p className="text-center text-gray-400 py-8">No data</p> : (
                <div className="space-y-3">{topCustomers.map((c, idx) => (
                  <div key={c.customer_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm">{idx + 1}</div>
                    <div className="flex-1"><p className="font-medium text-sm">{c.customer_name}</p><p className="text-xs text-gray-400">{c.order_count} orders</p></div>
                    <p className="font-bold text-sm">{currency}{Number(c.total_spent).toFixed(0)}</p>
                  </div>
                ))}</div>
              )}
            </div>
          </div>

          {/* ── Category Breakdown ── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-6">
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-emerald-600" />
                <h3 className="font-semibold text-gray-800">Sales by Category</h3>
              </div>
              <button onClick={() => exportCSV(categoryBreakdown, 'category_breakdown.csv')} className="text-xs text-gray-500 hover:text-emerald-600 flex items-center gap-1"><Download size={14} /> CSV</button>
            </div>
            {categoryBreakdown.length === 0 ? (
              <p className="text-center text-gray-400 py-8">No completed sales in this period</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[800px]">
                  <thead className="bg-gray-50 rounded-xl">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Category</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600">Orders</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600">Revenue</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600">Tax</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600">Charges</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-600">Avg Order</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {categoryBreakdown.map(row => {
                      const iconMap: Record<string, any> = {
                        dine_in: { Icon: UtensilsCrossed, color: 'bg-orange-100 text-orange-600' },
                        takeaway: { Icon: Coffee, color: 'bg-yellow-100 text-yellow-600' },
                        delivery: { Icon: Truck, color: 'bg-blue-100 text-blue-600' },
                      };
                      const meta = iconMap[row.order_type] || { Icon: ShoppingBag, color: 'bg-gray-100 text-gray-600' };
                      const { Icon } = meta;
                      return (
                        <tr key={row.order_type} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${meta.color}`}>
                                <Icon size={14} />
                              </div>
                              <span className="font-semibold text-gray-800">{row.category}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-700">{row.total_orders}</td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-600">{currency}{Number(row.total_sales).toFixed(0)}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{currency}{Number(row.total_tax).toFixed(0)}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{currency}{Number(row.total_charges).toFixed(0)}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{currency}{Number(row.avg_order).toFixed(0)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <td className="px-4 py-3 font-bold text-gray-700">Total</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-700">{categoryBreakdown.reduce((s, r) => s + r.total_orders, 0)}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700">{currency}{categoryBreakdown.reduce((s, r) => s + Number(r.total_sales), 0).toFixed(0)}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-700">{currency}{categoryBreakdown.reduce((s, r) => s + Number(r.total_tax), 0).toFixed(0)}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-700">{currency}{categoryBreakdown.reduce((s, r) => s + Number(r.total_charges), 0).toFixed(0)}</td>
                      <td className="px-4 py-3"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
          {/* ── Profit Margin Report ── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-6">
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-2">
                <Percent size={18} className="text-emerald-600" />
                <h3 className="font-semibold text-gray-800">Profit Margin by Product</h3>
              </div>
              <button onClick={() => exportCSV(profitMargin.data, 'profit_margin.csv')} className="text-xs text-gray-500 hover:text-emerald-600 flex items-center gap-1"><Download size={14} /> CSV</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              {[
                { label: 'Total Revenue', value: `${currency}${Number(profitMargin.summary.total_revenue || 0).toFixed(0)}`, color: 'text-gray-800' },
                { label: 'Total Cost', value: `${currency}${Number(profitMargin.summary.total_cost || 0).toFixed(0)}`, color: 'text-red-600' },
                { label: 'Gross Profit', value: `${currency}${Number(profitMargin.summary.gross_profit || 0).toFixed(0)}`, color: 'text-emerald-600' },
                { label: 'Overall Margin', value: `${profitMargin.summary.overall_margin || 0}%`, color: Number(profitMargin.summary.overall_margin) >= 30 ? 'text-emerald-600' : 'text-orange-500' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-gray-500 mt-1">{label}</p>
                </div>
              ))}
            </div>
            {profitMargin.data.length === 0 ? (
              <p className="text-center text-gray-400 py-6">No data — make sure products have cost prices set</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Product', 'Category', 'Qty Sold', 'Revenue', 'Cost', 'Gross Profit', 'Margin %'].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {profitMargin.data.map(r => (
                      <tr key={r.product_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{r.product_name}</td>
                        <td className="px-4 py-3 text-gray-500">{r.category_name}</td>
                        <td className="px-4 py-3 text-gray-700">{r.total_qty}</td>
                        <td className="px-4 py-3 font-medium">{currency}{Number(r.revenue).toFixed(0)}</td>
                        <td className="px-4 py-3 text-red-500">{currency}{Number(r.total_cost).toFixed(0)}</td>
                        <td className="px-4 py-3 text-emerald-600 font-bold">{currency}{Number(r.gross_profit).toFixed(0)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${Number(r.margin_pct) >= 30 ? 'bg-emerald-100 text-emerald-700' : Number(r.margin_pct) >= 15 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                            {Number(r.margin_pct).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Discount Analysis ── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-6">
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-2">
                <Tag size={18} className="text-orange-500" />
                <h3 className="font-semibold text-gray-800">Discount Analysis</h3>
              </div>
              <button onClick={() => exportCSV(discountAnalysis.by_cashier, 'discount_analysis.csv')} className="text-xs text-gray-500 hover:text-emerald-600 flex items-center gap-1"><Download size={14} /> CSV</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              {[
                { label: 'Total Discount Given', value: `${currency}${Number(discountAnalysis.summary.total_discount || 0).toFixed(0)}`, color: 'text-red-600' },
                { label: 'Discounted Orders', value: `${discountAnalysis.summary.discounted_orders || 0}`, color: 'text-gray-800' },
                { label: 'Gross Sales', value: `${currency}${Number(discountAnalysis.summary.gross_sales || 0).toFixed(0)}`, color: 'text-gray-800' },
                { label: 'Avg Discount Rate', value: `${discountAnalysis.summary.discount_pct || 0}%`, color: Number(discountAnalysis.summary.discount_pct) > 10 ? 'text-red-600' : 'text-emerald-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-gray-500 mt-1">{label}</p>
                </div>
              ))}
            </div>
            {discountAnalysis.by_cashier.length === 0 ? (
              <p className="text-center text-gray-400 py-6">No discount data in this period</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[600px]">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Cashier', 'Total Orders', 'Discounted Orders', 'Total Discount', 'Gross Sales', 'Discount %'].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {discountAnalysis.by_cashier.map(r => (
                      <tr key={r.user_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{r.cashier_name}</td>
                        <td className="px-4 py-3 text-gray-700">{r.total_orders}</td>
                        <td className="px-4 py-3 text-gray-700">{r.discounted_orders}</td>
                        <td className="px-4 py-3 text-red-500 font-bold">{currency}{Number(r.total_discount).toFixed(0)}</td>
                        <td className="px-4 py-3">{currency}{Number(r.gross_sales).toFixed(0)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${Number(r.discount_pct) > 10 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {Number(r.discount_pct).toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Tax Report ── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-6">
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="text-blue-600" />
                <h3 className="font-semibold text-gray-800">Tax / GST Report</h3>
              </div>
              <button onClick={() => exportCSV(taxReport.daily, 'tax_report.csv')} className="text-xs text-gray-500 hover:text-emerald-600 flex items-center gap-1"><Download size={14} /> CSV</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              {[
                { label: 'Gross Amount', value: `${currency}${Number(taxReport.summary.gross_amount || 0).toFixed(0)}`, color: 'text-gray-800' },
                { label: 'Tax Collected', value: `${currency}${Number(taxReport.summary.tax_collected || 0).toFixed(0)}`, color: 'text-blue-600' },
                { label: 'Net Amount', value: `${currency}${Number(taxReport.summary.net_amount || 0).toFixed(0)}`, color: 'text-emerald-600' },
                { label: 'Taxable Orders', value: `${taxReport.summary.taxable_orders || 0} / ${taxReport.summary.total_orders || 0}`, color: 'text-gray-800' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-gray-500 mt-1">{label}</p>
                </div>
              ))}
            </div>
            {taxReport.daily.length > 1 && (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={taxReport.daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric' })} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number | undefined) => v !== undefined ? [`${currency}${v.toFixed(0)}`] : ['0']} />
                  <Bar dataKey="tax_collected" name="Tax" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="net_amount" name="Net Sales" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
            {taxReport.daily.length === 0 && <p className="text-center text-gray-400 py-6">No data in this period</p>}
          </div>

          {/* ── Sales Returns ── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-6">
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-2"><RotateCcw size={18} className="text-red-500" /><h3 className="font-semibold text-gray-800">Sales Returns / Refunds</h3></div>
              <button onClick={() => exportCSV(salesReturns.data, 'sales_returns.csv')} className="text-xs text-gray-500 hover:text-emerald-600 flex items-center gap-1"><Download size={14} /> CSV</button>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-5">
              {[
                { label: 'Total Returns', value: String(salesReturns.summary.total_returns || 0), color: 'text-gray-800' },
                { label: 'Total Refunded', value: `${currency}${Number(salesReturns.summary.total_refund || 0).toFixed(0)}`, color: 'text-red-600' },
                { label: 'Avg Refund', value: `${currency}${Number(salesReturns.summary.avg_refund || 0).toFixed(0)}`, color: 'text-gray-800' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-gray-500 mt-1">{label}</p>
                </div>
              ))}
            </div>
            {salesReturns.data.length === 0 ? <p className="text-center text-gray-400 py-6">No returns in this period</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead className="bg-gray-50"><tr>
                    {['Return ID', 'Invoice', 'Date', 'Customer', 'Refund Amount', 'Reason', 'Processed By'].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {salesReturns.data.map(r => (
                      <tr key={r.return_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-500">#{r.return_id}</td>
                        <td className="px-4 py-3 font-medium text-blue-600">{r.invoice_no || `#${r.sale_id}`}</td>
                        <td className="px-4 py-3 text-gray-600">{new Date(r.return_date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-gray-700">{r.customer_name}</td>
                        <td className="px-4 py-3 font-bold text-red-600">{currency}{Number(r.refund_amount).toFixed(0)}</td>
                        <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">{r.reason || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{r.processed_by || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Shift Sales Report ── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-6">
            <div className="flex items-center gap-2 mb-5"><Clock size={18} className="text-purple-500" /><h3 className="font-semibold text-gray-800">Shift-wise Sales Report</h3></div>
            {shiftReport.data.length === 0 ? <p className="text-center text-gray-400 py-6">No data in this period</p> : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50"><tr>
                      {['Shift', 'Orders', 'Revenue', 'Avg Order', 'Discount'].map(h => (
                        <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {shiftReport.data.map(r => (
                        <tr key={r.shift_name} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800">{r.shift_name}</td>
                          <td className="px-4 py-3 text-gray-700">{r.total_orders}</td>
                          <td className="px-4 py-3 font-bold text-emerald-600">{currency}{Number(r.total_sales).toFixed(0)}</td>
                          <td className="px-4 py-3 text-gray-600">{currency}{Number(r.avg_order).toFixed(0)}</td>
                          <td className="px-4 py-3 text-red-500">{currency}{Number(r.total_discount).toFixed(0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={shiftReport.data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="shift_name" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number | undefined) => v !== undefined ? [`${currency}${v.toFixed(0)}`, 'Revenue'] : ['0', 'Revenue']} />
                    <Bar dataKey="total_sales" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ── Void / Cancelled Transactions ── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-6">
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-2"><XCircle size={18} className="text-red-600" /><h3 className="font-semibold text-gray-800">Void / Cancelled Transactions</h3></div>
              <button onClick={() => exportCSV(voidedSales.data, 'voided_sales.csv')} className="text-xs text-gray-500 hover:text-emerald-600 flex items-center gap-1"><Download size={14} /> CSV</button>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-5">
              {[
                { label: 'Total Voided', value: String(voidedSales.summary.total_voided || 0), color: 'text-red-600' },
                { label: 'Voided Amount', value: `${currency}${Number(voidedSales.summary.total_voided_amount || 0).toFixed(0)}`, color: 'text-red-600' },
                { label: 'Cashiers Involved', value: String(voidedSales.summary.cashiers_involved || 0), color: 'text-gray-800' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-gray-500 mt-1">{label}</p>
                </div>
              ))}
            </div>
            {voidedSales.data.length === 0 ? <p className="text-center text-gray-400 py-6">No voided/cancelled transactions in this period</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead className="bg-gray-50"><tr>
                    {['Invoice', 'Date', 'Customer', 'Amount', 'Status', 'Cashier', 'Note'].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {voidedSales.data.map(r => (
                      <tr key={r.sale_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-blue-600">{r.invoice_no || `#${r.sale_id}`}</td>
                        <td className="px-4 py-3 text-gray-600">{new Date(r.sale_date).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-gray-700">{r.customer_name}</td>
                        <td className="px-4 py-3 font-bold text-gray-800">{currency}{Number(r.net_amount).toFixed(0)}</td>
                        <td className="px-4 py-3"><span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">{r.status}</span></td>
                        <td className="px-4 py-3 text-gray-600">{r.cashier_name}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs truncate max-w-[150px]">{r.note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Product Performance ── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-6">
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-2"><Package size={18} className="text-indigo-600" /><h3 className="font-semibold text-gray-800">Product Performance</h3></div>
              <button onClick={() => exportCSV(productPerf.data, 'product_performance.csv')} className="text-xs text-gray-500 hover:text-emerald-600 flex items-center gap-1"><Download size={14} /> CSV</button>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-5">
              {[
                { label: 'Unique Products', value: String(productPerf.summary.unique_products || 0), color: 'text-gray-800' },
                { label: 'Total Qty Sold', value: String(productPerf.summary.grand_qty || 0), color: 'text-indigo-600' },
                { label: 'Total Revenue', value: `${currency}${Number(productPerf.summary.grand_total || 0).toFixed(0)}`, color: 'text-emerald-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-gray-500 mt-1">{label}</p>
                </div>
              ))}
            </div>
            {productPerf.data.length === 0 ? <p className="text-center text-gray-400 py-6">No data in this period</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead className="bg-gray-50"><tr>
                    {['#', 'Product', 'Category', 'Qty Sold', 'Orders', 'Revenue', 'Avg Price'].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {productPerf.data.map((r, i) => (
                      <tr key={r.product_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-400 font-medium">{i + 1}</td>
                        <td className="px-4 py-3 font-semibold text-gray-800">{r.product_name}</td>
                        <td className="px-4 py-3 text-gray-500">{r.category_name}</td>
                        <td className="px-4 py-3 font-bold text-indigo-600">{r.total_qty}</td>
                        <td className="px-4 py-3 text-gray-700">{r.order_count}</td>
                        <td className="px-4 py-3 font-bold text-emerald-600">{currency}{Number(r.revenue).toFixed(0)}</td>
                        <td className="px-4 py-3 text-gray-600">{currency}{Number(r.avg_price).toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Customer Sales History ── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-6">
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-2"><Users size={18} className="text-cyan-600" /><h3 className="font-semibold text-gray-800">Customer Sales History</h3></div>
              <button onClick={() => exportCSV(customerHistory.data, 'customer_history.csv')} className="text-xs text-gray-500 hover:text-emerald-600 flex items-center gap-1"><Download size={14} /> CSV</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              {[
                { label: 'Unique Customers', value: String(customerHistory.summary.total_customers || 0), color: 'text-gray-800' },
                { label: 'Total Orders', value: String(customerHistory.summary.total_orders || 0), color: 'text-cyan-600' },
                { label: 'Total Revenue', value: `${currency}${Number(customerHistory.summary.total_revenue || 0).toFixed(0)}`, color: 'text-emerald-600' },
                { label: 'Avg Order Value', value: `${currency}${Number(customerHistory.summary.avg_order_value || 0).toFixed(0)}`, color: 'text-gray-800' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-gray-500 mt-1">{label}</p>
                </div>
              ))}
            </div>
            {customerHistory.data.length === 0 ? <p className="text-center text-gray-400 py-6">No customer data in this period</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead className="bg-gray-50"><tr>
                    {['#', 'Customer', 'Phone', 'Orders', 'Total Spent', 'Avg Order', 'Last Visit'].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {customerHistory.data.map((r, i) => (
                      <tr key={r.customer_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                        <td className="px-4 py-3 font-semibold text-gray-800">{r.customer_name}</td>
                        <td className="px-4 py-3 text-gray-500">{r.phone || '—'}</td>
                        <td className="px-4 py-3 font-bold text-cyan-600">{r.total_orders}</td>
                        <td className="px-4 py-3 font-bold text-emerald-600">{currency}{Number(r.total_spent).toFixed(0)}</td>
                        <td className="px-4 py-3 text-gray-600">{currency}{Number(r.avg_order).toFixed(0)}</td>
                        <td className="px-4 py-3 text-gray-500">{r.last_visit ? new Date(r.last_visit).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Credit Sales / Receivables Aging ── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-6">
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-2"><CreditCard size={18} className="text-orange-600" /><h3 className="font-semibold text-gray-800">Credit Sales / Receivables Aging</h3></div>
              <button onClick={() => exportCSV(creditAging.data, 'credit_aging.csv')} className="text-xs text-gray-500 hover:text-emerald-600 flex items-center gap-1"><Download size={14} /> CSV</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              {[
                { label: 'Total Outstanding', value: `${currency}${Number(creditAging.summary.total_outstanding || 0).toFixed(0)}`, color: 'text-orange-600' },
                { label: 'Overdue Amount', value: `${currency}${Number(creditAging.summary.overdue_amount || 0).toFixed(0)}`, color: 'text-red-600' },
                { label: 'Overdue Records', value: String(creditAging.summary.overdue_count || 0), color: 'text-red-600' },
                { label: 'Total Records', value: String(creditAging.summary.total_records || 0), color: 'text-gray-800' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-gray-500 mt-1">{label}</p>
                </div>
              ))}
            </div>
            {creditAging.aging_buckets && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
                {[
                  { label: 'Current (Not Due)', key: 'current', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                  { label: '1–30 Days', key: 'days_1_30', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
                  { label: '31–60 Days', key: 'days_31_60', color: 'bg-orange-50 text-orange-700 border-orange-200' },
                  { label: '61–90 Days', key: 'days_61_90', color: 'bg-red-50 text-red-700 border-red-200' },
                  { label: '90+ Days', key: 'days_90_plus', color: 'bg-red-100 text-red-800 border-red-300' },
                ].map(({ label, key, color }) => (
                  <div key={key} className={`rounded-xl border p-3 text-center ${color}`}>
                    <p className="text-lg font-bold">{currency}{Number(creditAging.aging_buckets[key] || 0).toFixed(0)}</p>
                    <p className="text-xs mt-1">{label}</p>
                  </div>
                ))}
              </div>
            )}
            {creditAging.data.length === 0 ? <p className="text-center text-gray-400 py-6">No outstanding credit sales</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[750px]">
                  <thead className="bg-gray-50"><tr>
                    {['Customer', 'Phone', 'Total', 'Paid', 'Balance Due', 'Due Date', 'Days Overdue', 'Status'].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {creditAging.data.map(r => (
                      <tr key={r.credit_sale_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-gray-800">{r.customer_name}</td>
                        <td className="px-4 py-3 text-gray-500">{r.phone || '—'}</td>
                        <td className="px-4 py-3">{currency}{Number(r.total_amount).toFixed(0)}</td>
                        <td className="px-4 py-3 text-emerald-600">{currency}{Number(r.paid_amount).toFixed(0)}</td>
                        <td className="px-4 py-3 font-bold text-red-600">{currency}{Number(r.balance_due).toFixed(0)}</td>
                        <td className="px-4 py-3 text-gray-600">{r.due_date}</td>
                        <td className="px-4 py-3">
                          <span className={`font-bold ${Number(r.days_overdue) > 90 ? 'text-red-700' : Number(r.days_overdue) > 30 ? 'text-orange-600' : Number(r.days_overdue) > 0 ? 'text-yellow-600' : 'text-emerald-600'}`}>
                            {Number(r.days_overdue) <= 0 ? 'On time' : `${r.days_overdue}d`}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${r.status === 'overdue' ? 'bg-red-100 text-red-700' : r.status === 'partial' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Daily Cash Reconciliation ── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-6">
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-2"><Vault size={18} className="text-gray-700" /><h3 className="font-semibold text-gray-800">Daily Cash Reconciliation</h3></div>
              <button onClick={() => exportCSV(cashRecon.data, 'cash_reconciliation.csv')} className="text-xs text-gray-500 hover:text-emerald-600 flex items-center gap-1"><Download size={14} /> CSV</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              {[
                { label: 'Sessions', value: String(cashRecon.summary.total_sessions || 0), color: 'text-gray-800' },
                { label: 'Cash Sales', value: `${currency}${Number(cashRecon.summary.total_cash_sales || 0).toFixed(0)}`, color: 'text-emerald-600' },
                { label: 'Net Difference', value: `${currency}${Number(cashRecon.summary.total_difference || 0).toFixed(0)}`, color: Number(cashRecon.summary.total_difference) < 0 ? 'text-red-600' : 'text-emerald-600' },
                { label: 'Shortages / Overages', value: `${cashRecon.summary.shortage_count || 0} / ${cashRecon.summary.overage_count || 0}`, color: 'text-gray-800' },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-gray-500 mt-1">{label}</p>
                </div>
              ))}
            </div>
            {cashRecon.data.length === 0 ? <p className="text-center text-gray-400 py-6">No register sessions in this period</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[900px]">
                  <thead className="bg-gray-50"><tr>
                    {['Session', 'Opened By', 'Opening Bal', 'Cash Sales', 'Cash In', 'Cash Out', 'Expected', 'Closing', 'Difference', 'Status'].map(h => (
                      <th key={h} className="px-3 py-3 text-left font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {cashRecon.data.map(r => (
                      <tr key={r.register_id} className="hover:bg-gray-50">
                        <td className="px-3 py-3 text-gray-500 text-xs">{r.opened_at ? new Date(r.opened_at).toLocaleString() : '—'}</td>
                        <td className="px-3 py-3 font-medium text-gray-800">{r.opened_by}</td>
                        <td className="px-3 py-3">{currency}{Number(r.opening_balance).toFixed(0)}</td>
                        <td className="px-3 py-3 font-bold text-emerald-600">{currency}{Number(r.cash_sales_total).toFixed(0)}</td>
                        <td className="px-3 py-3 text-emerald-500">+{currency}{Number(r.total_cash_in).toFixed(0)}</td>
                        <td className="px-3 py-3 text-red-500">-{currency}{Number(r.total_cash_out).toFixed(0)}</td>
                        <td className="px-3 py-3 text-gray-600">{r.expected_balance != null ? `${currency}${Number(r.expected_balance).toFixed(0)}` : '—'}</td>
                        <td className="px-3 py-3">{r.closing_balance != null ? `${currency}${Number(r.closing_balance).toFixed(0)}` : '—'}</td>
                        <td className="px-3 py-3">
                          {r.difference != null ? (
                            <span className={`font-bold ${Number(r.difference) < 0 ? 'text-red-600' : Number(r.difference) > 0 ? 'text-orange-500' : 'text-emerald-600'}`}>
                              {Number(r.difference) > 0 ? '+' : ''}{currency}{Number(r.difference).toFixed(0)}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${r.status === 'open' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>{r.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const SalesReportsWithGate = () => <ReportPasswordGate><SalesReports /></ReportPasswordGate>;
export default SalesReportsWithGate;
