import { useState, useEffect } from 'react';
import { X, Package } from 'lucide-react';
import api from '../utils/api';
import { useToast } from './Toast';

interface POItem {
  po_item_id: number;
  product_id: number;
  product_name: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
}

interface ReceiveStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  poId: number;
  poNumber: string;
}

const ReceiveStockModal = ({ isOpen, onClose, onSuccess, poId, poNumber }: ReceiveStockModalProps) => {
  const toast = useToast();
  const [items, setItems] = useState<POItem[]>([]);
  const [receivedQuantities, setReceivedQuantities] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [fetchingItems, setFetchingItems] = useState(false);

  useEffect(() => {
    if (isOpen && poId) {
      fetchPOItems();
    }
  }, [isOpen, poId]);

  const fetchPOItems = async () => {
    setFetchingItems(true);
    try {
      const res = await api.get(`/purchase-orders/${poId}`);
      const poItems = res.data.items || [];
      setItems(poItems);

      // Initialize received quantities with ordered quantities
      const initialQuantities: Record<number, number> = {};
      poItems.forEach((item: POItem) => {
        initialQuantities[item.po_item_id] = item.quantity_ordered;
      });
      setReceivedQuantities(initialQuantities);
    } catch (error) {
      console.error('Error fetching PO items:', error);
      toast.error('Failed to fetch PO items');
    } finally {
      setFetchingItems(false);
    }
  };

  const handleQuantityChange = (poItemId: number, value: number) => {
    setReceivedQuantities({
      ...receivedQuantities,
      [poItemId]: value
    });
  };

  const handleSubmit = async () => {
    // Validate all quantities
    const invalidItems = items.filter(item => {
      const received = receivedQuantities[item.po_item_id];
      return received === undefined || received < 0;
    });

    if (invalidItems.length > 0) {
      toast.error('Please enter valid received quantities for all items');
      return;
    }

    setLoading(true);
    try {
      const receiveData = {
        items: items.map(item => ({
          po_item_id: item.po_item_id,
          product_id: item.product_id,
          quantity_received: receivedQuantities[item.po_item_id]
        }))
      };

      await api.post(`/purchase-orders/${poId}/receive`, receiveData);
      toast.success('Stock received successfully! Inventory has been updated.');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error receiving stock:', error);
      toast.error(error.response?.data?.message || 'Failed to receive stock');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setItems([]);
    setReceivedQuantities({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package size={28} />
            <div>
              <h2 className="text-base font-semibold">Receive Stock</h2>
              <p className="text-emerald-100 text-sm mt-1">PO Number: {poNumber}</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-white hover:bg-white/20 p-2 rounded-lg transition">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {fetchingItems ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading items...</p>
            </div>
          ) : (
            <>
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 mb-6">
                <p className="text-sm text-emerald-800">
                  <strong>Note:</strong> Enter the quantity received for each item. The inventory will be updated automatically.
                  You can receive partial quantities if needed.
                </p>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-4 font-semibold text-gray-700">Product</th>
                      <th className="text-center p-4 font-semibold text-gray-700">Ordered</th>
                      <th className="text-center p-4 font-semibold text-gray-700">Received</th>
                      <th className="text-right p-4 font-semibold text-gray-700">Unit Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.po_item_id} className="border-t hover:bg-gray-50">
                        <td className="p-4">
                          <p className="font-medium text-gray-800">{item.product_name}</p>
                        </td>
                        <td className="p-4 text-center">
                          <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-semibold">
                            {item.quantity_ordered}
                          </span>
                        </td>
                        <td className="p-4">
                          <input
                            type="number"
                            min="0"
                            max={item.quantity_ordered}
                            value={receivedQuantities[item.po_item_id] || 0}
                            onChange={(e) => handleQuantityChange(item.po_item_id, Number(e.target.value))}
                            className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                          />
                        </td>
                        <td className="p-4 text-right text-gray-700">
                          ${Number(item.unit_cost).toFixed(0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {items.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No items found for this purchase order.
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50 flex items-center justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            disabled={loading || fetchingItems || items.length === 0}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : 'Confirm & Update Inventory'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiveStockModal;
