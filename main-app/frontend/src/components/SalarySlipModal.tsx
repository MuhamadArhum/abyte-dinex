import { useEffect, useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { X, Printer, Download } from 'lucide-react';
import api from '../utils/api';

interface SalarySlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: any;
}

const SalarySlipModal = ({ isOpen, onClose, payment }: SalarySlipModalProps) => {
  const { currencySymbol: currency } = useSettings();
  const [settings, setSettings] = useState<any>(null);
  const [staff, setStaff] = useState<any>(null);

  useEffect(() => {
    if (isOpen && payment) {
      api.get('/settings').then(r => setSettings(r.data)).catch(() => {});
      api.get(`/staff/${payment.staff_id}`).then(r => setStaff(r.data)).catch(() => {});
    }
  }, [isOpen, payment]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const content = document.getElementById('salary-slip-content');
    if (!content) return;

    const printWindow = window.open('', '', 'width=800,height=600');
    if (!printWindow) return;

    printWindow.document.write('<html><head><title>Salary Slip</title>');
    printWindow.document.write('<style>');
    printWindow.document.write('body { font-family: Arial, sans-serif; padding: 20px; } ');
    printWindow.document.write('table { width: 100%; border-collapse: collapse; } ');
    printWindow.document.write('th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; } ');
    printWindow.document.write('.header { text-align: center; margin-bottom: 20px; } ');
    printWindow.document.write('.footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; } ');
    printWindow.document.write('</style></head><body>');
    printWindow.document.write(content.innerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.print();
  };

  if (!isOpen || !payment) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between no-print">
          <h2 className="text-base font-semibold text-gray-800">Salary Slip</h2>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition" title="Print">
              <Printer size={20} />
            </button>
            <button onClick={handleDownload} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition" title="Download">
              <Download size={20} />
            </button>
            <button onClick={onClose} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">
              <X size={20} />
            </button>
          </div>
        </div>

        <div id="salary-slip-content" className="p-8">
          {/* Header */}
          <div className="text-center mb-8 border-b-2 border-gray-300 pb-6">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">{settings?.store_name || 'AByte ERP Store'}</h1>
            {settings?.address && <p className="text-gray-600">{settings.address}</p>}
            {settings?.phone && <p className="text-gray-600">Phone: {settings.phone}</p>}
            {settings?.email && <p className="text-gray-600">Email: {settings.email}</p>}
            <h2 className="text-base font-semibold text-gray-800 mt-4">SALARY SLIP</h2>
          </div>

          {/* Employee Details */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div>
              <p className="text-sm text-gray-600">Employee Name</p>
              <p className="font-semibold text-gray-800">{staff?.full_name || payment.full_name || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Employee ID</p>
              <p className="font-semibold text-gray-800">{staff?.employee_id || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Department</p>
              <p className="font-semibold text-gray-800">{staff?.department || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Position</p>
              <p className="font-semibold text-gray-800">{staff?.position || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Payment Date</p>
              <p className="font-semibold text-gray-800">{new Date(payment.payment_date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Payment Period</p>
              <p className="font-semibold text-gray-800">
                {new Date(payment.from_date).toLocaleDateString()} - {new Date(payment.to_date).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Earnings & Deductions */}
          <div className="border border-gray-300 rounded-lg overflow-hidden mb-8">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left p-4 font-semibold text-gray-700">Description</th>
                  <th className="text-right p-4 font-semibold text-gray-700">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-4 text-gray-700">Basic Salary</td>
                  <td className="p-4 text-right font-medium text-gray-800">{currency}{Number(payment.amount).toLocaleString()}</td>
                </tr>
                {Number(payment.bonuses || 0) > 0 && (
                  <tr className="border-b">
                    <td className="p-4 text-gray-700">Bonuses</td>
                    <td className="p-4 text-right font-medium text-green-600">+${Number(payment.bonuses).toLocaleString()}</td>
                  </tr>
                )}
                {Number(payment.deductions || 0) > 0 && (
                  <tr className="border-b">
                    <td className="p-4 text-gray-700">Deductions</td>
                    <td className="p-4 text-right font-medium text-red-600">-${Number(payment.deductions).toLocaleString()}</td>
                  </tr>
                )}
                <tr className="bg-gray-50 font-bold">
                  <td className="p-4 text-gray-800">Net Salary</td>
                  <td className="p-4 text-right text-lg text-emerald-600">{currency}{Number(payment.net_amount).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Payment Method */}
          <div className="mb-8">
            <p className="text-sm text-gray-600">Payment Method</p>
            <p className="font-semibold text-gray-800 capitalize">{(payment.payment_method || 'bank_transfer').replace('_', ' ')}</p>
          </div>

          {/* Notes */}
          {payment.notes && (
            <div className="mb-8">
              <p className="text-sm text-gray-600 mb-2">Notes</p>
              <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">{payment.notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="border-t-2 border-gray-300 pt-6 mt-8">
            <div className="grid grid-cols-2 gap-12">
              <div>
                <div className="border-t border-gray-400 pt-2 mt-16 text-center">
                  <p className="text-sm text-gray-600">Employee Signature</p>
                </div>
              </div>
              <div>
                <div className="border-t border-gray-400 pt-2 mt-16 text-center">
                  <p className="text-sm text-gray-600">Authorized Signature</p>
                </div>
              </div>
            </div>
            <div className="text-center mt-8 text-xs text-gray-500">
              <p>This is a computer-generated salary slip and does not require a signature.</p>
              <p>Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 20px; }
        }
      `}</style>
    </div>
  );
};

export default SalarySlipModal;
