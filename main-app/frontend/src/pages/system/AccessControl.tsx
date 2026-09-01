import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Shield, Save, Check, Loader2, ChevronDown, ChevronRight,
  Users, Copy, Search, AlertCircle, X, Plus, Trash2,
  LayoutDashboard, ShoppingCart, Package, UserCheck, Calculator, Settings, UtensilsCrossed,
} from 'lucide-react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';

// ─── CRUD actions ─────────────────────────────────────────────────────────────
const CRUD = [
  { action: 'create', label: 'Create', accent: 'accent-emerald-500' },
  { action: 'update', label: 'Update', accent: 'accent-blue-500'    },
  { action: 'delete', label: 'Delete', accent: 'accent-red-500'     },
] as const;

// ─── Module tree ──────────────────────────────────────────────────────────────
// moduleKey: null = always visible; otherwise must match tenant's enabled modules
const MODULE_TREE = [
  {
    section: 'Dashboard',
    moduleKey: null,
    Icon: LayoutDashboard,
    color: 'bg-blue-500',
    lightColor: 'bg-blue-50 border-blue-200',
    textColor: 'text-blue-700',
    keys: [
      { key: 'dashboard', label: 'Dashboard' },
    ],
  },
  {
    section: 'Sales',
    moduleKey: 'sales',
    Icon: ShoppingCart,
    color: 'bg-emerald-500',
    lightColor: 'bg-emerald-50 border-emerald-200',
    textColor: 'text-emerald-700',
    keys: [
      { key: 'sales.pos',         label: 'POS Terminal' },
      { key: 'sales.orders',      label: 'Orders' },
      { key: 'sales.register',    label: 'Cash Register' },
      { key: 'sales.customers',   label: 'Customers' },
      { key: 'sales.returns',     label: 'Returns' },
      { key: 'sales.quotations',  label: 'Quotations' },
      { key: 'sales.credit',      label: 'Credit Sales' },
      { key: 'sales.pricerules',  label: 'Price Rules' },
      { key: 'sales.targets',     label: 'Sales Targets' },
      { key: 'sales.deliveries',  label: 'Deliveries' },
      { key: 'sales.reports',     label: 'Sales Reports' },
    ],
  },
  {
    section: 'Restaurant',
    moduleKey: 'restaurant',
    Icon: UtensilsCrossed,
    color: 'bg-pink-500',
    lightColor: 'bg-pink-50 border-pink-200',
    textColor: 'text-pink-700',
    keys: [
      { key: 'restaurant.tables', label: 'Table Management' },
    ],
  },
  {
    section: 'Inventory',
    moduleKey: 'inventory',
    Icon: Package,
    color: 'bg-orange-500',
    lightColor: 'bg-orange-50 border-orange-200',
    textColor: 'text-orange-700',
    keys: [
      { key: 'inventory.products',    label: 'Products' },
      { key: 'inventory.categories',  label: 'Categories' },
      { key: 'inventory.bundles',     label: 'Deals & Bundles' },
      { key: 'inventory.purchases',   label: 'Purchases & Suppliers' },
      { key: 'inventory.stock',       label: 'Stock Update' },
      { key: 'inventory.adjustments', label: 'Stock Adjustments / Issuance' },
      { key: 'inventory.transfers',   label: 'Stock Transfers' },
      { key: 'inventory.alerts',      label: 'Stock Alerts' },
      { key: 'inventory.variants',    label: 'Product Variants' },
      { key: 'inventory.stockcount',  label: 'Stock Count' },
      { key: 'inventory.reports',     label: 'Inventory Reports' },
    ],
  },
  {
    section: 'HR',
    moduleKey: 'hr',
    Icon: UserCheck,
    color: 'bg-purple-500',
    lightColor: 'bg-purple-50 border-purple-200',
    textColor: 'text-purple-700',
    keys: [
      { key: 'hr.staff',             label: 'Employee List' },
      { key: 'hr.attendance',        label: 'Attendance' },
      { key: 'hr.daily-attendance',  label: 'Daily Attendance' },
      { key: 'hr.ledger',            label: 'Employee Ledger' },
      { key: 'hr.salary-sheet',      label: 'Salary Sheet & Slips' },
      { key: 'hr.payroll',           label: 'Payroll Processing' },
      { key: 'hr.increments',        label: 'Salary Increments' },
      { key: 'hr.loans',             label: 'Loans' },
      { key: 'hr.advances',          label: 'Advance Payments' },
      { key: 'hr.leaves',            label: 'Leave Management' },
      { key: 'hr.holidays',          label: 'Holidays' },
      { key: 'hr.departments',       label: 'Departments' },
      { key: 'hr.salary-components', label: 'Salary Components' },
      { key: 'hr.appraisals',        label: 'Appraisals' },
      { key: 'hr.exit',              label: 'Exit Management' },
      { key: 'hr.reports',           label: 'HR Reports' },
    ],
  },
  {
    section: 'Accounts',
    moduleKey: 'accounts',
    Icon: Calculator,
    color: 'bg-teal-500',
    lightColor: 'bg-teal-50 border-teal-200',
    textColor: 'text-teal-700',
    keys: [
      { key: 'accounts.chart',              label: 'Chart of Accounts' },
      { key: 'accounts.journal',            label: 'Journal Voucher' },
      { key: 'accounts.payment-vouchers',   label: 'Payment Vouchers (CPV)' },
      { key: 'accounts.receipt-vouchers',   label: 'Receipt Vouchers (CRV)' },
      { key: 'accounts.ledger',             label: 'Account Ledger' },
      { key: 'accounts.trial-balance',      label: 'Trial Balance' },
      { key: 'accounts.trial-balance-6col', label: 'Trial Balance (6 Col)' },
      { key: 'accounts.profit-loss',        label: 'Profit & Loss' },
      { key: 'accounts.balance-sheet',      label: 'Balance Sheet' },
      { key: 'accounts.bank-accounts',      label: 'Bank Accounts' },
      { key: 'accounts.analytics',          label: 'Analytics' },
      { key: 'accounts.reports',            label: 'Accounts Reports' },
    ],
  },
  {
    section: 'System',
    moduleKey: null,
    Icon: Settings,
    color: 'bg-slate-500',
    lightColor: 'bg-slate-50 border-slate-200',
    textColor: 'text-slate-700',
    keys: [
      { key: 'system.stores',    label: 'Branch / Store Config' },
      { key: 'system.audit',     label: 'Audit Log' },
      { key: 'system.backup',    label: 'Backup' },
      { key: 'system.settings',  label: 'Settings & Email' },
      { key: 'system.ai_widget', label: 'AI Assistant' },
    ],
  },
];

// All base module keys (used for access/view progress %)
const BASE_KEYS = MODULE_TREE.flatMap(s => s.keys.map(k => k.key));
const TOTAL_MODULES = BASE_KEYS.length;

// All keys including CRUD sub-keys (used for Select All)
const ALL_KEYS = MODULE_TREE.flatMap(s =>
  s.keys.flatMap(k => [k.key, ...CRUD.map(c => `${k.key}.${c.action}`)])
);

// Sub-keys for a given base key
const subKeys = (base: string) => CRUD.map(c => `${base}.${c.action}`);

// ─── Component ────────────────────────────────────────────────────────────────
const AccessControl = () => {
  const { user, refreshPermissions, hasModule } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [roles, setRoles]               = useState<string[]>([]);
  const [allPerms, setAllPerms]         = useState<Record<string, Set<string>>>({});
  const [savedPerms, setSavedPerms]     = useState<Record<string, Set<string>>>({});
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);
  const [collapsed, setCollapsed]       = useState<Record<string, boolean>>({});
  const [search, setSearch]             = useState('');
  const [copyFrom, setCopyFrom]         = useState('');
  const [newRoleName, setNewRoleName]   = useState('');
  const [creatingRole, setCreatingRole] = useState(false);
  const [deletingRole, setDeletingRole] = useState<string | null>(null);

  const permissions: Set<string> = allPerms[selectedRole] || new Set();

  const setPermissions = useCallback((updater: (prev: Set<string>) => Set<string>) => {
    setAllPerms(prev => ({
      ...prev,
      [selectedRole]: updater(prev[selectedRole] || new Set()),
    }));
    setSaved(false);
  }, [selectedRole]);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    Promise.all([api.get('/users/roles'), api.get('/permissions')])
      .then(([rolesRes, permsRes]) => {
        const nonAdmin: string[] = (rolesRes.data.data || [])
          .map((r: any) => r.role_name)
          .filter((n: string) => n !== 'Admin');
        setRoles(nonAdmin);
        if (nonAdmin.length > 0) setSelectedRole(nonAdmin[0]);

        const data = permsRes.data as Record<string, string[]>;
        const mapped: Record<string, Set<string>> = {};
        for (const [role, keys] of Object.entries(data)) {
          mapped[role] = new Set(keys);
        }
        setAllPerms(mapped);
        setSavedPerms(mapped);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Dirty check ───────────────────────────────────────────────────────────
  const isDirty = useCallback((role: string) => {
    const curr = allPerms[role]   || new Set<string>();
    const orig = savedPerms[role] || new Set<string>();
    if (curr.size !== orig.size) return true;
    for (const k of curr) if (!orig.has(k)) return true;
    return false;
  }, [allPerms, savedPerms]);

  // ── Toggle base key (View) ────────────────────────────────────────────────
  const toggleBase = (baseKey: string) => {
    setPermissions(prev => {
      const next = new Set(prev);
      if (next.has(baseKey)) {
        next.delete(baseKey);
        subKeys(baseKey).forEach(k => next.delete(k));
      } else {
        next.add(baseKey);
      }
      return next;
    });
  };

  // ── Toggle CRUD sub-key ───────────────────────────────────────────────────
  const toggleSub = (baseKey: string, subKey: string) => {
    setPermissions(prev => {
      const next = new Set(prev);
      if (next.has(subKey)) {
        next.delete(subKey);
      } else {
        next.add(subKey);
        next.add(baseKey); // auto-enable base (view) when enabling CRUD
      }
      return next;
    });
  };

  // ── Section toggle (all base + CRUD) ─────────────────────────────────────
  const toggleSection = (keys: string[]) => {
    const allModuleKeys = keys.flatMap(k => [k, ...subKeys(k)]);
    const allOn = allModuleKeys.every(k => permissions.has(k));
    setPermissions(prev => {
      const next = new Set(prev);
      if (allOn) allModuleKeys.forEach(k => next.delete(k));
      else       allModuleKeys.forEach(k => next.add(k));
      return next;
    });
  };

  const selectAll = () => setPermissions(() => new Set(ALL_KEYS));
  const clearAll  = () => setPermissions(() => new Set());

  const handleCopyFrom = (fromRole: string) => {
    if (!fromRole || fromRole === selectedRole) return;
    const src = allPerms[fromRole] || new Set<string>();
    setAllPerms(prev => ({ ...prev, [selectedRole]: new Set(src) }));
    setSaved(false);
    setCopyFrom('');
  };

  // ── Create role ───────────────────────────────────────────────────────────
  const handleCreateRole = async () => {
    const name = newRoleName.trim();
    if (!name) return;
    setCreatingRole(true);
    try {
      const res = await api.post('/users/roles', { role_name: name });
      const created = res.data.role_name as string;
      setRoles(prev => [...prev, created]);
      setAllPerms(prev => ({ ...prev, [created]: new Set() }));
      setSavedPerms(prev => ({ ...prev, [created]: new Set() }));
      setSelectedRole(created);
      setNewRoleName('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create role');
    } finally {
      setCreatingRole(false);
    }
  };

  // ── Delete role ───────────────────────────────────────────────────────────
  const handleDeleteRole = async (roleName: string, _roleId?: number) => {
    const ok = await confirm({ title: 'Delete Role', message: `Delete role "${roleName}"? This cannot be undone.`, type: 'danger' });
    if (!ok) return;
    setDeletingRole(roleName);
    try {
      // We need role_id — fetch it first if not known
      const rolesRes = await api.get('/users/roles');
      const found = (rolesRes.data.data || []).find((r: any) => r.role_name === roleName);
      if (!found) throw new Error('Role not found');
      await api.delete(`/users/roles/${found.role_id}`);
      setRoles(prev => prev.filter(r => r !== roleName));
      setAllPerms(prev => { const n = { ...prev }; delete n[roleName]; return n; });
      setSavedPerms(prev => { const n = { ...prev }; delete n[roleName]; return n; });
      if (selectedRole === roleName) setSelectedRole(roles.find(r => r !== roleName) || '');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete role');
    } finally {
      setDeletingRole(null);
    }
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/permissions/${encodeURIComponent(selectedRole)}`, {
        permissions: Array.from(permissions),
      });
      setSavedPerms(prev => ({ ...prev, [selectedRole]: new Set(permissions) }));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      // If the saved role matches the currently logged-in user's role, refresh their permissions immediately
      if (user?.role_name === selectedRole) {
        refreshPermissions();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  // ── Filtered tree ─────────────────────────────────────────────────────────
  const filteredTree = useMemo(() => {
    const moduleFiltered = MODULE_TREE.filter(s =>
      s.moduleKey === null || hasModule(s.moduleKey)
    );
    if (!search.trim()) return moduleFiltered;
    const q = search.toLowerCase();
    return moduleFiltered
      .map(s => ({ ...s, keys: s.keys.filter(k => k.label.toLowerCase().includes(q) || k.key.includes(q)) }))
      .filter(s => s.keys.length > 0);
  }, [search, hasModule]);

  // ── Role stats (count base modules with view access) ──────────────────────
  const roleStats = useCallback((role: string) => {
    const perms = allPerms[role] || new Set<string>();
    const count = BASE_KEYS.filter(k => perms.has(k)).length;
    return { count, pct: Math.round((count / TOTAL_MODULES) * 100) };
  }, [allPerms]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 size={40} className="animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading access control...</p>
        </div>
      </div>
    );
  }

  const { count: currentCount, pct: currentPct } = roleStats(selectedRole);
  const dirty = isDirty(selectedRole);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 mb-2 flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
              <Shield className="text-white" size={24} />
            </div>
            Access Control
          </h1>
          <p className="text-gray-600">Configure module access and CRUD permissions per role — Admin always has full access</p>
        </div>

        <div className="flex items-center gap-3">
          {selectedRole && (
            <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl shadow-sm">
              <span className="text-sm font-semibold text-gray-700">{selectedRole}</span>
              <span className="text-xs text-gray-400">{currentCount}/{TOTAL_MODULES} modules</span>
              <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${currentPct}%` }} />
              </div>
              <span className="text-xs font-semibold text-emerald-600">{currentPct}%</span>
            </div>
          )}
          {dirty && (
            <span className="flex items-center gap-1.5 text-xs text-amber-600 font-semibold bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl">
              <AlertCircle size={13} /> Unsaved changes
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !selectedRole || !dirty}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
              saved
                ? 'bg-emerald-50 text-emerald-700 border-2 border-emerald-300'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow'
            }`}
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <Check size={15} /> : <Save size={15} />}
            {saved ? 'Saved!' : 'Save Permissions'}
          </button>
        </div>
      </div>

      {/* ── Main card ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex min-h-[600px]">

          {/* ── Role sidebar ────────────────────────────────────────────── */}
          <div className="w-56 shrink-0 border-r border-gray-100 p-4 bg-gray-50/50 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider px-1 mb-1">
              <Users size={12} /> Roles
            </div>

            {/* Role list */}
            <div className="flex flex-col gap-2 flex-1">
              {roles.length === 0 ? (
                <p className="text-xs text-gray-400 px-1">No roles yet. Create one below.</p>
              ) : roles.map(role => {
                const { count, pct } = roleStats(role);
                const active  = selectedRole === role;
                const hasDirt = isDirty(role);
                const deleting = deletingRole === role;
                return (
                  <div key={role} className="relative group">
                    <button
                      onClick={() => setSelectedRole(role)}
                      className={`w-full text-left px-3 py-3 rounded-xl transition-all ${
                        active
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                          : 'bg-white text-gray-700 border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-semibold text-sm pr-5">{role}</span>
                        {hasDirt && (
                          <span className={`w-2 h-2 rounded-full shrink-0 ${active ? 'bg-amber-300' : 'bg-amber-500'}`} />
                        )}
                      </div>
                      <div className={`w-full h-1 rounded-full overflow-hidden mb-1 ${active ? 'bg-white/30' : 'bg-gray-100'}`}>
                        <div
                          className={`h-full rounded-full transition-all ${active ? 'bg-white' : 'bg-emerald-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={`text-xs ${active ? 'text-emerald-100' : 'text-gray-400'}`}>
                        {count}/{TOTAL_MODULES} modules · {pct}%
                      </span>
                    </button>
                    {/* Delete button — appears on hover */}
                    <button
                      onClick={() => handleDeleteRole(role)}
                      disabled={deleting}
                      title={`Delete ${role}`}
                      className={`absolute top-2 right-2 p-1 rounded-lg transition-all opacity-0 group-hover:opacity-100 ${
                        active
                          ? 'text-white/70 hover:text-white hover:bg-white/20'
                          : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                      } disabled:opacity-30`}
                    >
                      {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Create new role */}
            <div className="pt-2 border-t border-gray-200 mt-1">
              <p className="text-xs font-semibold text-gray-400 mb-1.5 px-1">New Role</p>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={newRoleName}
                  onChange={e => setNewRoleName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateRole()}
                  placeholder="Role name..."
                  className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 bg-white"
                />
                <button
                  onClick={handleCreateRole}
                  disabled={creatingRole || !newRoleName.trim()}
                  title="Create role"
                  className="px-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {creatingRole ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                </button>
              </div>
            </div>
          </div>

          {/* ── Right: Permission editor ─────────────────────────────────── */}
          <div className="flex-1 min-w-0 p-6">


            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
              <div className="relative flex-1 min-w-44">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search modules..."
                  className="w-full pl-8 pr-8 py-2 border-2 border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X size={13} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 border-2 border-gray-200 rounded-lg px-3 py-2 bg-white">
                <Copy size={13} className="text-gray-400 shrink-0" />
                <select
                  value={copyFrom}
                  onChange={e => { setCopyFrom(e.target.value); handleCopyFrom(e.target.value); }}
                  className="text-sm text-gray-600 bg-transparent outline-none cursor-pointer"
                >
                  <option value="">Copy from role...</option>
                  {roles.filter(r => r !== selectedRole).map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <button onClick={selectAll} className="text-xs px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg border-2 border-emerald-200 hover:bg-emerald-100 font-semibold">
                Select All
              </button>
              <button onClick={clearAll} className="text-xs px-3 py-2 bg-gray-100 text-gray-600 rounded-lg border-2 border-gray-200 hover:bg-gray-200 font-semibold">
                Clear All
              </button>
            </div>

            {/* Sections */}
            {filteredTree.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Search size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">No modules match &ldquo;{search}&rdquo;</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTree.map(({ section, Icon, color, lightColor, textColor, keys }) => {
                  const keyList     = keys.map(k => k.key);
                  const viewEnabled = keyList.filter(k => permissions.has(k)).length;
                  const allOn       = keys.flatMap(k => [k.key, ...subKeys(k.key)]).every(k => permissions.has(k));
                  const someOn      = viewEnabled > 0 && !allOn;
                  const isCollapsed = collapsed[section];

                  return (
                    <div key={section} className="border-2 border-gray-100 rounded-xl overflow-hidden">

                      {/* Section header */}
                      <div className={`flex items-center px-4 py-3 ${allOn ? lightColor : 'bg-gray-50'}`}>
                        <button
                          onClick={() => setCollapsed(p => ({ ...p, [section]: !p[section] }))}
                          className="flex items-center gap-2.5 flex-1 text-left min-w-0"
                        >
                          {isCollapsed
                            ? <ChevronRight size={15} className="text-gray-400 shrink-0" />
                            : <ChevronDown  size={15} className="text-gray-400 shrink-0" />
                          }
                          <div className={`p-1.5 rounded-lg ${color} shrink-0`}>
                            <Icon size={12} className="text-white" />
                          </div>
                          <span className="font-bold text-gray-800 text-sm">{section}</span>
                          <span className={`ml-1.5 text-xs font-semibold px-2 py-0.5 rounded-full border ${
                            allOn  ? `${lightColor} ${textColor}` :
                            someOn ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                     'bg-gray-100 text-gray-400 border-gray-200'
                          }`}>
                            {viewEnabled}/{keyList.length}
                          </span>
                        </button>
                        <button
                          onClick={() => toggleSection(keyList)}
                          className={`ml-3 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 border ${
                            allOn  ? `${lightColor} ${textColor} hover:opacity-80` :
                            someOn ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' :
                                     'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                          }`}
                        >
                          {allOn ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>

                      {/* Module rows */}
                      {!isCollapsed && (
                        <div className="divide-y divide-gray-50 bg-white">

                          {/* Column header */}
                          <div className="grid grid-cols-[1fr_auto] items-center px-4 py-1.5 bg-gray-50/80">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Module</span>
                            <div className="flex items-center gap-1.5">
                              <span className="w-14 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">View</span>
                              {CRUD.map(c => (
                                <span key={c.action} className="w-14 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">{c.label}</span>
                              ))}
                            </div>
                          </div>

                          {keys.map(({ key, label }) => {
                            const hasView = permissions.has(key);
                            return (
                              <div
                                key={key}
                                className={`grid grid-cols-[1fr_auto] items-center px-4 py-2.5 transition-colors ${
                                  hasView ? `${lightColor.split(' ')[0]} hover:opacity-95` : 'hover:bg-gray-50'
                                }`}
                              >
                                {/* Module name */}
                                <span className={`text-sm font-medium ${hasView ? textColor : 'text-gray-600'}`}>
                                  {label}
                                </span>

                                {/* View + CRUD checkboxes */}
                                <div className="flex items-center gap-1.5">
                                  {/* View (base key) */}
                                  <div className="w-14 flex justify-center">
                                    <input
                                      type="checkbox"
                                      checked={hasView}
                                      onChange={() => toggleBase(key)}
                                      className="w-4 h-4 rounded cursor-pointer accent-gray-700"
                                    />
                                  </div>

                                  {/* Create / Update / Delete */}
                                  {CRUD.map(({ action, label: cLabel, accent }) => {
                                    const subKey = `${key}.${action}`;
                                    const on     = permissions.has(subKey);
                                    return (
                                      <div key={action} className="w-14 flex justify-center">
                                        <input
                                          type="checkbox"
                                          checked={on}
                                          disabled={!hasView}
                                          onChange={() => hasView ? toggleSub(key, subKey) : undefined}
                                          title={hasView ? cLabel : `Enable View first`}
                                          className={`w-4 h-4 rounded cursor-pointer disabled:cursor-not-allowed disabled:opacity-30 ${accent}`}
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating save bar */}
      {dirty && (
        <div className="fixed bottom-6 right-6 z-30 flex items-center gap-3 bg-white border-2 border-emerald-200 rounded-2xl px-5 py-3 shadow-xl">
          <AlertCircle size={15} className="text-amber-500" />
          <span className="text-sm font-semibold text-gray-700">
            Unsaved changes for <span className="text-emerald-600">{selectedRole}</span>
          </span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-semibold text-sm transition-all"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save
          </button>
        </div>
      )}
    </div>
  );
};

export default AccessControl;
