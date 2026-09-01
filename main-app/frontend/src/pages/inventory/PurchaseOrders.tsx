import { useState, useEffect } from 'react';
import { Plus, Eye, FileText, Search, Filter, Info, Pencil, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Pagination from '../../components/Pagination';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import CreatePOModal from '../../components/CreatePOModal';
import ViewPODetailsModal from '../../components/ViewPODetailsModal';

const PurchaseOrders = () => {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { error, success } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [editPO, setEditPO] = useState<any>(null);      // PO being edited (with items pre-loaded)
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => { fetchOrders(); }, [pagination.page, statusFilter]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params: any = { page: pagination.page, limit: pagination.limit };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (searchTerm) params.search = searchTerm;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await api.get('/purchase-orders', { params });
      setOrders(res.data.data || []);
      if (res.data.pagination) setPagination(res.data.pagination);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const handleSearch = () => {
    setPagination(p => ({ ...p, page: 1 }));
    fetchOrders();
  };

  const handleViewDetails = (po: any) => {
    setSelectedPO(po);
    setShowDetailsModal(true);
  };

  // Load full PO (with items) then open edit modal
  const handleEdit = async (po: any) => {
    try {
      const res = await api.get(`/purchase-orders/${po.po_id}`);
      setEditPO(res.data);
      setShowCreateModal(true);
    } catch {
      error('Failed to load PO details');
    }
  };

  const handleDelete = async (po: any) => {
    const ok = await confirm({ title: 'Delete Purchase Order', message: `Delete ${po.po_number}? This cannot be undone.`, type: 'danger' });
    if (!ok) return;
    setDeletingId(po.po_id);
    try {
      await api.delete(`/purchase-orders/${po.po_id}`);
      success('Purchase order deleted');
      fetchOrders();
    } catch (err: any) {
      error(err?.response?.data?.message || 'Delete failed');
    } finally { setDeletingId(null); }
  };

  const handleModalClose = () => {
    setShowCreateModal(false);
    setEditPO(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'received':  return 'bg-emerald-100 text-emerald-700';
      case 'pending':   return 'bg-yellow-100 text-yellow-700';
      case 'draft':     return 'bg-gray-100 text-gray-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default:          return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading && orders.length === 0) return <div className="p-4 sm:p-6">Loading...</div>;

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <FileText className="text-emerald-600" size={20} />
          <h1 className="text-xl font-semibold tracking-tight text-gray-900">Purchase Orders</h1>
        </div>
        <button
          onClick={() => { setEditPO(null); setShowCreateModal(true); }}
          className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl hover:bg-emerald-700 transition shadow-lg hover:shadow-xl"
        >
          <Plus size={20} />
          <span className="hidden sm:inline">Create Purchase Order</span>
        </button>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-4 py-3 mb-6 text-sm">
        <Info size={16} className="mt-0.5 shrink-0 text-blue-500" />
        <span>
          To receive goods against a PO, use the{' '}
          <button onClick={() => navigate('/purchase-voucher')}
            className="font-semibold underline hover:text-blue-900">
            Purchase Voucher (GRN)
          </button>{' '}
          module — select <strong>"From Purchase Order"</strong> to pre-fill items from this PO.
        </span>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search by PO number or supplier..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-500" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="pending">Pending</option>
              <option value="received">Received</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm"
              title="Start Date"
            />
            <span className="text-gray-400 text-sm">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm"
              title="End Date"
            />
          </div>
          <button onClick={handleSearch}
            className="bg-emerald-600 text-white px-5 py-2 rounded-lg hover:bg-emerald-700 transition text-sm">
            Apply
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-4 font-semibold text-gray-700">PO Number</th>
              <th className="text-left p-4 font-semibold text-gray-700">Supplier</th>
              <th className="text-left p-4 font-semibold text-gray-700">Order Date</th>
              <th className="text-right p-4 font-semibold text-gray-700">Total Amount</th>
              <th className="text-center p-4 font-semibold text-gray-700">Status</th>
              <th className="text-center p-4 font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.length > 0 ? orders.map((po: any) => (
              <tr key={po.po_id} className="border-b hover:bg-gray-50 transition">
                <td className="p-4 font-semibold text-emerald-600">{po.po_number}</td>
                <td className="p-4">{po.supplier_name}</td>
                <td className="p-4">{new Date(po.order_date).toLocaleDateString()}</td>
                <td className="p-4 text-right font-semibold">{Number(po.total_amount || 0).toFixed(0)}</td>
                <td className="p-4 text-center">
                  <span className={`px-3 py-1 rounded-full text-xs capitalize font-semibold ${getStatusColor(po.status)}`}>
                    {po.status}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center justify-center gap-1">
                    {/* View */}
                    <button onClick={() => handleViewDetails(po)}
                      className="text-emerald-600 hover:bg-emerald-50 p-2 rounded-lg transition" title="View">
                      <Eye size={16} />
                    </button>

                    {/* Edit — only draft/pending */}
                    {(po.status === 'draft' || po.status === 'pending') && (
                      <button onClick={() => handleEdit(po)}
                        className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition" title="Edit">
                        <Pencil size={16} />
                      </button>
                    )}

                    {/* Delete — only draft/pending/cancelled */}
                    {po.status !== 'received' && (
                      <button
                        onClick={() => handleDelete(po)}
                        disabled={deletingId === po.po_id}
                        className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition disabled:opacity-40" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
                  No purchase orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>

        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={page => setPagination(p => ({ ...p, page }))}
          totalItems={pagination.total}
          itemsPerPage={pagination.limit}
          onItemsPerPageChange={limit => setPagination(p => ({ ...p, limit, page: 1 }))}
        />
      </div>

      {/* Create / Edit Modal */}
      <CreatePOModal
        isOpen={showCreateModal}
        onClose={handleModalClose}
        onSuccess={() => { fetchOrders(); handleModalClose(); }}
        editPO={editPO}
      />

      {/* View Details Modal */}
      {selectedPO && (
        <ViewPODetailsModal
          isOpen={showDetailsModal}
          onClose={() => { setShowDetailsModal(false); setSelectedPO(null); }}
          poId={selectedPO.po_id}
        />
      )}
    </div>
  );
};

export default PurchaseOrders;
