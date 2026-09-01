import { useState } from 'react';
import { X, DollarSign } from 'lucide-react';
import api from '../utils/api';
import { localToday } from '../utils/dateUtils';
import { useToast } from './Toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  loan: any;
}

const LoanRepaymentModal = ({ isOpen, onClose, onSuccess, loan }: Props) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    amount: '',
    repayment_date: localToday(),
    payment_method: 'cash' as string,
    notes: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!formData.amount || Number(formData.amount) <= 0) errors.amount = 'Valid amount required';
    if (Number(formData.amount) > Number(loan?.remaining_balance)) errors.amount = 'Exceeds remaining balance';
    if (!formData.repayment_date) errors.repayment_date = 'Date required';
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      await api.post(`/staff/loans/${loan.loan_id}/repay`, {
        amount: Number(formData.amount),
        repayment_date: formData.repayment_date,
        payment_method: formData.payment_method,
        notes: formData.notes || null
      });
      toast.success('Repayment recorded');
      setFormData({ amount: '', repayment_date: localToday(), payment_method: 'cash', notes: '' });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to record repayment');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !loan) return null;

  const inputClass = (field: string) =>
    `w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${formErrors[field] ? 'border-red-500' : 'border-gray-200'}`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-6 text-white flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <DollarSign size={24} />
            <div>
              <h2 className="text-sm font-semibold">Record Repayment</h2>
              <p className="text-emerald-200 text-sm">{loan.full_name} - Remaining: ${Number(loan.remaining_balance).toLocaleString()}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white hover:bg-white/20 p-2 rounded-lg transition"><X size={24} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Amount *</label>
            <input type="number" name="amount" value={formData.amount} onChange={handleChange} min="0" step="0.01"
              placeholder={`Max: ${Number(loan.remaining_balance).toLocaleString()}`} className={inputClass('amount')} />
            {formErrors.amount && <p className="text-red-500 text-xs mt-1">{formErrors.amount}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
            <input type="date" name="repayment_date" value={formData.repayment_date} onChange={handleChange} className={inputClass('repayment_date')} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
            <select name="payment_method" value={formData.payment_method} onChange={handleChange} className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500">
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="salary_deduction">Salary Deduction</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea name="notes" value={formData.notes} onChange={handleChange} rows={2} className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500" placeholder="Optional notes..." />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition">Cancel</button>
            <button type="submit" disabled={loading} className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50">
              {loading ? 'Recording...' : 'Record Repayment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoanRepaymentModal;
