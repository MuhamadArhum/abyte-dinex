import { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../../context/SettingsContext';
import { Plus, Search, Edit, Trash2, User, Phone, ShoppingBag, Clock } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import AddCustomerModal from '../../components/AddCustomerModal';
import Pagination from '../../components/Pagination';

interface Purchase {
  sale_id: number;
  sale_date: string;
  net_amount: string;
  cashier_name: string;
}

interface Customer {
  customer_id: number;
  customer_name: string;
  phone_number: string;
  created_at: string;
  purchases?: Purchase[];
}

const Customers = () => {
  const { currencySymbol: currency } = useSettings();
  const toast = useToast();
  const confirm = useConfirm();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [purchaseHistory, setPurchaseHistory] = useState<Purchase[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // History Pagination State
  const [historyPage, setHistoryPage] = useState(1);
  const [historyItemsPerPage, setHistoryItemsPerPage] = useState(5);
  const [historyTotalItems, setHistoryTotalItems] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(0);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/customers', {
        params: {
          page: currentPage,
          limit: itemsPerPage,
          search: searchTerm
        }
      });
      
      if (res.data.pagination) {
        setCustomers(res.data.data);
        setTotalItems(res.data.pagination.total);
        setTotalPages(res.data.pagination.totalPages);
      } else {
        setCustomers(res.data);
      }
    } catch (error) {
      console.error("Failed to fetch customers", error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const fetchCustomerDetails = useCallback(async (id: number, page: number) => {
    setHistoryLoading(true);
    try {
      const res = await api.get(`/customers/${id}`, {
        params: {
          page: page,
          limit: historyItemsPerPage
        }
      });
      if (res.data.pagination) {
        setPurchaseHistory(res.data.purchases);
        setHistoryTotalItems(res.data.pagination.total);
        setHistoryTotalPages(res.data.pagination.totalPages);
      } else {
        setPurchaseHistory(res.data.purchases || []);
      }
    } catch (error) {
      console.error("Failed to fetch customer history", error);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyItemsPerPage]);

  useEffect(() => {
    if (selectedCustomer) {
      fetchCustomerDetails(selectedCustomer.customer_id, historyPage);
    }
  }, [selectedCustomer, historyPage, fetchCustomerDetails]);

  const handleDelete = async (id: number) => {
    const ok = await confirm({ title: 'Delete Customer', message: 'Are you sure you want to delete this customer?', type: 'danger' });
    if (!ok) return;
    try {
      await api.delete(`/customers/${id}`);
      fetchCustomers();
      if (selectedCustomer?.customer_id === id) {
        setSelectedCustomer(null);
      }
    } catch (error: any) {
      console.error("Failed to delete customer", error);
      toast.error(error.response?.data?.message || 'Failed to delete customer');
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsModalOpen(true);
  };

  const handleSelectCustomer = (customer: Customer) => {
    if (selectedCustomer?.customer_id !== customer.customer_id) {
      setHistoryPage(1);
      setSelectedCustomer(customer);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to page 1 on search
  };

  if (loading && customers.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 h-[calc(100vh-56px)] md:h-[calc(100vh-64px)] overflow-hidden flex flex-col">
      <div className="flex flex-wrap justify-between items-center gap-3 mb-4 md:mb-6">
        <div>
          <h1 className="text-lg md:text-xl font-semibold tracking-tight text-gray-900">Customers</h1>
          <p className="text-gray-600 text-sm hidden sm:block">Manage customer profiles and history</p>
        </div>
        <button
          onClick={() => {
            setEditingCustomer(null);
            setIsModalOpen(true);
          }}
          className="bg-emerald-600 text-white px-3 md:px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 flex items-center gap-2 shadow-sm transition-colors text-sm"
        >
          <Plus size={18} />
          Add Customer
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 md:gap-6 flex-1 overflow-hidden">
        {/* Left Side: Customer List */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search by name or phone..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={searchTerm}
                onChange={handleSearch}
              />
            </div>
          </div>

          <div className="overflow-y-auto flex-1">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-600 font-medium text-sm sticky top-0">
                <tr>
                  <th className="p-4">Name</th>
                  <th className="p-4">Phone</th>
                  <th className="p-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {customers.map((customer) => (
                  <tr 
                    key={customer.customer_id} 
                    className={`hover:bg-gray-50 transition-colors cursor-pointer ${selectedCustomer?.customer_id === customer.customer_id ? 'bg-emerald-50' : ''}`}
                    onClick={() => handleSelectCustomer(customer)}
                  >
                    <td className="p-4 font-medium text-gray-800 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-xs">
                        {customer.customer_name.charAt(0)}
                      </div>
                      {customer.customer_name}
                    </td>
                    <td className="p-4 text-gray-600">{customer.phone_number || 'N/A'}</td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleEdit(customer); }}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        >
                          <Edit size={16} />
                        </button>
                        {customer.customer_id !== 1 && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(customer.customer_id); }}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={(l) => { setItemsPerPage(l); setCurrentPage(1); }}
          />
        </div>

        {/* Right Side: Customer Details */}
        <div className="w-full lg:w-96 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden lg:flex-shrink-0">
          {selectedCustomer ? (
            <>
              <div className="p-6 border-b border-gray-100 bg-emerald-50/50 text-center">
                <div className="w-20 h-20 rounded-full bg-white border-4 border-emerald-100 flex items-center justify-center text-emerald-600 text-3xl font-bold mx-auto mb-3 shadow-sm">
                  {selectedCustomer.customer_name.charAt(0)}
                </div>
                <h2 className="text-base font-semibold text-gray-800">{selectedCustomer.customer_name}</h2>
                <p className="text-gray-500 flex items-center justify-center gap-2 mt-1">
                  <Phone size={14} />
                  {selectedCustomer.phone_number || 'No Phone'}
                </p>
                <div className="mt-4 flex justify-center gap-2 text-sm text-gray-600">
                  <span className="flex items-center gap-1 bg-white px-3 py-1 rounded-full border border-gray-200">
                    <ShoppingBag size={14} className="text-emerald-500" />
                    {historyTotalItems || purchaseHistory.length} Orders
                  </span>
                  <span className="flex items-center gap-1 bg-white px-3 py-1 rounded-full border border-gray-200">
                    <Clock size={14} className="text-emerald-500" />
                    Joined {new Date(selectedCustomer.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="p-4 border-b border-gray-100 bg-gray-50">
                <h3 className="font-semibold text-gray-700">Purchase History</h3>
              </div>

              <div className="overflow-y-auto flex-1 p-4 space-y-3">
                {historyLoading ? (
                  <div className="flex justify-center py-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                  </div>
                ) : purchaseHistory.length > 0 ? (
                  purchaseHistory.map((purchase) => (
                    <div key={purchase.sale_id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-gray-800">{currency}{parseFloat(purchase.net_amount).toFixed(0)}</p>
                        <p className="text-xs text-gray-500">{new Date(purchase.sale_date).toLocaleDateString()} • {new Date(purchase.sale_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md">
                          #{purchase.sale_id}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 text-gray-400">
                    <ShoppingBag size={32} className="mx-auto mb-2 opacity-20" />
                    <p>No purchase history</p>
                  </div>
                )}
              </div>
              {purchaseHistory.length > 0 && (
                <div className="p-2 border-t border-gray-100">
                   <Pagination
                    currentPage={historyPage}
                    totalPages={historyTotalPages}
                    onPageChange={setHistoryPage}
                    totalItems={historyTotalItems}
                    itemsPerPage={historyItemsPerPage}
                    onItemsPerPageChange={(l) => { setHistoryItemsPerPage(l); setHistoryPage(1); }}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
              <User size={48} className="mb-4 opacity-20" />
              <h3 className="text-lg font-semibold text-gray-500 mb-2">Select a Customer</h3>
              <p className="text-sm">Click on a customer from the list to view their profile and purchase history.</p>
            </div>
          )}
        </div>
      </div>

      <AddCustomerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          fetchCustomers();
          if (selectedCustomer) {
            fetchCustomerDetails(selectedCustomer.customer_id, historyPage);
          }
        }}
        customerToEdit={editingCustomer}
      />
    </div>
  );
};

export default Customers;
