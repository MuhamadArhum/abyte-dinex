import { useState, useEffect, useCallback } from 'react';
import {
  Pencil, Search, MapPin, Phone, Mail, X, Building2,
  User, TrendingUp, Plus, Users, AlertTriangle, CheckCircle,
  UserCheck, UserX, RefreshCw, ChevronRight, ShieldCheck,
} from 'lucide-react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

// ─── Types ───────────────────────────────────────────────────────────────────
interface StoreData {
  store_id: number; store_name: string; store_code: string;
  address: string | null; phone: string | null; email: string | null;
  manager_id: number | null; manager_name: string | null;
  monthly_charge: number; is_active: number;
}
interface AppUser {
  user_id: number; name: string; username: string;
  role_name?: string; role?: string; branch_id: number | null; branch_name: string | null;
}
interface ConsolidatedBranch {
  store_id: number; store_name: string; store_code: string;
  monthly_charge: number; manager_name: string | null;
  today_sale_count: number; today_revenue: number;
  month_revenue: number; total_staff: number; total_users: number;
}

// ─── Store Modal ──────────────────────────────────────────────────────────────
const StoreModal = ({ store, users, onClose, onSave }: {
  store: StoreData | null; users: AppUser[];
  onClose: () => void; onSave: () => void;
}) => {
  const [form, setForm] = useState({
    store_name: store?.store_name || '', store_code: store?.store_code || '',
    address: store?.address || '', phone: store?.phone || '',
    email: store?.email || '', manager_id: store?.manager_id || '',
    monthly_charge: store?.monthly_charge ?? 0, is_active: store ? store.is_active : 1,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.store_name.trim() || !form.store_code.trim()) { setError('Store name and code are required'); return; }
    setSaving(true); setError('');
    try {
      if (store) await api.put(`/stores/${store.store_id}`, form);
      else       await api.post('/stores', form);
      onSave();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save store');
    } finally { setSaving(false); }
  };

  const f = (k: keyof typeof form, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <Building2 size={20} className="text-emerald-600" />
            {store ? 'Edit Branch' : 'Add New Branch'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Branch Name *</label>
              <input value={form.store_name} onChange={e => f('store_name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                placeholder="Main Branch" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Branch Code *</label>
              <input value={form.store_code} onChange={e => f('store_code', e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-mono"
                placeholder="MAIN" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Address</label>
            <input value={form.address} onChange={e => f('address', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
              placeholder="123 Main Street, City" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Phone</label>
              <input value={form.phone} onChange={e => f('phone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                placeholder="+92 300 1234567" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Email</label>
              <input type="email" value={form.email} onChange={e => f('email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                placeholder="branch@example.com" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Branch Manager</label>
              <select value={form.manager_id} onChange={e => f('manager_id', e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm">
                <option value="">No Manager</option>
                {users.map(u => (
                  <option key={u.user_id} value={u.user_id}>{u.name} ({u.role_name || u.role})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Monthly Charge (Rs.)</label>
              <input type="number" min="0" value={form.monthly_charge} onChange={e => f('monthly_charge', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                placeholder="0" />
            </div>
          </div>
          {store && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Status</label>
              <select value={form.is_active} onChange={e => f('is_active', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm">
                <option value={1}>Active</option>
                <option value={0}>Inactive</option>
              </select>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button type="button" onClick={onClose}
              className="px-5 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 transition-colors font-medium text-sm">
              {saving ? 'Saving...' : store ? 'Update Branch' : 'Create Branch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Branch Users Panel ───────────────────────────────────────────────────────
const BranchUsersPanel = ({ store, allUsers, onClose, onChanged }: {
  store: StoreData; allUsers: AppUser[];
  onClose: () => void; onChanged: () => void;
}) => {
  const branchUsers    = allUsers.filter(u => u.branch_id === store.store_id);
  const unassignedUsers = allUsers.filter(u => !u.branch_id && (u.role_name || u.role) !== 'Admin');
  const [assigning, setAssigning] = useState<number | null>(null);

  const assign = async (userId: number, branchId: number | null) => {
    setAssigning(userId);
    try {
      await api.patch(`/users/${userId}/branch`, { branch_id: branchId });
      onChanged();
    } catch { /* silent */ }
    finally { setAssigning(null); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Users size={18} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 text-sm">{store.store_name}</h3>
              <p className="text-xs text-gray-500">{branchUsers.length} users assigned</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Current branch users */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
              <UserCheck size={13} /> Assigned to this Branch ({branchUsers.length})
            </h4>
            {branchUsers.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-xl">
                <Users size={28} className="mx-auto text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">No users assigned yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {branchUsers.map(u => (
                  <div key={u.user_id} className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{u.name}</p>
                        <p className="text-xs text-gray-500">@{u.username} · {u.role_name || u.role}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => assign(u.user_id, null)}
                      disabled={assigning === u.user_id}
                      className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove from branch"
                    >
                      {assigning === u.user_id ? (
                        <div className="w-4 h-4 border-2 border-gray-300 border-t-emerald-500 rounded-full animate-spin" />
                      ) : <UserX size={15} />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Unassigned users — can be added */}
          {unassignedUsers.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <UserX size={13} className="text-amber-500" /> Unassigned Users — Add to this Branch
              </h4>
              <div className="space-y-2">
                {unassignedUsers.map(u => (
                  <div key={u.user_id} className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-amber-400 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{u.name}</p>
                        <p className="text-xs text-gray-500">@{u.username} · {u.role_name || u.role}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => assign(u.user_id, store.store_id)}
                      disabled={assigning === u.user_id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors"
                    >
                      {assigning === u.user_id ? (
                        <div className="w-3 h-3 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                      ) : <Plus size={12} />}
                      Assign
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Users in other branches */}
          {(() => {
            const otherBranchUsers = allUsers.filter(u => u.branch_id && u.branch_id !== store.store_id && (u.role_name || u.role) !== 'Admin');
            if (!otherBranchUsers.length) return null;
            return (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <ChevronRight size={13} /> Users in Other Branches (transfer)
                </h4>
                <div className="space-y-2">
                  {otherBranchUsers.map(u => (
                    <div key={u.user_id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-400 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">{u.name}</p>
                          <p className="text-xs text-gray-400">Currently: {u.branch_name || 'Other Branch'}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => assign(u.user_id, store.store_id)}
                        disabled={assigning === u.user_id}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors"
                      >
                        Transfer
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const Stores = () => {
  const { isAdmin } = useAuth();
  const [stores,     setStores]     = useState<StoreData[]>([]);
  const [allUsers,   setAllUsers]   = useState<AppUser[]>([]);
  const [consolidated, setConsolidated] = useState<ConsolidatedBranch[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [showModal,  setShowModal]  = useState(false);
  const [editStore,  setEditStore]  = useState<StoreData | null>(null);
  const [usersPanel, setUsersPanel] = useState<StoreData | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [storeRes, userRes, consolidRes] = await Promise.all([
        api.get('/stores'),
        api.get('/users'),
        isAdmin ? api.get('/stores/consolidated-summary').catch(() => ({ data: { data: [] } })) : Promise.resolve({ data: { data: [] } }),
      ]);
      setStores(storeRes.data.data || []);
      setAllUsers(userRes.data.data || userRes.data || []);
      setConsolidated(consolidRes.data.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const unassignedNonAdmin = allUsers.filter(u => !u.branch_id && (u.role_name || u.role) !== 'Admin');
  const filteredStores = stores.filter(s =>
    !search ||
    s.store_name.toLowerCase().includes(search.toLowerCase()) ||
    s.store_code.toLowerCase().includes(search.toLowerCase())
  );

  const getUsersForStore = (storeId: number) =>
    allUsers.filter(u => u.branch_id === storeId);

  const getConsolidated = (storeId: number) =>
    consolidated.find(c => c.store_id === storeId);

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="text-emerald-600" size={22} />
            Branch Configuration
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {stores.filter(s => s.is_active).length} active branches · {allUsers.filter(u => u.branch_id).length} users assigned
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchAll} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors" title="Refresh">
            <RefreshCw size={16} />
          </button>
          {stores.length > 1 && (
            <button onClick={() => setShowSummary(!showSummary)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm border transition-colors ${showSummary ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'}`}>
              <TrendingUp size={15} /> Summary
            </button>
          )}
          <button onClick={() => { setEditStore(null); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm shadow-sm">
            <Plus size={16} /> Add Branch
          </button>
        </div>
      </div>

      {/* ── Unassigned Users Warning ── */}
      {unassignedNonAdmin.length > 0 && (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-amber-800 text-sm">
              {unassignedNonAdmin.length} user{unassignedNonAdmin.length > 1 ? 's' : ''} not assigned to any branch
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              {unassignedNonAdmin.map(u => u.name).join(', ')} — Click "Manage Users" on any branch to assign them.
            </p>
          </div>
        </div>
      )}

      {/* ── All assigned confirmation ── */}
      {unassignedNonAdmin.length === 0 && allUsers.filter(u => (u.role_name || u.role) !== 'Admin').length > 0 && (
        <div className="mb-5 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle size={16} className="text-emerald-500 shrink-0" />
          <p className="text-sm text-emerald-700 font-medium">All users are assigned to branches. Branch isolation is fully active.</p>
        </div>
      )}

      {/* ── Consolidated Summary ── */}
      {showSummary && consolidated.length > 0 && (
        <div className="mb-6 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
            <h2 className="font-semibold text-sm flex items-center gap-2"><TrendingUp size={15} /> Consolidated Branch Summary</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Branch', 'Code', 'Manager', "Today Sales", "Today Revenue", 'Month Revenue', 'Staff', 'Users'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {consolidated.map(b => (
                  <tr key={b.store_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-800">{b.store_name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{b.store_code}</td>
                    <td className="px-4 py-3 text-gray-600">{b.manager_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{b.today_sale_count}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-700">Rs. {Number(b.today_revenue).toLocaleString()}</td>
                    <td className="px-4 py-3 font-semibold text-blue-700">Rs. {Number(b.month_revenue).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-600">{b.total_staff}</td>
                    <td className="px-4 py-3 text-gray-600">{b.total_users}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Search ── */}
      <div className="mb-5 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search branches..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
      </div>

      {/* ── Branch Cards ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-emerald-200 border-t-emerald-600"></div>
        </div>
      ) : filteredStores.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <Building2 size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No branches found</p>
          <button onClick={() => { setEditStore(null); setShowModal(true); }}
            className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors">
            Create First Branch
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredStores.map(store => {
            const branchUsers = getUsersForStore(store.store_id);
            const stats = getConsolidated(store.store_id);
            const setupComplete = store.manager_id && branchUsers.length > 0;

            return (
              <div key={store.store_id}
                className={`bg-white rounded-2xl border-2 shadow-sm hover:shadow-md transition-all overflow-hidden ${
                  store.is_active ? 'border-gray-100 hover:border-emerald-200' : 'border-gray-100 opacity-70'
                }`}>

                {/* Card header */}
                <div className="p-5 border-b border-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow-sm ${
                        store.is_active ? 'bg-gradient-to-br from-emerald-500 to-emerald-600' : 'bg-gray-400'
                      }`}>
                        {store.store_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-800">{store.store_name}</h3>
                        <span className="text-xs font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{store.store_code}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {setupComplete
                        ? <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-medium"><ShieldCheck size={10} /> Ready</span>
                        : <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium"><AlertTriangle size={10} /> Setup</span>
                      }
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${store.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {store.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Info rows */}
                <div className="px-5 py-4 space-y-2 text-sm">
                  {store.address && (
                    <div className="flex items-center gap-2 text-gray-500"><MapPin size={13} className="shrink-0 text-gray-400" /><span className="truncate">{store.address}</span></div>
                  )}
                  {store.phone && (
                    <div className="flex items-center gap-2 text-gray-500"><Phone size={13} className="text-gray-400" /><span>{store.phone}</span></div>
                  )}
                  {store.email && (
                    <div className="flex items-center gap-2 text-gray-500"><Mail size={13} className="text-gray-400" /><span>{store.email}</span></div>
                  )}
                  <div className="flex items-center gap-2 text-gray-500">
                    <User size={13} className="text-gray-400" />
                    <span>{store.manager_name
                      ? <span className="text-emerald-700 font-medium">{store.manager_name}</span>
                      : <span className="text-amber-500">No manager assigned</span>
                    }</span>
                  </div>
                </div>

                {/* Stats */}
                {stats && (
                  <div className="grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100 bg-gray-50/50">
                    {[
                      { label: "Today's Sales", value: stats.today_sale_count },
                      { label: 'Today Rev.', value: `Rs.${Number(stats.today_revenue).toLocaleString()}` },
                      { label: 'Month Rev.', value: `Rs.${Number(stats.month_revenue).toLocaleString()}` },
                    ].map(s => (
                      <div key={s.label} className="px-3 py-2.5 text-center">
                        <p className="text-xs font-bold text-gray-700">{s.value}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Users preview */}
                <div className="px-5 py-3 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2">
                        {branchUsers.slice(0, 4).map(u => (
                          <div key={u.user_id}
                            className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 border-2 border-white flex items-center justify-center text-white text-xs font-bold"
                            title={u.name}>
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                        ))}
                        {branchUsers.length > 4 && (
                          <div className="w-7 h-7 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-gray-600 text-xs font-bold">
                            +{branchUsers.length - 4}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">
                        {branchUsers.length === 0
                          ? <span className="text-amber-500 font-medium">No users assigned</span>
                          : `${branchUsers.length} user${branchUsers.length > 1 ? 's' : ''}`
                        }
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-2">
                  <button
                    onClick={() => setUsersPanel(store)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors">
                    <Users size={13} /> Manage Users
                  </button>
                  <button
                    onClick={() => { setEditStore(store); setShowModal(true); }}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-lg text-xs font-semibold transition-colors">
                    <Pencil size={13} /> Edit
                  </button>
                </div>
              </div>
            );
          })}

          {/* Add Branch CTA card */}
          <button
            onClick={() => { setEditStore(null); setShowModal(true); }}
            className="bg-white rounded-2xl border-2 border-dashed border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/30 transition-all p-8 flex flex-col items-center justify-center gap-3 group min-h-[200px]">
            <div className="w-12 h-12 bg-emerald-100 group-hover:bg-emerald-200 rounded-2xl flex items-center justify-center transition-colors">
              <Plus size={22} className="text-emerald-600" />
            </div>
            <p className="font-semibold text-gray-500 group-hover:text-emerald-700 transition-colors text-sm">Add New Branch</p>
          </button>
        </div>
      )}

      {/* ── Modals ── */}
      {showModal && (
        <StoreModal
          store={editStore}
          users={allUsers}
          onClose={() => { setShowModal(false); setEditStore(null); }}
          onSave={() => { setShowModal(false); setEditStore(null); fetchAll(); }}
        />
      )}

      {usersPanel && (
        <BranchUsersPanel
          store={usersPanel}
          allUsers={allUsers}
          onClose={() => setUsersPanel(null)}
          onChanged={fetchAll}
        />
      )}
    </div>
  );
};

export default Stores;
