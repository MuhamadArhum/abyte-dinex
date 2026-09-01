import { useState, useEffect } from 'react';
import {
  Building2, Plus, Edit, X, Loader2, Eye, EyeOff,
  Users, Package, ShoppingCart, CheckCircle, XCircle, Key
} from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';

interface Tenant {
  tenant_id: number;
  tenant_code: string;
  tenant_name: string;
  db_name: string;
  admin_email: string;
  plan: 'basic' | 'professional' | 'enterprise';
  is_active: number;
  created_at: string;
  stats: { users: number; products: number; sales: number };
}

const PLAN_COLORS: Record<string, string> = {
  basic: 'bg-gray-100 text-gray-600',
  professional: 'bg-blue-100 text-blue-700',
  enterprise: 'bg-purple-100 text-purple-700',
};

const Tenants = () => {
  const toast = useToast();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [createForm, setCreateForm] = useState({
    tenant_code: '', tenant_name: '', admin_name: '', admin_email: '', admin_password: '', plan: 'basic'
  });
  const [editForm, setEditForm] = useState({ tenant_name: '', is_active: true, plan: 'basic' });
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => { fetchTenants(); }, []);

  const fetchTenants = async () => {
    try {
      const res = await api.get('/tenants');
      setTenants(res.data.data || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/tenants', createForm);
      toast.success(`Client "${createForm.tenant_name}" created successfully!`);
      setShowCreateModal(false);
      setCreateForm({ tenant_code: '', tenant_name: '', admin_name: '', admin_email: '', admin_password: '', plan: 'basic' });
      fetchTenants();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create tenant');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) return;
    setSaving(true);
    try {
      await api.put(`/tenants/${selectedTenant.tenant_id}`, editForm);
      toast.success('Tenant updated');
      setShowEditModal(false);
      fetchTenants();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (tenant: Tenant) => {
    try {
      await api.put(`/tenants/${tenant.tenant_id}`, { is_active: !tenant.is_active });
      toast.success(`Tenant ${tenant.is_active ? 'deactivated' : 'activated'}`);
      fetchTenants();
    } catch (err: any) {
      toast.error('Failed to update status');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) return;
    setSaving(true);
    try {
      await api.post(`/tenants/${selectedTenant.tenant_id}/reset-password`, { new_password: newPassword });
      toast.success('Admin password reset successfully');
      setShowPasswordModal(false);
      setNewPassword('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setEditForm({ tenant_name: tenant.tenant_name, is_active: tenant.is_active === 1, plan: tenant.plan || 'basic' });
    setShowEditModal(true);
  };

  const openResetPassword = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setNewPassword('');
    setShowPasswordModal(true);
  };

  if (loading) return (
    <div className="p-8 flex justify-center items-center min-h-64">
      <Loader2 className="animate-spin text-emerald-600" size={36} />
    </div>
  );

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
              <Building2 className="text-white" size={24} />
            </div>
            Client Management
          </h1>
          <p className="text-gray-500 mt-1">Each client has their own isolated database</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-semibold shadow-sm transition"
        >
          <Plus size={18} /> Add New Client
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
          <p className="text-3xl font-bold text-emerald-600">{tenants.length}</p>
          <p className="text-gray-500 text-sm mt-1">Total Clients</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
          <p className="text-3xl font-bold text-emerald-600">{tenants.filter(t => t.is_active).length}</p>
          <p className="text-gray-500 text-sm mt-1">Active</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
          <p className="text-3xl font-bold text-gray-400">{tenants.filter(t => !t.is_active).length}</p>
          <p className="text-gray-500 text-sm mt-1">Inactive</p>
        </div>
      </div>

      {/* Tenants Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {tenants.map(tenant => (
          <div key={tenant.tenant_id} className={`bg-white rounded-2xl border-2 p-6 shadow-sm transition ${tenant.is_active ? 'border-gray-100' : 'border-gray-200 opacity-60'}`}>
            {/* Card Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-lg shadow-sm
                  ${tenant.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                  {tenant.tenant_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-gray-800">{tenant.tenant_name}</p>
                  <p className="text-xs text-gray-400 font-mono">code: {tenant.tenant_code}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {tenant.is_active
                  ? <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full">Active</span>
                  : <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs font-semibold rounded-full">Inactive</span>
                }
                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full capitalize ${PLAN_COLORS[tenant.plan] || PLAN_COLORS.basic}`}>
                  {tenant.plan || 'basic'}
                </span>
              </div>
            </div>

            {/* DB Info */}
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-xs text-gray-400 mb-1">Database</p>
              <p className="text-xs font-mono text-gray-600">{tenant.db_name}</p>
              <p className="text-xs text-gray-400 mt-1">{tenant.admin_email}</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
              <div className="text-center p-2 bg-emerald-50 rounded-lg">
                <Users size={14} className="text-emerald-500 mx-auto mb-1" />
                <p className="text-sm font-bold text-emerald-700">{tenant.stats?.users || 0}</p>
                <p className="text-xs text-emerald-400">Users</p>
              </div>
              <div className="text-center p-2 bg-emerald-50 rounded-lg">
                <Package size={14} className="text-emerald-500 mx-auto mb-1" />
                <p className="text-sm font-bold text-emerald-700">{tenant.stats?.products || 0}</p>
                <p className="text-xs text-emerald-400">Products</p>
              </div>
              <div className="text-center p-2 bg-emerald-50 rounded-lg">
                <ShoppingCart size={14} className="text-emerald-500 mx-auto mb-1" />
                <p className="text-sm font-bold text-emerald-700">{tenant.stats?.sales || 0}</p>
                <p className="text-xs text-emerald-400">Sales</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button onClick={() => openEdit(tenant)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg font-medium transition">
                <Edit size={14} /> Edit
              </button>
              <button onClick={() => openResetPassword(tenant)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg font-medium transition">
                <Key size={14} /> Password
              </button>
              {tenant.tenant_code !== 'default' && (
                <button onClick={() => handleToggleStatus(tenant)}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-lg font-medium transition
                    ${tenant.is_active ? 'text-red-600 bg-red-50 hover:bg-red-100' : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'}`}>
                  {tenant.is_active ? <XCircle size={14} /> : <CheckCircle size={14} />}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ===== CREATE MODAL ===== */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-sm font-semibold text-gray-800">Add New Client</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Company Name <span className="text-red-500">*</span></label>
                <input type="text" value={createForm.tenant_name}
                  onChange={e => setCreateForm({ ...createForm, tenant_name: e.target.value })}
                  placeholder="e.g. Al-Noor Traders"
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-emerald-500 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Company Code <span className="text-red-500">*</span></label>
                <input type="text" value={createForm.tenant_code}
                  onChange={e => setCreateForm({ ...createForm, tenant_code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                  placeholder="e.w. alnoor_traders (lowercase, no spaces)"
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-emerald-500 outline-none font-mono" required />
                <p className="text-xs text-gray-400 mt-1">This is the login code for this client. Only a-z, 0-9, underscore.</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Plan</label>
                <select value={createForm.plan}
                  onChange={e => setCreateForm({ ...createForm, plan: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-emerald-500 outline-none">
                  <option value="basic">Basic</option>
                  <option value="professional">Professional</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div className="border-t border-gray-100 pt-4">
                <p className="text-sm font-semibold text-gray-600 mb-3">Admin User for this Client</p>
                <div className="space-y-3">
                  <input type="text" value={createForm.admin_name}
                    onChange={e => setCreateForm({ ...createForm, admin_name: e.target.value })}
                    placeholder="Admin Full Name"
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-emerald-500 outline-none" />
                  <input type="email" value={createForm.admin_email}
                    onChange={e => setCreateForm({ ...createForm, admin_email: e.target.value })}
                    placeholder="Admin Email *"
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-emerald-500 outline-none" required />
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} value={createForm.admin_password}
                      onChange={e => setCreateForm({ ...createForm, admin_password: e.target.value })}
                      placeholder="Admin Password * (min 8 chars)"
                      className="w-full px-4 pr-12 py-2.5 border-2 border-gray-200 rounded-lg focus:border-emerald-500 outline-none"
                      required minLength={8} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 border-2 border-gray-200 rounded-lg text-gray-700 font-semibold hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <><Loader2 className="animate-spin" size={18} /> Creating...</> : 'Create Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== EDIT MODAL ===== */}
      {showEditModal && selectedTenant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-sm font-semibold text-gray-800">Edit Client</h3>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            <form onSubmit={handleEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Company Name</label>
                <input type="text" value={editForm.tenant_name}
                  onChange={e => setEditForm({ ...editForm, tenant_name: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-emerald-500 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Plan</label>
                <select value={editForm.plan}
                  onChange={e => setEditForm({ ...editForm, plan: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-emerald-500 outline-none">
                  <option value="basic">Basic</option>
                  <option value="professional">Professional</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEditModal(false)}
                  className="flex-1 py-2.5 border-2 border-gray-200 rounded-lg text-gray-700 font-semibold hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== RESET PASSWORD MODAL ===== */}
      {showPasswordModal && selectedTenant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-sm font-semibold text-gray-800">Reset Admin Password</h3>
              <button onClick={() => setShowPasswordModal(false)} className="text-gray-400 hover:text-gray-600"><X size={24} /></button>
            </div>
            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              <p className="text-sm text-gray-500">Resetting password for <strong>{selectedTenant.tenant_name}</strong> ({selectedTenant.admin_email})</p>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="New Password (min 8 chars)"
                  className="w-full px-4 pr-12 py-2.5 border-2 border-gray-200 rounded-lg focus:border-emerald-500 outline-none"
                  required minLength={8} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowPasswordModal(false)}
                  className="flex-1 py-2.5 border-2 border-gray-200 rounded-lg text-gray-700 font-semibold hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 disabled:opacity-50">
                  {saving ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tenants;
