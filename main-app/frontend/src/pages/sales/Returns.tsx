import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { RotateCcw, Search, Loader2, Check, Printer, FileText } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import Pagination from '../../components/Pagination';
import { ReceiptModal } from '../../printing/ReceiptView';
import { buildReturnReceipt } from '../../printing/receiptBuilder';

interface SaleItem {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: string;
  already_returned: number;
  max_returnable: number;
}

interface SaleData {
  sale_id: number;
  sale_date: string;
  total_amount: string;
  status: string;
  customer_name: string;
  cashier_name: string;
  payment_method: string;
  items: SaleItem[];
}

const REASONS = [
  { value: 'defective', label: 'Defective Product' },
  { value: 'wrong_item', label: 'Wrong Item' },
  { value: 'customer_change', label: 'Customer Changed Mind' },
  { value: 'expired', label: 'Expired' },
  { value: 'other', label: 'Other' },
];

const Returns = () => {
  const { currencySymbol: currency } = useSettings();
  const toast = useToast();
  const [saleId, setSaleId] = useState('');
  const [sale, setSale] = useState<SaleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  // Return form state
  const [selectedItems, setSelectedItems] = useState<Record<number, number>>({});
  const [reason, setReason] = useState('');
  const [reasonNote, setReasonNote] = useState('');
  const [refundMethod, setRefundMethod] = useState('original');
  const [returnType, setReturnType] = useState<'return' | 'exchange'>('return');

  // Return result for printing
  const [returnData, setReturnData] = useState<{ saleId: number; items: { product_name: string; quantity: number; unit_price: string }[]; refundAmount: number; reason: string; refundMethod: string; returnType: string } | null>(null);
  const [thermalAvailable, setThermalAvailable] = useState(false);
  const [thermalPrinting, setThermalPrinting] = useState(false);
  const [receiptViewData, setReceiptViewData] = useState<any>(null);

  // Recent returns
  const [recentReturns, setRecentReturns] = useState<any[]>([]);
  const [showRecent, setShowRecent] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [returnsDateFrom, setReturnsDateFrom] = useState('');
  const [returnsDateTo, setReturnsDateTo] = useState('');

  const searchSale = async () => {
    if (!saleId.trim()) return;
    setLoading(true);
    setSale(null);
    setSuccess(false);
    setSelectedItems({});
    try {
      const res = await api.get(`/returns/sale/${saleId}`);
      if (res.data.status !== 'completed') {
        toast.error('Only completed sales can be returned');
        setLoading(false);
        return;
      }
      setSale(res.data);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Sale not found');
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (productId: number, maxQty: number) => {
    setSelectedItems(prev => {
      const copy = { ...prev };
      if (copy[productId]) {
        delete copy[productId];
      } else {
        copy[productId] = maxQty;
      }
      return copy;
    });
  };

  const updateQty = (productId: number, qty: number) => {
    setSelectedItems(prev => ({ ...prev, [productId]: qty }));
  };

  const totalRefund = sale ? Object.entries(selectedItems).reduce((sum, [pid, qty]) => {
    const item = sale.items.find(i => i.product_id === Number(pid));
    return sum + (item ? parseFloat(item.unit_price) * qty : 0);
  }, 0) : 0;

  const handleReturn = async () => {
    if (Object.keys(selectedItems).length === 0) {
      toast.error('Please select at least one item to return');
      return;
    }
    if (!reason) {
      toast.error('Please select a reason');
      return;
    }

    setProcessing(true);
    try {
      const items = Object.entries(selectedItems).map(([pid, qty]) => ({
        product_id: Number(pid),
        quantity_returned: qty,
      }));

      // Capture data for printing before clearing state
      const printItems = Object.entries(selectedItems).map(([pid, qty]) => {
        const item = sale!.items.find(i => i.product_id === Number(pid));
        return { product_name: item?.product_name || '', quantity: qty, unit_price: item?.unit_price || '0' };
      });
      const capturedReturnData = {
        saleId: sale!.sale_id,
        items: printItems,
        refundAmount: totalRefund,
        reason: REASONS.find(r => r.value === reason)?.label || reason,
        refundMethod,
        returnType,
      };

      await api.post('/returns', {
        sale_id: sale?.sale_id,
        items,
        reason,
        reason_note: reasonNote,
        refund_method: refundMethod,
        return_type: returnType,
      });

      setReturnData(capturedReturnData);
      setSuccess(true);
      setSale(null);
      setSelectedItems({});
      setReason('');
      setReasonNote('');
      setSaleId('');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to process return');
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => {
    api.get('/settings/printers/check?purpose=return_receipt')
      .then(res => setThermalAvailable(res.data.available))
      .catch(() => {});
  }, []);

  const handleThermalPrint = async () => {
    if (!returnData) return;
    setThermalPrinting(true);
    try {
      await api.post('/settings/print-thermal-document', {
        purpose: 'return_receipt',
        documentData: returnData,
      });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Print failed');
    } finally {
      setThermalPrinting(false);
    }
  };

  const loadRecentReturns = useCallback(async () => {
    try {
      const params: Record<string, string | number> = { page: currentPage, limit: itemsPerPage };
      if (returnsDateFrom) params.date_start = returnsDateFrom;
      if (returnsDateTo) params.date_end = returnsDateTo;
      const res = await api.get('/returns', { params });
      if (res.data.pagination) {
        setRecentReturns(res.data.data);
        setTotalItems(res.data.pagination.total);
        setTotalPages(res.data.pagination.totalPages);
      } else {
        setRecentReturns(res.data);
      }
      setShowRecent(true);
    } catch (error) {
      console.error('Failed to fetch returns', error);
    }
  }, [currentPage, itemsPerPage, returnsDateFrom, returnsDateTo]);

  useEffect(() => {
    if (showRecent) {
      loadRecentReturns();
    }
  }, [showRecent, currentPage, loadRecentReturns]);

  return (
    <>
    {receiptViewData && <ReceiptModal data={receiptViewData} onClose={() => setReceiptViewData(null)} />}
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 flex items-center gap-3">
            <RotateCcw className="text-emerald-600" size={20} />
            Returns & Exchanges
          </h1>
          <p className="text-gray-500 mt-1">Process returns and exchanges for completed sales</p>
        </div>
        <button
          onClick={() => setShowRecent(true)}
          className="text-gray-600 hover:text-gray-800 text-sm border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
        >
          View Recent Returns
        </button>
      </div>

      {/* Success Message */}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 flex items-center gap-3 flex-wrap">
          <Check size={20} className="text-emerald-600 flex-shrink-0" />
          <span className="text-emerald-700 font-medium">Return processed successfully! Stock has been restored.</span>
          <div className="ml-auto flex items-center gap-2">
            {returnData && (
              <button
                onClick={async () => {
                  const sRes = await api.get('/settings').catch(() => ({ data: {} }));
                  setReceiptViewData(buildReturnReceipt({
                    sale_id:       returnData.saleId,
                    items:         returnData.items.map(i => ({ product_name: i.product_name, quantity: i.quantity, unit_price: i.unit_price })),
                    refund_amount: returnData.refundAmount,
                    refund_method: returnData.refundMethod,
                    reason:        returnData.reason,
                  }, sRes.data));
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-emerald-300 text-emerald-700 text-sm rounded-lg transition-colors hover:bg-emerald-50"
              >
                <FileText size={14} /> View
              </button>
            )}
            {thermalAvailable && returnData && (
              <button
                onClick={handleThermalPrint}
                disabled={thermalPrinting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg transition-colors disabled:opacity-60"
              >
                {thermalPrinting ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
                Print
              </button>
            )}
            <button onClick={() => { setSuccess(false); setReturnData(null); }} className="text-emerald-600 hover:text-emerald-800 text-sm">Dismiss</button>
          </div>
        </div>
      )}

      {/* Sale Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="font-semibold text-gray-800 mb-4">Find Sale</h2>
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="number"
              value={saleId}
              onChange={(e) => setSaleId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchSale()}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="Enter Sale ID..."
            />
          </div>
          <button
            onClick={searchSale}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:bg-gray-300"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
            Search
          </button>
        </div>
      </div>

      {/* Sale Details & Return Form */}
      {sale && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sale Info + Items */}
          <div className="lg:col-span-2 space-y-6">
            {/* Sale Header */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Sale #</span>
                  <p className="font-bold text-gray-800">{sale.sale_id}</p>
                </div>
                <div>
                  <span className="text-gray-500">Date</span>
                  <p className="font-medium">{new Date(sale.sale_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="text-gray-500">Customer</span>
                  <p className="font-medium">{sale.customer_name}</p>
                </div>
                <div>
                  <span className="text-gray-500">Total</span>
                  <p className="font-bold text-emerald-600">{currency}{parseFloat(sale.total_amount).toFixed(0)}</p>
                </div>
              </div>
            </div>

            {/* Items Selection */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800">Select Items to Return</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {sale.items.map(item => (
                  <div key={item.product_id} className={`p-4 flex items-center gap-4 ${item.max_returnable === 0 ? 'opacity-50' : ''}`}>
                    <input
                      type="checkbox"
                      checked={!!selectedItems[item.product_id]}
                      onChange={() => toggleItem(item.product_id, item.max_returnable)}
                      disabled={item.max_returnable === 0}
                      className="w-5 h-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{item.product_name}</p>
                      <p className="text-sm text-gray-500">
                        ${parseFloat(item.unit_price).toFixed(0)} each | Bought: {item.quantity}
                        {item.already_returned > 0 && <span className="text-orange-500"> | Already returned: {item.already_returned}</span>}
                      </p>
                    </div>
                    {selectedItems[item.product_id] !== undefined && (
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-500">Qty:</label>
                        <input
                          type="number"
                          value={selectedItems[item.product_id]}
                          onChange={(e) => updateQty(item.product_id, Math.min(item.max_returnable, Math.max(1, parseInt(e.target.value) || 1)))}
                          min={1}
                          max={item.max_returnable}
                          className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-center font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                      </div>
                    )}
                    {item.max_returnable === 0 && (
                      <span className="text-xs text-gray-400">Fully returned</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Return Form Sidebar */}
          <div className="space-y-6">
            {/* Return Type */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-800 mb-3">Return Type</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setReturnType('return')}
                  className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                    returnType === 'return' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600'
                  }`}
                >
                  Return
                </button>
                <button
                  onClick={() => setReturnType('exchange')}
                  className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                    returnType === 'exchange' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-600'
                  }`}
                >
                  Exchange
                </button>
              </div>
            </div>

            {/* Reason */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-800 mb-3">Reason</h3>
              <div className="space-y-2">
                {REASONS.map(r => (
                  <button
                    key={r.value}
                    onClick={() => setReason(r.value)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
                      reason === r.value ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <textarea
                value={reasonNote}
                onChange={(e) => setReasonNote(e.target.value)}
                className="w-full mt-3 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none h-16"
                placeholder="Additional notes..."
              />
            </div>

            {/* Refund Method */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-800 mb-3">Refund Method</h3>
              <select
                value={refundMethod}
                onChange={(e) => setRefundMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="original">Original Payment Method</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="store_credit">Store Credit</option>
              </select>
            </div>

            {/* Refund Summary */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-800 mb-3">Refund Summary</h3>
              <div className="text-center">
                <p className="text-sm text-gray-500">Total Refund Amount</p>
                <p className="text-3xl font-bold text-red-600 mt-1">{currency}{totalRefund.toFixed(0)}</p>
                <p className="text-xs text-gray-400 mt-1">{Object.keys(selectedItems).length} item(s) selected</p>
              </div>

              <button
                onClick={handleReturn}
                disabled={processing || Object.keys(selectedItems).length === 0 || !reason}
                className="w-full mt-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {processing ? <Loader2 className="animate-spin" size={20} /> : <RotateCcw size={20} />}
                Process Return
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recent Returns */}
      {showRecent && (
        <div className="mt-8">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h3 className="text-sm font-semibold text-gray-800">Recent Returns</h3>
            <input type="date" value={returnsDateFrom} onChange={(e) => { setReturnsDateFrom(e.target.value); setCurrentPage(1); }} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" title="Start Date" />
            <span className="text-gray-400 text-sm">to</span>
            <input type="date" value={returnsDateTo} onChange={(e) => { setReturnsDateTo(e.target.value); setCurrentPage(1); }} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" title="End Date" />
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[600px]">
              <thead className="bg-gray-50 text-gray-600 font-medium">
                <tr>
                  <th className="p-4">Return ID</th>
                  <th className="p-4">Sale #</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Reason</th>
                  <th className="p-4">Refund</th>
                  <th className="p-4">Processed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentReturns.length > 0 ? recentReturns.map((r: any) => (
                  <tr key={r.return_id} className="hover:bg-gray-50">
                    <td className="p-4 font-medium">#{r.return_id}</td>
                    <td className="p-4">#{r.sale_id}</td>
                    <td className="p-4 text-gray-500">{new Date(r.return_date).toLocaleDateString()}</td>
                    <td className="p-4 text-gray-600 capitalize">{(r.reason || '').replace(/_/g, ' ')}</td>
                    <td className="p-4 font-medium text-red-600">{currency}{parseFloat(r.refund_amount || 0).toFixed(0)}</td>
                    <td className="p-4 text-gray-600">{r.processed_by}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} className="p-8 text-center text-gray-400">No returns found</td></tr>
                )}
              </tbody>
            </table>
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={(v) => { setItemsPerPage(v); setCurrentPage(1); }}
            />
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default Returns;
