import { useState, useEffect, useRef } from 'react';
import { X, User, Briefcase, DollarSign, Calendar, Mail, Phone, MapPin, Clock, Search, ChevronDown, TrendingUp, TrendingDown } from 'lucide-react';
import api from '../utils/api';
import { localToday } from '../utils/dateUtils';
import { useToast } from './Toast';
import { useAuth } from '../context/AuthContext';

// ── Inline AccountSelector (same pattern as CPV/CRV) ──────────────────────────
interface Account { account_id: number; account_code: string; account_name: string; level: number; is_active: boolean; }

const AccountSelector = ({
  accounts, value, onChange, placeholder
}: { accounts: Account[]; value: number | ''; onChange: (id: number | '') => void; placeholder: string }) => {
  const [open, setOpen]       = useState(false);
  const [search, setSearch]   = useState('');
  const [cursor, setCursor]   = useState(-1);
  const listRef               = useRef<HTMLDivElement>(null);
  const inputRef              = useRef<HTMLInputElement>(null);

  const level4 = accounts.filter(a => a.is_active && a.level === 4);
  const filtered = search.trim()
    ? level4.filter(a => `${a.account_code} ${a.account_name}`.toLowerCase().includes(search.toLowerCase()))
    : level4;

  const selected = level4.find(a => a.account_id === value);

  const select = (a: Account) => {
    onChange(a.account_id);
    setSearch('');
    setOpen(false);
    setCursor(-1);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    else if (e.key === 'Enter' && cursor >= 0) { e.preventDefault(); select(filtered[cursor]); }
    else if (e.key === 'Escape') { setOpen(false); setSearch(''); }
  };

  useEffect(() => {
    if (cursor >= 0 && listRef.current) {
      const el = listRef.current.children[cursor] as HTMLElement;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [cursor]);

  return (
    <div className="relative">
      <div
        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg cursor-pointer flex items-center justify-between bg-white hover:border-emerald-400 transition"
        onClick={() => { setOpen(o => !o); setTimeout(() => inputRef.current?.focus(), 50); }}
      >
        {selected
          ? <span className="text-sm text-gray-800">{selected.account_code} — {selected.account_name}</span>
          : <span className="text-sm text-gray-400">{placeholder}</span>}
        <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
      </div>
      {value !== '' && (
        <button type="button" onClick={(e) => { e.stopPropagation(); onChange(''); }}
          className="absolute right-7 top-1/2 -translate-y-1/2 text-gray-300 hover:text-red-400 text-xs">✕</button>
      )}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg">
          <div className="p-2 border-b border-gray-100 flex items-center gap-2">
            <Search size={13} className="text-gray-400" />
            <input ref={inputRef} type="text" value={search}
              onChange={e => { setSearch(e.target.value); setCursor(-1); }}
              onKeyDown={handleKey}
              placeholder="Search account..."
              className="flex-1 text-sm outline-none"
            />
          </div>
          <div ref={listRef} className="max-h-44 overflow-y-auto">
            {filtered.length === 0
              ? <div className="p-3 text-xs text-gray-400 text-center">No accounts found</div>
              : filtered.map((a, i) => (
                <div key={a.account_id}
                  className={`px-3 py-2 text-sm cursor-pointer transition ${i === cursor ? 'bg-emerald-50 text-emerald-800' : 'hover:bg-gray-50'}`}
                  onMouseDown={() => select(a)}>
                  <span className="font-mono text-xs text-gray-500 mr-2">{a.account_code}</span>
                  {a.account_name}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};
// ──────────────────────────────────────────────────────────────────────────────

interface CompState {
  component_id: number;
  name: string;
  type: 'allowance' | 'deduction';
  calculation: 'fixed' | 'percentage';
  default_value: number;
  custom_value: string;
  is_enabled: boolean;
}

interface StaffMember {
  staff_id: number;
  user_id: number | null;
  employee_id: string | null;
  full_name: string;
  phone: string;
  email: string;
  address: string;
  position: string;
  department: string;
  salary: number;
  salary_type: string;
  hire_date: string;
  is_active: number;
  leave_balance?: number;
  salary_account_id?: number | null;
  time_in?: string;
  time_out?: string;
  monthly_leave_allowed?: number;
  grace_time?: number;
  branch_id?: number | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  staffToEdit?: StaffMember | null;
}

const EMPTY_FORM = {
  user_id: '', employee_id: '', full_name: '', phone: '', email: '', address: '',
  position: '', department: '', salary: '', salary_type: 'monthly',
  hire_date: localToday(), is_active: 1, leave_balance: '20',
  salary_account_id: '' as number | '',
  time_in: '', time_out: '',
  monthly_leave_allowed: '2',
  grace_time: '10',
  branch_id: '',
};

const AddStaffModal = ({ isOpen, onClose, onSuccess, staffToEdit }: Props) => {
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role_name === 'Admin';
  const [loading, setLoading]         = useState(false);
  const [users, setUsers]             = useState<any[]>([]);
  const [branches, setBranches]       = useState<{ store_id: number; store_name: string }[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [designations, setDesignations] = useState<any[]>([]);
  const [accounts, setAccounts]       = useState<Account[]>([]);
  const [components, setComponents]   = useState<CompState[]>([]);
  const [formErrors, setFormErrors]   = useState<Record<string, string>>({});
  const [formData, setFormData]       = useState({ ...EMPTY_FORM });

  useEffect(() => {
    if (!isOpen) return;
    setFormErrors({});
    fetchDropdowns();
    if (staffToEdit) {
      setFormData({
        user_id:               staffToEdit.user_id?.toString() || '',
        employee_id:           staffToEdit.employee_id || '',
        full_name:             staffToEdit.full_name,
        phone:                 staffToEdit.phone || '',
        email:                 staffToEdit.email || '',
        address:               staffToEdit.address || '',
        position:              staffToEdit.position || '',
        department:            staffToEdit.department || '',
        salary:                staffToEdit.salary?.toString() || '',
        salary_type:           staffToEdit.salary_type || 'monthly',
        hire_date:             staffToEdit.hire_date?.split('T')[0] || '',
        is_active:             staffToEdit.is_active,
        leave_balance:         (staffToEdit.leave_balance ?? 20).toString(),
        salary_account_id:     staffToEdit.salary_account_id || '',
        time_in:               staffToEdit.time_in || '',
        time_out:              staffToEdit.time_out || '',
        monthly_leave_allowed: (staffToEdit.monthly_leave_allowed ?? 2).toString(),
        grace_time:            (staffToEdit.grace_time ?? 10).toString(),
        branch_id:             staffToEdit.branch_id?.toString() || '',
      });
    } else {
      setFormData({ ...EMPTY_FORM, hire_date: localToday() });
    }
  }, [isOpen, staffToEdit]);

  // Re-fetch designations when department changes
  useEffect(() => {
    if (!isOpen) return;
    fetchDesignations(formData.department);
  }, [formData.department, isOpen]);

  const fetchDropdowns = async () => {
    try {
      const [usersRes, deptsRes, accsRes, compsRes, branchRes] = await Promise.all([
        api.get('/users').catch(() => ({ data: { data: [] } })),
        api.get('/staff/departments', { params: { is_active: 1 } }),
        api.get('/accounting/accounts', { params: { tree: 1 } }).catch(() => ({ data: { data: [] } })),
        api.get('/staff/salary-components').catch(() => ({ data: { data: [] } })),
        api.get('/stores').catch(() => ({ data: { data: [] } })),
      ]);
      setUsers(usersRes.data.data || []);
      setDepartments(deptsRes.data.data || []);
      setBranches((branchRes.data.data || []).filter((s: any) => s.is_active !== 0));

      const flatAccounts: Account[] = [];
      const flatten = (nodes: any[]) => nodes.forEach(n => {
        flatAccounts.push(n);
        if (n.children) flatten(n.children);
      });
      flatten(accsRes.data.data || []);
      setAccounts(flatAccounts);

      const allComps: any[] = (compsRes.data.data || []).filter((c: any) => c.is_active);

      if (staffToEdit) {
        const scRes = await api.get(`/staff/staff-components/${staffToEdit.staff_id}`).catch(() => ({ data: { data: [] } }));
        const staffComps: any[] = scRes.data.data || [];
        setComponents(allComps.map(c => {
          const sc = staffComps.find((s: any) => s.component_id === c.component_id);
          return {
            component_id:  c.component_id,
            name:          c.name,
            type:          c.type,
            calculation:   c.calculation,
            default_value: Number(c.default_value),
            custom_value:  sc ? String(sc.effective_value) : String(c.default_value),
            is_enabled:    sc ? sc.staff_active === 1 : false,
          };
        }));
      } else {
        setComponents(allComps.map(c => ({
          component_id:  c.component_id,
          name:          c.name,
          type:          c.type,
          calculation:   c.calculation,
          default_value: Number(c.default_value),
          custom_value:  String(c.default_value),
          is_enabled:    false,
        })));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDesignations = async (dept: string) => {
    try {
      const deptObj = departments.find(d => d.name === dept);
      const params: any = { is_active: 1 };
      if (deptObj) params.department_id = deptObj.department_id;
      const res = await api.get('/staff/designations', { params });
      setDesignations(res.data.data || []);
    } catch {
      setDesignations([]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      // Reset position if department changes
      ...(name === 'department' ? { position: '' } : {}),
    }));
    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.full_name.trim()) errors.full_name = 'Full name is required';
    if (!formData.hire_date) errors.hire_date = 'Hire date is required';
    if (formData.phone && !/^[\d+\-() ]{7,20}$/.test(formData.phone)) errors.phone = 'Invalid phone format';
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.email = 'Invalid email format';
    if (formData.salary && Number(formData.salary) < 0) errors.salary = 'Salary cannot be negative';
    if (isAdmin && !formData.branch_id) errors.branch_id = 'Branch is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const payload: any = {
        ...formData,
        user_id:               formData.user_id ? parseInt(formData.user_id) : null,
        salary:                formData.salary ? parseFloat(formData.salary) : null,
        is_active:             parseInt(formData.is_active.toString()),
        salary_account_id:     formData.salary_account_id || null,
        time_in:               formData.time_in || null,
        time_out:              formData.time_out || null,
        monthly_leave_allowed: parseInt(formData.monthly_leave_allowed) || 2,
        grace_time:            parseInt(formData.grace_time) || 10,
        branch_id:             formData.branch_id ? parseInt(formData.branch_id) : null,
      };

      let staffId: number;
      if (staffToEdit) {
        payload.leave_balance = parseInt(formData.leave_balance);
        await api.put(`/staff/${staffToEdit.staff_id}`, payload);
        staffId = staffToEdit.staff_id;
        toast.success('Staff member updated successfully');
      } else {
        delete payload.leave_balance;
        const res = await api.post('/staff', payload);
        staffId = res.data.staff_id;
        toast.success('Staff member added successfully');
      }

      if (components.length > 0) {
        await api.post(`/staff/staff-components/${staffId}`, {
          components: components.map(c => ({
            component_id: c.component_id,
            custom_value: c.is_enabled && c.custom_value !== '' ? parseFloat(c.custom_value) : null,
            is_active:    c.is_enabled ? 1 : 0,
          })),
        });
      }

      setFormData({ ...EMPTY_FORM, hire_date: localToday() });
      onSuccess();
      onClose();
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to save staff member';
      const field = error.response?.data?.field;
      if (field) setFormErrors(prev => ({ ...prev, [field]: msg }));
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const inp = (field: string) =>
    `w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm ${formErrors[field] ? 'border-red-400' : 'border-gray-200'}`;

  const sel = 'w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-5 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <User size={24} />
            <div>
              <h2 className="font-semibold">{staffToEdit ? 'Edit Staff Member' : 'Add New Staff Member'}</h2>
              <p className="text-emerald-100 text-xs mt-0.5">Fill all required fields</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white hover:bg-white/20 p-2 rounded-lg transition"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ── Link to User Account ── */}
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <User className="inline mr-1.5" size={14} /> Link to User Account <span className="font-normal text-gray-400">(Optional)</span>
            </label>
            <select name="user_id" value={formData.user_id} onChange={handleChange} className={sel}>
              <option value="">-- No User Account --</option>
              {users.map(u => (
                <option key={u.user_id} value={u.user_id}>{u.name} ({u.email}) — {u.role}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Link this staff member to a system user for login access</p>
          </div>

          {/* ── Personal Information ── */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide border-l-4 border-emerald-500 pl-3 mb-4">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Employee ID</label>
                <input type="text" name="employee_id" value={formData.employee_id} onChange={handleChange} className={inp('employee_id')} placeholder="e.g., EMP-001" />
                <p className="text-xs text-gray-400 mt-1">Used for attendance machine integration</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Full Name <span className="text-red-500">*</span></label>
                <input type="text" name="full_name" value={formData.full_name} onChange={handleChange} className={inp('full_name')} placeholder="Enter full name" />
                {formErrors.full_name && <p className="text-red-500 text-xs mt-1">{formErrors.full_name}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5"><Phone className="inline mr-1" size={12} />Phone Number</label>
                <input type="text" name="phone" value={formData.phone} onChange={handleChange} className={inp('phone')} placeholder="03XX-XXXXXXX" />
                {formErrors.phone && <p className="text-red-500 text-xs mt-1">{formErrors.phone}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5"><Mail className="inline mr-1" size={12} />Email Address</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} className={inp('email')} placeholder="email@example.com" />
                {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5"><MapPin className="inline mr-1" size={12} />Address</label>
                <input type="text" name="address" value={formData.address} onChange={handleChange} className={inp('address')} placeholder="Enter address" />
              </div>
            </div>
          </div>

          {/* ── Job Information ── */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide border-l-4 border-emerald-500 pl-3 mb-4">
              <Briefcase className="inline mr-1.5" size={14} />Job Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Department</label>
                <select name="department" value={formData.department} onChange={handleChange} className={sel}>
                  <option value="">-- Select Department --</option>
                  {departments.map(d => <option key={d.department_id} value={d.name}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Designation / Position</label>
                {designations.length > 0 ? (
                  <select name="position" value={formData.position} onChange={handleChange} className={sel}>
                    <option value="">-- Select Designation --</option>
                    {designations.map(d => <option key={d.designation_id} value={d.name}>{d.name}</option>)}
                  </select>
                ) : (
                  <input type="text" name="position" value={formData.position} onChange={handleChange} className={inp('position')}
                    placeholder={formData.department ? 'No designations — type manually' : 'Select department first'} />
                )}
                {formErrors.position && <p className="text-red-500 text-xs mt-1">{formErrors.position}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5"><Calendar className="inline mr-1" size={12} />Hire Date <span className="text-red-500">*</span></label>
                <input type="date" name="hire_date" value={formData.hire_date} onChange={handleChange} className={inp('hire_date')} />
                {formErrors.hire_date && <p className="text-red-500 text-xs mt-1">{formErrors.hire_date}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Status</label>
                <select name="is_active" value={formData.is_active} onChange={handleChange} className={sel}>
                  <option value={1}>Active</option>
                  <option value={0}>Inactive</option>
                </select>
              </div>
              {isAdmin && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Assign Branch <span className="text-red-500">*</span></label>
                  {branches.length === 0 ? (
                    <div className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm text-red-500 bg-red-50">
                      No active branches found.
                    </div>
                  ) : (
                    <select name="branch_id" value={formData.branch_id} onChange={handleChange} className={`${sel} ${formErrors.branch_id ? 'border-red-400' : ''}`}>
                      <option value="">— Select branch —</option>
                      {branches.map(b => (
                        <option key={b.store_id} value={b.store_id}>{b.store_name}</option>
                      ))}
                    </select>
                  )}
                  <p className="text-xs text-gray-400 mt-1">Staff will be assigned to this branch.</p>
                  {formErrors.branch_id && <p className="text-red-500 text-xs mt-1">{formErrors.branch_id}</p>}
                </div>
              )}
            </div>
          </div>

          {/* ── Attendance / Shift Settings ── */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide border-l-4 border-blue-500 pl-3 mb-4">
              <Clock className="inline mr-1.5" size={14} />Attendance & Shift Settings
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Time In</label>
                <input type="time" name="time_in" value={formData.time_in} onChange={handleChange} className={inp('time_in')} />
                <p className="text-xs text-gray-400 mt-1">Expected arrival</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Time Out</label>
                <input type="time" name="time_out" value={formData.time_out} onChange={handleChange} className={inp('time_out')} />
                <p className="text-xs text-gray-400 mt-1">Expected departure</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Grace Time (min)</label>
                <input type="number" name="grace_time" value={formData.grace_time} onChange={handleChange} min="0" max="60" className={inp('grace_time')} />
                <p className="text-xs text-gray-400 mt-1">Late arrival buffer</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Monthly Leaves</label>
                <input type="number" name="monthly_leave_allowed" value={formData.monthly_leave_allowed} onChange={handleChange} min="0" max="30" className={inp('monthly_leave_allowed')} />
                <p className="text-xs text-gray-400 mt-1">Free leaves/month</p>
              </div>
            </div>
            <p className="text-xs text-blue-600 mt-3 bg-blue-50 px-3 py-2 rounded-lg">
              Time In/Out will be used by the attendance machine integration to auto-match check-in and mark employees as present.
            </p>
          </div>

          {/* ── Salary Information ── */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide border-l-4 border-emerald-500 pl-3 mb-4">
              <DollarSign className="inline mr-1.5" size={14} />Salary Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Salary Amount</label>
                <input type="number" name="salary" value={formData.salary} onChange={handleChange} min="0" step="0.01" className={inp('salary')} placeholder="Enter salary amount" />
                {formErrors.salary && <p className="text-red-500 text-xs mt-1">{formErrors.salary}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Salary Type</label>
                <select name="salary_type" value={formData.salary_type} onChange={handleChange} className={sel}>
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              {staffToEdit && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Leave Balance (days)</label>
                  <input type="number" name="leave_balance" value={formData.leave_balance} onChange={handleChange} min="0" className={inp('leave_balance')} />
                  {formErrors.leave_balance && <p className="text-red-500 text-xs mt-1">{formErrors.leave_balance}</p>}
                </div>
              )}

              {/* Salary Credit Account */}
              <div className={staffToEdit ? '' : 'md:col-span-2'}>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Salary Account <span className="text-gray-400 font-normal">[CR] — Level 4</span>
                </label>
                <AccountSelector
                  accounts={accounts}
                  value={formData.salary_account_id}
                  onChange={v => setFormData(prev => ({ ...prev, salary_account_id: v }))}
                  placeholder="Select salary credit account..."
                />
                <p className="text-xs text-gray-400 mt-1">Account to credit when salary is paid (e.g. Salaries Payable)</p>
              </div>
            </div>
          </div>

          {/* ── Salary Components ── */}
          {components.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide border-l-4 border-violet-500 pl-3 mb-4">
                <DollarSign className="inline mr-1.5" size={14} />Salary Components
              </h3>
              <p className="text-xs text-gray-500 mb-4 bg-violet-50 px-3 py-2 rounded-lg border border-violet-100">
                Enable the allowances and deductions that apply to this employee. Enabled components will be included in the salary sheet calculation.
              </p>

              {/* Allowances */}
              {components.filter(c => c.type === 'allowance').length > 0 && (
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp size={13} className="text-blue-500" />
                    <span className="text-xs font-bold text-blue-600 uppercase tracking-wide">Allowances</span>
                  </div>
                  <div className="space-y-2">
                    {components.filter(c => c.type === 'allowance').map(comp => (
                      <div key={comp.component_id}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition ${comp.is_enabled ? 'border-blue-200 bg-blue-50' : 'border-gray-100 bg-gray-50'}`}>
                        <input
                          type="checkbox"
                          checked={comp.is_enabled}
                          onChange={e => setComponents(prev => prev.map(c =>
                            c.component_id === comp.component_id ? { ...c, is_enabled: e.target.checked } : c
                          ))}
                          className="w-4 h-4 accent-blue-500 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">{comp.name}</p>
                          <p className="text-xs text-gray-400">{comp.calculation === 'percentage' ? `% of basic salary` : 'Fixed amount'}</p>
                        </div>
                        {comp.is_enabled && (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={comp.custom_value}
                              onChange={e => setComponents(prev => prev.map(c =>
                                c.component_id === comp.component_id ? { ...c, custom_value: e.target.value } : c
                              ))}
                              className="w-28 px-2.5 py-1.5 border border-blue-200 rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-400 outline-none"
                            />
                            {comp.calculation === 'percentage' && <span className="text-xs text-gray-400">%</span>}
                          </div>
                        )}
                        {!comp.is_enabled && (
                          <span className="text-xs text-gray-400 font-mono">{comp.calculation === 'percentage' ? `${comp.default_value}%` : comp.default_value.toLocaleString()}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Deductions */}
              {components.filter(c => c.type === 'deduction').length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown size={13} className="text-orange-500" />
                    <span className="text-xs font-bold text-orange-600 uppercase tracking-wide">Deductions</span>
                  </div>
                  <div className="space-y-2">
                    {components.filter(c => c.type === 'deduction').map(comp => (
                      <div key={comp.component_id}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition ${comp.is_enabled ? 'border-orange-200 bg-orange-50' : 'border-gray-100 bg-gray-50'}`}>
                        <input
                          type="checkbox"
                          checked={comp.is_enabled}
                          onChange={e => setComponents(prev => prev.map(c =>
                            c.component_id === comp.component_id ? { ...c, is_enabled: e.target.checked } : c
                          ))}
                          className="w-4 h-4 accent-orange-500 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">{comp.name}</p>
                          <p className="text-xs text-gray-400">{comp.calculation === 'percentage' ? `% of basic salary` : 'Fixed amount'}</p>
                        </div>
                        {comp.is_enabled && (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={comp.custom_value}
                              onChange={e => setComponents(prev => prev.map(c =>
                                c.component_id === comp.component_id ? { ...c, custom_value: e.target.value } : c
                              ))}
                              className="w-28 px-2.5 py-1.5 border border-orange-200 rounded-lg text-sm text-right focus:ring-2 focus:ring-orange-400 outline-none"
                            />
                            {comp.calculation === 'percentage' && <span className="text-xs text-gray-400">%</span>}
                          </div>
                        )}
                        {!comp.is_enabled && (
                          <span className="text-xs text-gray-400 font-mono">{comp.calculation === 'percentage' ? `${comp.default_value}%` : comp.default_value.toLocaleString()}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </form>

        {/* Footer */}
        <div className="border-t border-gray-100 px-6 py-4 bg-gray-50 flex items-center justify-end gap-3 flex-shrink-0">
          <button type="button" onClick={onClose} className="px-5 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-100 transition text-sm">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={loading}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center gap-2">
            {loading && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {loading ? 'Saving...' : staffToEdit ? 'Update Staff Member' : 'Add Staff Member'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddStaffModal;
