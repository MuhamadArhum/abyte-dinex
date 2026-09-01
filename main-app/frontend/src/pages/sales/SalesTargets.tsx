import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { Target, Plus, TrendingUp, Award, Users, Edit2, Trash2, X, BarChart3, Printer } from 'lucide-react';
import { printReport, buildTable, buildStatsCards } from '../../utils/reportPrinter';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import Pagination from '../../components/Pagination';

interface TargetItem {
  target_id: number;
  user_id: number | null;
  user_name: string;
  target_type: 'daily' | 'weekly' | 'monthly';
  target_amount: number;
  target_orders: number | null;
  period_start: string;
  period_end: string;
  is_active: boolean;
  actual_amount: number;
  actual_orders: number;
  achievement_percentage: number;
}

interface DashboardItem {
  target_id: number;
  user_name: string;
  target_type: 'daily' | 'weekly' | 'monthly';
  target_amount: number;
  target_orders: number | null;
  actual_amount: number;
  actual_orders: number;
  achievement_percentage: number;
  period_start: string;
  period_end: string;
}

interface Stats {
  active_targets: number;
  overall_achievement: number;
  top_performer: { name: string; percentage: number } | null;
  lowest_performer: { name: string; percentage: number } | null;
}

interface UserOption {
  user_id: number;
  name: string;
  role_name: string;
}

interface PaginationData {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ModalFormData {
  user_id: string;
  target_type: 'daily' | 'weekly' | 'monthly';
  target_amount: string;
  target_orders: string;
  period_start: string;
  period_end: string;
  is_active: boolean;
}

const defaultFormData: ModalFormData = {
  user_id: '',
  target_type: 'monthly',
  target_amount: '',
  target_orders: '',
  period_start: '',
  period_end: '',
  is_active: true,
};

// ---------- Target Modal ----------
const TargetModal = ({
  isOpen,
  onClose,
  onSuccess,
  target,
  users,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  target: TargetItem | null;
  users: UserOption[];
}) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ModalFormData>(defaultFormData);

  useEffect(() => {
    if (target) {
      setFormData({
        user_id: target.user_id != null ? String(target.user_id) : '',
        target_type: target.target_type,
        target_amount: String(target.target_amount),
        target_orders: target.target_orders != null ? String(target.target_orders) : '',
        period_start: target.period_start ? target.period_start.split('T')[0] : '',
        period_end: target.period_end ? target.period_end.split('T')[0] : '',
        is_active: target.is_active,
      });
    } else {
      setFormData(defaultFormData);
    }
  }, [target, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.target_amount || !formData.period_start || !formData.period_end) {
      toast.error('Please fill all required fields');
      return;
    }

    const payload: any = {
      target_type: formData.target_type,
      target_amount: parseFloat(formData.target_amount),
      period_start: formData.period_start,
      period_end: formData.period_end,
    };

    if (formData.user_id) {
      payload.user_id = parseInt(formData.user_id, 10);
    }
    if (formData.target_orders) {
      payload.target_orders = parseInt(formData.target_orders, 10);
    }
    if (target) {
      payload.is_active = formData.is_active;
    }

    setLoading(true);
    try {
      if (target) {
        await api.put(`/sales-targets/${target.target_id}`, payload);
        toast.success('Target updated successfully');
      } else {
        await api.post('/sales-targets', payload);
        toast.success('Target created successfully');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold text-gray-800">
            {target ? 'Edit Target' : 'Create Target'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* User dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Cashier</label>
              <select
                value={formData.user_id}
                onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Store-Wide (All Cashiers)</option>
                {users.map((u) => (
                  <option key={u.user_id} value={u.user_id}>
                    {u.name} ({u.role_name})
                  </option>
                ))}
              </select>
            </div>

            {/* Target type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Target Type *</label>
              <select
                value={formData.target_type}
                onChange={(e) =>
                  setFormData({ ...formData, target_type: e.target.value as 'daily' | 'weekly' | 'monthly' })
                }
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            {/* Target amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Target Amount (Rs) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.target_amount}
                onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g., 50000"
                required
              />
            </div>

            {/* Target orders */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Target Orders (optional)</label>
              <input
                type="number"
                min="0"
                value={formData.target_orders}
                onChange={(e) => setFormData({ ...formData, target_orders: e.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                placeholder="e.g., 100"
              />
            </div>

            {/* Period start */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Period Start *</label>
                <input
                  type="date"
                  value={formData.period_start}
                  onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Period End *</label>
                <input
                  type="date"
                  value={formData.period_end}
                  onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>

            {/* Active toggle (only in edit mode) */}
            {target && (
              <div className="flex items-center gap-3">
                <label className="block text-sm font-medium text-gray-700">Active</label>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                    formData.is_active ? 'bg-emerald-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      formData.is_active ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition disabled:opacity-50"
            >
              {loading ? 'Saving...' : target ? 'Update Target' : 'Create Target'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const getProgressBarClass = (pct: number): string => {
  if (pct >= 80) return 'bg-emerald-500';
  if (pct >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
};

const getProgressBgClass = (pct: number): string => {
  if (pct >= 80) return 'bg-emerald-100';
  if (pct >= 50) return 'bg-yellow-100';
  return 'bg-red-100';
};

const getAchievementTextClass = (pct: number): string => {
  if (pct >= 80) return 'text-emerald-700';
  if (pct >= 50) return 'text-yellow-700';
  return 'text-red-700';
};

const getAchievementBadgeClass = (pct: number): string => {
  if (pct >= 80) return 'bg-emerald-100 text-emerald-700';
  if (pct >= 50) return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-700';
};

const getTypeBadgeClass = (type: string): string => {
  if (type === 'daily') return 'bg-emerald-100 text-emerald-700';
  if (type === 'weekly') return 'bg-emerald-100 text-emerald-700';
  return 'bg-emerald-100 text-emerald-700';
};

// ---------- Main Page ----------
const SalesTargets = () => {
  const { currencySymbol: currency } = useSettings();
  const toast = useToast();
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'manage'>('dashboard');

  // Dashboard state
  const [stats, setStats] = useState<Stats>({
    active_targets: 0,
    overall_achievement: 0,
    top_performer: null,
    lowest_performer: null,
  });
  const [dashboardItems, setDashboardItems] = useState<DashboardItem[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  // Manage state
  const [targets, setTargets] = useState<TargetItem[]>([]);
  const [manageLoading, setManageLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });
  const [filterUserId, setFilterUserId] = useState('');
  const [filterType, setFilterType] = useState('');

  // Shared state
  const [users, setUsers] = useState<UserOption[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<TargetItem | null>(null);

  // Fetch users list on mount
  useEffect(() => {
    fetchUsers();
  }, []);

  // Fetch appropriate data when tab changes
  useEffect(() => {
    if (activeTab === 'dashboard') {
      fetchDashboard();
      fetchStats();
    } else {
      fetchTargets();
    }
  }, [activeTab]);

  // Re-fetch manage targets when filters or page change
  useEffect(() => {
    if (activeTab === 'manage') {
      fetchTargets();
    }
  }, [pagination.page, filterUserId, filterType]);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data.data || []);
    } catch (err) {
      console.error('Failed to load users', err);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get('/sales-targets/stats');
      setStats({
        active_targets: res.data.active_targets ?? 0,
        overall_achievement: res.data.overall_achievement ?? 0,
        top_performer: res.data.top_performer || null,
        lowest_performer: res.data.lowest_performer || null,
      });
    } catch (err) {
      console.error('Failed to load stats', err);
    }
  };

  const fetchDashboard = async () => {
    setDashboardLoading(true);
    try {
      const res = await api.get('/sales-targets/dashboard');
      setDashboardItems(Array.isArray(res.data) ? res.data : res.data.data || []);
    } catch (err) {
      toast.error('Failed to load dashboard');
    } finally {
      setDashboardLoading(false);
    }
  };

  const fetchTargets = useCallback(async () => {
    setManageLoading(true);
    try {
      const params: any = { page: pagination.page, limit: pagination.limit };
      if (filterUserId) params.user_id = filterUserId;
      if (filterType) params.target_type = filterType;
      const res = await api.get('/sales-targets', { params });
      setTargets(res.data.data || []);
      if (res.data.pagination) {
        setPagination((prev) => ({ ...prev, ...res.data.pagination }));
      }
    } catch (err) {
      toast.error('Failed to load targets');
    } finally {
      setManageLoading(false);
    }
  }, [pagination.page, pagination.limit, filterUserId, filterType]);

  const handleDelete = async (target: TargetItem) => {
    const ok = await confirm({ title: 'Delete Target', message: `Delete target for "${target.user_name}"?`, type: 'danger' });
    if (!ok) return;
    try {
      await api.delete(`/sales-targets/${target.target_id}`);
      toast.success('Target deleted');
      fetchTargets();
      if (activeTab === 'dashboard') {
        fetchDashboard();
        fetchStats();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const handleEdit = (target: TargetItem) => {
    setSelectedTarget(target);
    setShowModal(true);
  };

  const handleCreate = () => {
    setSelectedTarget(null);
    setShowModal(true);
  };

  const handleModalSuccess = () => {
    if (activeTab === 'dashboard') {
      fetchDashboard();
      fetchStats();
    } else {
      fetchTargets();
    }
  };

  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  const handleLimitChange = (limit: number) => {
    setPagination((prev) => ({ ...prev, limit, page: 1 }));
  };

  const formatCurrency = (amount: number): string => {
    return `Rs ${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString();
  };

  const handlePrint = () => {
    let content = buildStatsCards([
      { label: 'Active Targets', value: String(stats.active_targets) },
      { label: 'Overall Achievement', value: `${stats.overall_achievement}%` },
      { label: 'Top Performer', value: stats.top_performer ? `${stats.top_performer.name} (${stats.top_performer.percentage}%)` : '-' },
      { label: 'Lowest Performer', value: stats.lowest_performer ? `${stats.lowest_performer.name} (${stats.lowest_performer.percentage}%)` : '-' },
    ]);
    if (dashboardItems.length > 0) {
      const rows = dashboardItems.map(d => [d.user_name, d.target_type, `${currency}${Number(d.target_amount).toFixed(0)}`, `${currency}${Number(d.actual_amount).toFixed(0)}`, `${d.achievement_percentage}%`]);
      content += buildTable(['Cashier', 'Type', 'Target', 'Actual', 'Achievement'], rows, { alignRight: [2, 3, 4], caption: 'Sales Targets Dashboard' });
    }
    printReport({ title: 'Sales Targets Report', content });
  };

  // ---------- Render ----------
  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Target className="text-emerald-600" size={20} />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-gray-900">Sales Targets</h1>
            <p className="text-gray-600 text-sm mt-1">Track cashier performance and manage sales goals</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-3 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition"
          >
            <Printer size={18} />
            <span className="hidden sm:inline">Print</span>
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl hover:bg-emerald-700 transition shadow-lg"
          >
            <Plus size={20} /> <span className="hidden sm:inline">Create Target</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-8">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-6 py-4 font-medium transition border-b-2 ${
              activeTab === 'dashboard'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <BarChart3 size={18} />
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`flex items-center gap-2 px-6 py-4 font-medium transition border-b-2 ${
              activeTab === 'manage'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Target size={18} />
            Manage Targets
          </button>
        </div>
      </div>

      {/* ==================== DASHBOARD TAB ==================== */}
      {activeTab === 'dashboard' && (
        <>
          {/* Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Active Targets */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Target size={20} className="text-emerald-600" />
                </div>
                <p className="text-gray-600 text-sm font-medium">Active Targets</p>
              </div>
              <p className="text-3xl font-bold text-gray-800">{stats.active_targets}</p>
            </div>

            {/* Overall Achievement */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <TrendingUp size={20} className="text-emerald-600" />
                </div>
                <p className="text-gray-600 text-sm font-medium">Overall Achievement</p>
              </div>
              <p className="text-3xl font-bold text-gray-800">{stats.overall_achievement.toFixed(1)}%</p>
            </div>

            {/* Top Performer */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Award size={20} className="text-emerald-600" />
                </div>
                <p className="text-gray-600 text-sm font-medium">Top Performer</p>
              </div>
              {stats.top_performer ? (
                <>
                  <p className="text-lg font-bold text-gray-800 truncate">{stats.top_performer.name}</p>
                  <p className="text-sm text-emerald-600 font-semibold">{stats.top_performer.percentage.toFixed(1)}%</p>
                </>
              ) : (
                <p className="text-gray-400 text-sm">No data</p>
              )}
            </div>

            {/* Lowest Performer */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Users size={20} className="text-red-600" />
                </div>
                <p className="text-gray-600 text-sm font-medium">Lowest Performer</p>
              </div>
              {stats.lowest_performer ? (
                <>
                  <p className="text-lg font-bold text-gray-800 truncate">{stats.lowest_performer.name}</p>
                  <p className="text-sm text-red-600 font-semibold">{stats.lowest_performer.percentage.toFixed(1)}%</p>
                </>
              ) : (
                <p className="text-gray-400 text-sm">No data</p>
              )}
            </div>
          </div>

          {/* Progress Bars Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <BarChart3 size={18} className="text-emerald-600" />
                Cashier Performance
              </h3>
            </div>

            {dashboardLoading ? (
              <div className="p-12 text-center text-gray-500">Loading dashboard...</div>
            ) : dashboardItems.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <Target size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">No active targets found</p>
                <p className="text-sm mt-1">Create a sales target to start tracking performance</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {dashboardItems.map((item) => {
                  const pct = Math.min(item.achievement_percentage, 100);
                  const barClass = getProgressBarClass(item.achievement_percentage);
                  const bgClass = getProgressBgClass(item.achievement_percentage);
                  const textClass = getAchievementTextClass(item.achievement_percentage);

                  return (
                    <div key={item.target_id} className="p-5 hover:bg-gray-50 transition">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-gray-800">{item.user_name}</span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getTypeBadgeClass(item.target_type)}`}>
                            {item.target_type}
                          </span>
                        </div>
                        <span className={`text-sm font-bold ${textClass}`}>
                          {item.achievement_percentage.toFixed(1)}%
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className={`w-full h-3 rounded-full ${bgClass} overflow-hidden`}>
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${barClass}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      {/* Details row */}
                      <div className="flex items-center justify-between mt-2 text-sm text-gray-600">
                        <span>
                          Amount: <span className="font-medium text-gray-800">
                            {formatCurrency(item.actual_amount)}
                          </span>
                          {' / '}
                          <span className="font-medium">{formatCurrency(item.target_amount)}</span>
                        </span>
                        {item.target_orders != null && item.target_orders > 0 && (
                          <span>
                            Orders: <span className="font-medium text-gray-800">{item.actual_orders}</span>
                            {' / '}
                            <span className="font-medium">{item.target_orders}</span>
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {formatDate(item.period_start)} - {formatDate(item.period_end)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ==================== MANAGE TARGETS TAB ==================== */}
      {activeTab === 'manage' && (
        <>
          {/* Toolbar */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <select
                value={filterUserId}
                onChange={(e) => {
                  setFilterUserId(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">All Users</option>
                {users.map((u) => (
                  <option key={u.user_id} value={u.user_id}>
                    {u.name}
                  </option>
                ))}
              </select>

              <select
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value);
                  setPagination((prev) => ({ ...prev, page: 1 }));
                }}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">All Types</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>

              <div className="ml-auto">
                <button
                  onClick={handleCreate}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2 rounded-lg hover:bg-emerald-700 transition"
                >
                  <Plus size={18} /> Create Target
                </button>
              </div>
            </div>
          </div>

          {/* Targets Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-gray-50">
                <tr className="border-b">
                  <th className="text-left p-4 font-semibold text-gray-700">User</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Type</th>
                  <th className="text-right p-4 font-semibold text-gray-700">Target Amount</th>
                  <th className="text-right p-4 font-semibold text-gray-700">Actual</th>
                  <th className="text-center p-4 font-semibold text-gray-700">Achievement</th>
                  <th className="text-left p-4 font-semibold text-gray-700">Period</th>
                  <th className="text-center p-4 font-semibold text-gray-700">Status</th>
                  <th className="text-center p-4 font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {manageLoading ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-500">
                      Loading...
                    </td>
                  </tr>
                ) : targets.length > 0 ? (
                  targets.map((t) => (
                    <tr key={t.target_id} className="border-b hover:bg-gray-50 transition">
                      <td className="p-4">
                        <span className="font-semibold text-gray-800">{t.user_name}</span>
                      </td>
                      <td className="p-4">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${getTypeBadgeClass(t.target_type)}`}>
                          {t.target_type}
                        </span>
                      </td>
                      <td className="p-4 text-right font-medium text-gray-800">
                        {formatCurrency(t.target_amount)}
                      </td>
                      <td className="p-4 text-right font-medium text-gray-800">
                        {formatCurrency(t.actual_amount)}
                      </td>
                      <td className="p-4 text-center">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${getAchievementBadgeClass(t.achievement_percentage)}`}>
                          {t.achievement_percentage.toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-4 text-sm text-gray-600">
                        {formatDate(t.period_start)} - {formatDate(t.period_end)}
                      </td>
                      <td className="p-4 text-center">
                        {t.is_active ? (
                          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
                            Active
                          </span>
                        ) : (
                          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
                            Expired
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleEdit(t)}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(t)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-500">
                      No targets found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>

            {/* Pagination */}
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={handlePageChange}
              totalItems={pagination.total}
              itemsPerPage={pagination.limit}
              onItemsPerPageChange={handleLimitChange}
            />
          </div>
        </>
      )}

      {/* Target Modal */}
      <TargetModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedTarget(null);
        }}
        onSuccess={handleModalSuccess}
        target={selectedTarget}
        users={users}
      />
    </div>
  );
};

export default SalesTargets;
