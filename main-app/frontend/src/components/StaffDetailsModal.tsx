import { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { X, User, Calendar, DollarSign, TrendingUp, Edit, Trash2, BarChart3, CreditCard, Printer } from 'lucide-react';
import api from '../utils/api';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import EditSalaryPaymentModal from './EditSalaryPaymentModal';
import SalarySlipModal from './SalarySlipModal';

interface StaffDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffId: number;
}

const StaffDetailsModal = ({ isOpen, onClose, staffId }: StaffDetailsModalProps) => {
  const { currencySymbol: currency } = useSettings();
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const isAdmin = (user?.role_name || user?.role) === 'Admin';

  const [staff, setStaff] = useState<any>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [salaryHistory, setSalaryHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'attendance' | 'salary' | 'performance' | 'loans' | 'increments'>('info');
  const [showEditPayment, setShowEditPayment] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [loanHistory, setLoanHistory] = useState<any[]>([]);
  const [incrementHistory, setIncrementHistory] = useState<any[]>([]);
  const [showSalarySlip, setShowSalarySlip] = useState(false);
  const [slipPayment, setSlipPayment] = useState<any>(null);

  useEffect(() => {
    if (isOpen && staffId) {
      fetchStaffDetails();
      fetchAttendanceHistory();
      fetchSalaryHistory();
      fetchLoanHistory();
      fetchIncrementHistory();
    }
  }, [isOpen, staffId]);

  const fetchStaffDetails = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/staff/${staffId}`);
      setStaff(res.data);
    } catch (error) {
      console.error('Error fetching staff details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceHistory = async () => {
    try {
      const res = await api.get(`/staff/${staffId}/attendance`, { params: { limit: 60 } });
      setAttendanceHistory(res.data.data || []);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  const fetchSalaryHistory = async () => {
    try {
      const res = await api.get(`/staff/${staffId}/salary-payments`, { params: { limit: 20 } });
      setSalaryHistory(res.data.data || []);
    } catch (error) {
      console.error('Error fetching salary history:', error);
    }
  };

  const fetchLoanHistory = async () => {
    try {
      const res = await api.get('/staff/loans', { params: { staff_id: staffId, limit: 50 } });
      setLoanHistory(res.data.data || []);
    } catch (error) { console.error('Error fetching loans:', error); }
  };

  const fetchIncrementHistory = async () => {
    try {
      const res = await api.get('/staff/increments', { params: { staff_id: staffId, limit: 50 } });
      setIncrementHistory(res.data.data || []);
    } catch (error) { console.error('Error fetching increments:', error); }
  };

  const handleDeletePayment = async (payment: any) => {
    const ok = await confirm({ title: 'Delete Salary Payment', message: `Delete salary payment of $${Number(payment.net_amount).toFixed(0)}?`, type: 'danger' });
    if (!ok) return;
    try {
      await api.delete(`/staff/salary-payment/${payment.payment_id}`);
      toast.success('Salary payment deleted');
      fetchSalaryHistory();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete');
    }
  };

  const getAttendanceStats = () => {
    if (attendanceHistory.length === 0) return { present: 0, absent: 0, halfDay: 0, leave: 0 };
    return attendanceHistory.reduce((acc, record) => {
      if (record.status === 'present') acc.present++;
      else if (record.status === 'absent') acc.absent++;
      else if (record.status === 'half_day') acc.halfDay++;
      else if (record.status === 'leave') acc.leave++;
      return acc;
    }, { present: 0, absent: 0, halfDay: 0, leave: 0 });
  };

  const getPerformanceMetrics = () => {
    if (attendanceHistory.length === 0) return null;
    const totalDays = attendanceHistory.filter(r => r.status !== 'holiday').length;
    const presentDays = attendanceHistory.filter(r => r.status === 'present').length;
    const halfDays = attendanceHistory.filter(r => r.status === 'half_day').length;
    const attendanceRate = totalDays > 0 ? ((presentDays + halfDays * 0.5) / totalDays * 100) : 0;

    const onTimeCount = attendanceHistory.filter(r =>
      r.check_in && r.check_in <= '09:00' && (r.status === 'present' || r.status === 'half_day')
    ).length;
    const attendedDays = attendanceHistory.filter(r => r.check_in).length;
    const punctualityRate = attendedDays > 0 ? (onTimeCount / attendedDays * 100) : 0;

    let totalHours = 0, overtimeHours = 0;
    attendanceHistory.forEach(r => {
      if (r.check_in && r.check_out) {
        const [inH, inM] = r.check_in.split(':').map(Number);
        const [outH, outM] = r.check_out.split(':').map(Number);
        const hours = (outH * 60 + outM - inH * 60 - inM) / 60;
        totalHours += hours;
        if (hours > 8) overtimeHours += hours - 8;
      }
    });

    return { attendanceRate, punctualityRate, totalHours, overtimeHours, totalDays, presentDays, attendedDays };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-700';
      case 'absent': return 'bg-red-100 text-red-700';
      case 'half_day': return 'bg-yellow-100 text-yellow-700';
      case 'leave': return 'bg-emerald-100 text-emerald-700';
      case 'holiday': return 'bg-emerald-100 text-emerald-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const handleClose = () => {
    setStaff(null);
    setAttendanceHistory([]);
    setSalaryHistory([]);
    setLoanHistory([]);
    setIncrementHistory([]);
    setActiveTab('info');
    onClose();
  };

  if (!isOpen) return null;

  const stats = getAttendanceStats();
  const metrics = getPerformanceMetrics();

  const tabs = [
    { id: 'info' as const, label: 'Info', icon: User },
    { id: 'attendance' as const, label: 'Attendance', icon: Calendar },
    { id: 'salary' as const, label: 'Salary', icon: DollarSign },
    { id: 'loans' as const, label: 'Loans', icon: CreditCard },
    { id: 'increments' as const, label: 'Increments', icon: TrendingUp },
    { id: 'performance' as const, label: 'Performance', icon: BarChart3 },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <User size={28} />
            <div>
              <h2 className="text-base font-semibold">Staff Details</h2>
              {staff && <p className="text-emerald-100 text-sm mt-1">{staff.full_name} - {staff.position}</p>}
            </div>
          </div>
          <button onClick={handleClose} className="text-white hover:bg-white/20 p-2 rounded-lg transition">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 bg-gray-50">
          <div className="flex">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-4 px-4 text-center font-medium transition text-sm ${
                  activeTab === tab.id ? 'bg-white text-emerald-600 border-b-2 border-emerald-600' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="inline mr-1.5" size={16} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading details...</p>
            </div>
          ) : (
            <>
              {/* Personal Info Tab */}
              {activeTab === 'info' && staff && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <p className="text-sm text-gray-600 mb-1">Employee ID</p>
                      <p className="text-lg font-semibold text-gray-800">{staff.employee_id || '-'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <p className="text-sm text-gray-600 mb-1">Full Name</p>
                      <p className="text-lg font-semibold text-gray-800">{staff.full_name}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <p className="text-sm text-gray-600 mb-1">Position</p>
                      <p className="text-lg font-semibold text-gray-800">{staff.position || '-'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <p className="text-sm text-gray-600 mb-1">Department</p>
                      <p className="text-lg font-semibold text-gray-800">{staff.department || '-'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <p className="text-sm text-gray-600 mb-1">Phone</p>
                      <p className="text-lg font-semibold text-gray-800">{staff.phone || '-'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <p className="text-sm text-gray-600 mb-1">Email</p>
                      <p className="text-lg font-semibold text-gray-800">{staff.email || '-'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <p className="text-sm text-gray-600 mb-1">Hire Date</p>
                      <p className="text-lg font-semibold text-gray-800">{new Date(staff.hire_date).toLocaleDateString()}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <p className="text-sm text-gray-600 mb-1">Salary</p>
                      <p className="text-lg font-semibold text-gray-800">{currency}{Number(staff.salary || 0).toFixed(0)} / {staff.salary_type}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <p className="text-sm text-gray-600 mb-1">Status</p>
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${staff.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {staff.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <p className="text-sm text-gray-600 mb-1">Leave Balance</p>
                      <p className={`text-lg font-semibold ${
                        (staff.leave_balance ?? 20) > 5 ? 'text-green-700' :
                        (staff.leave_balance ?? 20) > 0 ? 'text-yellow-700' : 'text-red-700'
                      }`}>
                        {staff.leave_balance ?? 20} days remaining
                      </p>
                    </div>
                  </div>
                  {staff.address && (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <p className="text-sm text-gray-600 mb-1">Address</p>
                      <p className="text-gray-800">{staff.address}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Attendance History Tab */}
              {activeTab === 'attendance' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                      <p className="text-sm text-green-600 mb-1">Present</p>
                      <p className="text-2xl font-bold text-green-700">{stats.present}</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4 border border-red-100">
                      <p className="text-sm text-red-600 mb-1">Absent</p>
                      <p className="text-2xl font-bold text-red-700">{stats.absent}</p>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-100">
                      <p className="text-sm text-yellow-600 mb-1">Half Day</p>
                      <p className="text-2xl font-bold text-yellow-700">{stats.halfDay}</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100">
                      <p className="text-sm text-emerald-600 mb-1">Leave</p>
                      <p className="text-2xl font-bold text-emerald-700">{stats.leave}</p>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left p-4 font-semibold text-gray-700">Date</th>
                          <th className="text-center p-4 font-semibold text-gray-700">Check In</th>
                          <th className="text-center p-4 font-semibold text-gray-700">Check Out</th>
                          <th className="text-center p-4 font-semibold text-gray-700">Hours</th>
                          <th className="text-center p-4 font-semibold text-gray-700">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceHistory.length > 0 ? (
                          attendanceHistory.map((record: any) => {
                            let hrs = null;
                            if (record.check_in && record.check_out) {
                              const [inH, inM] = record.check_in.split(':').map(Number);
                              const [outH, outM] = record.check_out.split(':').map(Number);
                              const h = (outH * 60 + outM - inH * 60 - inM) / 60;
                              hrs = { hours: Math.round(h * 100) / 100, isOvertime: h > 8 };
                            }
                            return (
                              <tr key={record.attendance_id} className="border-t hover:bg-gray-50">
                                <td className="p-4 font-medium">{new Date(record.attendance_date).toLocaleDateString()}</td>
                                <td className="p-4 text-center font-mono text-sm">{record.check_in || '-'}</td>
                                <td className="p-4 text-center font-mono text-sm">{record.check_out || '-'}</td>
                                <td className="p-4 text-center font-mono text-sm">
                                  {hrs ? (
                                    <span className={hrs.isOvertime ? 'text-orange-600 font-bold' : ''}>
                                      {hrs.hours.toFixed(1)}h{hrs.isOvertime && <span className="text-xs ml-1">(OT)</span>}
                                    </span>
                                  ) : '-'}
                                </td>
                                <td className="p-4 text-center">
                                  <span className={`px-3 py-1 rounded-full text-sm font-semibold capitalize ${getStatusColor(record.status)}`}>
                                    {record.status.replace('_', ' ')}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr><td colSpan={5} className="p-8 text-center text-gray-500">No attendance records found</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Salary Payments Tab */}
              {activeTab === 'salary' && (
                <div className="space-y-6">
                  {salaryHistory.length > 0 ? (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left p-4 font-semibold text-gray-700">Payment Date</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Period</th>
                            <th className="text-right p-4 font-semibold text-gray-700">Amount</th>
                            <th className="text-right p-4 font-semibold text-gray-700">Deductions</th>
                            <th className="text-right p-4 font-semibold text-gray-700">Bonuses</th>
                            <th className="text-right p-4 font-semibold text-gray-700">Net Amount</th>
                            {isAdmin && <th className="text-center p-4 font-semibold text-gray-700">Actions</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {salaryHistory.map((payment: any) => (
                            <tr key={payment.payment_id} className="border-t hover:bg-gray-50">
                              <td className="p-4 font-medium">{new Date(payment.payment_date).toLocaleDateString()}</td>
                              <td className="p-4 text-sm text-gray-600">
                                {new Date(payment.from_date).toLocaleDateString()} - {new Date(payment.to_date).toLocaleDateString()}
                              </td>
                              <td className="p-4 text-right">{currency}{Number(payment.amount).toFixed(0)}</td>
                              <td className="p-4 text-right text-red-600">{payment.deductions > 0 ? `-$${Number(payment.deductions).toFixed(0)}` : '-'}</td>
                              <td className="p-4 text-right text-green-600">{payment.bonuses > 0 ? `+$${Number(payment.bonuses).toFixed(0)}` : '-'}</td>
                              <td className="p-4 text-right font-bold text-emerald-600">{currency}{Number(payment.net_amount).toFixed(0)}</td>
                              {isAdmin && (
                                <td className="p-4 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button onClick={() => { setSlipPayment({...payment, staff_id: staffId, full_name: staff?.full_name}); setShowSalarySlip(true); }} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition" title="Print Slip">
                                      <Printer size={16} />
                                    </button>
                                    <button onClick={() => { setSelectedPayment(payment); setShowEditPayment(true); }} className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition" title="Edit">
                                      <Edit size={16} />
                                    </button>
                                    <button onClick={() => handleDeletePayment(payment)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete">
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <DollarSign className="mx-auto mb-4 text-gray-400" size={48} />
                      <p>No salary payments found</p>
                    </div>
                  )}
                </div>
              )}

              {/* Loans Tab */}
              {activeTab === 'loans' && (
                <div className="space-y-6">
                  {loanHistory.length > 0 ? (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left p-4 font-semibold text-gray-700">Date</th>
                            <th className="text-right p-4 font-semibold text-gray-700">Amount</th>
                            <th className="text-right p-4 font-semibold text-gray-700">Repaid</th>
                            <th className="text-right p-4 font-semibold text-gray-700">Remaining</th>
                            <th className="text-right p-4 font-semibold text-gray-700">Monthly Ded.</th>
                            <th className="text-center p-4 font-semibold text-gray-700">Status</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loanHistory.map((loan: any) => (
                            <tr key={loan.loan_id} className="border-t hover:bg-gray-50">
                              <td className="p-4 font-medium">{new Date(loan.loan_date).toLocaleDateString()}</td>
                              <td className="p-4 text-right">{currency}{Number(loan.loan_amount).toLocaleString()}</td>
                              <td className="p-4 text-right text-green-600">{currency}{Number(loan.total_repaid || 0).toLocaleString()}</td>
                              <td className="p-4 text-right font-bold text-red-600">{currency}{Number(loan.remaining_balance).toLocaleString()}</td>
                              <td className="p-4 text-right text-gray-600">{Number(loan.monthly_deduction) > 0 ? `${currency}${Number(loan.monthly_deduction).toLocaleString()}` : '-'}</td>
                              <td className="p-4 text-center">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${
                                  loan.status === 'active' ? 'bg-green-100 text-green-700' :
                                  loan.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                }`}>{loan.status}</span>
                              </td>
                              <td className="p-4 text-sm text-gray-600">{loan.reason || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <CreditCard className="mx-auto mb-4 text-gray-400" size={48} />
                      <p>No loans found for this employee</p>
                    </div>
                  )}
                </div>
              )}

              {/* Increments Tab */}
              {activeTab === 'increments' && (
                <div className="space-y-6">
                  {incrementHistory.length > 0 ? (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left p-4 font-semibold text-gray-700">Effective Date</th>
                            <th className="text-right p-4 font-semibold text-gray-700">Old Salary</th>
                            <th className="text-right p-4 font-semibold text-gray-700">New Salary</th>
                            <th className="text-right p-4 font-semibold text-gray-700">Change</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Reason</th>
                            <th className="text-left p-4 font-semibold text-gray-700">Approved By</th>
                          </tr>
                        </thead>
                        <tbody>
                          {incrementHistory.map((inc: any) => {
                            const isIncrease = Number(inc.increment_amount) >= 0;
                            return (
                              <tr key={inc.increment_id} className="border-t hover:bg-gray-50">
                                <td className="p-4 font-medium">{new Date(inc.effective_date).toLocaleDateString()}</td>
                                <td className="p-4 text-right text-gray-600">{currency}{Number(inc.old_salary).toLocaleString()}</td>
                                <td className="p-4 text-right font-bold">{currency}{Number(inc.new_salary).toLocaleString()}</td>
                                <td className="p-4 text-right">
                                  <span className={`font-semibold ${isIncrease ? 'text-green-600' : 'text-red-600'}`}>
                                    {isIncrease ? '+' : ''}{Number(inc.increment_amount).toLocaleString()} ({Number(inc.increment_percentage).toFixed(1)}%)
                                  </span>
                                </td>
                                <td className="p-4 text-sm text-gray-600">{inc.reason || '-'}</td>
                                <td className="p-4 text-sm text-gray-600">{inc.approved_by_name || '-'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <TrendingUp className="mx-auto mb-4 text-gray-400" size={48} />
                      <p>No salary increments found for this employee</p>
                    </div>
                  )}
                </div>
              )}

              {/* Performance Tab */}
              {activeTab === 'performance' && (
                <div className="space-y-6">
                  {metrics ? (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white border border-gray-200 rounded-xl p-5 text-center">
                          <p className="text-sm text-gray-500 mb-2">Attendance Rate</p>
                          <p className={`text-3xl font-bold ${
                            metrics.attendanceRate >= 90 ? 'text-green-600' :
                            metrics.attendanceRate >= 70 ? 'text-yellow-600' : 'text-red-600'
                          }`}>{metrics.attendanceRate.toFixed(1)}%</p>
                          <p className="text-xs text-gray-400 mt-1">{metrics.presentDays} of {metrics.totalDays} days</p>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-xl p-5 text-center">
                          <p className="text-sm text-gray-500 mb-2">Punctuality</p>
                          <p className={`text-3xl font-bold ${
                            metrics.punctualityRate >= 90 ? 'text-green-600' :
                            metrics.punctualityRate >= 70 ? 'text-yellow-600' : 'text-red-600'
                          }`}>{metrics.punctualityRate.toFixed(1)}%</p>
                          <p className="text-xs text-gray-400 mt-1">On-time arrivals</p>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-xl p-5 text-center">
                          <p className="text-sm text-gray-500 mb-2">Total Hours</p>
                          <p className="text-3xl font-bold text-emerald-600">{metrics.totalHours.toFixed(1)}h</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Avg {metrics.attendedDays > 0 ? (metrics.totalHours / metrics.attendedDays).toFixed(1) : 0}h/day
                          </p>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-xl p-5 text-center">
                          <p className="text-sm text-gray-500 mb-2">Overtime</p>
                          <p className={`text-3xl font-bold ${metrics.overtimeHours > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                            {metrics.overtimeHours.toFixed(1)}h
                          </p>
                          <p className="text-xs text-gray-400 mt-1">Beyond 8h/day</p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 text-center">Based on last {attendanceHistory.length} attendance records</p>
                    </>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <BarChart3 className="mx-auto mb-4 text-gray-400" size={48} />
                      <p>No attendance data to calculate performance</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50 flex items-center justify-end">
          <button onClick={handleClose} className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition">Close</button>
        </div>
      </div>

      {/* Edit Salary Payment Modal */}
      <EditSalaryPaymentModal
        isOpen={showEditPayment}
        onClose={() => { setShowEditPayment(false); setSelectedPayment(null); }}
        onSuccess={fetchSalaryHistory}
        payment={selectedPayment}
        staffName={staff?.full_name || ''}
      />

      {/* Salary Slip Modal */}
      <SalarySlipModal
        isOpen={showSalarySlip}
        onClose={() => { setShowSalarySlip(false); setSlipPayment(null); }}
        payment={slipPayment}
      />
    </div>
  );
};

export default StaffDetailsModal;
