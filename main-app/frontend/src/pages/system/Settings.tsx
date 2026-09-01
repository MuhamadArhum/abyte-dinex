import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import {
  Save,
  Building2,
  Phone,
  Mail,
  Globe,
  FileText,
  Loader2,
  Settings as SettingsIcon,
  Users,
  Shield,
  Plus,
  Trash2,
  Edit,
  X,
  AlertTriangle,
  Receipt,
  ShoppingCart,
  Clock,
  Lock,
  Eye,
  EyeOff,
  Server,
  Key,
  Printer,
  Hash,
  DollarSign,
  Package,
  CheckCircle,
  Truck,
  UtensilsCrossed,
  Coffee,
  Percent,
  ShoppingBag,
  Layers,
  Copy,
  RefreshCw,
  Upload,
  ImageOff,
  MessageCircle,
  FileCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../components/Toast';


interface User {
  user_id: number;
  username: string;
  name: string;
  email: string;
  role: string;
  role_id: number;
  branch_id: number | null;
  branch_name: string | null;
  created_at: string;
}

const Settings = () => {
  const { user: currentUser } = useAuth();
  const { refreshSettings } = useSettings();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('store');

  // All settings from DB
  const [settings, setSettings] = useState<any>({
    store_name: '', address: '', phone: '', email: '', website: '',
    receipt_header: '', receipt_footer: '', receipt_logo: '',
    tax_rate: 0, tax_on_cash: 16, tax_on_card: 5, tax_on_online: 5,
    currency_symbol: 'Rs.', default_delivery_charges: 0,
    low_stock_threshold: 10, default_payment_method: 'cash', auto_print_receipt: false,
    barcode_prefix: '', invoice_prefix: 'INV-', date_format: 'DD/MM/YYYY', timezone: 'Asia/Karachi',
    business_hours_open: '09:00', business_hours_close: '21:00',
    allow_negative_stock: false, discount_requires_approval: false, max_cashier_discount: 50,
    session_timeout_minutes: 480,
    receipt_show_store_name: true, receipt_show_address: true, receipt_show_phone: true, receipt_show_tax: true,
    receipt_paper_width: '80mm',
    printer_type: 'none', printer_ip: '', printer_port: 9100, printer_name: '', printer_paper_width: 80,
    view_completed_orders_password: '', refund_password: '', reports_password: '',
    jv_delete_password: '',
    cpv_default_account_id: '',
    crv_default_account_id: '',
    pos_mode: 'simple',
    pos_tax_config: null,
  });

  const defaultCategoryConfig = () => ({
    tax_enabled: false, tax_rate: 0,
    service_enabled: false, service_rate: 0,
    other_enabled: false, other_rate: 0, other_label: 'Other Charges',
  });

  const getPosCategories = (): Record<string, any> => {
    const cfg = settings.pos_tax_config;
    const def = {
      dine_in: defaultCategoryConfig(),
      takeaway: defaultCategoryConfig(),
      delivery: defaultCategoryConfig(),
      walk_in: defaultCategoryConfig(),
    };
    if (!cfg || typeof cfg !== 'object') return def;
    return {
      dine_in: { ...def.dine_in, ...(cfg.dine_in || {}) },
      takeaway: { ...def.takeaway, ...(cfg.takeaway || {}) },
      delivery: { ...def.delivery, ...(cfg.delivery || {}) },
      walk_in: { ...def.walk_in, ...(cfg.walk_in || {}) },
    };
  };

  const setCategoryConfig = (cat: string, field: string, value: any) => {
    const current = getPosCategories();
    setSettings((prev: any) => ({
      ...prev,
      pos_tax_config: { ...current, [cat]: { ...current[cat], [field]: value } },
    }));
  };

  // Show/hide state for POS security password fields
  const [showViewCompletedPw, setShowViewCompletedPw] = useState(false);
  const [showRefundPw, setShowRefundPw] = useState(false);
  const [showReportsPw, setShowReportsPw] = useState(false);
  const [showJvDeletePw, setShowJvDeletePw] = useState(false);

  // Accounting accounts (for CPV/CRV defaults)
  const [accountsList, setAccountsList] = useState<any[]>([]);

  // Roles
  interface Role { role_id: number; role_name: string; }
  interface Branch { store_id: number; store_name: string; }
  const [roles, setRoles] = useState<Role[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [roleError, setRoleError] = useState('');
  const [roleSaving, setRoleSaving] = useState(false);

  // Users
  const [users, setUsers] = useState<User[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({ username: '', name: '', email: '', password: '', role_id: 0, branch_id: '' as string });
  const [showUserPassword, setShowUserPassword] = useState(false);

  // Password
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [showPasswords, setShowPasswords] = useState({ current: false, new_password: false, confirm: false });

  // System info
  const [systemInfo, setSystemInfo] = useState<any>(null);

  // Logo upload
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoDeleting, setLogoDeleting] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [agentStatus, setAgentStatus] = useState<'checking' | 'available' | 'unavailable'>('checking');
  const [agentInfo, setAgentInfo] = useState<any>(null);
  const [agentTokenSaving, setAgentTokenSaving] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // WhatsApp state
  const [waSettings, setWaSettings] = useState({ whatsapp_enabled: false, whatsapp_api_url: '', whatsapp_id_instance: '', whatsapp_api_token: '' });
  const [waSaving, setWaSaving] = useState(false);
  const [waTesting, setWaTesting] = useState(false);
  const [waTestResult, setWaTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // FBR state
  const [fbrSettings, setFbrSettings] = useState({ fbr_enabled: false, fbr_posid: '', fbr_username: '', fbr_password: '', fbr_mode: 'sandbox', fbr_ntn: '' });
  const [fbrSaving, setFbrSaving] = useState(false);
  const [fbrTesting, setFbrTesting] = useState(false);
  const [fbrTestResult, setFbrTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [fbrLogs, setFbrLogs] = useState<any[]>([]);
  const [fbrLogsLoading, setFbrLogsLoading] = useState(false);

  const AGENT_URL = import.meta.env.VITE_PRINTER_AGENT_URL || 'http://localhost:3001';
  const SERVER_URL = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'https://erp.abytesol.com';

  const checkAgentStatus = async () => {
    setAgentStatus('checking');
    try {
      const res = await fetch(`${AGENT_URL}/health`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) { setAgentInfo(await res.json()); setAgentStatus('available'); }
      else setAgentStatus('unavailable');
    } catch { setAgentStatus('unavailable'); }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const form = new FormData();
      form.append('logo', file);
      const res = await api.post('/settings/logo', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSettings((s: any) => ({ ...s, receipt_logo: res.data.logo_url }));
      toast.success('Logo uploaded');
    } catch {
      toast.error('Logo upload failed');
    } finally {
      setLogoUploading(false);
      e.target.value = '';
    }
  };

  const handleLogoDelete = async () => {
    setLogoDeleting(true);
    try {
      await api.delete('/settings/logo');
      setSettings((s: any) => ({ ...s, receipt_logo: '' }));
      toast.success('Logo removed');
    } catch {
      toast.error('Failed to remove logo');
    } finally {
      setLogoDeleting(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  const generateAndSaveAgentToken = async () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const token = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    setAgentTokenSaving(true);
    try {
      await api.put('/settings', { ...settings, agent_token: token });
      setSettings((prev: any) => ({ ...prev, agent_token: token }));
      refreshSettings();
      toast.success('Agent token regenerated');
    } catch {
      toast.error('Failed to save token');
    } finally {
      setAgentTokenSaving(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    if (currentUser?.role_name === 'Admin') {
      fetchUsers();
      fetchRoles();
      fetchBranches();
    }
    api.get('/accounting/accounts', { params: { tree: 1 } })
      .then(r => setAccountsList((r.data.data || []).filter((a: any) => a.is_active && a.level === 4)))
      .catch(() => {});
  }, [currentUser]);

  useEffect(() => {
    if (activeTab === 'printer') checkAgentStatus();
    if (activeTab === 'integrations') { loadWaSettings(); loadFbrSettings(); loadFbrLogs(); }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'system' && currentUser?.role_name === 'Admin' && !systemInfo) {
      fetchSystemInfo();
    }
  }, [activeTab]);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      setSettings({ ...settings, ...res.data });
    } catch (err) {
      console.error('Failed to load settings', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data.data || []);
    } catch (err) {
      console.error('Failed to load users', err);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await api.get('/users/roles');
      setRoles(res.data.data || []);
    } catch (err) {
      console.error('Failed to load roles', err);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await api.get('/stores');
      setBranches((res.data.data || []).filter((s: any) => s.is_active !== 0));
    } catch (err) {
      console.error('Failed to load branches', err);
    }
  };

  const fetchSystemInfo = async () => {
    try {
      const res = await api.get('/settings/system-info');
      setSystemInfo(res.data);
    } catch (err) {
      console.error('Failed to load system info', err);
    }
  };


  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings', settings);
      refreshSettings();
      toast.success('Settings saved successfully');
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedRoleName = roles.find(r => r.role_id === userForm.role_id)?.role_name ?? '';
    if (selectedRoleName !== 'Admin' && !userForm.branch_id) {
      toast.error('Branch is required for non-admin users');
      return;
    }
    setSaving(true);
    try {
      const branch_id = selectedRoleName === 'Admin' ? null : Number(userForm.branch_id);
      if (editingUser) {
        const payload: any = { username: userForm.username, name: userForm.name, email: userForm.email, role_id: userForm.role_id, branch_id };
        if (userForm.password) payload.password = userForm.password;
        await api.put(`/users/${editingUser.user_id}`, payload);
        toast.success('User updated');
      } else {
        const payload: any = { ...userForm, branch_id };
        await api.post('/users', payload);
        toast.success('User created');
      }
      setShowUserModal(false);
      setEditingUser(null);
      const defaultRoleId = roles.find(r => r.role_name === 'Cashier')?.role_id || roles.find(r => r.role_name !== 'Admin')?.role_id || 0;
      setUserForm({ username: '', name: '', email: '', password: '', role_id: defaultRoleId, branch_id: '' });
      setShowUserPassword(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await api.delete(`/users/${userId}`);
      toast.success('User deleted');
      fetchUsers();
    } catch (err) {
      toast.error('Failed to delete user');
    }
  };

  const handleCreateRole = async () => {
    setRoleError('');
    if (!newRoleName.trim()) return setRoleError('Role name is required');
    setRoleSaving(true);
    try {
      await api.post('/users/roles', { role_name: newRoleName.trim() });
      toast.success(`Role "${newRoleName.trim()}" created`);
      setShowRoleModal(false);
      setNewRoleName('');
      fetchRoles();
    } catch (err: any) {
      setRoleError(err.response?.data?.message || 'Failed to create role');
    } finally {
      setRoleSaving(false);
    }
  };

  const handleDeleteRole = async (roleId: number, roleName: string) => {
    if (!confirm(`Delete role "${roleName}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/users/roles/${roleId}`);
      toast.success(`Role "${roleName}" deleted`);
      fetchRoles();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete role');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error('New passwords do not match');
      return;
    }
    if (passwordForm.new_password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setSaving(true);
    try {
      await api.post('/settings/change-password', {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password
      });
      toast.success('Password changed successfully');
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const openUserModal = (user?: User) => {
    const defaultRoleId = roles.find(r => r.role_name === 'Cashier')?.role_id || roles.find(r => r.role_name !== 'Admin')?.role_id || 0;
    if (user) {
      setEditingUser(user);
      setUserForm({ username: user.username, name: user.name, email: user.email, password: '', role_id: user.role_id, branch_id: user.branch_id ? String(user.branch_id) : '' });
    } else {
      setEditingUser(null);
      setUserForm({ username: '', name: '', email: '', password: '', role_id: defaultRoleId, branch_id: '' });
    }
    setShowUserModal(true);
  };

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const loadWaSettings = async () => {
    try {
      const res = await api.get('/whatsapp/settings');
      setWaSettings(res.data);
    } catch (_e) { /* silent — settings may not exist yet */ }
  };

  const handleSaveWaSettings = async () => {
    setWaSaving(true);
    try {
      await api.put('/whatsapp/settings', waSettings);
      toast.success('WhatsApp settings saved');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally { setWaSaving(false); }
  };

  const handleTestWa = async () => {
    setWaTesting(true); setWaTestResult(null);
    try {
      const res = await api.post('/whatsapp/test');
      setWaTestResult({ ok: true, message: `Connected: ${res.data.verified_name} (${res.data.phone_number})` });
    } catch (err: any) {
      setWaTestResult({ ok: false, message: err.response?.data?.message || 'Connection failed' });
    } finally { setWaTesting(false); }
  };

  const loadFbrSettings = async () => {
    try {
      const res = await api.get('/fbr/settings');
      setFbrSettings(res.data);
    } catch (_e) { /* silent — settings may not exist yet */ }
  };

  const handleSaveFbrSettings = async () => {
    setFbrSaving(true);
    try {
      await api.put('/fbr/settings', fbrSettings);
      toast.success('FBR settings saved');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally { setFbrSaving(false); }
  };

  const handleTestFbr = async () => {
    setFbrTesting(true); setFbrTestResult(null);
    try {
      const res = await api.post('/fbr/test');
      setFbrTestResult({ ok: true, message: res.data.message || 'FBR connection successful' });
    } catch (err: any) {
      setFbrTestResult({ ok: false, message: err.response?.data?.message || 'FBR connection failed' });
    } finally { setFbrTesting(false); }
  };

  const loadFbrLogs = async () => {
    setFbrLogsLoading(true);
    try {
      const res = await api.get('/fbr/logs');
      setFbrLogs(res.data.data || []);
    } catch (_e) { /* silent */ } finally { setFbrLogsLoading(false); }
  };

  const handleRetryFailed = async () => {
    try {
      const res = await api.post('/fbr/retry-failed');
      toast.success(res.data.message || 'Retry completed');
      loadFbrLogs();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Retry failed');
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center min-h-screen">
        <div className="text-center">
          <Loader2 className="animate-spin text-emerald-600 mx-auto mb-4" size={40} />
          <p className="text-gray-600 font-medium">Loading settings...</p>
        </div>
      </div>
    );
  }


  const tabs = [
    { id: 'store',      name: 'Store Info',       icon: Building2 },
    { id: 'receipt',    name: 'Receipt & Invoice', icon: Receipt },
    { id: 'pos',        name: 'POS Settings',      icon: ShoppingCart },
    { id: 'users',      name: 'Users',             icon: Users,       adminOnly: true },
    { id: 'printer',    name: 'Printer',           icon: Printer,     adminOnly: true },
    { id: 'security',   name: 'Security',          icon: Shield },
    { id: 'integrations', name: 'WhatsApp & FBR',   icon: MessageCircle, adminOnly: true },
    { id: 'system',     name: 'System',            icon: Server,      adminOnly: true },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900 mb-2 flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
            <SettingsIcon className="text-white" size={24} />
          </div>
          Settings & Configuration
        </h1>
        <p className="text-gray-600">Manage your store settings, users, and system configuration</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {tabs.map(tab => {
            if (tab.adminOnly && currentUser?.role_name !== 'Admin') return null;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 font-semibold transition-all whitespace-nowrap ${activeTab === tab.id
                    ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                  }`}
              >
                <Icon size={20} />
                {tab.name}
              </button>
            );
          })}
        </div>

        <div className="p-4 sm:p-6">

          {/* ========== STORE INFO TAB ========== */}
          {activeTab === 'store' && (
            <form onSubmit={handleSaveSettings} className="space-y-6">
              <h2 className="text-base font-semibold text-gray-800 mb-4">Store Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Store Name *</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input type="text" value={settings.store_name}
                      onChange={e => setSettings({ ...settings, store_name: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" required />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input type="text" value={settings.phone}
                      onChange={e => setSettings({ ...settings, phone: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input type="email" value={settings.email}
                      onChange={e => setSettings({ ...settings, email: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Website</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input type="text" value={settings.website}
                      onChange={e => setSettings({ ...settings, website: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Currency Symbol</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input type="text" value={settings.currency_symbol}
                      onChange={e => setSettings({ ...settings, currency_symbol: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      placeholder="Rs." />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Business Hours - Open</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input type="time" value={settings.business_hours_open}
                      onChange={e => setSettings({ ...settings, business_hours_open: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Business Hours - Close</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input type="time" value={settings.business_hours_close}
                      onChange={e => setSettings({ ...settings, business_hours_close: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Address</label>
                  <textarea value={settings.address} rows={3}
                    onChange={e => setSettings({ ...settings, address: e.target.value })}
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                </div>
              </div>
              <div className="flex justify-end pt-4 border-t border-gray-200">
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 font-semibold shadow-lg transition-all">
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Save Changes
                </button>
              </div>
            </form>
          )}

          {/* ========== RECEIPT & INVOICE TAB ========== */}
          {activeTab === 'receipt' && (
            <form onSubmit={handleSaveSettings} className="space-y-6">
              <h2 className="text-base font-semibold text-gray-800 mb-4">Receipt & Invoice Settings</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Receipt Paper Width</label>
                  <select value={settings.receipt_paper_width}
                    onChange={e => setSettings({ ...settings, receipt_paper_width: e.target.value })}
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none">
                    <option value="58mm">58mm (Small)</option>
                    <option value="80mm">80mm (Standard)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Invoice Number Prefix</label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input type="text" value={settings.invoice_prefix}
                      onChange={e => setSettings({ ...settings, invoice_prefix: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      placeholder="INV-" />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Receipt Header Message</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input type="text" value={settings.receipt_header || ''}
                      onChange={e => setSettings({ ...settings, receipt_header: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      placeholder="e.g. Welcome to our store!" />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Receipt Footer Message</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input type="text" value={settings.receipt_footer}
                      onChange={e => setSettings({ ...settings, receipt_footer: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      placeholder="e.g. Thank you for shopping with us!" />
                  </div>
                </div>
              </div>

              {/* Logo Upload */}
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-4">Company Logo</h3>
                <div className="flex items-start gap-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  {/* Preview */}
                  <div className="w-28 h-28 rounded-xl border-2 border-dashed border-gray-300 bg-white flex items-center justify-center overflow-hidden shrink-0">
                    {settings.receipt_logo ? (
                      <img
                        src={settings.receipt_logo}
                        alt="Logo"
                        className="max-w-full max-h-full object-contain p-1"
                      />
                    ) : (
                      <ImageOff size={32} className="text-gray-300" />
                    )}
                  </div>
                  {/* Actions */}
                  <div className="flex-1 space-y-3">
                    <p className="text-sm text-gray-600">
                      Upload your company logo — it will appear on printed invoices and receipt views.
                      <span className="block text-xs text-gray-400 mt-0.5">PNG, JPG or WebP · Max 2 MB · Recommended: square or wide</span>
                    </p>
                    <div className="flex items-center gap-3 flex-wrap">
                      <label className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition ${
                        logoUploading ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}>
                        {logoUploading
                          ? <Loader2 size={15} className="animate-spin" />
                          : <Upload size={15} />
                        }
                        {settings.receipt_logo ? 'Replace Logo' : 'Upload Logo'}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/webp"
                          className="hidden"
                          disabled={logoUploading}
                          onChange={handleLogoUpload}
                        />
                      </label>
                      {settings.receipt_logo && (
                        <button
                          type="button"
                          onClick={handleLogoDelete}
                          disabled={logoDeleting}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                        >
                          {logoDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Receipt Show/Hide Toggles */}
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-4">Receipt Display Options</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'receipt_show_store_name', label: 'Show Store Name', icon: Building2 },
                    { key: 'receipt_show_address', label: 'Show Address', icon: Globe },
                    { key: 'receipt_show_phone', label: 'Show Phone Number', icon: Phone },
                    { key: 'receipt_show_tax', label: 'Show Tax Details', icon: DollarSign },
                  ].map(item => {
                    const Icon = item.icon;
                    return (
                      <label key={item.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-100 transition">
                        <div className="flex items-center gap-3">
                          <Icon size={20} className="text-gray-500" />
                          <span className="font-medium text-gray-700">{item.label}</span>
                        </div>
                        <div className="relative">
                          <input type="checkbox" className="sr-only peer"
                            checked={!!settings[item.key]}
                            onChange={e => setSettings({ ...settings, [item.key]: e.target.checked })} />
                          <div className="w-11 h-6 bg-gray-300 peer-checked:bg-emerald-500 rounded-full transition-colors"></div>
                          <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Receipt Preview */}
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-4">Receipt Preview</h3>
                <div className="max-w-xs mx-auto bg-white border-2 border-dashed border-gray-300 rounded-lg p-6 font-mono text-sm text-center">
                  {settings.receipt_logo && (
                    <div className="flex justify-center mb-2">
                      <img src={settings.receipt_logo} alt="Logo" className="max-h-16 max-w-[120px] object-contain" />
                    </div>
                  )}
                  {settings.receipt_header && <p className="text-xs text-gray-500 mb-2">{settings.receipt_header}</p>}
                  {settings.receipt_show_store_name && <p className="font-bold text-lg">{settings.store_name || 'Store Name'}</p>}
                  {settings.receipt_show_address && settings.address && <p className="text-xs text-gray-500">{settings.address}</p>}
                  {settings.receipt_show_phone && settings.phone && <p className="text-xs text-gray-500">Tel: {settings.phone}</p>}
                  <div className="border-t border-dashed border-gray-300 my-3"></div>
                  <p className="text-xs text-gray-400">Date: {new Date().toLocaleDateString()}</p>
                  <p className="text-xs text-gray-400">Invoice: {settings.invoice_prefix}000001</p>
                  <div className="border-t border-dashed border-gray-300 my-3"></div>
                  <div className="text-left text-xs space-y-1">
                    <div className="flex justify-between"><span>Sample Item x2</span><span>{settings.currency_symbol} 500.00</span></div>
                    <div className="flex justify-between"><span>Another Item x1</span><span>{settings.currency_symbol} 250.00</span></div>
                  </div>
                  <div className="border-t border-dashed border-gray-300 my-3"></div>
                  {settings.receipt_show_tax && (
                    <div className="text-left text-xs">
                      <div className="flex justify-between"><span>Subtotal</span><span>{settings.currency_symbol} 750.00</span></div>
                      <div className="flex justify-between text-gray-500"><span>Tax ({settings.tax_rate}%)</span><span>{settings.currency_symbol} {(750 * (settings.tax_rate || 0) / 100).toFixed(0)}</span></div>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm mt-1">
                    <span>Total</span>
                    <span>{settings.currency_symbol} {(750 + 750 * (settings.tax_rate || 0) / 100).toFixed(0)}</span>
                  </div>
                  <div className="border-t border-dashed border-gray-300 my-3"></div>
                  {settings.receipt_footer && <p className="text-xs text-gray-500">{settings.receipt_footer}</p>}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-200">
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 font-semibold shadow-lg transition-all">
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Save Changes
                </button>
              </div>
            </form>
          )}

          {/* ========== POS SETTINGS TAB ========== */}
          {activeTab === 'pos' && (
            <form onSubmit={handleSaveSettings} className="space-y-6">
              <h2 className="text-base font-semibold text-gray-800 mb-4">POS Configuration</h2>

              {/* ── POS Sale Mode ── */}
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Layers size={18} className="text-emerald-600" />
                  <h3 className="text-sm font-bold text-emerald-800 uppercase tracking-wider">POS Sale Mode</h3>
                </div>
                <p className="text-xs text-gray-600 mb-4">Choose how sales are processed at the POS terminal</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      value: 'simple',
                      label: 'Simple Mode (Walk-In)',
                      desc: 'Basic walk-in sales only. Token: WI-01',
                      icon: ShoppingBag,
                      color: 'emerald',
                    },
                    {
                      value: 'category',
                      label: 'Category Mode',
                      desc: 'Dine-In (DIN-01), Takeaway (TA-01), Delivery (DL-01), Walk-In (WI-01)',
                      icon: Layers,
                      color: 'teal',
                    },
                  ].map(opt => {
                    const Icon = opt.icon;
                    const active = settings.pos_mode === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setSettings({ ...settings, pos_mode: opt.value })}
                        className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                          active
                            ? 'border-emerald-500 bg-white shadow-md shadow-emerald-100'
                            : 'border-gray-200 bg-white/60 hover:border-emerald-300'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${active ? 'bg-emerald-500' : 'bg-gray-100'}`}>
                          <Icon size={20} className={active ? 'text-white' : 'text-gray-500'} />
                        </div>
                        <div>
                          <p className={`font-bold text-sm ${active ? 'text-emerald-700' : 'text-gray-700'}`}>{opt.label}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                        </div>
                        {active && <CheckCircle size={16} className="text-emerald-500 ml-auto shrink-0 mt-1" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Tax Rates by Payment Method ── */}
              <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-200 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Percent size={18} className="text-orange-600" />
                  <h3 className="text-sm font-bold text-orange-800 uppercase tracking-wider">Tax Rates by Payment Method (%)</h3>
                </div>
                <p className="text-xs text-gray-600 mb-4">Set the GST/Tax percentage applied per payment method. Checkout will automatically use the correct rate.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { key: 'tax_on_cash',   label: 'Tax on Cash',   color: 'orange' },
                    { key: 'tax_on_card',   label: 'Tax on Card',   color: 'blue' },
                    { key: 'tax_on_online', label: 'Tax on Online', color: 'violet' },
                  ].map(({ key, label }) => (
                    <div key={key} className="bg-white rounded-xl border border-orange-100 p-3">
                      <label className="block text-xs font-semibold text-gray-500 mb-2">{label}</label>
                      <div className="relative">
                        <input
                          type="number" step="0.01" min="0" max="100"
                          value={(settings as any)[key]}
                          onChange={e => setSettings({ ...settings, [key]: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 pr-8 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-center font-bold text-lg"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Per-Category Tax Configuration ── */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Percent size={18} className="text-gray-600" />
                  <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Per-Category Tax & Charges Configuration</h3>
                </div>
                <p className="text-xs text-gray-500 mb-4">Configure default Tax, Service Charges, and Other Charges for each order category. These auto-apply in POS when the order type is selected.</p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {[
                    { key: 'dine_in',  label: 'Dine-In',   token: 'DIN-01', icon: UtensilsCrossed, color: 'orange' },
                    { key: 'takeaway', label: 'Takeaway',  token: 'TA-01',  icon: Coffee,           color: 'yellow' },
                    { key: 'delivery', label: 'Delivery',  token: 'DL-01',  icon: Truck,            color: 'blue'   },
                    { key: 'walk_in',  label: 'Walk-In',   token: 'WI-01',  icon: ShoppingBag,      color: 'emerald'},
                  ].map(cat => {
                    const cfg = getPosCategories()[cat.key];
                    const Icon = cat.icon;
                    const colorMap: Record<string, string> = {
                      orange: 'bg-orange-100 text-orange-600 border-orange-200',
                      yellow: 'bg-yellow-100 text-yellow-600 border-yellow-200',
                      blue:   'bg-blue-100 text-blue-600 border-blue-200',
                      emerald:'bg-emerald-100 text-emerald-600 border-emerald-200',
                    };
                    const headerColor: Record<string, string> = {
                      orange: 'from-orange-50 to-orange-100 border-orange-200',
                      yellow: 'from-yellow-50 to-yellow-100 border-yellow-200',
                      blue:   'from-blue-50 to-blue-100 border-blue-200',
                      emerald:'from-emerald-50 to-emerald-100 border-emerald-200',
                    };
                    return (
                      <div key={cat.key} className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden">
                        <div className={`flex items-center gap-3 px-4 py-3 bg-gradient-to-r ${headerColor[cat.color]} border-b`}>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorMap[cat.color]}`}>
                            <Icon size={16} />
                          </div>
                          <div>
                            <p className="font-bold text-sm text-gray-800">{cat.label}</p>
                            <p className="text-xs text-gray-500">Token: {cat.token}</p>
                          </div>
                        </div>
                        <div className="p-4 space-y-3">
                          {/* Tax */}
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 flex-1">
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer"
                                  checked={!!cfg.tax_enabled}
                                  onChange={e => setCategoryConfig(cat.key, 'tax_enabled', e.target.checked)} />
                                <div className="w-9 h-5 bg-gray-200 peer-checked:bg-emerald-500 rounded-full transition-colors"></div>
                                <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform"></div>
                              </label>
                              <span className="text-sm font-medium text-gray-700">Tax</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <input type="number" min="0" max="100" step="0.1"
                                disabled={!cfg.tax_enabled}
                                value={cfg.tax_rate}
                                onChange={e => setCategoryConfig(cat.key, 'tax_rate', parseFloat(e.target.value) || 0)}
                                className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center font-bold disabled:opacity-40 focus:ring-2 focus:ring-emerald-500 outline-none" />
                              <span className="text-xs text-gray-500">%</span>
                            </div>
                          </div>
                          {/* Service Charges */}
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 flex-1">
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer"
                                  checked={!!cfg.service_enabled}
                                  onChange={e => setCategoryConfig(cat.key, 'service_enabled', e.target.checked)} />
                                <div className="w-9 h-5 bg-gray-200 peer-checked:bg-emerald-500 rounded-full transition-colors"></div>
                                <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform"></div>
                              </label>
                              <span className="text-sm font-medium text-gray-700">Service Charges</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <input type="number" min="0" max="100" step="0.1"
                                disabled={!cfg.service_enabled}
                                value={cfg.service_rate}
                                onChange={e => setCategoryConfig(cat.key, 'service_rate', parseFloat(e.target.value) || 0)}
                                className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center font-bold disabled:opacity-40 focus:ring-2 focus:ring-emerald-500 outline-none" />
                              <span className="text-xs text-gray-500">%</span>
                            </div>
                          </div>
                          {/* Other Charges */}
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 flex-1">
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer"
                                  checked={!!cfg.other_enabled}
                                  onChange={e => setCategoryConfig(cat.key, 'other_enabled', e.target.checked)} />
                                <div className="w-9 h-5 bg-gray-200 peer-checked:bg-emerald-500 rounded-full transition-colors"></div>
                                <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-4 transition-transform"></div>
                              </label>
                              <input type="text"
                                placeholder="Other Charges"
                                disabled={!cfg.other_enabled}
                                value={cfg.other_label}
                                onChange={e => setCategoryConfig(cat.key, 'other_label', e.target.value)}
                                className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs disabled:opacity-40 focus:ring-2 focus:ring-emerald-500 outline-none min-w-0" />
                            </div>
                            <div className="flex items-center gap-1">
                              <input type="number" min="0" max="100" step="0.1"
                                disabled={!cfg.other_enabled}
                                value={cfg.other_rate}
                                onChange={e => setCategoryConfig(cat.key, 'other_rate', parseFloat(e.target.value) || 0)}
                                className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center font-bold disabled:opacity-40 focus:ring-2 focus:ring-emerald-500 outline-none" />
                              <span className="text-xs text-gray-500">%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Default Payment Method</label>
                  <select value={settings.default_payment_method}
                    onChange={e => setSettings({ ...settings, default_payment_method: e.target.value })}
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none">
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="online">Online</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Low Stock Alert Threshold</label>
                  <div className="relative">
                    <Package className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input type="number" value={settings.low_stock_threshold}
                      onChange={e => setSettings({ ...settings, low_stock_threshold: parseInt(e.target.value) || 0 })}
                      className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      placeholder="10" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Products below this quantity will show in alerts</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Barcode Prefix</label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input type="text" value={settings.barcode_prefix}
                      onChange={e => setSettings({ ...settings, barcode_prefix: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      placeholder="e.g. AB" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Max Cashier Discount (%)</label>
                  <input type="number" step="0.01" min="0" max="100" value={settings.max_cashier_discount}
                    onChange={e => setSettings({ ...settings, max_cashier_discount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                  <p className="text-xs text-gray-500 mt-1">Maximum discount cashiers can apply (Admin/Manager have no limit)</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Default Delivery Charges (Rs.)</label>
                  <div className="relative">
                    <Truck className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input type="number" step="1" min="0" value={settings.default_delivery_charges}
                      onChange={e => setSettings({ ...settings, default_delivery_charges: parseFloat(e.target.value) || 0 })}
                      className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                      placeholder="0" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Pre-filled in cart when Delivery mode is selected</p>
                </div>
              </div>

              {/* Toggle Options */}
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-4">POS Behavior</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { key: 'auto_print_receipt', label: 'Auto-Print Receipt After Sale', desc: 'Automatically print receipt when sale is completed', icon: Printer },
                    { key: 'allow_negative_stock', label: 'Allow Negative Stock', desc: 'Allow selling products even when stock is 0', icon: Package },
                    { key: 'discount_requires_approval', label: 'Discount Requires Approval', desc: 'Require manager approval for discounts above cashier limit', icon: Shield },
                  ].map(item => {
                    const Icon = item.icon;
                    return (
                      <label key={item.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-100 transition">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                            <Icon size={20} className="text-emerald-600" />
                          </div>
                          <div>
                            <span className="font-medium text-gray-700 block">{item.label}</span>
                            <span className="text-xs text-gray-500">{item.desc}</span>
                          </div>
                        </div>
                        <div className="relative ml-4">
                          <input type="checkbox" className="sr-only peer"
                            checked={!!settings[item.key]}
                            onChange={e => setSettings({ ...settings, [item.key]: e.target.checked })} />
                          <div className="w-11 h-6 bg-gray-300 peer-checked:bg-emerald-500 rounded-full transition-colors"></div>
                          <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-200">
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 font-semibold shadow-lg transition-all">
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  Save Changes
                </button>
              </div>
            </form>
          )}

          {/* ========== PRINTER TAB ========== */}
          {activeTab === 'printer' && currentUser?.role_name === 'Admin' && (
            <div className="space-y-5">

              {/* ── Agent Status Card ── */}
              <div className={`rounded-xl border-2 p-5 transition ${
                agentStatus === 'available'   ? 'border-emerald-300 bg-emerald-50' :
                agentStatus === 'unavailable' ? 'border-amber-200 bg-amber-50' :
                                                'border-gray-200 bg-gray-50'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    agentStatus === 'available' ? 'bg-emerald-100' : agentStatus === 'unavailable' ? 'bg-amber-100' : 'bg-gray-100'
                  }`}>
                    {agentStatus === 'checking'    && <Loader2 size={20} className="animate-spin text-gray-400" />}
                    {agentStatus === 'available'   && <CheckCircle size={20} className="text-emerald-600" />}
                    {agentStatus === 'unavailable' && <Server size={20} className="text-amber-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-800">Abyte ERP Printer Agent</p>
                      <code className="px-2 py-0.5 bg-white border border-gray-200 text-gray-600 text-xs rounded-md">{AGENT_URL.replace('http://', '')}</code>
                      {agentStatus === 'available'   && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">● RUNNING</span>}
                      {agentStatus === 'unavailable' && <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">○ NOT RUNNING</span>}
                    </div>

                    {agentStatus === 'available' && agentInfo && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div className="bg-white rounded-lg p-3 border border-emerald-200 text-center">
                          <div className="text-2xl font-bold text-emerald-600">{agentInfo.printers}</div>
                          <div className="text-xs text-gray-500 mt-0.5">Total Printers</div>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-blue-200 text-center">
                          <div className="text-2xl font-bold text-blue-600">{agentInfo.invoice ?? 0}</div>
                          <div className="text-xs text-gray-500 mt-0.5">Invoice</div>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-orange-200 text-center">
                          <div className="text-2xl font-bold text-orange-500">{agentInfo.kot ?? 0}</div>
                          <div className="text-xs text-gray-500 mt-0.5">KOT</div>
                        </div>
                      </div>
                    )}

                    {agentStatus === 'available' && (
                      <div className="mt-3 flex items-center gap-3 flex-wrap">
                        <a href={AGENT_URL} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition">
                          <Printer size={15} /> Open Printer Dashboard
                        </a>
                        <button onClick={checkAgentStatus} className="text-xs text-gray-500 underline hover:no-underline">Re-check</button>
                      </div>
                    )}

                    {agentStatus === 'unavailable' && (
                      <div className="mt-3 space-y-3">
                        <p className="text-sm text-amber-700 font-medium">Printer Agent is not running on this PC.</p>
                        <div className="bg-white border border-amber-200 rounded-lg p-3 space-y-1.5">
                          <p className="text-xs font-semibold text-gray-700">Setup Steps:</p>
                          <p className="text-xs text-gray-600">1. Copy the <code className="bg-gray-100 px-1 rounded">printer-agent/</code> folder to the cashier PC</p>
                          <p className="text-xs text-gray-600">2. Install Node.js from <span className="font-medium">nodejs.org</span></p>
                          <p className="text-xs text-gray-600">3. Run <code className="bg-gray-100 px-1 rounded">install-service.bat</code> as Administrator</p>
                          <p className="text-xs text-gray-600">4. Add printers at <code className="bg-gray-100 px-1 rounded">{AGENT_URL}</code></p>
                        </div>
                        <button onClick={checkAgentStatus} className="text-xs text-gray-500 underline hover:no-underline">Re-check</button>
                      </div>
                    )}

                    {agentStatus === 'checking' && (
                      <p className="text-xs text-gray-500 mt-2">Checking agent on {AGENT_URL}...</p>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Info Card ── */}
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                  <Server size={16} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-800">Printers are managed in the Agent Dashboard</p>
                  <p className="text-sm text-blue-700 mt-0.5">
                    To add, edit or test printers — open the Agent Dashboard at{' '}
                    <a href={AGENT_URL} target="_blank" rel="noreferrer"
                      className="font-semibold underline">{AGENT_URL}</a>.
                    The agent must be running on the cashier PC.
                  </p>
                </div>
              </div>

              {/* ── Agent Config (Server Connection) ── */}
              <div>
                <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Server size={14} className="text-gray-500" /> Agent Server Configuration
                </h2>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                  <p className="text-xs text-gray-500">Enter these values in the Printer Agent dashboard under "Server Connection".</p>

                  {/* Server URL */}
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Server URL</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-700 font-mono truncate">
                        {SERVER_URL}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(SERVER_URL, 'server_url')}
                        className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                        title="Copy"
                      >
                        {copiedField === 'server_url' ? <CheckCircle size={15} className="text-emerald-600" /> : <Copy size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Tenant Code */}
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Tenant Code</label>
                    <p className="text-xs text-gray-500 px-3 py-2 bg-white border border-gray-200 rounded-lg">
                      Your company login code (the code staff use to log in)
                    </p>
                  </div>

                  {/* Agent Token */}
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">Agent Token</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-700 font-mono truncate">
                        {settings.agent_token || <span className="text-gray-400 italic">No token generated yet</span>}
                      </code>
                      {settings.agent_token && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(settings.agent_token, 'agent_token')}
                          className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                          title="Copy token"
                        >
                          {copiedField === 'agent_token' ? <CheckCircle size={15} className="text-emerald-600" /> : <Copy size={15} />}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={generateAndSaveAgentToken}
                        disabled={agentTokenSaving}
                        className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-60 transition"
                        title="Generate new token"
                      >
                        {agentTokenSaving ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                        {settings.agent_token ? 'Regenerate' : 'Generate'}
                      </button>
                    </div>
                    {settings.agent_token && (
                      <p className="text-xs text-amber-600 mt-1.5">
                        Regenerating will disconnect the agent until you update the token in its dashboard.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Mobile Print Queue Info ── */}
              <div>
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Mobile Print Queue</h2>
                <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 space-y-2">
                  <p className="text-xs font-semibold text-emerald-800">How it works</p>
                  <ol className="text-xs text-emerald-700 space-y-1 list-decimal list-inside">
                    <li>Mobile app (Waiter App) sends print job → saved in database</li>
                    <li>Printer Agent polls backend every 3s <strong>(configure below)</strong></li>
                    <li>Agent sends ESC/POS commands to thermal printer</li>
                  </ol>
                  <p className="text-xs text-emerald-600 mt-2">
                    Configure Agent Token below, then enter it in the Printer Agent dashboard.
                  </p>
                </div>
              </div>

              {/* ── Auto Print Receipt toggle (still useful) ── */}
              <div>
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Receipt Settings</h2>
                <label className="flex items-start gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50 cursor-pointer hover:bg-gray-100 transition">
                  <input
                    type="checkbox"
                    checked={!!settings.auto_print_receipt}
                    onChange={e => setSettings({ ...settings, auto_print_receipt: e.target.checked })}
                    className="mt-0.5 w-4 h-4 accent-emerald-600"
                  />
                  <div>
                    <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                      <Printer size={14} className="text-gray-500" /> Auto-Print Receipt After Sale
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">Automatically send receipt to the printer when a sale is completed</p>
                  </div>
                </label>
              </div>

            </div>
          )}

          {/* ========== USERS TAB ========== */}
          {activeTab === 'users' && currentUser?.role_name === 'Admin' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-base font-semibold text-gray-800">User Management</h2>
                <button onClick={() => openUserModal()}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold shadow-sm">
                  <Plus size={18} /> Add User
                </button>
              </div>

              {/* Stats Cards */}
              <div className="flex flex-wrap gap-3 mb-6">
                {roles.map((r, i) => {
                  const count = users.filter(u => u.role === r.role_name).length;
                  const palette = ['bg-red-100 text-red-700','bg-blue-100 text-blue-700','bg-emerald-100 text-emerald-700','bg-purple-100 text-purple-700','bg-amber-100 text-amber-700'];
                  return (
                    <div key={r.role_id} className="flex-1 min-w-28 p-4 bg-gray-50 rounded-xl border border-gray-200 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${palette[i % palette.length]}`}>{r.role_name}</span>
                      <p className="text-2xl font-bold text-gray-800 mt-2">{count}</p>
                    </div>
                  );
                })}
              </div>

              {/* Manage Roles */}
              <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Shield size={14} /> Roles</h3>
                  <button onClick={() => { setNewRoleName(''); setRoleError(''); setShowRoleModal(true); }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition">
                    <Plus size={13} /> New Role
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {roles.map(r => {
                    const BUILT_IN = ['Admin', 'Manager', 'Cashier'];
                    return (
                      <span key={r.role_id} className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-200 rounded-full text-sm text-gray-700">
                        {r.role_name}
                        {!BUILT_IN.includes(r.role_name) && (
                          <button onClick={() => handleDeleteRole(r.role_id, r.role_name)}
                            className="text-red-400 hover:text-red-600 transition ml-0.5" title="Delete role">
                            <X size={12} />
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Username</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Role</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Joined</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {users.map(user => (
                      <tr key={user.user_id} className="hover:bg-gray-50 transition">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold text-sm">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-gray-800">{user.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-500 text-sm font-mono">{user.username}</td>
                        <td className="px-6 py-4 text-gray-600">{user.email}</td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${user.role === 'Admin' ? 'bg-emerald-100 text-emerald-700'
                              : user.role === 'Manager' ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button onClick={() => openUserModal(user)}
                              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition" title="Edit">
                              <Edit size={16} />
                            </button>
                            {user.user_id !== currentUser?.user_id && (
                              <button onClick={() => handleDeleteUser(user.user_id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete">
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========== SECURITY TAB ========== */}
          {activeTab === 'security' && (
            <div className="space-y-8">
              {/* Change Password */}
              <div>
                <h2 className="text-base font-semibold text-gray-800 mb-2">Change Password</h2>
                <p className="text-sm text-gray-600 mb-6">Update your account password. Must be at least 6 characters.</p>

                <form onSubmit={handleChangePassword} className="max-w-lg space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Current Password *</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
                      <input type={showPasswords.current ? 'text' : 'password'}
                        value={passwordForm.current_password}
                        onChange={e => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                        className="w-full pl-10 pr-12 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        required />
                      <button type="button" onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                        {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">New Password *</label>
                    <div className="relative">
                      <Key className="absolute left-3 top-3 text-gray-400" size={18} />
                      <input type={showPasswords.new_password ? 'text' : 'password'}
                        value={passwordForm.new_password}
                        onChange={e => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                        className="w-full pl-10 pr-12 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        required minLength={6} />
                      <button type="button" onClick={() => setShowPasswords({ ...showPasswords, new_password: !showPasswords.new_password })}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                        {showPasswords.new_password ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {passwordForm.new_password && passwordForm.new_password.length < 6 && (
                      <p className="text-xs text-red-500 mt-1">Password must be at least 6 characters</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm New Password *</label>
                    <div className="relative">
                      <Key className="absolute left-3 top-3 text-gray-400" size={18} />
                      <input type={showPasswords.confirm ? 'text' : 'password'}
                        value={passwordForm.confirm_password}
                        onChange={e => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                        className="w-full pl-10 pr-12 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        required minLength={6} />
                      <button type="button" onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                        {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    {passwordForm.confirm_password && passwordForm.new_password !== passwordForm.confirm_password && (
                      <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                    )}
                  </div>
                  <button type="submit" disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 font-semibold shadow-lg transition-all">
                    {saving ? <Loader2 className="animate-spin" size={18} /> : <Lock size={18} />}
                    Change Password
                  </button>
                </form>
              </div>

              {/* POS Security Passwords (Admin only) */}
              {currentUser?.role_name === 'Admin' && (
                <div className="border-t border-gray-200 pt-8">
                  <h2 className="text-base font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <Lock size={18} className="text-amber-600" />
                    POS Security
                  </h2>
                  <p className="text-sm text-gray-600 mb-6">
                    Set passwords to restrict access to sensitive POS actions. Leave empty to disable password protection.
                  </p>

                  <form onSubmit={handleSaveSettings} className="max-w-lg space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        View Completed Orders Password
                      </label>
                      <div className="relative">
                        <input
                          type={showViewCompletedPw ? 'text' : 'password'}
                          value={settings.view_completed_orders_password || ''}
                          onChange={e => setSettings({ ...settings, view_completed_orders_password: e.target.value })}
                          className="w-full pl-4 pr-10 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                          placeholder="Leave empty to disable"
                        />
                        <button
                          type="button"
                          onClick={() => setShowViewCompletedPw(!showViewCompletedPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showViewCompletedPw ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Require password to view the Completed Orders tab in Orders Management</p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Refund Password
                      </label>
                      <div className="relative">
                        <input
                          type={showRefundPw ? 'text' : 'password'}
                          value={settings.refund_password || ''}
                          onChange={e => setSettings({ ...settings, refund_password: e.target.value })}
                          className="w-full pl-4 pr-10 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                          placeholder="Leave empty to disable"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRefundPw(!showRefundPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showRefundPw ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Require password before processing a refund</p>
                    </div>

                    {/* Reports Password */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Reports Password
                      </label>
                      <div className="relative">
                        <input
                          type={showReportsPw ? 'text' : 'password'}
                          value={settings.reports_password || ''}
                          onChange={e => setSettings({ ...settings, reports_password: e.target.value })}
                          className="w-full pl-4 pr-10 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                          placeholder="Leave empty to disable"
                        />
                        <button
                          type="button"
                          onClick={() => setShowReportsPw(!showReportsPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showReportsPw ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Require password to access any report page (once per session)</p>
                    </div>

                    <button type="submit" disabled={saving}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 font-semibold shadow-lg transition-all">
                      {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                      Save POS Security Settings
                    </button>
                  </form>
                </div>
              )}

              {/* Accounts Security (Admin only) */}
              {currentUser?.role_name === 'Admin' && (
                <div className="border-t border-gray-200 pt-8">
                  <h2 className="text-base font-semibold text-gray-800 mb-2 flex items-center gap-2">
                    <FileText size={18} className="text-emerald-600" />
                    Accounts Security
                  </h2>
                  <p className="text-sm text-gray-600 mb-6">
                    Set passwords to protect sensitive accounting actions. Leave empty to disable protection.
                  </p>

                  <form onSubmit={handleSaveSettings} className="max-w-lg space-y-5">
                    {/* JV Delete Password */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Journal Voucher Delete Password
                      </label>
                      <div className="relative">
                        <input
                          type={showJvDeletePw ? 'text' : 'password'}
                          value={settings.jv_delete_password || ''}
                          onChange={e => setSettings({ ...settings, jv_delete_password: e.target.value })}
                          className="w-full pl-4 pr-10 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                          placeholder="Leave empty to disable"
                        />
                        <button
                          type="button"
                          onClick={() => setShowJvDeletePw(s => !s)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showJvDeletePw ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Require password before deleting any Journal Voucher (draft or posted)</p>
                    </div>

                    {/* CPV / CRV Default Accounts */}
                    <div className="border-t border-gray-100 pt-5">
                      <h3 className="text-sm font-bold text-gray-700 mb-1">Voucher Default Accounts</h3>
                      <p className="text-xs text-gray-500 mb-4">Select the default Cash/Bank account that pre-fills when creating CPV or CRV. Staff won't need to select it every time.</p>

                      <div className="space-y-4">
                        {/* CPV Default Account */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            CPV Default Account <span className="text-xs font-normal text-gray-400">(Cash Payment Voucher)</span>
                          </label>
                          <select
                            value={settings.cpv_default_account_id || ''}
                            onChange={e => setSettings({ ...settings, cpv_default_account_id: e.target.value })}
                            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
                          >
                            <option value="">— None (manual select) —</option>
                            {accountsList.map(a => (
                              <option key={a.account_id} value={a.account_id}>
                                {a.account_code} — {a.account_name}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-gray-400 mt-1">Usually your main Cash or Bank account (Asset type)</p>
                        </div>

                        {/* CRV Default Account */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                            CRV Default Account <span className="text-xs font-normal text-gray-400">(Cash Receipt Voucher)</span>
                          </label>
                          <select
                            value={settings.crv_default_account_id || ''}
                            onChange={e => setSettings({ ...settings, crv_default_account_id: e.target.value })}
                            className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white"
                          >
                            <option value="">— None (manual select) —</option>
                            {accountsList.map(a => (
                              <option key={a.account_id} value={a.account_id}>
                                {a.account_code} — {a.account_name}
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-gray-400 mt-1">Usually your main Cash or Bank account (Asset type)</p>
                        </div>
                      </div>
                    </div>

                    <button type="submit" disabled={saving}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 font-semibold shadow-lg transition-all">
                      {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                      Save Accounts Settings
                    </button>
                  </form>
                </div>
              )}

              {/* Session Settings (Admin only) */}
              {currentUser?.role_name === 'Admin' && (
                <div className="border-t border-gray-200 pt-8">
                  <h2 className="text-base font-semibold text-gray-800 mb-2">Session & Security Settings</h2>
                  <p className="text-sm text-gray-600 mb-6">Configure session timeout and security policies.</p>

                  <form onSubmit={handleSaveSettings} className="max-w-lg space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Session Timeout (minutes)</label>
                      <input type="number" min="5" max="1440" value={settings.session_timeout_minutes}
                        onChange={e => setSettings({ ...settings, session_timeout_minutes: parseInt(e.target.value) || 480 })}
                        className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                      <p className="text-xs text-gray-500 mt-1">Auto-logout after inactivity. Default: 480 mins (8 hours)</p>
                    </div>

                    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 flex items-start gap-3">
                      <AlertTriangle size={20} className="text-yellow-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-yellow-800 mb-1">Security Tip</p>
                        <p className="text-sm text-yellow-700">
                          Keep session timeout low for shared terminals. Recommended: 30-60 minutes for POS stations.
                        </p>
                      </div>
                    </div>

                    <button type="submit" disabled={saving}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 font-semibold shadow-lg transition-all">
                      {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                      Save Security Settings
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* ========== WHATSAPP TAB ========== */}
          {/* ========== WHATSAPP & FBR TAB ========== */}
          {activeTab === 'integrations' && currentUser?.role_name === 'Admin' && (
            <div className="space-y-10">

              {/* ── WhatsApp Section ── */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center">
                    <MessageCircle size={18} className="text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-800">WhatsApp Integration</h2>
                    <p className="text-xs text-gray-500">Send invoice receipts to customers via Meta Cloud API</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div>
                    <p className="font-semibold text-gray-800">Enable WhatsApp Sending</p>
                    <p className="text-xs text-gray-500 mt-0.5">Staff can send invoices via WhatsApp after checkout</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={waSettings.whatsapp_enabled} onChange={e => setWaSettings(p => ({ ...p, whatsapp_enabled: e.target.checked }))} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">API URL <span className="text-red-500">*</span></label>
                    <input type="text" value={waSettings.whatsapp_api_url} onChange={e => setWaSettings(p => ({ ...p, whatsapp_api_url: e.target.value }))}
                      placeholder="https://7107.api.greenapi.com" className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                    <p className="text-xs text-gray-400 mt-1">apiUrl from your Green API instance dashboard</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Instance ID <span className="text-red-500">*</span></label>
                    <input type="text" value={waSettings.whatsapp_id_instance} onChange={e => setWaSettings(p => ({ ...p, whatsapp_id_instance: e.target.value }))}
                      placeholder="e.g. 7107607411" className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                    <p className="text-xs text-gray-400 mt-1">idInstance from Green API dashboard</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">API Token <span className="text-red-500">*</span></label>
                    <input type="password" value={waSettings.whatsapp_api_token} onChange={e => setWaSettings(p => ({ ...p, whatsapp_api_token: e.target.value }))}
                      placeholder="apiTokenInstance" className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                    <p className="text-xs text-gray-400 mt-1">apiTokenInstance from Green API dashboard</p>
                  </div>
                </div>

                {waTestResult && (
                  <div className={`flex items-start gap-3 p-4 rounded-xl border ${waTestResult.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    {waTestResult.ok ? <CheckCircle size={18} className="mt-0.5 shrink-0" /> : <AlertTriangle size={18} className="mt-0.5 shrink-0" />}
                    <p className="text-sm">{waTestResult.message}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={handleTestWa} disabled={waTesting || !waSettings.whatsapp_api_url || !waSettings.whatsapp_id_instance}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-xl border border-blue-200 transition disabled:opacity-50">
                    {waTesting ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
                    Test Connection
                  </button>
                  <button onClick={handleSaveWaSettings} disabled={waSaving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition disabled:opacity-50">
                    {waSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Save WhatsApp
                  </button>
                </div>
              </div>

              {/* ── Divider ── */}
              <div className="border-t border-gray-200" />

              {/* ── FBR Section ── */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center">
                    <FileCheck size={18} className="text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-gray-800">FBR POS Integration</h2>
                    <p className="text-xs text-gray-500">TIER-1 retailer tax compliance — each sale reported to FBR automatically</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div>
                    <p className="font-semibold text-gray-800">Enable FBR Reporting</p>
                    <p className="text-xs text-gray-500 mt-0.5">Auto-report each sale to FBR after checkout</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={fbrSettings.fbr_enabled} onChange={e => setFbrSettings(p => ({ ...p, fbr_enabled: e.target.checked }))} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">API Mode</label>
                  <div className="flex gap-3">
                    {(['sandbox', 'live'] as const).map(mode => (
                      <button key={mode} onClick={() => setFbrSettings(p => ({ ...p, fbr_mode: mode }))}
                        className={`px-5 py-2.5 rounded-xl font-semibold text-sm border-2 transition ${fbrSettings.fbr_mode === mode ? (mode === 'live' ? 'border-red-500 bg-red-50 text-red-700' : 'border-blue-500 bg-blue-50 text-blue-700') : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                        {mode === 'live' ? '🔴 Live (Production)' : '🔵 Sandbox (Testing)'}
                      </button>
                    ))}
                  </div>
                  {fbrSettings.fbr_mode === 'live' && (
                    <p className="text-xs text-red-600 mt-1 font-medium">Live mode reports real sales to FBR. Only enable after testing in sandbox.</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">POSID <span className="text-red-500">*</span></label>
                    <input type="text" value={fbrSettings.fbr_posid} onChange={e => setFbrSettings(p => ({ ...p, fbr_posid: e.target.value }))}
                      placeholder="e.g. 123456" className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                    <p className="text-xs text-gray-400 mt-1">POS ID issued by FBR upon registration</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Business NTN</label>
                    <input type="text" value={fbrSettings.fbr_ntn} onChange={e => setFbrSettings(p => ({ ...p, fbr_ntn: e.target.value }))}
                      placeholder="e.g. 1234567-8" className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                    <p className="text-xs text-gray-400 mt-1">Your NTN registered with FBR</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">FBR Username <span className="text-red-500">*</span></label>
                    <input type="text" value={fbrSettings.fbr_username} onChange={e => setFbrSettings(p => ({ ...p, fbr_username: e.target.value }))}
                      placeholder="FBR portal username" className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">FBR Password <span className="text-red-500">*</span></label>
                    <input type="password" value={fbrSettings.fbr_password} onChange={e => setFbrSettings(p => ({ ...p, fbr_password: e.target.value }))}
                      placeholder="FBR portal password" className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" />
                  </div>
                </div>

                {fbrTestResult && (
                  <div className={`flex items-start gap-3 p-4 rounded-xl border ${fbrTestResult.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    {fbrTestResult.ok ? <CheckCircle size={18} className="mt-0.5 shrink-0" /> : <AlertTriangle size={18} className="mt-0.5 shrink-0" />}
                    <p className="text-sm">{fbrTestResult.message}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={handleTestFbr} disabled={fbrTesting || !fbrSettings.fbr_posid || !fbrSettings.fbr_username || !fbrSettings.fbr_password}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-xl border border-blue-200 transition disabled:opacity-50">
                    {fbrTesting ? <Loader2 size={16} className="animate-spin" /> : <FileCheck size={16} />}
                    Test FBR Connection
                  </button>
                  <button onClick={handleSaveFbrSettings} disabled={fbrSaving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition disabled:opacity-50">
                    {fbrSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Save FBR
                  </button>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-800">Recent FBR Submissions</h3>
                    <div className="flex gap-2">
                      <button onClick={handleRetryFailed} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-lg transition">
                        <RefreshCw size={12} /> Retry Failed
                      </button>
                      <button onClick={loadFbrLogs} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition">
                        <RefreshCw size={12} /> Refresh
                      </button>
                    </div>
                  </div>
                  {fbrLogsLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="animate-spin text-gray-400" size={24} /></div>
                  ) : fbrLogs.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm border border-dashed border-gray-200 rounded-xl">No FBR submissions yet</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b border-gray-200">
                          <th className="text-left pb-2 text-gray-500 font-medium">Invoice</th>
                          <th className="text-left pb-2 text-gray-500 font-medium">FBR Invoice #</th>
                          <th className="text-left pb-2 text-gray-500 font-medium">Status</th>
                          <th className="text-left pb-2 text-gray-500 font-medium">Date</th>
                        </tr></thead>
                        <tbody>
                          {fbrLogs.map((log: any) => (
                            <tr key={log.fbr_log_id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-2.5 font-medium">{log.invoice_no || `#${log.sale_id}`}</td>
                              <td className="py-2.5 text-emerald-700 font-mono text-xs">{log.fbr_invoice_no || '—'}</td>
                              <td className="py-2.5">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${log.fbr_status === 'sent' ? 'bg-emerald-100 text-emerald-700' : log.fbr_status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                  {log.fbr_status}
                                </span>
                              </td>
                              <td className="py-2.5 text-gray-400 text-xs">{log.created_at ? new Date(log.created_at).toLocaleDateString() : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* ========== SYSTEM TAB ========== */}
          {activeTab === 'system' && currentUser?.role_name === 'Admin' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-base font-semibold text-gray-800 mb-2">System Configuration</h2>
                <p className="text-sm text-gray-600 mb-6">Regional settings and system information.</p>

                <form onSubmit={handleSaveSettings} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Date Format</label>
                      <select value={settings.date_format}
                        onChange={e => setSettings({ ...settings, date_format: e.target.value })}
                        className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none">
                        <option value="DD/MM/YYYY">DD/MM/YYYY (31/12/2026)</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY (12/31/2026)</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD (2026-12-31)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Timezone</label>
                      <select value={settings.timezone}
                        onChange={e => setSettings({ ...settings, timezone: e.target.value })}
                        className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none">
                        <option value="Asia/Karachi">Asia/Karachi (PKT +05:00)</option>
                        <option value="Asia/Dubai">Asia/Dubai (GST +04:00)</option>
                        <option value="Asia/Kolkata">Asia/Kolkata (IST +05:30)</option>
                        <option value="Asia/Riyadh">Asia/Riyadh (AST +03:00)</option>
                        <option value="Europe/London">Europe/London (GMT +00:00)</option>
                        <option value="America/New_York">America/New_York (EST -05:00)</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-gray-200">
                    <button type="submit" disabled={saving}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 font-semibold shadow-lg transition-all">
                      {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>

              {/* System Information */}
              <div className="border-t border-gray-200 pt-8">
                <h2 className="text-base font-semibold text-gray-800 mb-4">System Information</h2>
                {systemInfo ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Users size={18} className="text-emerald-600" />
                        <span className="text-sm font-medium text-gray-600">Users</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-800">{systemInfo.users}</p>
                    </div>
                    <div className="p-4 bg-emerald-50 rounded-xl border border-green-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Package size={18} className="text-emerald-600" />
                        <span className="text-sm font-medium text-gray-600">Products</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-800">{systemInfo.products}</p>
                    </div>
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                      <div className="flex items-center gap-2 mb-2">
                        <ShoppingCart size={18} className="text-emerald-600" />
                        <span className="text-sm font-medium text-gray-600">Orders</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-800">{systemInfo.orders}</p>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-xl border border-orange-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Users size={18} className="text-orange-600" />
                        <span className="text-sm font-medium text-gray-600">Customers</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-800">{systemInfo.customers}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                    Loading system info...
                  </div>
                )}

                {systemInfo && (
                  <div className="mt-6 bg-gray-50 rounded-xl border border-gray-200 p-6">
                    <h3 className="font-semibold text-gray-700 mb-4">Server Details</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Node.js</p>
                        <p className="font-medium text-gray-800">{systemInfo.node_version}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Platform</p>
                        <p className="font-medium text-gray-800">{systemInfo.platform}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Uptime</p>
                        <p className="font-medium text-gray-800">{formatUptime(systemInfo.uptime)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Memory Usage</p>
                        <p className="font-medium text-gray-800">{systemInfo.memory} MB</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* About */}
              <div className="border-t border-gray-200 pt-8">
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border-2 border-emerald-200 p-6 text-center">
                  <h3 className="text-base font-semibold text-gray-800 mb-2">AByte ERP</h3>
                  <p className="text-gray-600 mb-1">Enterprise Point of Sale System</p>
                  <p className="text-sm text-gray-500">Version 1.0.0</p>
                </div>
              </div>
            </div>
          )}


        </div>
      </div>

      {/* User Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">
                {editingUser ? 'Edit User' : 'Add New User'}
              </h3>
              <button onClick={() => { setShowUserModal(false); setEditingUser(null); setShowUserPassword(false); }}
                className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleUserSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Username <span className="text-red-500">*</span></label>
                <input type="text" value={userForm.username}
                  onChange={e => setUserForm({ ...userForm, username: e.target.value })}
                  placeholder="e.g. john_cashier"
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name <span className="text-red-500">*</span></label>
                <input type="text" value={userForm.name}
                  onChange={e => setUserForm({ ...userForm, name: e.target.value })}
                  placeholder="e.g. John Smith"
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email <span className="text-red-500">*</span></label>
                <input type="email" value={userForm.email}
                  onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                  placeholder="e.g. john@store.com"
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Password {editingUser ? <span className="text-gray-400 font-normal">(blank = keep current)</span> : <span className="text-red-500">*</span>}
                </label>
                <div className="relative">
                  <input type={showUserPassword ? 'text' : 'password'} value={userForm.password}
                    onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                    placeholder="Min 8 characters"
                    className="w-full px-4 pr-12 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    required={!editingUser} minLength={editingUser ? undefined : 8} />
                  <button type="button" onClick={() => setShowUserPassword(!showUserPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                    {showUserPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {userForm.password && userForm.password.length < 8 && (
                  <p className="text-xs text-red-500 mt-1">Password must be at least 8 characters</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Role <span className="text-red-500">*</span></label>
                <select value={userForm.role_id}
                  onChange={e => setUserForm({ ...userForm, role_id: parseInt(e.target.value), branch_id: '' })}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none">
                  {roles.map(r => (
                    <option key={r.role_id} value={r.role_id}>{r.role_name}</option>
                  ))}
                </select>
              </div>

              {/* Branch selection — required for non-Admin roles */}
              {(() => {
                const selectedRoleName = roles.find(r => r.role_id === userForm.role_id)?.role_name ?? '';
                if (!selectedRoleName || selectedRoleName === 'Admin') {
                  return selectedRoleName === 'Admin' ? (
                    <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-600">
                      Admin users have access to all branches and cannot be restricted to a single branch.
                    </div>
                  ) : null;
                }
                return (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Assign Branch <span className="text-red-500">*</span>
                    </label>
                    {branches.length === 0 ? (
                      <div className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm text-red-500 bg-red-50">
                        No active branches found. Please create a branch first.
                      </div>
                    ) : (
                      <select
                        value={userForm.branch_id}
                        onChange={e => setUserForm({ ...userForm, branch_id: e.target.value })}
                        className={`w-full px-4 py-2.5 border-2 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none ${!userForm.branch_id ? 'border-red-300' : 'border-gray-200'}`}
                      >
                        <option value="">— Select branch —</option>
                        {branches.map(b => (
                          <option key={b.store_id} value={b.store_id}>{b.store_name}</option>
                        ))}
                      </select>
                    )}
                    <p className="text-xs text-gray-400 mt-1">User will only see data for this branch.</p>
                  </div>
                );
              })()}

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowUserModal(false); setEditingUser(null); setShowUserPassword(false); }}
                  className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 font-semibold transition">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold transition disabled:opacity-50 shadow-lg">
                  {saving ? <Loader2 className="animate-spin mx-auto" size={20} /> : (editingUser ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Role Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><Shield size={16} /> Create New Role</h3>
              <button onClick={() => setShowRoleModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              {roleError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{roleError}</div>}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Role Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newRoleName}
                  onChange={e => setNewRoleName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateRole()}
                  placeholder="e.g. Supervisor, Accountant"
                  autoFocus
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                />
                <p className="text-xs text-gray-400 mt-1">Built-in roles (Admin, Manager, Cashier) cannot be deleted.</p>
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-gray-100">
              <button onClick={() => setShowRoleModal(false)}
                className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 font-semibold transition">
                Cancel
              </button>
              <button onClick={handleCreateRole} disabled={roleSaving}
                className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold transition disabled:opacity-50">
                {roleSaving ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Create Role'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Settings;
