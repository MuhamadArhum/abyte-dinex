import { useState, useEffect } from 'react';
import { X, DollarSign, Link2, Info } from 'lucide-react';
import api from '../utils/api';
import { localToday } from '../utils/dateUtils';
import { useToast } from './Toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const IssueLoanModal = ({ isOpen, onClose, onSuccess }: Props) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [staff, setStaff] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    staff_id: '',
    loan_amount: '',
    monthly_deduction: '',
    loan_date: localToday(),
    reason: '',
    debit_account_id: '',
    credit_account_id: '',
  });

  useEffect(() => {
    if (isOpen) {
      fetchStaff();
      fetchAccounts();
      setFormErrors({});
      setFormData({ staff_id: '', loan_amount: '', monthly_deduction: '', loan_date: localToday(), reason: '', debit_account_id: '', credit_account_id: '' });
    }
  }, [isOpen]);

  const fetchStaff = async () => {
    try {
      const res = await api.get('/staff', { params: { is_active: 1, limit: 200 } });
      setStaff(res.data.data || []);
    } catch { /* ignore */ }
  };

  const fetchAccounts = async () => {
    try {
      const res = await api.get('/accounting/accounts', { params: { tree: 1 } });
      const level4 = (res.data.data || []).filter((a: any) => a.level === 4 && a.is_active);
      setAccounts(level4);
    } catch { /* accounts not loaded — optional */ }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!formData.staff_id) errors.staff_id = 'Select a staff member';
    if (!formData.loan_amount || Number(formData.loan_amount) <= 0) errors.loan_amount = 'Valid amount required';
    if (!formData.loan_date) errors.loan_date = 'Date required';
    if (formData.monthly_deduction && Number(formData.monthly_deduction) < 0) errors.monthly_deduction = 'Cannot be negative';
    // if one account is set, both must be set
    if ((formData.debit_account_id && !formData.credit_account_id) || (!formData.debit_account_id && formData.credit_account_id)) {
      errors.debit_account_id = 'Both debit and credit accounts must be selected together';
    }
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      await api.post('/staff/loans', {
        staff_id: Number(formData.staff_id),
        loan_amount: Number(formData.loan_amount),
        monthly_deduction: Number(formData.monthly_deduction) || 0,
        loan_date: formData.loan_date,
        reason: formData.reason || null,
        debit_account_id: formData.debit_account_id ? Number(formData.debit_account_id) : null,
        credit_account_id: formData.credit_account_id ? Number(formData.credit_account_id) : null,
      });
      toast.success('Loan issued successfully' + (formData.debit_account_id ? ' — journal entry posted' : ''));
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to issue loan');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const inputClass = (field: string) =>
    `w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm ${formErrors[field] ? 'border-red-400' : 'border-gray-200'}`;

  const accountOptions = accounts.map(a => (
    <option key={a.account_id} value={a.account_id}>
      {a.account_code} — {a.account_name}
    </option>
  ));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-5 text-white flex items-center justify-between rounded-t-2xl sticky top-0">
          <div className="flex items-center gap-3">
            <DollarSign size={24} />
            <h2 className="text-base font-semibold">Issue New Loan</h2>
          </div>
          <button onClick={onClose} className="text-white hover:bg-white/20 p-2 rounded-lg transition"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Staff */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Staff Member *</label>
            <select name="staff_id" value={formData.staff_id} onChange={handleChange} className={inputClass('staff_id')}>
              <option value="">— Select Staff —</option>
              {staff.map(s => <option key={s.staff_id} value={s.staff_id}>{s.employee_id ? `[${s.employee_id}] ` : ''}{s.full_name} {s.position ? `(${s.position})` : ''}</option>)}
            </select>
            {formErrors.staff_id && <p className="text-red-500 text-xs mt-1">{formErrors.staff_id}</p>}
          </div>

          {/* Amount + Deduction */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Loan Amount *</label>
              <input type="number" name="loan_amount" value={formData.loan_amount} onChange={handleChange} min="0" step="0.01" placeholder="0.00" className={inputClass('loan_amount')} />
              {formErrors.loan_amount && <p className="text-red-500 text-xs mt-1">{formErrors.loan_amount}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Monthly Deduction</label>
              <input type="number" name="monthly_deduction" value={formData.monthly_deduction} onChange={handleChange} min="0" step="0.01" placeholder="0.00" className={inputClass('monthly_deduction')} />
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Loan Date *</label>
            <input type="date" name="loan_date" value={formData.loan_date} onChange={handleChange} className={inputClass('loan_date')} />
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Reason</label>
            <textarea name="reason" value={formData.reason} onChange={handleChange} rows={2}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm"
              placeholder="Reason for loan..." />
          </div>

          {/* Account Linking Section */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Link2 size={15} className="text-blue-600" />
              <span className="text-sm font-semibold text-blue-800">Account Integration</span>
              <span className="text-xs text-blue-500 font-normal">(optional)</span>
            </div>
            <p className="text-xs text-blue-600 flex items-start gap-1.5">
              <Info size={12} className="mt-0.5 shrink-0" />
              Linking Level 4 accounts will auto-post a journal entry and update account balances when the loan is issued and repaid.
            </p>

            <div>
              <label className="block text-xs font-semibold text-blue-700 mb-1.5 uppercase tracking-wide">Debit Account (Loan Receivable)</label>
              <select name="debit_account_id" value={formData.debit_account_id} onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent ${formErrors.debit_account_id ? 'border-red-400' : 'border-blue-200'}`}>
                <option value="">— No Account —</option>
                {accountOptions}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-blue-700 mb-1.5 uppercase tracking-wide">Credit Account (Cash / Bank)</label>
              <select name="credit_account_id" value={formData.credit_account_id} onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent ${formErrors.debit_account_id ? 'border-red-400' : 'border-blue-200'}`}>
                <option value="">— No Account —</option>
                {accountOptions}
              </select>
            </div>

            {formErrors.debit_account_id && (
              <p className="text-red-500 text-xs">{formErrors.debit_account_id}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-5 py-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition text-sm font-medium">Cancel</button>
            <button type="submit" disabled={loading}
              className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 text-sm font-medium flex items-center gap-2">
              {loading ? 'Issuing...' : 'Issue Loan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default IssueLoanModal;
