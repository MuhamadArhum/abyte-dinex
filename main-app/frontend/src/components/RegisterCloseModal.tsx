import { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { X, Lock, Loader2, AlertTriangle, CheckCircle, DollarSign, TrendingUp, TrendingDown, Clock, Calendar, User, FileText, Calculator, Receipt } from 'lucide-react';
import api from '../utils/api';
import { useToast } from './Toast';

interface RegisterCloseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  expectedCash: number;
  shiftExpenses?: number;
  register: any;
}

const r = (n: number) => Math.round(n);

const RegisterCloseModal: React.FC<RegisterCloseModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  expectedCash,
  shiftExpenses = 0,
  register
}) => {
  const { currencySymbol: currency } = useSettings();
  const toast = useToast();
  const [closingBalance, setClosingBalance] = useState('');
  const [closeNote, setCloseNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [shiftSales, setShiftSales] = useState<any[]>([]);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [showSalesList, setShowSalesList] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShiftLoading(true);
      api.get('/register/current')
        .then(res => { setShiftSales(res.data?.shift_sales || []); })
        .catch(() => {})
        .finally(() => setShiftLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const closingValue = parseFloat(closingBalance) || 0;
  const difference = closingValue - expectedCash;
  const isDifferenceSignificant = Math.abs(difference) >= 0.01;

  // Calculate shift duration
  const shiftDuration = register.opened_at 
    ? Math.floor((new Date().getTime() - new Date(register.opened_at).getTime()) / (1000 * 60))
    : 0;

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const handleClose = async () => {
    if (!closingBalance || parseFloat(closingBalance) < 0) {
      toast.error('Please enter a valid closing balance');
      return;
    }

    // Show confirmation if there's a significant difference
    if (isDifferenceSignificant && !showConfirmation) {
      setShowConfirmation(true);
      return;
    }

    setIsProcessing(true);
    try {
      await api.post('/register/close', {
        closing_balance: parseFloat(closingBalance),
        close_note: closeNote.trim() || undefined,
        expected_cash: expectedCash,
        difference: difference
      });
      setClosingBalance('');
      setCloseNote('');
      setShowConfirmation(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to close register');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-300 border-2 border-gray-200">
        {/* Header */}
        <div className="p-6 border-b-2 border-gray-100 bg-gradient-to-r from-red-50 via-orange-50 to-red-50">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-red-500 to-red-600 p-2.5 rounded-xl shadow-lg">
                <Lock size={28} className="text-white" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-800">Close Cash Register</h2>
                <p className="text-sm text-gray-500 mt-0.5">Complete your shift and reconcile cash</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-xl transition-all duration-200"
            >
              <X size={28} />
            </button>
          </div>
        </div>

        <div className="p-6 max-h-[calc(100vh-200px)] overflow-y-auto space-y-6">
          {/* Shift Info Banner */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-emerald-600 mb-2">
                <Clock size={18} />
                <p className="text-xs font-semibold uppercase">Duration</p>
              </div>
              <p className="text-2xl font-bold text-emerald-800">{formatDuration(shiftDuration)}</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-emerald-600 mb-2">
                <User size={18} />
                <p className="text-xs font-semibold uppercase">Cashier</p>
              </div>
              <p className="text-lg font-bold text-emerald-800 truncate">{register.opened_by_name || 'Staff'}</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-emerald-600 mb-2">
                <Calendar size={18} />
                <p className="text-xs font-semibold uppercase">Date</p>
              </div>
              <p className="text-sm font-bold text-emerald-800">
                {register.opened_at ? new Date(register.opened_at).toLocaleDateString() : 'Today'}
              </p>
            </div>
          </div>

          {/* Detailed Shift Summary */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2 text-lg">
              <FileText size={20} className="text-gray-600" />
              Shift Summary
            </h3>
            <div className="space-y-3">
              {/* Opening Balance */}
              <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-gray-200">
                <span className="text-gray-600 font-medium flex items-center gap-2">
                  <DollarSign size={16} className="text-emerald-500" />
                  Opening Balance
                </span>
                <span className="font-bold text-gray-800">
                  ${r(parseFloat(register.opening_balance || 0))}
                </span>
              </div>

              {/* Cash Sales */}
              <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <span className="text-emerald-700 font-medium flex items-center gap-2">
                  <TrendingUp size={16} className="text-emerald-600" />
                  Cash Sales
                </span>
                <span className="font-bold text-emerald-700">
                  +${r(parseFloat(register.cash_sales_total || 0))}
                </span>
              </div>

              {/* Card Sales */}
              <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <span className="text-emerald-700 font-medium flex items-center gap-2">
                  💳 Card Sales
                </span>
                <span className="font-bold text-emerald-700">
                  ${r(parseFloat(register.card_sales_total || 0))}
                </span>
              </div>

              {/* Expenses */}
              <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-200">
                <span className="text-red-700 font-medium flex items-center gap-2">
                  <TrendingDown size={16} className="text-red-600" />
                  Expenses (This Shift)
                </span>
                <span className="font-bold text-red-700">
                  -${r(shiftExpenses)}
                </span>
              </div>

              {/* Expected Cash - Highlighted */}
              <div className="flex justify-between items-center p-4 bg-gradient-to-r from-emerald-100 to-emerald-100 rounded-lg border-2 border-emerald-300 shadow-md">
                <span className="font-bold text-emerald-800 flex items-center gap-2">
                  <Calculator size={18} className="text-emerald-600" />
                  <span>
                    Expected Cash in Drawer
                    <span className="block text-xs font-normal text-emerald-600">Opening + Sales − Expenses</span>
                  </span>
                </span>
                <span className="font-bold text-2xl text-emerald-900">
                  ${r(expectedCash)}
                </span>
              </div>
            </div>
          </div>

          {/* Shift Sales */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5">
            <button
              onClick={() => setShowSalesList(v => !v)}
              className="w-full flex justify-between items-center"
            >
              <h3 className="font-semibold text-blue-800 flex items-center gap-2 text-base">
                <Receipt size={20} className="text-blue-600" />
                Shift Sales
                <span className="bg-blue-200 text-blue-800 text-xs font-bold px-2 py-0.5 rounded-full">
                  {shiftLoading ? '...' : shiftSales.length} transactions
                </span>
              </h3>
              <span className="text-blue-500 text-sm">{showSalesList ? '▲ Hide' : '▼ Show'}</span>
            </button>

            {/* Payment method summary */}
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="bg-white rounded-xl p-3 text-center border border-emerald-200">
                <p className="text-xs text-gray-500 mb-1">Cash Sales</p>
                <p className="font-bold text-emerald-700 text-base">{currency}{r(parseFloat(register.cash_sales_total || 0))}</p>
              </div>
              <div className="bg-white rounded-xl p-3 text-center border border-blue-200">
                <p className="text-xs text-gray-500 mb-1">Card / Online</p>
                <p className="font-bold text-blue-700 text-base">{currency}{r(parseFloat(register.card_sales_total || 0))}</p>
              </div>
              <div className="bg-white rounded-xl p-3 text-center border border-gray-300">
                <p className="text-xs text-gray-500 mb-1">Total Revenue</p>
                <p className="font-bold text-gray-800 text-base">
                  {currency}{r(parseFloat(register.cash_sales_total || 0) + parseFloat(register.card_sales_total || 0))}
                </p>
              </div>
            </div>

            {/* Collapsible sales list */}
            {showSalesList && (
              <div className="mt-4">
                {shiftLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="animate-spin text-blue-500" size={22} />
                    <span className="ml-2 text-blue-600 text-sm">Loading sales...</span>
                  </div>
                ) : shiftSales.length === 0 ? (
                  <p className="text-center text-blue-500 text-sm py-4">No completed sales in this shift</p>
                ) : (
                  <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                    {shiftSales.map((sale: any) => (
                      <div key={sale.sale_id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-blue-100">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-bold text-gray-700 shrink-0">
                            {sale.invoice_no || `#${sale.sale_id}`}
                          </span>
                          <span className="text-xs text-gray-400 shrink-0">
                            {new Date(sale.sale_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full capitalize ${
                            sale.payment_method === 'cash'   ? 'bg-emerald-100 text-emerald-700' :
                            sale.payment_method === 'credit' ? 'bg-orange-100 text-orange-700'  :
                                                               'bg-blue-100 text-blue-700'
                          }`}>{sale.payment_method}</span>
                          <span className="text-sm font-bold text-gray-800">
                            {currency}{r(parseFloat(sale.total_amount))}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actual Cash Count */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <DollarSign size={16} className="text-orange-600" />
              Actual Cash Count <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={24} />
              <input
                type="number"
                value={closingBalance}
                onChange={(e) => setClosingBalance(e.target.value)}
                className="w-full pl-14 pr-4 py-4 border-2 border-gray-200 rounded-xl text-2xl font-bold focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all shadow-sm bg-white"
                placeholder="Count all cash in drawer"
                min="0"
                step="0.01"
                autoFocus
              />
            </div>
            <p className="text-xs text-gray-500 mt-2 ml-1">
              💡 Count all bills and coins in the cash drawer carefully
            </p>
          </div>

          {/* Difference Display */}
          {closingBalance && (
            <div className={`p-5 rounded-xl flex items-start gap-4 border-2 transition-all ${
              Math.abs(difference) < 0.01 
                ? 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-300 text-emerald-800' 
                : difference > 0 
                ? 'bg-gradient-to-r from-emerald-50 to-emerald-50 border-emerald-300 text-emerald-800' 
                : 'bg-gradient-to-r from-red-50 to-orange-50 border-red-300 text-red-800'
            }`}>
              <div className="flex-shrink-0">
                {Math.abs(difference) < 0.01 ? (
                  <div className="bg-emerald-500 p-2 rounded-full">
                    <CheckCircle size={24} className="text-white" />
                  </div>
                ) : (
                  <div className={`p-2 rounded-full ${difference > 0 ? 'bg-emerald-500' : 'bg-red-500'}`}>
                    <AlertTriangle size={24} className="text-white" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <p className="font-bold text-lg mb-1">
                  {Math.abs(difference) < 0.01 
                    ? '✓ Perfect Balance!' 
                    : difference > 0 
                    ? `⚠️ Cash Over by $${r(difference)}`
                    : `⚠️ Cash Short by $${r(Math.abs(difference))}`}
                </p>
                <p className="text-sm opacity-90">
                  {Math.abs(difference) < 0.01 
                    ? 'The cash count matches the expected amount exactly.' 
                    : difference > 0 
                    ? 'You have more cash than expected. Please verify the count.' 
                    : 'You have less cash than expected. Please verify the count and check for missing transactions.'}
                </p>
                <div className="mt-3 p-3 bg-white/60 rounded-lg">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs opacity-75">Expected:</p>
                      <p className="font-bold">{currency}{r(expectedCash)}</p>
                    </div>
                    <div>
                      <p className="text-xs opacity-75">Actual:</p>
                      <p className="font-bold">{currency}{r(closingValue)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Confirmation Checkbox if difference */}
          {isDifferenceSignificant && closingBalance && showConfirmation && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-amber-800 mb-2">Confirmation Required</p>
                  <p className="text-sm text-amber-700 mb-3">
                    You are about to close the register with a discrepancy of <strong>{currency}{r(Math.abs(difference))}</strong>.
                    Please verify your cash count is accurate before proceeding.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowConfirmation(false)}
                      className="px-4 py-2 bg-white border-2 border-amber-300 rounded-lg text-amber-700 font-semibold hover:bg-amber-50 transition-all"
                    >
                      Recount Cash
                    </button>
                    <button
                      onClick={handleClose}
                      disabled={isProcessing}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold transition-all"
                    >
                      Confirm & Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Closing Note */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <FileText size={16} className="text-gray-600" />
              Closing Notes (Optional)
            </label>
            <textarea
              value={closeNote}
              onChange={(e) => setCloseNote(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none resize-none h-24 transition-all shadow-sm"
              placeholder="Add notes about this shift (e.g., reasons for discrepancy, special events, issues encountered)..."
              maxLength={300}
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{closeNote.length}/300</p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-5 border-t-2 border-gray-100">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all duration-200 border-2 border-gray-200 hover:border-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={handleClose}
              disabled={isProcessing || !closingBalance || (isDifferenceSignificant && !showConfirmation)}
              className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg disabled:shadow-none disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Closing Register...
                </>
              ) : (
                <>
                  <Lock size={20} />
                  Close Register
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterCloseModal;