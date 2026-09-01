import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { CreditCard, Search, DollarSign, AlertTriangle, Clock, CheckCircle, X, Printer, Loader2, FileText } from 'lucide-react';
import { printReport, buildTable, buildStatsCards } from '../../utils/reportPrinter';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import Pagination from '../../components/Pagination';
import { ReceiptModal } from '../../printing/ReceiptView';
import { buildCreditSaleReceipt } from '../../printing/receiptBuilder';

interface CreditSale {
  credit_sale_id: number;
  sale_id: number;
  customer_id: number;
  customer_name: string;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  due_date: string;
  status: string;
  created_at: string;
}

const STATUS_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: 'Pending', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  partial: { label: 'Partial', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  paid: { label: 'Paid', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  overdue: { label: 'Overdue', bg: 'bg-red-100', text: 'text-red-700' },
};

const CreditSales = () => {
  const { currencySymbol: currency } = useSettings();
  const toast = useToast();
  const [sales, setSales] = useState<CreditSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [tab, setTab] = useState<'all' | 'overdue'>('all');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [stats, setStats] = useState({ total_outstanding: 0, overdue_count: 0, collected_this_month: 0, active_count: 0 });

  // Thermal print
  const [creditThermalAvailable, setCreditThermalAvailable] = useState(false);
  const [thermalPrintingId, setThermalPrintingId] = useState<number | null>(null);

  // Receipt view
  const [receiptViewData, setReceiptViewData] = useState<any>(null);

  // Payment modal
  const [paymentModal, setPaymentModal] = useState<CreditSale | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [payNotes, setPayNotes] = useState('');

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (tab === 'overdue') params.overdue = 1;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await api.get('/credit-sales', { params });
      setSales(res.data.data || []);
      if (res.data.pagination) {
        setTotalItems(res.data.pagination.total);
        setTotalPages(res.data.pagination.totalPages);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [page, limit, search, statusFilter, tab, dateFrom, dateTo]);

  const fetchStats = async () => {
    try { const res = await api.get('/credit-sales/stats'); setStats(res.data); } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchStats(); }, []);
  useEffect(() => { fetchSales(); }, [fetchSales]);
  useEffect(() => {
    api.get('/settings/printers/check?purpose=credit_sale')
      .then(res => setCreditThermalAvailable(res.data.available))
      .catch(() => {});
  }, []);

  const openPayment = (cs: CreditSale) => {
    setPaymentModal(cs);
    setPayAmount('');
    setPayMethod('Cash');
    setPayNotes('');
  };

  const handlePayment = async () => {
    if (!paymentModal || !payAmount || parseFloat(payAmount) <= 0) { toast.error('Enter a valid amount'); return; }
    try {
      await api.post(`/credit-sales/${paymentModal.credit_sale_id}/payment`, {
        amount: parseFloat(payAmount), payment_method: payMethod, notes: payNotes || null
      });
      setPaymentModal(null);
      fetchSales();
      fetchStats();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const isOverdue = (cs: CreditSale) => cs.status !== 'paid' && new Date(cs.due_date) < new Date();

  const handleThermalPrintCS = async (cs: CreditSale) => {
    setThermalPrintingId(cs.credit_sale_id);
    try {
      await api.post('/settings/print-thermal-document', {
        purpose: 'credit_sale',
        documentData: {
          saleId: cs.sale_id,
          customerName: cs.customer_name,
          totalAmount: cs.total_amount,
          paidAmount: cs.paid_amount,
          balanceDue: cs.balance_due,
          dueDate: cs.due_date,
          status: cs.status,
        },
      });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Print failed');
    } finally {
      setThermalPrintingId(null);
    }
  };

  const handlePrintRow = (cs: CreditSale) => {
    const rows = [[`#${cs.sale_id}`, cs.customer_name, `${currency}${Number(cs.total_amount).toFixed(0)}`, `${currency}${Number(cs.paid_amount).toFixed(0)}`, `${currency}${Number(cs.balance_due).toFixed(0)}`, new Date(cs.due_date).toLocaleDateString(), cs.status]];
    const content = buildTable(['Sale #', 'Customer', 'Total', 'Paid', 'Balance', 'Due Date', 'Status'], rows, { alignRight: [2, 3, 4] });
    printReport({ title: `Credit Sale - ${cs.customer_name}`, content });
  };

  const handlePrint = () => {
    let content = buildStatsCards([
      { label: 'Total Outstanding', value: `${currency}${Number(stats.total_outstanding).toFixed(0)}` },
      { label: 'Overdue', value: String(stats.overdue_count) },
      { label: 'Collected This Month', value: `${currency}${Number(stats.collected_this_month).toFixed(0)}` },
      { label: 'Active Credit Sales', value: String(stats.active_count) },
    ]);
    const rows = sales.map(cs => [
      `#${cs.sale_id}`, cs.customer_name, `${currency}${Number(cs.total_amount).toFixed(0)}`, `${currency}${Number(cs.paid_amount).toFixed(0)}`,
      `${currency}${Number(cs.balance_due).toFixed(0)}`, new Date(cs.due_date).toLocaleDateString(), cs.status
    ]);
    content += buildTable(['Sale #', 'Customer', 'Total', 'Paid', 'Balance', 'Due Date', 'Status'], rows, { alignRight: [2, 3, 4] });
    printReport({ title: 'Credit Sales Report', content });
  };

  return (
    <>
    {receiptViewData && <ReceiptModal data={receiptViewData} onClose={() => setReceiptViewData(null)} />}
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 flex items-center gap-3"><CreditCard className="text-rose-600" size={20} /> Credit Sales</h1>
          <p className="text-gray-500 mt-1">Manage customer credit accounts and payments</p>
        </div>
        <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition" disabled={sales.length === 0}>
          <Printer size={16} /> <span className="hidden sm:inline">Print</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-rose-50 rounded-xl"><DollarSign size={24} className="text-rose-600" /></div>
            <div><p className="text-2xl font-bold text-rose-600">{currency}{Number(stats.total_outstanding).toFixed(0)}</p><p className="text-sm text-gray-500">Total Outstanding</p></div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-50 rounded-xl"><AlertTriangle size={24} className="text-red-600" /></div>
            <div><p className="text-2xl font-bold text-red-600">{stats.overdue_count}</p><p className="text-sm text-gray-500">Overdue</p></div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 rounded-xl"><CheckCircle size={24} className="text-emerald-600" /></div>
            <div><p className="text-2xl font-bold text-emerald-600">{currency}{Number(stats.collected_this_month).toFixed(0)}</p><p className="text-sm text-gray-500">Collected This Month</p></div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 rounded-xl"><Clock size={24} className="text-emerald-600" /></div>
            <div><p className="text-2xl font-bold text-emerald-600">{stats.active_count}</p><p className="text-sm text-gray-500">Active Credit Sales</p></div>
          </div>
        </div>
      </div>

      {/* Tabs & Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-4 items-center">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button onClick={() => { setTab('all'); setPage(1); }} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'all' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}>All</button>
            <button onClick={() => { setTab('overdue'); setPage(1); }} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === 'overdue' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}>Overdue</button>
          </div>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Search by sale# or customer..." className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
            <option value="">All Status</option>
            <option value="pending">Pending</option><option value="partial">Partial</option><option value="paid">Paid</option><option value="overdue">Overdue</option>
          </select>
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" title="Start Date" />
          <span className="text-gray-400 text-sm">to</span>
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" title="End Date" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-600"></div></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sale #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Paid</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sales.map((cs) => {
                  const badge = STATUS_BADGES[isOverdue(cs) ? 'overdue' : cs.status] || STATUS_BADGES.pending;
                  return (
                    <tr key={cs.credit_sale_id} className={`hover:bg-gray-50 ${isOverdue(cs) ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-3 font-mono font-medium">#{cs.sale_id}</td>
                      <td className="px-4 py-3 text-gray-700 font-medium">{cs.customer_name}</td>
                      <td className="px-4 py-3 text-right">{currency}{Number(cs.total_amount).toFixed(0)}</td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-medium">{currency}{Number(cs.paid_amount).toFixed(0)}</td>
                      <td className="px-4 py-3 text-right font-bold text-rose-600">{currency}{Number(cs.balance_due).toFixed(0)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{new Date(cs.due_date).toLocaleDateString()}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>{badge.label}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {cs.status !== 'paid' && (
                            <button onClick={() => openPayment(cs)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors">
                              <DollarSign size={14} /> Record Payment
                            </button>
                          )}
                          <button
                            onClick={async () => {
                              const sRes = await api.get('/settings').catch(() => ({ data: {} }));
                              setReceiptViewData(buildCreditSaleReceipt(cs, sRes.data));
                            }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Receipt"
                          >
                            <FileText size={14} />
                          </button>
                          <button
                            onClick={() => creditThermalAvailable ? handleThermalPrintCS(cs) : handlePrintRow(cs)}
                            disabled={thermalPrintingId === cs.credit_sale_id}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-60"
                            title="Print Receipt"
                          >
                            {thermalPrintingId === cs.credit_sale_id ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {sales.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400"><CreditCard size={40} className="mx-auto mb-3 text-gray-300" /><p>No credit sales found</p></td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} totalItems={totalItems} itemsPerPage={limit} onItemsPerPageChange={(v) => { setLimit(v); setPage(1); }} />
      </div>

      {/* Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b">
              <div><h2 className="text-base font-semibold">Record Payment</h2><p className="text-sm text-gray-500">Sale #{paymentModal.sale_id} - {paymentModal.customer_name}</p></div>
              <button onClick={() => setPaymentModal(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-center">
                <p className="text-sm text-rose-600">Balance Due</p>
                <p className="text-2xl font-bold text-rose-700">{currency}{Number(paymentModal.balance_due).toFixed(0)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                <input type="number" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-rose-500 outline-none" min="0.01" step="0.01" max={paymentModal.balance_due} placeholder="0.00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                  <option value="Cash">Cash</option><option value="Card">Card</option><option value="Online">Online</option><option value="Bank Transfer">Bank Transfer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={payNotes} onChange={(e) => setPayNotes(e.target.value)} rows={2} className="w-full px-3 py-2 border rounded-lg" placeholder="Optional" />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t">
              <button onClick={() => setPaymentModal(null)} className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handlePayment} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">Record Payment</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default CreditSales;
