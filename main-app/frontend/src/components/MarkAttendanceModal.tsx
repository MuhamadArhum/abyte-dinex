import { useState, useEffect } from 'react';
import { X, Calendar, Clock, User, CheckCircle } from 'lucide-react';
import api from '../utils/api';
import { localToday } from '../utils/dateUtils';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmDialog';

interface MarkAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const MarkAttendanceModal = ({ isOpen, onClose, onSuccess }: MarkAttendanceModalProps) => {
  const toast = useToast();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);
  const [staff, setStaff] = useState<any[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<number | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    attendance_date: localToday(),
    check_in: '',
    check_out: '',
    status: 'present',
    notes: ''
  });

  // Bulk marking
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('present');

  useEffect(() => {
    if (isOpen) {
      fetchStaff();
      setFormErrors({});
    }
  }, [isOpen]);

  const fetchStaff = async () => {
    try {
      const res = await api.get('/staff', { params: { is_active: 1, limit: 100 } });
      setStaff(res.data.data || []);
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }));
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!selectedStaff) errors.staff = 'Please select a staff member';
    if (!formData.attendance_date) errors.attendance_date = 'Date is required';
    if (formData.check_in && formData.check_out && formData.check_in >= formData.check_out) {
      errors.check_out = 'Check out must be after check in';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const attendanceData = {
        staff_id: selectedStaff,
        attendance_date: formData.attendance_date,
        check_in: formData.check_in || null,
        check_out: formData.check_out || null,
        status: formData.status,
        notes: formData.notes || null
      };

      await api.post('/staff/attendance', attendanceData);
      toast.success('Attendance marked successfully');
      resetForm();
      onSuccess();
      onClose();
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to mark attendance';
      const field = error.response?.data?.field;
      if (field) setFormErrors(prev => ({ ...prev, [field]: msg }));
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkMark = async () => {
    if (staff.length === 0) {
      toast.error('No staff members found');
      return;
    }

    const ok = await confirm({ title: 'Bulk Mark Attendance', message: `Mark all ${staff.length} active staff members as ${bulkStatus}?`, type: 'warning' });
    if (!ok) return;

    setLoading(true);
    try {
      const bulkData = staff.map(member => ({
        staff_id: member.staff_id,
        attendance_date: formData.attendance_date,
        check_in: bulkStatus === 'present' ? '09:00' : null,
        check_out: bulkStatus === 'present' ? '17:00' : null,
        status: bulkStatus,
        notes: `Bulk marked as ${bulkStatus}`
      }));

      await api.post('/staff/attendance/bulk', { records: bulkData });
      toast.success(`Attendance marked for ${staff.length} staff members`);
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to mark bulk attendance');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedStaff(null);
    setFormData({
      attendance_date: localToday(),
      check_in: '',
      check_out: '',
      status: 'present',
      notes: ''
    });
    setBulkMode(false);
    setBulkStatus('present');
    setFormErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  const inputClass = (field: string) =>
    `w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${formErrors[field] ? 'border-red-500' : 'border-gray-200'}`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle size={28} />
            <div>
              <h2 className="text-base font-semibold">Mark Attendance</h2>
              <p className="text-emerald-100 text-sm mt-1">Record staff attendance</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-white hover:bg-white/20 p-2 rounded-lg transition">
            <X size={24} />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="bg-gray-50 border-b border-gray-200 p-4">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setBulkMode(false);
                resetForm();
              }}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                !bulkMode
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              Single Marking
            </button>
            <button
              onClick={() => {
                setBulkMode(true);
                resetForm();
              }}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                bulkMode
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              Bulk Marking
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!bulkMode ? (
            /* Single Marking Form */
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="inline mr-1" size={16} />
                  Attendance Date *
                </label>
                <input
                  type="date"
                  name="attendance_date"
                  value={formData.attendance_date}
                  onChange={handleChange}
                  className={inputClass('attendance_date')}
                />
                {formErrors.attendance_date && <p className="text-red-500 text-xs mt-1">{formErrors.attendance_date}</p>}
              </div>

              {/* Staff Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="inline mr-1" size={16} />
                  Select Staff Member *
                </label>
                <select
                  value={selectedStaff || ''}
                  onChange={(e) => {
                    setSelectedStaff(Number(e.target.value));
                    if (formErrors.staff) setFormErrors(prev => ({ ...prev, staff: '' }));
                  }}
                  className={inputClass('staff')}
                >
                  <option value="">-- Select Staff --</option>
                  {staff.map(member => (
                    <option key={member.staff_id} value={member.staff_id}>
                      {member.full_name} - {member.position}
                    </option>
                  ))}
                </select>
                {formErrors.staff && <p className="text-red-500 text-xs mt-1">{formErrors.staff}</p>}
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status *
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="half_day">Half Day</option>
                  <option value="leave">On Leave</option>
                  <option value="holiday">Holiday</option>
                </select>
              </div>

              {/* Times */}
              {(formData.status === 'present' || formData.status === 'half_day') && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Clock className="inline mr-1" size={16} />
                      Check In Time
                    </label>
                    <input
                      type="time"
                      name="check_in"
                      value={formData.check_in}
                      onChange={handleChange}
                      className={inputClass('check_in')}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Clock className="inline mr-1" size={16} />
                      Check Out Time
                    </label>
                    <input
                      type="time"
                      name="check_out"
                      value={formData.check_out}
                      onChange={handleChange}
                      className={inputClass('check_out')}
                    />
                    {formErrors.check_out && <p className="text-red-500 text-xs mt-1">{formErrors.check_out}</p>}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Any additional notes..."
                />
              </div>
            </form>
          ) : (
            /* Bulk Marking */
            <div className="space-y-6">
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4">
                <p className="text-sm text-emerald-800">
                  <strong>Bulk Marking:</strong> This will mark attendance for all active staff members with the same status.
                </p>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="inline mr-1" size={16} />
                  Attendance Date *
                </label>
                <input
                  type="date"
                  name="attendance_date"
                  value={formData.attendance_date}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              {/* Bulk Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mark All As *
                </label>
                <select
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                  <option value="holiday">Holiday</option>
                </select>
              </div>

              {/* Staff List Preview */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Will mark {staff.length} staff members:
                </p>
                <div className="bg-gray-50 rounded-lg p-4 max-h-48 overflow-y-auto border border-gray-200">
                  <div className="space-y-1">
                    {staff.map(member => (
                      <div key={member.staff_id} className="text-sm text-gray-700 flex items-center gap-2">
                        <CheckCircle size={14} className="text-green-600" />
                        {member.full_name} - {member.position}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition"
          >
            Cancel
          </button>

          {!bulkMode ? (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : 'Mark Attendance'}
            </button>
          ) : (
            <button
              onClick={handleBulkMark}
              disabled={loading}
              className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : `Mark All as ${bulkStatus}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MarkAttendanceModal;
