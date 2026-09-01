import { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
  TrendingUp, ShoppingCart, DollarSign, Users, Clock, Package
} from 'lucide-react';
import DateRangeFilter from '../components/DateRangeFilter';
import api from '../utils/api';
import { useSettings } from '../context/SettingsContext';
import { localToday } from '../utils/dateUtils';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
const fmtDec = (n: number) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const KpiCard = ({ icon: Icon, label, value, sub, color = 'emerald' }: any) => {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2.5 rounded-xl ${colors[color]}`}>
          <Icon size={20} />
        </div>
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
};

const SalesAnalytics = () => {
  const { currencySymbol } = useSettings();
  const [dateFrom, setDateFrom] = useState(localToday());
  const [dateTo, setDateTo] = useState(localToday());
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState<any>({});
  const [trend, setTrend] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [hourly, setHourly] = useState<any[]>([]);

  const fetchAll = async (from = dateFrom, to = dateTo) => {
    setLoading(true);
    try {
      const [statsRes, trendRes, catRes, pmRes, custRes, hourlyRes] = await Promise.all([
        api.get('/analytics/dashboard', { params: { start_date: from, end_date: to } }),
        api.get('/analytics/sales-trend', { params: { period: 'daily', start_date: from, end_date: to } }),
        api.get('/analytics/category-breakdown', { params: { start_date: from, end_date: to } }),
        api.get('/analytics/payment-methods', { params: { start_date: from, end_date: to } }),
        api.get('/analytics/customer-analytics', { params: { start_date: from, end_date: to } }),
        api.get('/analytics/hourly-sales', { params: { start_date: from, end_date: to } }),
      ]);
      setStats(statsRes.data);
      setTrend(trendRes.data.data || []);
      setCategories(catRes.data.data || []);
      setPaymentMethods(pmRes.data.data || []);
      setCustomers(custRes.data.top_customers || []);
      setHourly((hourlyRes.data.data || []).filter((h: any) => h.transaction_count > 0));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const sales = stats.sales || {};
  const profit = stats.profit || 0;
  const topProducts = stats.topProducts || [];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
          <TrendingUp size={22} className="text-emerald-600" />
          Sales Analytics
        </h1>
      </div>

      <DateRangeFilter
        dateFrom={dateFrom}
        dateTo={dateTo}
        onFromChange={setDateFrom}
        onToChange={setDateTo}
        onApply={() => fetchAll()}
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard icon={DollarSign} label="Total Sales" color="emerald"
              value={`${currencySymbol}${fmt(Number(sales.net_sales || 0))}`}
              sub={`${sales.total_transactions || 0} transactions`} />
            <KpiCard icon={ShoppingCart} label="Avg Transaction" color="blue"
              value={`${currencySymbol}${fmtDec(Number(sales.avg_transaction || 0))}`}
              sub="per sale" />
            <KpiCard icon={TrendingUp} label="Net Profit" color={profit >= 0 ? 'emerald' : 'orange'}
              value={`${profit < 0 ? '-' : ''}${currencySymbol}${fmt(Math.abs(profit))}`}
              sub={`Expenses: ${currencySymbol}${fmt(Number(stats.expenses?.total_expenses || 0))}`} />
            <KpiCard icon={Package} label="Discount Given" color="purple"
              value={`${currencySymbol}${fmt(Number(sales.total_discount || 0))}`}
              sub={`${fmtDec((Number(sales.total_discount || 0) / Math.max(Number(sales.total_sales || 1), 1)) * 100)}% of gross`} />
          </div>

          {/* Sales Trend Chart */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-800 mb-4">Daily Sales Trend</h2>
            {trend.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No data for selected period</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trend} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={v => `${currencySymbol}${fmt(v)}`} width={80} />
                  <Tooltip formatter={(val: any) => [`${currencySymbol}${fmtDec(Number(val))}`, '']}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgb(0 0 0 / 0.1)', fontSize: 13 }} />
                  <Legend />
                  <Line type="monotone" dataKey="net_sales" name="Net Sales" stroke="#10b981" strokeWidth={2.5}
                    dot={{ r: 3, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }} />
                  <Line type="monotone" dataKey="transaction_count" name="Transactions" stroke="#3b82f6" strokeWidth={2}
                    dot={{ r: 3, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Category Breakdown + Payment Methods */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Bar Chart */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-800 mb-4">Revenue by Category</h2>
              {categories.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={categories.slice(0, 8)} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="category_name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} tickFormatter={v => `${currencySymbol}${fmt(v)}`} width={70} />
                    <Tooltip formatter={(val: any) => [`${currencySymbol}${fmtDec(Number(val))}`, 'Revenue']}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgb(0 0 0 / 0.1)', fontSize: 12 }} />
                    <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Payment Methods Pie */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-800 mb-4">Payment Methods</h2>
              {paymentMethods.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No data</div>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="55%" height={200}>
                    <PieChart>
                      <Pie data={paymentMethods} dataKey="total_amount" nameKey="payment_method"
                        cx="50%" cy="50%" outerRadius={80} innerRadius={40}>
                        {paymentMethods.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val: any) => `${currencySymbol}${fmtDec(Number(val))}`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {paymentMethods.map((pm, i) => (
                      <div key={pm.payment_method} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-gray-700">{pm.payment_method}</span>
                        </div>
                        <span className="font-medium text-gray-900">{Number(pm.percentage || 0).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Hourly Pattern + Top Customers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Hourly Sales */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-800 mb-1 flex items-center gap-2">
                <Clock size={16} className="text-orange-500" /> Peak Hours
              </h2>
              <p className="text-xs text-gray-400 mb-4">Transaction volume by hour of day</p>
              {hourly.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={hourly} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} width={30} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgb(0 0 0 / 0.1)', fontSize: 12 }} />
                    <Bar dataKey="transaction_count" name="Transactions" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Top Customers */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Users size={16} className="text-blue-500" /> Top Customers
              </h2>
              {customers.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No customer data</div>
              ) : (
                <div className="space-y-2">
                  {customers.slice(0, 7).map((c, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{c.customer_name}</p>
                        <p className="text-xs text-gray-400">{c.total_orders} orders</p>
                      </div>
                      <p className="text-sm font-semibold text-emerald-700">{currencySymbol}{fmt(Number(c.total_spent))}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Top Products Table */}
          {topProducts.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-800">Top Selling Products</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-4 text-left text-gray-500 font-medium">#</th>
                    <th className="p-4 text-left text-gray-500 font-medium">Product</th>
                    <th className="p-4 text-right text-gray-500 font-medium">Units Sold</th>
                    <th className="p-4 text-right text-gray-500 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {topProducts.map((p: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="p-4 text-gray-400 font-medium">#{i + 1}</td>
                      <td className="p-4 font-medium text-gray-800">{p.product_name}</td>
                      <td className="p-4 text-right text-gray-600">{fmt(Number(p.units_sold))}</td>
                      <td className="p-4 text-right font-semibold text-emerald-700">{currencySymbol}{fmtDec(Number(p.revenue))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SalesAnalytics;
