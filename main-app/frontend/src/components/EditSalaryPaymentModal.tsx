import { useState, useEffect } from 'react';
import { X, DollarSign, Edit } from 'lucide-react';
import api from '../utils/api';
import { useToast } from './Toast';

interface PaymentRecord {
  payment_id: number;
  staff_id: number;
  payment_date: string;
  from_date: string;
  to_date: string;
  amount: number;
  deductions: number;
  bonuses: number;
  net_amount: number;
  payment_method: string;
  notes: string | null;
}

interface EditSalaryPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  payment: PaymentRecord | null;
  staffName: string;
}

const EditSalaryPaymentModal = ({ isOpen, onClose, onSuccess, payment, staffName }: EditSalaryPaymentModalProps) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    payment_date: '',
    from_date: '',
    to_date: '',
    amount: '',
    deductions: '0',
    bonuses: '0',
    payment_method: 'bank_transfer',
    notes: ''
  });

  useEffect(() => {
    if (isOpen && payment) {
      setFormData({
        payment_date: payment.payment_date?.split('T')[0] || '',
        from_date: payment.from_date?.split('T')[0] || '',
        to_date: payment.to_date?.split('T')[0] || '',
        amount: Number(payment.amount).toString(),
        deductions: Number(payment.deductions).toString(),
        bonuses: Number(payment.bonuses).toString(),
        payment_method: payment.payment_method || 'bank_transfer',
        notes: payment.notes || ''
      });
      setFormErrors({});
    }
  }, [isOpen, payment]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }));
  };

  const calculateNetAmount = () => {
    const amount = parseFloat(formData.amount) || 0;
    const deductions = parseFloat(formData.deductions) || 0;
    const bonuses = parseFloat(formData.bonuses) || 0;
    return amount - deductions + bonuses;
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.payment_date) errors.payment_date = 'Payment date required';
    if (!formData.from_date) errors.from_date = 'From date required';
    if (!formData.to_date) errors.to_date = 'To date required';
    if (formData.from_date && formData.to_date && formData.from_date > formData.to_date) {
      errors.to_date = 'To date must be after from date';
    }
    if (!formData.amount || Number(formData.amount) <= 0) errors.amount = 'Valid amount required';
    if (Number(formData.deductions) < 0) errors.deductions = 'Cannot be negative';
    if (Number(formData.bonuses) < 0) errors.bonuses = 'Cannot be negative';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payment || !validate()) return;

    setLoading(true);
    try {
      const netAmount = calculateNetAmount();
      await api.put(`/staff/salary-payment/${payment.payment_id}`, {
        payment_date: formData.payment_date,
        from_date: formData.from_date,
        to_date: formData.to_date,
        amount: parseFloat(formData.amount),
        deductions: parseFloat(formData.deductions) || 0,
        bonuses: parseFloat(formData.bonuses) || 0,
        net_amount: netAmount,
        payment_method: formData.payment_method,
        notes: formData.notes || null
      });
      toast.success('Salary payment updated');
      onSuccess();
      onClose();
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to update';
      const field = error.response?.data?.field;
      if (field) setFormErrors(prev => ({ ...prev, [field]: msg }));
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !payment) return null;

  const netAmount = calculateNetAmount();
  const inputClass = (field: string) =>
    `w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${formErrors[field] ? 'border-red-500' : 'border-gray-200'}`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-600 p-6 rounded-t-2xl flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Edit className="text-white" size={24} />
            <div>
              <h2 className="text-base font-semibold text-white">Edit Salary Payment</h2>
              <p className="text-emerald-200 text-sm">{staffName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date *</label>
            <input type="date" name="payment_date" value={formData.payment_date} onChange={handleChange} className={inputClass('payment_date')} />
            {formErrors.payment_date && <p className="text-red-500 text-xs mt-1">{formErrors.payment_date}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Date *</label>
              <input type="date" name="from_date" value={formData.from_date} onChange={handleChange} className={inputClass('from_date')} />
              {formErrors.from_date && <p className="text-red-500 text-xs mt-1">{formErrors.from_date}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Date *</label>
              <input type="date" name="to_date" value={formData.to_date} onChange={handleChange} className={inputClass('to_date')} />
              {formErrors.to_date && <p className="text-red-500 text-xs mt-1">{formErrors.to_date}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Base Amount *</label>
            <div className="relative">
              <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="number" name="amount" value={formData.amount} onChange={handleChange} step="0.01" min="0" className={`${inputClass('amount')} pl-9`} />
            </div>
            {formErrors.amount && <p className="text-red-500 text-xs mt-1">{formErrors.amount}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Deductions</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-red-400 text-sm">-$</span>
                <input type="number" name="deductions" value={formData.deductions} onChange={handleChange} step="0.01" min="0" className={`${inputClass('deductions')} pl-9`} />
              </div>
              {formErrors.deductions && <p className="text-red-500 text-xs mt-1">{formErrors.deductions}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bonuses</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-500 text-sm">+$</span>
                <input type="number" name="bonuses" value={formData.bonuses} onChange={handleChange} step="0.01" min="0" className={`${inputClass('bonuses')} pl-9`} />
              </div>
              {formErrors.bonuses && <p className="text-red-500 text-xs mt-1">{formErrors.bonuses}</p>}
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-500">Net Amount</p>
            <p className={`text-2xl font-bold ${netAmount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              ${netAmount.toFixed(0)}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <select name="payment_method" value={formData.payment_method} onChange={handleChange} className={inputClass('payment_method')}>
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea name="notes" value={formData.notes} onChange={handleChange} rows={2} className={`${inputClass('notes')} resize-none`} placeholder="Optional notes..." />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-600 to-emerald-600 text-white rounded-lg hover:from-emerald-700 hover:to-emerald-700 transition-all disabled:opacity-50">
              {loading ? 'Saving...' : 'Update Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditSalaryPaymentModal;
