import { useNavigate } from 'react-router-dom';
import { FileText, ArrowLeft } from 'lucide-react';
import CompletedOrdersView from '../../components/CompletedOrdersView';

const Orders = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b-2 border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/pos')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
            >
              <ArrowLeft size={24} />
            </button>
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-2.5 rounded-xl shadow-lg">
                <FileText size={28} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-gray-900">Orders Management</h1>
                <p className="text-sm text-gray-500">Track and manage all your completed orders</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-6">
        <CompletedOrdersView />
      </div>
    </div>
  );
};

export default Orders;
