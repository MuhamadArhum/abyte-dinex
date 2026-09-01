import { useState, useEffect, useRef } from 'react';
import { useSettings } from '../context/SettingsContext';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign, ShoppingBag, ShoppingCart, AlertTriangle, TrendingUp,
  TrendingDown, Plus, Package, CreditCard, ArrowRight,
  Clock, CheckCircle, Box, RefreshCw, Truck, UserCheck, UserX,
  Bell, Activity, AlertCircle
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { SkeletonStatCard } from '../components/Skeleton';

/* ── Animated counter ── */
const AnimatedNumber = ({ value, prefix = '', decimals = 0 }: { value: number; prefix?: string; decimals?: number }) => {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    const to = value;
    prev.current = value;
    if (from === to) return;
    const start = performance.now();
    const dur = 700;
    const tick = (now: number) => {
      const p = Math.min((now - start) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (to - from) * ease);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);
  return <>{prefix}{display.toFixed(decimals)}</>;
};

/* ── Stat card ── */
const StatCard = ({ icon: Icon, label, value, prefix = '', decimals = 0, badge, badgeColor, link, gradient, delay = 0 }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.4, ease: 'easeOut' }}
    whileHover={{ y: -3, transition: { duration: 0.2 } }}
    className={`relative overflow-hidden p-6 rounded-2xl shadow-sm border group cursor-default ${gradient || 'bg-white border-gray-100 hover:shadow-md'}`}
  >
    <div className="flex items-start justify-between mb-4">
      <motion.div
        whileHover={{ scale: 1.12, rotate: 5 }}
        transition={{ type: 'spring', stiffness: 300 }}
        className={`w-12 h-12 rounded-xl flex items-center justify-center ${gradient ? 'bg-white/20' : 'bg-emerald-100 text-emerald-600'}`}
      >
        <Icon size={22} className={gradient ? 'text-white' : ''} />
      </motion.div>
      {badge !== undefined && (
        <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${badgeColor}`}>
          {badge >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {Math.abs(badge).toFixed(1)}%
        </span>
      )}
    </div>
    <p className={`text-sm font-medium mb-1 ${gradient ? 'text-white/75' : 'text-gray-500'}`}>{label}</p>
    <p className={`text-3xl font-bold tracking-tight ${gradient ? 'text-white' : 'text-gray-800'}`}>
      <AnimatedNumber value={value} prefix={prefix} decimals={decimals} />
    </p>
    {link && (
      <Link to={link.to} className={`text-xs mt-2 inline-flex items-center gap-1 ${gradient ? 'text-white/70 hover:text-white' : 'text-emerald-600 hover:text-emerald-700'} transition-colors`}>
        {link.label} <ArrowRight size={11} />
      </Link>
    )}
    {gradient && <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl pointer-events-none" />}
  </motion.div>
);

interface DashboardStats {
  totalSales: number; orderCount: number; lowStockCount: number; customerCount: number;
  todayRevenue: number; weekRevenue: number; monthRevenue: number;
  revenueGrowth: number; ordersGrowth: number; pendingDeliveries: number;
}
interface ChartDataPoint { name: string; sales: number; orders: number; date?: string }
interface RecentOrder { sale_id: number; total: number; customer_name: string; created_at: string; status: string }
interface TopProduct { product_id: number; product_name: string; quantity_sold: number; revenue: number }
interface LowStockItem { product_id: number; product_name: string; quantity: number; min_stock: number; unit?: string }
interface AttendanceSummary { total: number; present: number; absent: number; unmarked: number; half_day: number; leave: number }

const fadeList = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } }
};
const fadeItem = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.3 } }
};

const Dashboard = () => {
  const { currencySymbol: currency } = useSettings();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalSales: 0, orderCount: 0, lowStockCount: 0, customerCount: 0,
    todayRevenue: 0, weekRevenue: 0, monthRevenue: 0, revenueGrowth: 0, ordersGrowth: 0, pendingDeliveries: 0
  });
  const [chartData, setChartData]           = useState<ChartDataPoint[]>([]);
  const [recentOrders, setRecentOrders]     = useState<RecentOrder[]>([]);
  const [topProducts, setTopProducts]       = useState<TopProduct[]>([]);
  const [lowStockItems, setLowStockItems]   = useState<LowStockItem[]>([]);
  const [attendance, setAttendance]         = useState<AttendanceSummary>({ total: 0, present: 0, absent: 0, unmarked: 0, half_day: 0, leave: 0 });
  const [loading, setLoading]               = useState(true);
  const [refreshing, setRefreshing]         = useState(false);
  const [fetchError, setFetchError]         = useState<string | null>(null);
  const [chartPeriod, setChartPeriod]       = useState<'week' | 'month' | 'year'>('week');
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => { fetchDashboardData(); }, [chartPeriod]);

  const fetchDashboardData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setFetchError(null);
    try {
      const daysBack = chartPeriod === 'month' ? 30 : chartPeriod === 'year' ? 365 : 7;
      const startDate = new Date(Date.now() - daysBack * 86400000).toISOString().split('T')[0];
      const [dashRes, inventoryRes, customersRes, recentOrdersRes, productReportRes, lowStockRes, attendanceRes, deliveriesRes] = await Promise.all([
        api.get(`/reports/dashboard?chart_start=${startDate}`),
        api.get('/inventory-reports/summary').catch(() => ({ data: {} })),
        api.get('/customers?page=1&limit=1'),
        api.get('/sales?page=1&limit=5'),
        api.get('/reports/product').catch(() => ({ data: { data: [] } })),
        api.get('/inventory-reports/low-stock?limit=6').catch(() => ({ data: { data: [] } })),
        api.get(`/staff/reports/daily-attendance?date=${today}`).catch(() => ({ data: { summary: {} } })),
        api.get('/deliveries?status=pending&page=1&limit=1').catch(() => ({ data: { pagination: { total: 0 } } })),
      ]);
      const d = dashRes.data;
      const todayRevenue = d.today_revenue || 0;
      const todayOrders  = d.today_orders  || 0;
      const yRev = d.yesterday_revenue || 0;
      const yOrd = d.yesterday_orders  || 0;
      setStats({
        totalSales: todayRevenue, orderCount: todayOrders,
        lowStockCount: (inventoryRes.data.low_stock_count || 0) + (inventoryRes.data.out_of_stock_count || 0),
        customerCount: customersRes.data.pagination?.total || 0,
        todayRevenue, weekRevenue: d.week_revenue || 0, monthRevenue: d.month_revenue || 0,
        revenueGrowth: yRev > 0 ? ((todayRevenue - yRev) / yRev * 100) : 0,
        ordersGrowth:  yOrd > 0 ? ((todayOrders  - yOrd) / yOrd * 100) : 0,
        pendingDeliveries: deliveriesRes.data.pagination?.total || 0,
      });
      setLowStockItems((lowStockRes.data.data || []).slice(0, 6));
      const att = attendanceRes.data.summary || {};
      setAttendance({ total: att.total || 0, present: att.present || 0, absent: att.absent || 0, unmarked: att.unmarked || 0, half_day: att.half_day || 0, leave: att.leave || 0 });
      setChartData((d.chart || []).map((row: any) => ({
        name: chartPeriod === 'year'
          ? new Date(row.date).toLocaleDateString('en-US', { month: 'short' })
          : new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        sales: parseFloat(row.revenue || 0),
        orders: parseInt(row.orders || 0),
        date: row.date
      })));
      const recentSales = recentOrdersRes.data.data || recentOrdersRes.data.sales || [];
      setRecentOrders(recentSales.slice(0, 5).map((s: any) => ({
        sale_id: s.sale_id, total: s.total_amount || s.net_amount || 0,
        customer_name: s.customer_name, created_at: s.sale_date || s.created_at, status: s.status
      })));
      const productSales = productReportRes.data.data || [];
      setTopProducts(productSales.slice(0, 5).map((p: any) => ({
        product_id: p.product_id || 0, product_name: p.product_name,
        quantity_sold: p.total_quantity || 0, revenue: p.total_revenue || 0
      })));
    } catch (e) {
      console.error('Dashboard fetch error', e);
      setFetchError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false); setRefreshing(false);
    }
  };

  const quickActions = [
    { label: 'New Sale',      icon: ShoppingCart, path: '/pos',              color: 'bg-emerald-100 text-emerald-600' },
    { label: 'Add Product',   icon: Plus,         path: '/products',         color: 'bg-violet-100  text-violet-600'  },
    { label: 'Deliveries',    icon: Truck,        path: '/deliveries',       color: 'bg-blue-100    text-blue-600'    },
    { label: 'Attendance',    icon: UserCheck,    path: '/daily-attendance', color: 'bg-cyan-100    text-cyan-600'    },
    { label: 'Payroll',       icon: DollarSign,   path: '/payroll',          color: 'bg-amber-100   text-amber-600'   },
    { label: 'Reports',       icon: TrendingUp,   path: '/reports',          color: 'bg-rose-100    text-rose-600'    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 p-4 sm:p-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35 }}>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Abyte ERP Dashboard Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Welcome back! Dear <span className="font-bold text-emerald-600">{user?.name}</span>. Here's what's happening today.
          </p>
        </motion.div>
        <motion.button
          initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35 }}
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
          onClick={() => fetchDashboardData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50 transition shadow-sm"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin text-emerald-500' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </motion.button>
      </div>

      {/* Error State */}
      {fetchError && !loading && (
        <div className="bg-white border border-red-200 rounded-2xl p-6 flex items-center gap-4 shadow-sm">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <AlertCircle size={20} className="text-red-500" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-800 text-sm">Something went wrong</p>
            <p className="text-gray-500 text-sm mt-0.5">{fetchError}</p>
          </div>
          <button
            onClick={() => fetchDashboardData()}
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-xl hover:bg-red-700 transition flex-shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Stat Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => <SkeletonStatCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard icon={DollarSign} label="Today's Sales" value={stats.totalSales} prefix={currency} decimals={2}
            badge={stats.revenueGrowth} badgeColor={stats.revenueGrowth >= 0 ? 'bg-white/25 text-white' : 'bg-red-500/20 text-white'}
            gradient="bg-gradient-to-br from-emerald-500 to-emerald-600 border-emerald-500" delay={0} />
          <StatCard icon={ShoppingBag} label="Orders Today" value={stats.orderCount}
            badge={stats.ordersGrowth} badgeColor={stats.ordersGrowth >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}
            delay={0.08} />
          <StatCard icon={AlertTriangle} label="Low / Out of Stock" value={stats.lowStockCount}
            link={{ to: '/stock-alerts', label: 'View alerts' }} delay={0.16} />
          <StatCard icon={Truck} label="Pending Deliveries" value={stats.pendingDeliveries}
            link={{ to: '/deliveries', label: 'Manage deliveries' }} delay={0.24} />
        </div>
      )}

      {/* Revenue Summary */}
      {!loading && (
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {[
            { label: 'This Week',  value: stats.weekRevenue,  icon: TrendingUp, color: 'bg-emerald-50 text-emerald-600' },
            { label: 'This Month', value: stats.monthRevenue, icon: DollarSign, color: 'bg-blue-50    text-blue-600' },
            { label: 'Avg Order',  value: stats.orderCount > 0 ? stats.totalSales / stats.orderCount : 0, icon: CreditCard, color: 'bg-orange-50 text-orange-600', gradient: true },
          ].map((item) => (
            <motion.div
              key={item.label}
              whileHover={{ y: -2 }}
              className={`p-5 rounded-xl shadow-sm border flex items-center justify-between ${item.gradient ? 'bg-gradient-to-br from-orange-500 to-red-500 border-orange-400 text-white' : 'bg-white border-gray-100'}`}
            >
              <div>
                <p className={`text-sm font-medium mb-1 ${item.gradient ? 'text-white/80' : 'text-gray-500'}`}>{item.label}</p>
                <p className={`text-2xl font-bold ${item.gradient ? 'text-white' : 'text-gray-800'}`}>
                  {currency}<AnimatedNumber value={item.value} decimals={2} />
                </p>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.gradient ? 'bg-white/20' : item.color}`}>
                <item.icon size={20} />
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* ── ROW 3: Chart + Quick Actions ── */}
      {!loading && (
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.4 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          {/* Chart */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold text-gray-800">Revenue Overview</h2>
              <select
                value={chartPeriod}
                onChange={e => setChartPeriod(e.target.value as any)}
                className="bg-gray-50 border border-gray-200 rounded-lg text-sm px-3 py-1.5 outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="year">Last Year</option>
              </select>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={chartPeriod}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="h-72 w-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#10B981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} tickFormatter={v => `${currency}${v}`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px -5px rgb(0 0 0 / 0.15)', padding: '12px 16px' }}
                      formatter={(value: any, name: any) =>
                        name === 'sales' ? [`${currency}${Number(value).toFixed(0)}`, 'Revenue'] : [value, 'Orders']
                      }
                    />
                    <Area type="monotone" dataKey="sales" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSales)" dot={false} activeDot={{ r: 5, fill: '#10B981' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Quick Actions + Tip */}
          <div className="space-y-5">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {quickActions.map((action, i) => {
                  const Icon = action.icon;
                  return (
                    <motion.div key={i} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                      <Link
                        to={action.path}
                        className="flex flex-col items-center justify-center p-4 rounded-xl border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50/40 transition-all group text-center"
                      >
                        <div className={`w-10 h-10 ${action.color} rounded-xl flex items-center justify-center mb-2 shadow-sm group-hover:shadow-md transition-shadow`}>
                          <Icon size={18} />
                        </div>
                        <span className="text-xs font-medium text-gray-700">{action.label}</span>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            <motion.div
              whileHover={{ scale: 1.01 }}
              className="bg-gradient-to-br from-emerald-600 to-teal-700 p-5 rounded-2xl text-white shadow-lg relative overflow-hidden"
            >
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
              <div className="absolute -bottom-8 -left-4 w-32 h-32 bg-teal-400/20 rounded-full blur-3xl" />
              <div className="relative">
                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center mb-3">
                  <Package size={18} />
                </div>
                <p className="text-sm font-semibold mb-1">Pro Tip</p>
                <p className="text-emerald-100 text-xs mb-4 leading-relaxed">
                  Monitor low stock items regularly to prevent running out of best-sellers.
                </p>
                <Link to="/inventory" className="inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                  Check Inventory <ArrowRight size={13} />
                </Link>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}

      {/* ── ROW 4: Alerts + Attendance ── */}
      {!loading && (
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38, duration: 0.4 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {/* Low Stock Alert */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center">
                  <Bell size={15} className="text-red-500" />
                </div>
                <h2 className="text-sm font-semibold text-gray-800">Stock Alerts</h2>
                {stats.lowStockCount > 0 && (
                  <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs font-bold rounded-full">{stats.lowStockCount}</span>
                )}
              </div>
              <Link to="/stock-alerts" className="text-emerald-600 text-xs hover:text-emerald-700 flex items-center gap-1 font-medium">
                View all <ArrowRight size={12} />
              </Link>
            </div>
            {lowStockItems.length > 0 ? (
              <div className="space-y-2">
                {lowStockItems.map((item) => {
                  const pct = Math.min((item.quantity / Math.max(item.min_stock, 1)) * 100, 100);
                  const isOut = item.quantity === 0;
                  return (
                    <div key={item.product_id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isOut ? 'bg-red-100' : 'bg-amber-100'}`}>
                        <Package size={14} className={isOut ? 'text-red-500' : 'text-amber-600'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-gray-800 truncate">{item.product_name}</p>
                          <span className={`text-xs font-bold ml-2 flex-shrink-0 ${isOut ? 'text-red-600' : 'text-amber-600'}`}>
                            {isOut ? 'Out' : `${item.quantity} ${item.unit || 'units'}`}
                          </span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${isOut ? 'bg-red-400' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <CheckCircle size={28} className="mb-2 text-emerald-400" />
                <p className="text-sm font-medium text-emerald-600">All stock levels are healthy</p>
              </div>
            )}
          </div>

          {/* Today's Attendance */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-cyan-100 rounded-xl flex items-center justify-center">
                  <UserCheck size={15} className="text-cyan-600" />
                </div>
                <h2 className="text-sm font-semibold text-gray-800">Today's Attendance</h2>
              </div>
              <Link to="/daily-attendance" className="text-emerald-600 text-xs hover:text-emerald-700 flex items-center gap-1 font-medium">
                Manage <ArrowRight size={12} />
              </Link>
            </div>

            {attendance.total > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  {[
                    { label: 'Present', value: attendance.present, color: 'bg-emerald-50 text-emerald-700', icon: UserCheck },
                    { label: 'Absent',  value: attendance.absent,  color: 'bg-red-50 text-red-600',         icon: UserX },
                    { label: 'Leave',   value: attendance.leave + attendance.half_day, color: 'bg-amber-50 text-amber-600', icon: Clock },
                  ].map(s => (
                    <div key={s.label} className={`rounded-xl p-3 text-center ${s.color}`}>
                      <p className="text-2xl font-black">{s.value}</p>
                      <p className="text-xs font-medium mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Attendance rate</span>
                    <span className="font-semibold text-gray-700">
                      {attendance.total > 0 ? Math.round((attendance.present / attendance.total) * 100) : 0}%
                    </span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden flex gap-0.5">
                    {attendance.present > 0 && <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(attendance.present / attendance.total) * 100}%` }} />}
                    {attendance.absent > 0  && <div className="h-full bg-red-400 rounded-full"     style={{ width: `${(attendance.absent  / attendance.total) * 100}%` }} />}
                    {(attendance.leave + attendance.half_day) > 0 && <div className="h-full bg-amber-400 rounded-full" style={{ width: `${((attendance.leave + attendance.half_day) / attendance.total) * 100}%` }} />}
                  </div>
                  {attendance.unmarked > 0 && (
                    <p className="text-xs text-amber-600 font-medium flex items-center gap-1 mt-2">
                      <Activity size={11} /> {attendance.unmarked} staff not yet marked
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                <UserCheck size={28} className="mb-2 opacity-40" />
                <p className="text-sm">No attendance data for today</p>
                <Link to="/daily-attendance" className="text-xs text-emerald-600 mt-1 font-medium hover:underline">Mark attendance →</Link>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ── ROW 5: Recent Orders + Top Products ── */}
      {!loading && (
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.46, duration: 0.4 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {/* Recent Orders */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-800">Recent Orders</h2>
              <Link to="/orders" className="text-emerald-600 text-xs hover:text-emerald-700 flex items-center gap-1 font-medium">
                View all <ArrowRight size={12} />
              </Link>
            </div>
            {recentOrders.length > 0 ? (
              <motion.ul variants={fadeList} initial="hidden" animate="show" className="space-y-2">
                {recentOrders.map(order => (
                  <motion.li key={order.sale_id} variants={fadeItem}
                    className="flex items-center justify-between p-3 rounded-xl border border-gray-50 hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform">
                        <ShoppingCart size={16} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{order.customer_name || 'Walk-in Customer'}</p>
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock size={10} /> {new Date(order.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-800 text-sm">{currency}{Number(order.total).toFixed(0)}</p>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs">
                        <CheckCircle size={9} /> Done
                      </span>
                    </div>
                  </motion.li>
                ))}
              </motion.ul>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <ShoppingCart size={30} className="mb-2 opacity-40" />
                <p className="text-sm">No recent orders</p>
              </div>
            )}
          </div>

          {/* Top Products */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-800">Top Selling Products</h2>
              <Link to="/reports" className="text-emerald-600 text-xs hover:text-emerald-700 flex items-center gap-1 font-medium">
                View all <ArrowRight size={12} />
              </Link>
            </div>
            {topProducts.length > 0 ? (
              <motion.ul variants={fadeList} initial="hidden" animate="show" className="space-y-2">
                {topProducts.map((product, index) => {
                  const maxRev = topProducts[0]?.revenue || 1;
                  const pct = (product.revenue / maxRev) * 100;
                  return (
                    <motion.li key={product.product_id} variants={fadeItem} className="p-3 rounded-xl border border-gray-50 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 bg-emerald-100 text-emerald-700 rounded-md flex items-center justify-center text-xs font-bold">
                            {index + 1}
                          </span>
                          <span className="text-sm font-medium text-gray-800 truncate max-w-[160px]">{product.product_name}</span>
                        </div>
                        <span className="font-bold text-gray-800 text-sm">{currency}{Number(product.revenue).toFixed(0)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ delay: 0.5 + index * 0.08, duration: 0.6, ease: 'easeOut' }}
                          className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full"
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{product.quantity_sold} units sold</p>
                    </motion.li>
                  );
                })}
              </motion.ul>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <Box size={30} className="mb-2 opacity-40" />
                <p className="text-sm">No product data</p>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default Dashboard;
 
