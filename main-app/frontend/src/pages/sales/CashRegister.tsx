import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { Wallet, Plus, Lock, Unlock, ArrowDownCircle, ArrowUpCircle, History, Loader2 } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import CashMovementModal from '../../components/CashMovementModal';
import RegisterCloseModal from '../../components/RegisterCloseModal';
import Pagination from '../../components/Pagination';

interface CashMovement {
  movement_id: number;
  type: 'cash_in' | 'cash_out';
  amount: string;
  reason: string;
  user_name: string;
  created_at: string;
}

interface Register {
  register_id: number;
  opened_by: number;
  opened_by_name: string;
  closed_by_name?: string;
  opening_balance: string;
  closing_balance?: string;
  expected_balance?: string;
  cash_sales_total: string;
  card_sales_total: string;
  total_cash_in: string;
  total_cash_out: string;
  shift_expenses?: number;
  difference?: string;
  status: 'open' | 'closed';
  opened_at: string;
  closed_at?: string;
  close_note?: string;
  movements?: CashMovement[];
}

const CashRegister = () => {
  const { currencySymbol: currency } = useSettings();
  const { user } = useAuth();
  const toast = useToast();
  const [register, setRegister] = useState<Register | null>(null);
  const [loading, setLoading] = useState(true);
  const [openingBalance, setOpeningBalance] = useState('');
  const [isOpening, setIsOpening] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [history, setHistory] = useState<Register[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    fetchRegister();
  }, []);

  const fetchRegister = async () => {
    try {
      const res = await api.get('/register/current');
      setRegister(res.data);
    } catch (error) {
      console.error('Failed to fetch register', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = async () => {
    const balance = parseFloat(openingBalance);
    if (isNaN(balance) || balance < 0) {
      toast.error('Please enter a valid opening balance');
      return;
    }
    setIsOpening(true);
    try {
      await api.post('/register/open', { opening_balance: balance });
      setOpeningBalance('');
      fetchRegister();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to open register');
    } finally {
      setIsOpening(false);
    }
  };

  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get('/register/history', {
        params: {
          page: currentPage,
          limit: itemsPerPage
        }
      });
      if (res.data.pagination) {
        setHistory(res.data.registers);
        setTotalItems(res.data.pagination.total);
        setTotalPages(res.data.pagination.totalPages);
      } else {
        setHistory(res.data.registers);
      }
      setShowHistory(true);
    } catch (error) {
      console.error('Failed to fetch history', error);
    }
  }, [currentPage, itemsPerPage]);

  useEffect(() => {
    if (showHistory) {
      fetchHistory();
    }
  }, [showHistory, currentPage, fetchHistory]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  // No register open - show open form
  if (!register) {
    return (
      <div className="p-4 sm:p-6">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900 flex items-center gap-3 mb-8">
          <Wallet className="text-emerald-600" size={20} />
          Cash Register
        </h1>

        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock size={32} className="text-gray-400" />
            </div>
            <h2 className="text-base font-semibold text-gray-800 mb-2">Register is Closed</h2>
            <p className="text-gray-500 mb-6">Open the register to start your shift</p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Opening Balance ($)</label>
              <input
                type="number"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-center text-2xl font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>

            <button
              onClick={handleOpen}
              disabled={isOpening}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {isOpening ? <Loader2 className="animate-spin" size={20} /> : <Unlock size={20} />}
              Open Register
            </button>
          </div>

          {(user?.role_name === 'Admin' || user?.role_name === 'Manager') && (
            <button
              onClick={fetchHistory}
              className="mt-4 w-full text-gray-500 hover:text-gray-700 text-sm flex items-center justify-center gap-2 py-2"
            >
              <History size={16} />
              View Past Shifts
            </button>
          )}
        </div>

        {showHistory && (
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Shift History</h3>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[600px]">
                <thead className="bg-gray-50 text-gray-600 font-medium">
                  <tr>
                    <th className="p-4">Opened</th>
                    <th className="p-4">Opened By</th>
                    <th className="p-4">Opening</th>
                    <th className="p-4">Cash Sales</th>
                    <th className="p-4">Closing</th>
                    <th className="p-4">Difference</th>
                    <th className="p-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {history.map(h => (
                    <tr key={h.register_id} className="hover:bg-gray-50">
                      <td className="p-4 text-gray-500">{new Date(h.opened_at).toLocaleString()}</td>
                      <td className="p-4 font-medium">{h.opened_by_name}</td>
                      <td className="p-4">{currency}{parseFloat(h.opening_balance).toFixed(0)}</td>
                      <td className="p-4 text-emerald-600">{currency}{parseFloat(h.cash_sales_total).toFixed(0)}</td>
                      <td className="p-4">{h.closing_balance ? `${currency}${parseFloat(h.closing_balance).toFixed(0)}` : '-'}</td>
                      <td className="p-4">
                        {h.difference !== null && h.difference !== undefined ? (
                          <span className={parseFloat(h.difference) >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                            ${parseFloat(h.difference).toFixed(0)}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${h.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                          {h.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onItemsPerPageChange={(l) => { setItemsPerPage(l); setCurrentPage(1); }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Register is open - show dashboard
  const cashSales = parseFloat(register.cash_sales_total);
  const cardSales = parseFloat(register.card_sales_total);
  const opening = parseFloat(register.opening_balance);
  const shiftExpenses = register.shift_expenses || 0;
  // Expected = Opening Balance + Cash Sales - Expenses
  const expectedCash = opening + cashSales - shiftExpenses;
  const cashIn = parseFloat(register.total_cash_in || '0');
  const cashOut = parseFloat(register.total_cash_out || '0');

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 flex items-center gap-3">
            <Wallet className="text-emerald-600" size={20} />
            Cash Register
          </h1>
          <p className="text-gray-500 mt-1">
            Opened by {register.opened_by_name} at {new Date(register.opened_at).toLocaleTimeString()}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowMovementModal(true)}
            className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 flex items-center gap-2 transition-colors"
          >
            <Plus size={18} />
            Cash In/Out
          </button>
          {(user?.role_name === 'Admin' || user?.role_name === 'Manager') && (
            <button
              onClick={() => setShowCloseModal(true)}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              <Lock size={18} />
              Close Register
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">Opening Balance</h3>
          <p className="text-3xl font-bold text-gray-800 mt-2">{currency}{opening.toFixed(0)}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">Cash Sales</h3>
          <p className="text-3xl font-bold text-emerald-600 mt-2">{currency}{cashSales.toFixed(0)}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">Card Sales</h3>
          <p className="text-3xl font-bold text-emerald-600 mt-2">{currency}{cardSales.toFixed(0)}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">Expected Cash in Drawer</h3>
          <p className="text-3xl font-bold text-gray-800 mt-2">{currency}{expectedCash.toFixed(0)}</p>
        </div>
      </div>

      {/* Cash In/Out Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <ArrowDownCircle size={20} className="text-emerald-500" />
            <h3 className="text-gray-700 font-medium">Total Cash In</h3>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{currency}{cashIn.toFixed(0)}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpCircle size={20} className="text-red-500" />
            <h3 className="text-gray-700 font-medium">Total Cash Out</h3>
          </div>
          <p className="text-2xl font-bold text-red-600">{currency}{cashOut.toFixed(0)}</p>
        </div>
      </div>

      {/* Recent Movements */}
      {register.movements && register.movements.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Cash Movements</h3>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[600px]">
            <thead className="bg-gray-50 text-gray-600 font-medium">
              <tr>
                <th className="p-4">Time</th>
                <th className="p-4">Type</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Reason</th>
                <th className="p-4">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {register.movements.map(m => (
                <tr key={m.movement_id} className="hover:bg-gray-50">
                  <td className="p-4 text-gray-500">{new Date(m.created_at).toLocaleTimeString()}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.type === 'cash_in' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {m.type === 'cash_in' ? 'Cash In' : 'Cash Out'}
                    </span>
                  </td>
                  <td className={`p-4 font-medium ${m.type === 'cash_in' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {m.type === 'cash_in' ? '+' : '-'}${parseFloat(m.amount).toFixed(0)}
                  </td>
                  <td className="p-4 text-gray-600">{m.reason}</td>
                  <td className="p-4 text-gray-600">{m.user_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      <CashMovementModal
        isOpen={showMovementModal}
        onClose={() => setShowMovementModal(false)}
        onSuccess={fetchRegister}
        currentBalance={expectedCash}
      />

      <RegisterCloseModal
        isOpen={showCloseModal}
        onClose={() => setShowCloseModal(false)}
        onSuccess={() => { setShowCloseModal(false); fetchRegister(); }}
        expectedCash={expectedCash}
        shiftExpenses={shiftExpenses}
        register={register}
      />
    </div>
  );
};

export default CashRegister;
