import { useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { X, ArrowDownCircle, ArrowUpCircle, Loader2, DollarSign, FileText, Calculator, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../utils/api';
import { useToast } from './Toast';

interface CashMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentBalance?: number;
}

const CASH_IN_REASONS = [
  'Initial Float',
  'Cash Deposit',
  'Bank Withdrawal',
  'Change Float',
  'Customer Overpayment Refund',
  'Other'
];

const CASH_OUT_REASONS = [
  'Bank Deposit',
  'Petty Cash',
  'Vendor Payment',
  'Employee Tips',
  'Supplies Purchase',
  'Utility Payment',
  'Other'
];

const CashMovementModal: React.FC<CashMovementModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentBalance = 0
}) => {
  const { currencySymbol: currency } = useSettings();
  const toast = useToast();
  const [type, setType] = useState<'cash_in' | 'cash_out'>('cash_in');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [touched, setTouched] = useState(false);

  if (!isOpen) return null;

  const reasons = type === 'cash_in' ? CASH_IN_REASONS : CASH_OUT_REASONS;

  const validateAmount = (value: string): boolean => {
    const amt = parseFloat(value);
    if (isNaN(amt) || amt <= 0) return false;
    if (type === 'cash_out' && amt > currentBalance) return false;
    return true;
  };

  const getNewBalance = (): number => {
    const amt = parseFloat(amount) || 0;
    return type === 'cash_in' ? currentBalance + amt : currentBalance - amt;
  };

  const isFormValid = (): boolean => {
    const finalReason = reason === 'Other' ? customReason : reason;
    return validateAmount(amount) && finalReason.trim().length > 0;
  };

  const handleSubmit = async () => {
    if (!isFormValid()) {
      setTouched(true);
      return;
    }

    const amt = parseFloat(amount);
    const finalReason = reason === 'Other' ? customReason : reason;

    setIsProcessing(true);
    try {
      await api.post('/register/cash-movement', { 
        type, 
        amount: amt, 
        reason: finalReason,
        notes: notes.trim() || undefined
      });
      
      // Reset form
      setAmount('');
      setReason('');
      setCustomReason('');
      setNotes('');
      setTouched(false);
      
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to record movement');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuickAmount = (value: number) => {
    setAmount(value.toString());
  };

  const amt = parseFloat(amount) || 0;
  const hasInsufficientFunds = type === 'cash_out' && amt > currentBalance;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300 border-2 border-gray-200">
        {/* Header */}
        <div className="p-6 border-b-2 border-gray-100 bg-gradient-to-r from-emerald-50 via-white to-emerald-50">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-2.5 rounded-xl shadow-lg">
                <DollarSign size={28} className="text-white" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-800">Cash Movement</h2>
                <p className="text-sm text-gray-500 mt-0.5">Record cash in/out transactions</p>
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
          {/* Current Balance Display */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-2 border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Current Cash Balance</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">
                  ${currentBalance.toFixed(0)}
                </p>
              </div>
              {amount && validateAmount(amount) && (
                <div className="text-right">
                  <p className="text-sm text-gray-600 font-medium">New Balance</p>
                  <p className={`text-2xl font-bold mt-1 ${
                    type === 'cash_in' ? 'text-emerald-600' : 'text-orange-600'
                  }`}>
                    ${getNewBalance().toFixed(0)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Type Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Transaction Type</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => {
                  setType('cash_in');
                  setReason('');
                  setCustomReason('');
                }}
                className={`p-5 rounded-xl border-2 flex flex-col items-center gap-3 transition-all duration-200 ${
                  type === 'cash_in' 
                    ? 'border-emerald-500 bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-700 shadow-lg scale-105' 
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className={`p-3 rounded-xl ${
                  type === 'cash_in' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'
                }`}>
                  <ArrowDownCircle size={32} />
                </div>
                <span className="font-bold text-lg">Cash In</span>
                <span className="text-xs">Add money to register</span>
              </button>
              <button
                onClick={() => {
                  setType('cash_out');
                  setReason('');
                  setCustomReason('');
                }}
                className={`p-5 rounded-xl border-2 flex flex-col items-center gap-3 transition-all duration-200 ${
                  type === 'cash_out' 
                    ? 'border-red-500 bg-gradient-to-br from-red-50 to-red-100 text-red-700 shadow-lg scale-105' 
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className={`p-3 rounded-xl ${
                  type === 'cash_out' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-400'
                }`}>
                  <ArrowUpCircle size={32} />
                </div>
                <span className="font-bold text-lg">Cash Out</span>
                <span className="text-xs">Remove money from register</span>
              </button>
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <Calculator size={16} className="text-emerald-600" />
              Amount <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={24} />
              <input
                type="number"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setTouched(true);
                }}
                className={`w-full pl-14 pr-4 py-4 border-2 rounded-xl text-2xl font-bold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all shadow-sm ${
                  touched && !validateAmount(amount) 
                    ? 'border-red-300 bg-red-50' 
                    : 'border-gray-200 bg-white'
                }`}
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
            
            {/* Validation Messages */}
            {touched && amount && !validateAmount(amount) && (
              <p className="text-red-500 text-sm mt-2 flex items-center gap-1">
                <AlertCircle size={16} />
                {hasInsufficientFunds 
                  ? `Insufficient funds. Available: $${currentBalance.toFixed(0)}` 
                  : 'Please enter a valid amount greater than 0'}
              </p>
            )}

            {/* Quick Amount Buttons */}
            <div className="mt-3 flex flex-wrap gap-2">
              <p className="text-xs text-gray-500 w-full mb-1">Quick amounts:</p>
              {[10, 20, 50, 100, 200, 500].map((value) => (
                <button
                  key={value}
                  onClick={() => handleQuickAmount(value)}
                  disabled={type === 'cash_out' && value > currentBalance}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${
                    parseFloat(amount) === value
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  ${value}
                </button>
              ))}
            </div>
          </div>

          {/* Reason Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <FileText size={16} className="text-emerald-600" />
              Reason <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {reasons.map(r => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium border-2 transition-all ${
                    reason === r 
                      ? type === 'cash_in'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
                        : 'border-red-500 bg-red-50 text-red-700 shadow-sm'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            
            {/* Custom Reason Input */}
            {reason === 'Other' && (
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none mt-3 transition-all shadow-sm"
                placeholder="Enter custom reason..."
                maxLength={100}
              />
            )}
          </div>

          {/* Additional Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <FileText size={16} className="text-gray-600" />
              Additional Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none resize-none h-24 transition-all shadow-sm"
              placeholder="Add any additional details or notes..."
              maxLength={200}
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{notes.length}/200</p>
          </div>

          {/* Summary Card */}
          {isFormValid() && (
            <div className={`p-4 rounded-xl border-2 ${
              type === 'cash_in' 
                ? 'bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200' 
                : 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200'
            }`}>
              <div className="flex items-start gap-3">
                <CheckCircle size={20} className={type === 'cash_in' ? 'text-emerald-600' : 'text-red-600'} />
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-800 mb-1">Transaction Summary</p>
                  <div className="space-y-1 text-sm">
                    <p className="text-gray-700">
                      <strong>Type:</strong> {type === 'cash_in' ? 'Cash In ↓' : 'Cash Out ↑'}
                    </p>
                    <p className="text-gray-700">
                      <strong>Amount:</strong> ${parseFloat(amount).toFixed(0)}
                    </p>
                    <p className="text-gray-700">
                      <strong>Reason:</strong> {reason === 'Other' ? customReason : reason}
                    </p>
                    <p className="text-gray-700">
                      <strong>New Balance:</strong> <span className="font-bold">{currency}{getNewBalance().toFixed(0)}</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t-2 border-gray-100">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all duration-200 border-2 border-gray-200 hover:border-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isProcessing || !isFormValid()}
              className={`flex-1 font-bold py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-white shadow-lg ${
                type === 'cash_in' 
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800' 
                  : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800'
              } disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed disabled:shadow-none`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle size={20} />
                  Record {type === 'cash_in' ? 'Cash In' : 'Cash Out'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CashMovementModal;