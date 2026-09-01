import { CheckCircle } from 'lucide-react';
import CompletedOrdersView from '../../components/CompletedOrdersView';

const DoneOrders = () => (
  <div className="min-h-screen bg-gray-100">
    <div className="bg-white border-b-2 border-gray-200 sticky top-0 z-10 shadow-sm">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-2.5 rounded-xl shadow-lg">
            <CheckCircle size={26} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-gray-900">Done Orders</h1>
            <p className="text-sm text-gray-500">View and manage all completed & paid orders</p>
          </div>
        </div>
      </div>
    </div>

    <div className="max-w-[1920px] mx-auto px-4 sm:px-6 py-6">
      <CompletedOrdersView title="Done Orders" />
    </div>
  </div>
);

export default DoneOrders;
