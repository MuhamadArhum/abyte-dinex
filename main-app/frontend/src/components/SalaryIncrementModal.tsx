import { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { X, TrendingUp } from 'lucide-react';
import api from '../utils/api';
import { localToday } from '../utils/dateUtils';
import { useToast } from './Toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  staffMember?: any;
}

const SalaryIncrementModal = ({ isOpen, onClose, onSuccess, staffMember }: Props) => {
  const { currencySymbol: currency } = useSettings();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [staff, setStaff] = useState<any[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    staff_id: '',
    new_salary: '',
    effective_date: localToday(),
    reason: ''
  });

  useEffect(() => {
    if (isOpen) {
      setFormErrors({});
      if (staffMember) {
        setSelectedStaff(staffMember);
        setFormData(prev => ({
          ...prev,
          staff_id: staffMember.staff_id.toString(),
          new_salary: ''
        }));
      } else {
        fetchStaff();
        setFormData({ staff_id: '', new_salary: '', effective_date: localToday(), reason: '' });
        setSelectedStaff(null);
      }
    }
  }, [isOpen, staffMember]);

  const fetchStaff = async () => {
    try {
      const res = await api.get('/staff', { params: { is_active: 1, limit: 100 } });
      setStaff(res.data.data || []);
    } catch (err) { console.error(err); }
  };

  const handleStaffChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setFormData(prev => ({ ...prev, staff_id: id, new_salary: '' }));
    setSelectedStaff(id ? staff.find(s => s.staff_id === Number(id)) : null);
    if (formErrors.staff_id) setFormErrors(prev => ({ ...prev, staff_id: '' }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }));
  };

  const currentSalary = Number(selectedStaff?.salary || 0);
  const newSalary = Number(formData.new_salary || 0);
  const incrementAmount = newSalary - currentSalary;
  const incrementPercentage = currentSalary > 0 ? ((incrementAmount / currentSalary) * 100) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!formData.staff_id) errors.staff_id = 'Select a staff member';
    if (!formData.new_salary || newSalary <= 0) errors.new_salary = 'Valid salary required';
    if (!formData.effective_date) errors.effective_date = 'Date required';
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      await api.post('/staff/increments', {
        staff_id: Number(formData.staff_id),
        new_salary: newSalary,
        effective_date: formData.effective_date,
        reason: formData.reason || null
      });
      toast.success(`Salary updated: $${currentSalary} → $${newSalary}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to apply increment');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const inputClass = (field: string) =>
    `w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${formErrors[field] ? 'border-red-500' : 'border-gray-200'}`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-6 text-white flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <TrendingUp size={28} />
            <h2 className="text-base font-semibold">Salary Increment</h2>
          </div>
          <button onClick={onClose} className="text-white hover:bg-white/20 p-2 rounded-lg transition"><X size={24} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Staff Selection */}
          {!staffMember ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Staff Member *</label>
              <select value={formData.staff_id} onChange={handleStaffChange} className={inputClass('staff_id')}>
                <option value="">-- Select Staff --</option>
                {staff.map(s => <option key={s.staff_id} value={s.staff_id}>{s.full_name} - ${Number(s.salary || 0).toLocaleString()}/{s.salary_type}</option>)}
              </select>
              {formErrors.staff_id && <p className="text-red-500 text-xs mt-1">{formErrors.staff_id}</p>}
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <p className="text-sm text-gray-600">Staff Member</p>
              <p className="text-lg font-bold text-gray-800">{staffMember.full_name}</p>
              <p className="text-sm text-gray-500">{staffMember.position} - {staffMember.department}</p>
            </div>
          )}

          {/* Current Salary */}
          {selectedStaff && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm text-gray-600">Current Salary</p>
              <p className="text-2xl font-bold text-gray-800">{currency}{currentSalary.toLocaleString()} <span className="text-sm font-normal text-gray-500">/ {selectedStaff.salary_type}</span></p>
            </div>
          )}

          {/* New Salary */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">New Salary *</label>
            <input type="number" name="new_salary" value={formData.new_salary} onChange={handleChange} min="0" step="0.01" placeholder="Enter new salary" className={inputClass('new_salary')} />
            {formErrors.new_salary && <p className="text-red-500 text-xs mt-1">{formErrors.new_salary}</p>}
          </div>

          {/* Increment Preview */}
          {selectedStaff && formData.new_salary && (
            <div className={`border-2 rounded-lg p-4 ${incrementAmount >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Change:</span>
                <span className={`text-lg font-bold ${incrementAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {incrementAmount >= 0 ? '+' : ''}{incrementAmount.toLocaleString()} ({incrementPercentage.toFixed(1)}%)
                </span>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Effective Date *</label>
            <input type="date" name="effective_date" value={formData.effective_date} onChange={handleChange} className={inputClass('effective_date')} />
            {formErrors.effective_date && <p className="text-red-500 text-xs mt-1">{formErrors.effective_date}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
            <textarea name="reason" value={formData.reason} onChange={handleChange} rows={2} className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500" placeholder="Annual increment, promotion, etc." />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition">Cancel</button>
            <button type="submit" disabled={loading} className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50">
              {loading ? 'Applying...' : 'Apply Increment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SalaryIncrementModal;
