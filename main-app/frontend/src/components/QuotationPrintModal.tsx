import { useState, useEffect } from 'react';
import api from '../utils/api';
import { ReceiptModal } from '../printing/ReceiptView';
import { buildQuotationReceipt } from '../printing/receiptBuilder';

interface QuotationPrintModalProps {
  quotationId: number;
  onClose: () => void;
}

const QuotationPrintModal = ({ quotationId, onClose }: QuotationPrintModalProps) => {
  const [loading, setLoading] = useState(true);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [qRes, sRes] = await Promise.all([
          api.get(`/quotations/${quotationId}`),
          api.get('/settings'),
        ]);
        setReceiptData(buildQuotationReceipt(qRes.data, sRes.data));
      } catch (e: any) {
        setError(e.response?.data?.message || 'Failed to load quotation');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [quotationId]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 flex items-center gap-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
          <span className="text-gray-600">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium">Close</button>
        </div>
      </div>
    );
  }

  return receiptData ? <ReceiptModal data={receiptData} onClose={onClose} /> : null;
};

export default QuotationPrintModal;
