import React, { useEffect, useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import { X, Printer, DollarSign, CreditCard, Smartphone, RefreshCw, BarChart } from 'lucide-react';
import api from '../utils/api';

interface DailyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DailyReportModal: React.FC<DailyReportModalProps> = ({ isOpen, onClose }) => {
  const { currencySymbol: currency } = useSettings();
  const [sales, setSales] = useState<any[]>([]);
  const [, setLoading] = useState(false);
  const [summary, setSummary] = useState({
    totalSales: 0,
    cash: 0,
    card: 0,
    online: 0,
    refunded: 0,
    count: 0
  });

  const fetchSales = async () => {
    setLoading(true);
    try {
      const res = await api.get('/sales/today');
      setSales(res.data);
      calculateSummary(res.data);
    } catch (error) {
      console.error("Failed to fetch daily sales", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateSummary = (data: any[]) => {
    const stats = {
      totalSales: 0,
      cash: 0,
      card: 0,
      online: 0,
      refunded: 0,
      count: 0
    };

    data.forEach(sale => {
      if (sale.status === 'refunded') {
        stats.refunded += parseFloat(sale.total_amount);
      } else {
        stats.totalSales += parseFloat(sale.total_amount);
        stats.count++;
        if (sale.payment_method === 'cash') stats.cash += parseFloat(sale.amount_paid);
        else if (sale.payment_method === 'card') stats.card += parseFloat(sale.amount_paid);
        else if (sale.payment_method === 'online') stats.online += parseFloat(sale.amount_paid);
      }
    });
    setSummary(stats);
  };

  useEffect(() => {
    if (isOpen) fetchSales();
  }, [isOpen]);

  const handlePrint = () => {
      const printWindow = window.open('', '', 'width=400,height=600');
      if (!printWindow) return;

      const reportHtml = `
        <html>
          <head>
            <title>Z-Report</title>
            <style>
              @page { size: 80mm auto; margin: 0; }
              body { font-family: 'Courier New', monospace; width: 80mm; margin: 0 auto; padding: 5mm; background: white; color: black; font-size: 12px; }
              .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
              .title { font-size: 16px; font-weight: bold; }
              .row { display: flex; justify-content: space-between; margin: 5px 0; }
              .bold { font-weight: bold; }
              .divider { border-top: 1px dashed #000; margin: 10px 0; }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="title">Z-REPORT</div>
              <div>{currency}{new Date().toLocaleDateString()}</div>
              <div>{currency}{new Date().toLocaleTimeString()}</div>
            </div>
            
            <div class="row bold">
              <span>Total Sales:</span>
              <span>$${summary.totalSales.toFixed(0)}</span>
            </div>
            <div class="row">
              <span>Total Orders:</span>
              <span>{currency}{summary.count}</span>
            </div>
            
            <div class="divider"></div>
            
            <div class="row">
              <span>Cash:</span>
              <span>$${summary.cash.toFixed(0)}</span>
            </div>
            <div class="row">
              <span>Card:</span>
              <span>$${summary.card.toFixed(0)}</span>
            </div>
            <div class="row">
              <span>Online:</span>
              <span>$${summary.online.toFixed(0)}</span>
            </div>
            
            <div class="divider"></div>
            
            <div class="row">
              <span>Refunds:</span>
              <span>$${summary.refunded.toFixed(0)}</span>
            </div>
            
            <div class="divider"></div>
            
            <div class="row bold">
              <span>Net Cash:</span>
              <span>$${(summary.cash).toFixed(0)}</span>
            </div>
          </body>
        </html>
      `;
      
      printWindow.document.write(reportHtml);
      printWindow.document.close();
      
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <BarChart size={24} className="text-emerald-600" />
            Daily Sales Report (Z-Report)
          </h2>
          <div className="flex items-center gap-4">
             <button 
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-bold shadow-md shadow-emerald-200"
              >
                <Printer size={18} />
                Print Z-Report
              </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 bg-gray-50/50">
          
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
             <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                   <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                      <DollarSign size={20} />
                   </div>
                   <p className="text-sm text-gray-500 font-medium">Total Sales</p>
                </div>
                <p className="text-2xl font-bold text-gray-800">{currency}{summary.totalSales.toFixed(0)}</p>
             </div>

             <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                   <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                      <CreditCard size={20} />
                   </div>
                   <p className="text-sm text-gray-500 font-medium">Card Sales</p>
                </div>
                <p className="text-2xl font-bold text-gray-800">{currency}{summary.card.toFixed(0)}</p>
             </div>

             <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                   <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                      <Smartphone size={20} />
                   </div>
                   <p className="text-sm text-gray-500 font-medium">Online Sales</p>
                </div>
                <p className="text-2xl font-bold text-gray-800">{currency}{summary.online.toFixed(0)}</p>
             </div>

             <div className="bg-white p-4 rounded-xl border border-red-100 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                   <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                      <RefreshCw size={20} />
                   </div>
                   <p className="text-sm text-gray-500 font-medium">Refunds</p>
                </div>
                <p className="text-2xl font-bold text-gray-800">{currency}{summary.refunded.toFixed(0)}</p>
             </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50">
               <h3 className="font-semibold text-gray-800">Today's Transactions</h3>
            </div>
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3 border-b border-gray-100">Time</th>
                  <th className="px-6 py-3 border-b border-gray-100">Order #</th>
                  <th className="px-6 py-3 border-b border-gray-100">Amount</th>
                  <th className="px-6 py-3 border-b border-gray-100">Method</th>
                  <th className="px-6 py-3 border-b border-gray-100">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sales.map(sale => (
                  <tr key={sale.sale_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 text-sm text-gray-600">{new Date(sale.sale_date).toLocaleTimeString()}</td>
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">#{sale.sale_id}</td>
                    <td className="px-6 py-3 text-sm font-bold text-emerald-600">{currency}{parseFloat(sale.total_amount).toFixed(0)}</td>
                    <td className="px-6 py-3 text-sm text-gray-600 capitalize">{sale.payment_method}</td>
                    <td className="px-6 py-3">
                       <span className={`px-2 py-1 text-xs rounded-full font-medium capitalize border ${
                          sale.status === 'refunded' 
                          ? 'bg-red-50 text-red-700 border-red-100' 
                          : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        }`}>
                          {sale.status}
                        </span>
                    </td>
                  </tr>
                ))}
                {sales.length === 0 && (
                   <tr>
                      <td colSpan={5} className="text-center py-8 text-gray-400">No transactions today</td>
                   </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      </div>
    </div>
  );
};

export default DailyReportModal;
