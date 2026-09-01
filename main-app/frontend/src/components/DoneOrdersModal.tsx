import React, { useEffect, useState, useCallback } from 'react';
import { X, Archive, Search, FileText, CheckCircle, RotateCcw } from 'lucide-react';
import api from '../utils/api';
import Pagination from './Pagination';
import { useToast } from './Toast';
import { useConfirm } from './ConfirmDialog';

interface DoneOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DoneOrdersModal: React.FC<DoneOrdersModalProps> = ({ isOpen, onClose }) => {
  const toast = useToast();
  const confirm = useConfirm();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/sales', {
        params: {
          page: currentPage,
          limit: itemsPerPage,
          status: 'completed,refunded',
          search: searchTerm
        }
      });
      
      if (res.data.pagination) {
        setSales(res.data.data);
        setTotalItems(res.data.pagination.total);
        setTotalPages(res.data.pagination.totalPages);
      } else {
        setSales(res.data);
      }
    } catch (error) {
      console.error("Failed to fetch sales", error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm]);

  const handleRefund = async (saleId: number) => {
    const ok = await confirm({ title: 'Refund Order', message: `Are you sure you want to refund Order #${saleId}? This will restore stock.`, type: 'danger' });
    if (!ok) return;

    try {
      await api.post(`/sales/${saleId}/refund`);
      toast.success('Order refunded successfully');
      fetchSales();
    } catch (error) {
      console.error("Failed to refund order", error);
      toast.error('Failed to refund order');
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSales();
    }
  }, [isOpen, fetchSales]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to page 1 on search
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <CheckCircle size={24} className="text-emerald-600" />
            Done Orders
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-gray-100 bg-white">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by Order ID or Customer Name"
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
              value={searchTerm}
              onChange={handleSearch}
            />
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-auto p-6 bg-gray-50/50">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
            </div>
          ) : sales.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <Archive size={48} className="mb-4 opacity-20" />
              <p>No completed orders found</p>
            </div>
          ) : (
            <>
              <div className="overflow-hidden bg-white border border-gray-200 rounded-xl shadow-sm mb-4">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 text-gray-600 text-sm uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4 font-semibold border-b border-gray-100">Order #</th>
                      <th className="px-6 py-4 font-semibold border-b border-gray-100">Date</th>
                      <th className="px-6 py-4 font-semibold border-b border-gray-100">Customer</th>
                      <th className="px-6 py-4 font-semibold border-b border-gray-100">Amount</th>
                      <th className="px-6 py-4 font-semibold border-b border-gray-100">Payment</th>
                      <th className="px-6 py-4 font-semibold border-b border-gray-100">Status</th>
                      <th className="px-6 py-4 font-semibold border-b border-gray-100 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sales.map(sale => (
                      <tr key={sale.sale_id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900">#{sale.sale_id}</td>
                        <td className="px-6 py-4 text-gray-600 text-sm">
                          {new Date(sale.sale_date).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {sale.customer_name || 'Walk-in'}
                        </td>
                        <td className="px-6 py-4 font-bold text-emerald-600">
                          ${parseFloat(sale.total_amount).toFixed(0)}
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-xs rounded-full font-medium capitalize border border-emerald-100">
                            {sale.payment_method}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs rounded-full font-medium capitalize border ${
                            sale.status === 'refunded' 
                            ? 'bg-red-50 text-red-700 border-red-100' 
                            : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          }`}>
                            {sale.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleRefund(sale.sale_id)}
                            disabled={sale.status === 'refunded'}
                            className={`p-2 transition-colors ${
                              sale.status === 'refunded' ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 hover:text-red-500'
                            }`} 
                            title="Refund Order"
                          >
                            <RotateCcw size={18} />
                          </button>
                          <button className="p-2 text-gray-400 hover:text-emerald-600 transition-colors" title="View Details">
                            <FileText size={18} />
                          </button>
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
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DoneOrdersModal;
