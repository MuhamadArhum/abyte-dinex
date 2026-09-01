import { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { X, FileText, Calendar, User, Package, DollarSign } from 'lucide-react';
import api from '../utils/api';
import { useToast } from './Toast';

interface POItem {
  po_item_id: number;
  product_id: number;
  product_name: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  total_cost: number;
}

interface PODetails {
  po_id: number;
  po_number: string;
  supplier_name: string;
  order_date: string;
  expected_date: string | null;
  received_date: string | null;
  status: string;
  total_amount: number;
  additional_charges: number;
  notes: string | null;
  created_by_name: string;
  items: POItem[];
  linked_pv?: { pv_id: number; pv_number: string; voucher_date: string; total_amount: number } | null;
}

interface ViewPODetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  poId: number;
}

const ViewPODetailsModal = ({ isOpen, onClose, poId }: ViewPODetailsModalProps) => {
  const { currencySymbol: currency } = useSettings();
  const toast = useToast();
  const [po, setPO] = useState<PODetails | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && poId) {
      fetchPODetails();
    }
  }, [isOpen, poId]);

  const fetchPODetails = async () => {
    setLoading(true);
    try {
      const [poRes, pvRes] = await Promise.all([
        api.get(`/purchase-orders/${poId}`),
        api.get('/purchase-vouchers', { params: { po_id: poId, limit: 1 } })
      ]);
      const poData = poRes.data;
      const pvList = pvRes.data.data || [];
      poData.linked_pv = pvList.length > 0 ? pvList[0] : null;
      setPO(poData);
    } catch (error) {
      console.error('Error fetching PO details:', error);
      toast.error('Failed to fetch PO details');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'received':
        return 'bg-green-100 text-green-700';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'draft':
        return 'bg-gray-100 text-gray-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const handleClose = () => {
    setPO(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText size={28} />
            <div>
              <h2 className="text-base font-semibold">Purchase Order Details</h2>
              {po && (
                <p className="text-emerald-100 text-sm mt-1">PO Number: {po.po_number}</p>
              )}
            </div>
          </div>
          <button onClick={handleClose} className="text-white hover:bg-white/20 p-2 rounded-lg transition">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading details...</p>
            </div>
          ) : po ? (
            <>
              {/* PO Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <User className="text-emerald-600" size={20} />
                    <h3 className="font-semibold text-gray-800">Supplier Information</h3>
                  </div>
                  <p className="text-lg font-bold text-gray-900">{po.supplier_name}</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Package className="text-emerald-600" size={20} />
                    <h3 className="font-semibold text-gray-800">Status</h3>
                  </div>
                  <span className={`inline-block px-4 py-2 rounded-full text-sm font-semibold capitalize ${getStatusColor(po.status)}`}>
                    {po.status}
                  </span>
                  {po.linked_pv && (
                    <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                      <p className="text-xs text-blue-600 font-semibold mb-0.5">Received via Purchase Voucher</p>
                      <p className="font-bold text-blue-800">{po.linked_pv.pv_number}</p>
                      <p className="text-xs text-blue-500">{po.linked_pv.voucher_date}</p>
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="text-emerald-600" size={20} />
                    <h3 className="font-semibold text-gray-800">Dates</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">Order Date:</span>
                      <span className="ml-2 font-semibold">{new Date(po.order_date).toLocaleDateString()}</span>
                    </div>
                    {po.expected_date && (
                      <div>
                        <span className="text-gray-600">Expected:</span>
                        <span className="ml-2 font-semibold">{new Date(po.expected_date).toLocaleDateString()}</span>
                      </div>
                    )}
                    {po.received_date && (
                      <div>
                        <span className="text-gray-600">Received:</span>
                        <span className="ml-2 font-semibold text-green-600">{new Date(po.received_date).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <DollarSign className="text-emerald-600" size={20} />
                    <h3 className="font-semibold text-gray-800">Total Amount</h3>
                  </div>
                  <p className="text-2xl font-bold text-emerald-600">{currency}{Number(po.total_amount || 0).toFixed(0)}</p>
                </div>
              </div>

              {/* Notes */}
              {po.notes && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 mb-6">
                  <h3 className="font-semibold text-gray-800 mb-2">Notes</h3>
                  <p className="text-gray-700">{po.notes}</p>
                </div>
              )}

              {/* Items Table */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 p-4 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-800">Order Items</h3>
                </div>

                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-left p-4 font-semibold text-gray-700">Product</th>
                      <th className="text-center p-4 font-semibold text-gray-700">Ordered</th>
                      <th className="text-center p-4 font-semibold text-gray-700">Received</th>
                      <th className="text-right p-4 font-semibold text-gray-700">Unit Cost</th>
                      <th className="text-right p-4 font-semibold text-gray-700">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {po.items.map((item) => (
                      <tr key={item.po_item_id} className="border-t hover:bg-gray-50">
                        <td className="p-4">
                          <p className="font-medium text-gray-800">{item.product_name}</p>
                        </td>
                        <td className="p-4 text-center">
                          <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-semibold">
                            {item.quantity_ordered}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                            item.quantity_received === item.quantity_ordered
                              ? 'bg-green-100 text-green-700'
                              : item.quantity_received > 0
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {item.quantity_received}
                          </span>
                        </td>
                        <td className="p-4 text-right text-gray-700">
                          ${Number(item.unit_cost).toFixed(0)}
                        </td>
                        <td className="p-4 text-right font-semibold text-gray-900">
                          ${Number(item.total_cost).toFixed(0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                    {Number(po.additional_charges) > 0 && (
                      <tr className="border-t border-gray-200">
                        <td colSpan={4} className="p-3 text-right text-gray-600 text-sm">Additional Charges:</td>
                        <td className="p-3 text-right text-sm">{Number(po.additional_charges).toFixed(0)}</td>
                      </tr>
                    )}
                    <tr>
                      <td colSpan={4} className="p-4 text-right font-bold text-gray-800 text-lg">Grand Total:</td>
                      <td className="p-4 text-right font-bold text-emerald-600 text-xl">
                        {Number(po.total_amount || 0).toFixed(0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Created By */}
              <div className="mt-6 text-center text-sm text-gray-500">
                Created by: <span className="font-semibold text-gray-700">{po.created_by_name}</span>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No purchase order details available.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50 flex items-center justify-end">
          <button
            onClick={handleClose}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewPODetailsModal;
