import { useState, useEffect, useCallback } from 'react';
import {
  UserPlus, Edit2, Trash2, Shield, Eye, EyeOff,
  Search, RefreshCw, Users, UserCheck, UserX, X,
} from 'lucide-react';
import api from '../../utils/api';
import Pagination from '../../components/Pagination';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';

interface AppUser {
  user_id:    number;
  username:   string;
  name:       string;
  email:      string;
  role:       string;
  role_id:    number;
  created_at: string;
}
interface Role { role_id: number; role_name: string }

const ROLE_COLORS: Record<string, string> = {
  Admin:       'bg-red-100   text-red-700   border-red-200',
  Manager:     'bg-blue-100  text-blue-700  border-blue-200',
  Cashier:     'bg-emerald-100 text-emerald-700 border-emerald-200',
  Supervisor:  'bg-purple-100 text-purple-700 border-purple-200',
  Storekeeper: 'bg-amber-100  text-amber-700  border-amber-200',
};

const ROLE_BG: Record<string, string> = {
  Admin:       'bg-red-500',
  Manager:     'bg-blue-500',
  Cashier:     'bg-emerald-500',
  Supervisor:  'bg-purple-500',
  Storekeeper: 'bg-amber-500',
};

const emptyForm = { username: '', name: '', email: '', password: '', role_id: '' };

/* ── User Form Modal ── */
function UserModal({
  user, roles, onClose, onSaved,
}: { user: AppUser | null; roles: Role[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm]           = useState(
    user
      ? { username: user.username, name: user.name, email: user.email, password: '', role_id: String(user.role_id) }
      : { ...emptyForm }
  );
  const [showPwd, setShowPwd]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSave = async () => {
    setError('');
    if (!form.username.trim() || !form.name.trim() || !form.email.trim() || !form.role_id)
      return setError('All fields except password are required.');
    if (!user && form.password.length < 8)
      return setError('Password must be at least 8 characters.');
    if (form.password && form.password.length < 8)
      return setError('Password must be at least 8 characters.');

    setSaving(true);
    try {
      const payload: any = {
        username: form.username.trim(),
        name:     form.name.trim(),
        email:    form.email.trim(),
        role_id:  Number(form.role_id),
      };
      if (form.password) payload.password = form.password;
      user ? await api.put(`/users/${user.user_id}`, payload)
           : await api.post('/users', payload);
      onSaved();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save user.');
    } finally { setSaving(false); }
  };

  const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-colors';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center">
              <UserPlus size={18} className="text-violet-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-800">
              {user ? 'Edit User' : 'Add New User'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-xl">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Full Name *</label>
              <input value={form.name} onChange={f('name')} placeholder="Ahmad Khan" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Username *</label>
              <input value={form.username} onChange={f('username')} placeholder="ahmad123" className={inp} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Email *</label>
            <input type="email" value={form.email} onChange={f('email')} placeholder="email@example.com" className={inp} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Password {user ? '(leave blank to keep)' : '*'}
            </label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                value={form.password} onChange={f('password')}
                placeholder={user ? 'Enter new password to change' : 'Min 8 characters'}
                className={inp + ' pr-10'}
              />
              <button type="button" onClick={() => setShowPwd(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Role *</label>
            <select value={form.role_id} onChange={f('role_id')}
              className={inp + ' bg-white cursor-pointer'}>
              <option value="">Select role...</option>
              {roles.map(r => <option key={r.role_id} value={r.role_id}>{r.role_name}</option>)}
            </select>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors font-medium">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors">
            {saving ? 'Saving…' : user ? 'Save Changes' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function UsersPage() {
  const toast   = useToast();
  const confirm = useConfirm();

  const [users, setUsers]       = useState<AppUser[]>([]);
  const [roles, setRoles]       = useState<Role[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [roleFilter, setRole]   = useState('');
  const [totalUsers, setTotal]  = useState(0);
  const [totalPages, setPages]  = useState(1);
  const [page, setPage]         = useState(1);
  const [limit, setLimit]       = useState(20);

  const [modalUser, setModalUser] = useState<AppUser | null | 'new'>('new' as any);
  const [showModal, setShowModal] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const params: any = { page, limit };
    if (search)     params.search = search;
    if (roleFilter) params.role   = roleFilter;

    const [uRes, rRes] = await Promise.all([
      api.get('/users', { params }).catch(() => ({ data: { data: [], pagination: { total: 0, totalPages: 1 } } })),
      api.get('/users/roles').catch(() => ({ data: { data: [] } })),
    ]);
    setUsers(uRes.data.data || []);
    setTotal(uRes.data.pagination?.total ?? 0);
    setPages(uRes.data.pagination?.totalPages ?? 1);
    setRoles(rRes.data.data || []);
    setLoading(false);
  }, [page, limit, search, roleFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openCreate = () => { setModalUser(null); setShowModal(true); };
  const openEdit   = (u: AppUser) => { setModalUser(u); setShowModal(true); };
  const closeModal = () => setShowModal(false);
  const onSaved    = () => { closeModal(); fetchUsers(); };

  const handleDelete = async (u: AppUser) => {
    const ok = await confirm({ title: 'Delete User', message: `Delete "${u.name}" (@${u.username})? This cannot be undone.`, type: 'danger' });
    if (!ok) return;
    try {
      await api.delete(`/users/${u.user_id}`);
      toast.success('User deleted');
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete user.');
    }
  };

  /* stat counts from current page — approximation; total from API */
  const adminCount   = users.filter(u => u.role === 'Admin').length;
  const managerCount = users.filter(u => u.role === 'Manager').length;
  const cashierCount = users.filter(u => u.role === 'Cashier').length;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 space-y-6">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-violet-100 rounded-2xl flex items-center justify-center">
            <Users size={22} className="text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">User Management</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {totalUsers.toLocaleString()} total users · Manage login accounts &amp; roles
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchUsers}
            className="p-2.5 border border-gray-200 bg-white rounded-xl hover:bg-gray-50 transition-colors"
            title="Refresh">
            <RefreshCw size={15} className="text-gray-500" />
          </button>
          <button onClick={openCreate}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm">
            <UserPlus size={16} /> Add User
          </button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: totalUsers,    icon: Users,     color: 'bg-violet-50 text-violet-700', iconBg: 'bg-violet-100' },
          { label: 'Admins',      value: adminCount,    icon: Shield,    color: 'bg-red-50    text-red-700',    iconBg: 'bg-red-100' },
          { label: 'Managers',    value: managerCount,  icon: UserCheck, color: 'bg-blue-50   text-blue-700',   iconBg: 'bg-blue-100' },
          { label: 'Cashiers',    value: cashierCount,  icon: UserX,     color: 'bg-emerald-50 text-emerald-700',iconBg: 'bg-emerald-100' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border border-gray-100 bg-white shadow-sm p-4 flex items-center gap-3`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${s.iconBg}`}>
              <s.icon size={18} className={s.color.split(' ')[1]} />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">{s.label}</p>
              <p className={`text-2xl font-black ${s.color.split(' ')[1]}`}>{s.value.toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-56">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text" placeholder="Search name, username or email…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm w-full focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-colors"
            />
          </div>
          <select value={roleFilter}
            onChange={e => { setRole(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-xl text-sm px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 bg-white cursor-pointer">
            <option value="">All Roles</option>
            {roles.map(r => <option key={r.role_id} value={r.role_name}>{r.role_name}</option>)}
          </select>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">
            <div className="animate-spin rounded-full h-8 w-8 border-3 border-gray-200 border-t-violet-600" />
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <Users size={36} className="mb-3 opacity-30" />
            <p className="text-sm font-medium">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['#', 'User', 'Username', 'Email', 'Role', 'Created', 'Actions'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((u, i) => (
                  <tr key={u.user_id} className="hover:bg-violet-50/30 transition-colors group">
                    <td className="px-5 py-4 text-sm text-gray-400 font-medium">
                      {(page - 1) * limit + i + 1}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${ROLE_BG[u.role] || 'bg-gray-400'}`}>
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-semibold text-gray-800">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500 font-mono">@{u.username}</td>
                    <td className="px-5 py-4 text-sm text-gray-600">{u.email}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                        <Shield size={10} /> {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500 whitespace-nowrap">
                      {new Date(u.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(u)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(u)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={totalUsers}
          itemsPerPage={limit}
          onItemsPerPageChange={n => { setLimit(n); setPage(1); }}
        />
      </div>

      {/* ── Modal ── */}
      {showModal && (
        <UserModal
          user={modalUser as AppUser | null}
          roles={roles}
          onClose={closeModal}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
