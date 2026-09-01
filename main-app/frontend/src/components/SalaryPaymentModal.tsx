import { useState, useEffect } from 'react';
import { X, DollarSign, Calendar, Minus, Plus, FileText } from 'lucide-react';
import api from '../utils/api';
import { localToday } from '../utils/dateUtils';
import { useToast } from './Toast';

interface SalaryPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  staffMember: any;
}

const SalaryPaymentModal = ({ isOpen, onClose, onSuccess, staffMember }: SalaryPaymentModalProps) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    payment_date: localToday(),
    from_date: '',
    to_date: '',
    amount: '',
    deductions: '0',
    bonuses: '0',
    payment_method: 'bank_transfer',
    notes: ''
  });

  useEffect(() => {
    if (isOpen && staffMember) {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);

      setFormData(prev => ({
        ...prev,
        from_date: firstDay.toISOString().split('T')[0],
        to_date: lastDay.toISOString().split('T')[0],
        amount: staffMember.salary?.toString() || '0'
      }));
      setFormErrors({});
    }
  }, [isOpen, staffMember]);

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
    const net = calculateNetAmount();
    if (net < 0) errors.amount = 'Net amount cannot be negative';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const netAmount = calculateNetAmount();
      const paymentData = {
        payment_date: formData.payment_date,
        from_date: formData.from_date,
        to_date: formData.to_date,
        amount: parseFloat(formData.amount),
        deductions: parseFloat(formData.deductions),
        bonuses: parseFloat(formData.bonuses),
        net_amount: netAmount,
        payment_method: formData.payment_method,
        notes: formData.notes || null
      };

      await api.post(`/staff/${staffMember.staff_id}/salary-payment`, paymentData);
      toast.success('Salary payment recorded successfully');
      resetForm();
      onSuccess();
      onClose();
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to record salary payment';
      const field = error.response?.data?.field;
      if (field) setFormErrors(prev => ({ ...prev, [field]: msg }));
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      payment_date: localToday(),
      from_date: '',
      to_date: '',
      amount: '',
      deductions: '0',
      bonuses: '0',
      payment_method: 'bank_transfer',
      notes: ''
    });
    setFormErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen || !staffMember) return null;

  const netAmount = calculateNetAmount();

  const inputClass = (field: string) =>
    `w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${formErrors[field] ? 'border-red-500' : 'border-gray-200'}`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DollarSign size={28} />
            <div>
              <h2 className="text-base font-semibold">Record Salary Payment</h2>
              <p className="text-emerald-100 text-sm mt-1">
                {staffMember.full_name} - {staffMember.position}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="text-white hover:bg-white/20 p-2 rounded-lg transition">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Payment Period */}
            <div className="border-l-4 border-emerald-500 pl-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Calendar size={20} />
                Payment Period
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">From Date *</label>
                  <input
                    type="date"
                    name="from_date"
                    value={formData.from_date}
                    onChange={handleChange}
                    className={inputClass('from_date')}
                  />
                  {formErrors.from_date && <p className="text-red-500 text-xs mt-1">{formErrors.from_date}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">To Date *</label>
                  <input
                    type="date"
                    name="to_date"
                    value={formData.to_date}
                    onChange={handleChange}
                    className={inputClass('to_date')}
                  />
                  {formErrors.to_date && <p className="text-red-500 text-xs mt-1">{formErrors.to_date}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Payment Date *</label>
                  <input
                    type="date"
                    name="payment_date"
                    value={formData.payment_date}
                    onChange={handleChange}
                    className={inputClass('payment_date')}
                  />
                  {formErrors.payment_date && <p className="text-red-500 text-xs mt-1">{formErrors.payment_date}</p>}
                </div>
              </div>
            </div>

            {/* Payment Details */}
            <div className="border-l-4 border-emerald-500 pl-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <DollarSign size={20} />
                Payment Details
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Base Salary Amount *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      name="amount"
                      value={formData.amount}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      className={`${inputClass('amount')} pl-12`}
                      placeholder="0.00"
                    />
                  </div>
                  {formErrors.amount && <p className="text-red-500 text-xs mt-1">{formErrors.amount}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                      <Minus size={16} className="text-red-600" />
                      Deductions
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        name="deductions"
                        value={formData.deductions}
                        onChange={handleChange}
                        min="0"
                        step="0.01"
                        className={`${inputClass('deductions')} pl-12`}
                        placeholder="0.00"
                      />
                    </div>
                    {formErrors.deductions && <p className="text-red-500 text-xs mt-1">{formErrors.deductions}</p>}
                    <p className="text-xs text-gray-500 mt-1">Taxes, fines, advances, etc.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                      <Plus size={16} className="text-green-600" />
                      Bonuses
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        name="bonuses"
                        value={formData.bonuses}
                        onChange={handleChange}
                        min="0"
                        step="0.01"
                        className={`${inputClass('bonuses')} pl-12`}
                        placeholder="0.00"
                      />
                    </div>
                    {formErrors.bonuses && <p className="text-red-500 text-xs mt-1">{formErrors.bonuses}</p>}
                    <p className="text-xs text-gray-500 mt-1">Performance bonus, overtime, etc.</p>
                  </div>
                </div>

                {/* Net Amount Display */}
                <div className="bg-gradient-to-r from-emerald-50 to-emerald-50 border-2 border-emerald-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold text-gray-700">Net Amount:</span>
                    <span className={`text-2xl font-bold ${netAmount >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      ${netAmount.toFixed(0)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 mt-2">
                    = Base ({parseFloat(formData.amount) || 0}) - Deductions ({parseFloat(formData.deductions) || 0}) + Bonuses ({parseFloat(formData.bonuses) || 0})
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Method & Notes */}
            <div className="border-l-4 border-yellow-500 pl-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <FileText size={20} />
                Additional Information
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                  <select
                    name="payment_method"
                    value={formData.payment_method}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="Any additional notes..."
                  />
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            disabled={loading || netAmount < 0}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SalaryPaymentModal;
