import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Search, XCircle, CheckCircle, Bell, Package } from 'lucide-react';
import api from '../../utils/api';
import Pagination from '../../components/Pagination';
import { useConfirm } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';

interface StockAlert {
  alert_id: number;
  product_id: number;
  product_name: string;
  alert_type: 'low_stock' | 'out_of_stock' | 'overstock';
  threshold_value: number;
  current_stock: number;
  is_active: number;
  created_at: string;
  resolved_at: string | null;
}

const ALERT_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  low_stock: { label: 'Low Stock', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  out_of_stock: { label: 'Out of Stock', bg: 'bg-red-100', text: 'text-red-700' },
  overstock: { label: 'Overstock', bg: 'bg-emerald-100', text: 'text-emerald-700' },
};

const StockAlerts = () => {
  const confirm = useConfirm();
  const { error } = useToast();
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Stats
  const [stats, setStats] = useState({ total_active: 0, low_stock: 0, out_of_stock: 0, overstock: 0 });

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page: currentPage, limit: itemsPerPage };
      if (search) params.search = search;
      if (typeFilter) params.alert_type = typeFilter;
      if (statusFilter) params.status = statusFilter;

      const res = await api.get('/purchase-orders/stock-alerts', { params });
      if (res.data.pagination) {
        setAlerts(res.data.data);
        setTotalItems(res.data.pagination.total);
        setTotalPages(res.data.pagination.totalPages);
      } else {
        setAlerts(res.data.data || []);
        setTotalItems(res.data.data?.length || 0);
        setTotalPages(1);
      }
    } catch (error) {
      console.error('Failed to fetch alerts', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, search, typeFilter, statusFilter]);

  const fetchStats = async () => {
    try {
      const res = await api.get('/purchase-orders/stock-alerts/stats');
      setStats(res.data);
    } catch (error) { console.error(error); }
  };

  useEffect(() => { fetchStats(); }, []);
  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const handleResolve = async (alertId: number) => {
    const ok = await confirm({ title: 'Resolve Alert', message: 'Mark this alert as resolved?', type: 'warning' });
    if (!ok) return;
    try {
      await api.put(`/purchase-orders/stock-alerts/${alertId}/resolve`);
      fetchAlerts();
      fetchStats();
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to resolve alert');
    }
  };

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900 flex items-center gap-3">
          <Bell className="text-orange-600" size={20} />
          Stock Alerts
        </h1>
        <p className="text-gray-500 mt-1">Monitor low stock, out of stock, and overstock items</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-50 rounded-xl"><Bell size={24} className="text-orange-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{stats.total_active}</p>
              <p className="text-sm text-gray-500">Active Alerts</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-50 rounded-xl"><AlertTriangle size={24} className="text-yellow-600" /></div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{stats.low_stock}</p>
              <p className="text-sm text-gray-500">Low Stock</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-50 rounded-xl"><XCircle size={24} className="text-red-600" /></div>
            <div>
              <p className="text-2xl font-bold text-red-600">{stats.out_of_stock}</p>
              <p className="text-sm text-gray-500">Out of Stock</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 rounded-xl"><Package size={24} className="text-emerald-600" /></div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{stats.overstock}</p>
              <p className="text-sm text-gray-500">Overstock</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Search by product name..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }} />
          </div>
          <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none min-w-[160px]">
            <option value="">All Types</option>
            <option value="low_stock">Low Stock</option>
            <option value="out_of_stock">Out of Stock</option>
            <option value="overstock">Overstock</option>
          </select>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none min-w-[140px]">
            <option value="active">Active</option>
            <option value="resolved">Resolved</option>
            <option value="">All</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Alert Type</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Current Stock</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Threshold</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {alerts.map((alert) => {
                  const badge = ALERT_BADGES[alert.alert_type] || ALERT_BADGES.low_stock;
                  return (
                    <tr key={alert.alert_id} className={`hover:bg-gray-50 ${
                      alert.alert_type === 'out_of_stock' && alert.is_active ? 'bg-red-50/30' : ''
                    }`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-xs">
                            {alert.product_name.charAt(0)}
                          </div>
                          <span className="font-medium text-gray-900">{alert.product_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-medium ${
                          alert.current_stock === 0 ? 'text-red-600' :
                          alert.current_stock < (alert.threshold_value || 10) ? 'text-yellow-600' :
                          'text-gray-700'
                        }`}>
                          {alert.current_stock}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">{alert.threshold_value || '-'}</td>
                      <td className="px-4 py-3">
                        {alert.is_active ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Active</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Resolved</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(alert.created_at).toLocaleDateString()}
                        {alert.resolved_at && (
                          <div className="text-emerald-600 mt-0.5">
                            Resolved: {new Date(alert.resolved_at).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {alert.is_active ? (
                          <button
                            onClick={() => handleResolve(alert.alert_id)}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                            title="Resolve Alert"
                          >
                            <CheckCircle size={14} />
                            Resolve
                          </button>
                        ) : (
                          <span className="text-gray-300 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {alerts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                      <AlertTriangle size={40} className="mx-auto mb-3 text-gray-300" />
                      <p>No stock alerts found</p>
                      <p className="text-sm mt-1">All inventory levels are healthy</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage}
          totalItems={totalItems} itemsPerPage={itemsPerPage} onItemsPerPageChange={(v) => { setItemsPerPage(v); setCurrentPage(1); }} />
      </div>
    </div>
  );
};

export default StockAlerts;
