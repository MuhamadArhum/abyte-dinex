import { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { X, Plus, Trash2, ChevronRight, ChevronLeft } from 'lucide-react';
import api from '../utils/api';
import { localToday } from '../utils/dateUtils';
import { useToast } from './Toast';

interface Product {
  product_id: number;
  product_name: string;
  barcode: string;
  sale_price: number;
}

interface Supplier {
  supplier_id: number;
  supplier_name: string;
  contact_person: string;
  phone: string;
}

interface POItem {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
}

interface CreatePOModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editPO?: any; // if provided, modal is in edit mode
}

const CreatePOModal = ({ isOpen, onClose, onSuccess, editPO }: CreatePOModalProps) => {
  const isEdit = !!editPO;
  const { currencySymbol: currency } = useSettings();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  // Form data
  const [selectedSupplier, setSelectedSupplier] = useState<number | null>(null);
  const [orderDate, setOrderDate] = useState(localToday());
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<POItem[]>([]);

  // Item form
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [unitCost, setUnitCost] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      fetchSuppliers();
      fetchProducts();
    }
  }, [isOpen]);

  // Pre-fill form when editing
  useEffect(() => {
    if (isOpen && isEdit && editPO) {
      setSelectedSupplier(editPO.supplier_id);
      setOrderDate(editPO.order_date?.split('T')[0] || localToday());
      setExpectedDate(editPO.expected_date?.split('T')[0] || '');
      setNotes(editPO.notes || '');
      setItems((editPO.items || []).map((i: any) => ({
        product_id: i.product_id,
        product_name: i.product_name,
        quantity: Number(i.quantity_ordered),
        unit_cost: Number(i.unit_cost),
        total_cost: Number(i.quantity_ordered) * Number(i.unit_cost),
      })));
      setStep(1);
    }
  }, [isOpen, editPO]);

  const fetchSuppliers = async () => {
    try {
      const res = await api.get('/suppliers', { params: { limit: 100 } });
      setSuppliers(res.data.data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products', { params: { limit: 1000 } });
      setProducts(res.data.data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const addItem = () => {
    if (!selectedProduct || quantity <= 0 || unitCost <= 0) {
      toast.error('Please select a product and enter valid quantity and cost');
      return;
    }

    const product = products.find(p => p.product_id === selectedProduct);
    if (!product) return;

    // Check if product already exists
    const existingIndex = items.findIndex(item => item.product_id === selectedProduct);
    if (existingIndex >= 0) {
      toast.error('Product already added. Please edit the existing item.');
      return;
    }

    const newItem: POItem = {
      product_id: selectedProduct,
      product_name: product.product_name,
      quantity,
      unit_cost: unitCost,
      total_cost: quantity * unitCost
    };

    setItems([...items, newItem]);
    setSelectedProduct(null);
    setQuantity(1);
    setUnitCost(0);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItemField = (index: number, field: 'quantity' | 'unit_cost', value: number) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, [field]: value };
      updated.total_cost = updated.quantity * updated.unit_cost;
      return updated;
    }));
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.total_cost, 0);
  };

  const handleNext = () => {
    if (step === 1) {
      if (!selectedSupplier) {
        toast.error('Please select a supplier');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (items.length === 0) {
        toast.error('Please add at least one item');
        return;
      }
      setStep(3);
    }
  };

  const handleSubmit = async () => {
    if (!selectedSupplier || items.length === 0) return;

    setLoading(true);
    try {
      const poData = {
        supplier_id: selectedSupplier,
        order_date: orderDate,
        expected_date: expectedDate || null,
        notes,
        items: items.map(item => ({
          product_id: item.product_id,
          quantity_ordered: item.quantity,
          unit_cost: item.unit_cost
        }))
      };

      if (isEdit) {
        await api.put(`/purchase-orders/${editPO.po_id}`, poData);
      } else {
        await api.post('/purchase-orders', poData);
      }
      resetForm();
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving PO:', error);
      toast.error(error.response?.data?.message || 'Failed to save Purchase Order');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setSelectedSupplier(null);
    setOrderDate(localToday());
    setExpectedDate('');
    setNotes('');
    setItems([]);
    setSelectedProduct(null);
    setQuantity(1);
    setUnitCost(0);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-6 text-white flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">{isEdit ? `Edit PO — ${editPO.po_number}` : 'Create Purchase Order'}</h2>
            <p className="text-emerald-100 text-sm mt-1">Step {step} of 3</p>
          </div>
          <button onClick={handleClose} className="text-white hover:bg-white/20 p-2 rounded-lg transition">
            <X size={24} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="bg-gray-100 h-2">
          <div
            className="bg-emerald-600 h-full transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Select Supplier */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Supplier *
                </label>
                <select
                  value={selectedSupplier || ''}
                  onChange={(e) => setSelectedSupplier(Number(e.target.value))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="">-- Select Supplier --</option>
                  {suppliers.map(supplier => (
                    <option key={supplier.supplier_id} value={supplier.supplier_id}>
                      {supplier.supplier_name} {supplier.contact_person ? `(${supplier.contact_person})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Order Date *
                  </label>
                  <input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expected Delivery Date
                  </label>
                  <input
                    type="date"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Any additional notes..."
                />
              </div>
            </div>
          )}

          {/* Step 2: Add Items */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                <h3 className="font-semibold text-gray-800 mb-3">Add Products</h3>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                    <select
                      value={selectedProduct || ''}
                      onChange={(e) => setSelectedProduct(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">-- Select Product --</option>
                      {products.map(product => (
                        <option key={product.product_id} value={product.product_id}>
                          {product.product_name} ({product.barcode})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Unit Cost ($)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={unitCost}
                      onChange={(e) => setUnitCost(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <button
                  onClick={addItem}
                  className="w-full bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700 transition flex items-center justify-center gap-2"
                >
                  <Plus size={20} />
                  Add Item
                </button>
              </div>

              {/* Items List */}
              {items.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-3 font-semibold text-gray-700">Product</th>
                        <th className="text-center p-3 font-semibold text-gray-700 w-28">Qty</th>
                        <th className="text-right p-3 font-semibold text-gray-700 w-32">Unit Cost</th>
                        <th className="text-right p-3 font-semibold text-gray-700 w-28">Total</th>
                        <th className="text-center p-3 font-semibold text-gray-700 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => (
                        <tr key={index} className="border-t hover:bg-gray-50">
                          <td className="p-3 font-medium">{item.product_name}</td>
                          <td className="p-3">
                            <input
                              type="number" min="0.001" step="0.001"
                              value={item.quantity}
                              onChange={e => updateItemField(index, 'quantity', parseFloat(e.target.value) || 0)}
                              className="w-full text-center border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-emerald-400"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="number" min="0" step="0.01"
                              value={item.unit_cost}
                              onChange={e => updateItemField(index, 'unit_cost', parseFloat(e.target.value) || 0)}
                              className="w-full text-right border border-gray-300 rounded px-2 py-1 focus:ring-1 focus:ring-emerald-400"
                            />
                          </td>
                          <td className="p-3 text-right font-semibold">{Number(item.total_cost).toFixed(0)}</td>
                          <td className="p-3 text-center">
                            <button onClick={() => removeItem(index)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t-2 text-sm">
                      <tr className="border-t-2 border-gray-300 bg-emerald-50">
                        <td colSpan={3} className="p-3 text-right font-bold text-gray-800">Total:</td>
                        <td className="p-3 text-right font-bold text-emerald-700 text-base">
                          {calculateTotal().toFixed(0)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {items.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No items added yet. Add products to continue.
                </div>
              )}
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                <h3 className="font-semibold text-gray-800 mb-3">Order Summary</h3>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-gray-600">Supplier</p>
                    <p className="font-semibold">
                      {suppliers.find(s => s.supplier_id === selectedSupplier)?.supplier_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Order Date</p>
                    <p className="font-semibold">{new Date(orderDate).toLocaleDateString()}</p>
                  </div>
                  {expectedDate && (
                    <div>
                      <p className="text-sm text-gray-600">Expected Delivery</p>
                      <p className="font-semibold">{new Date(expectedDate).toLocaleDateString()}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-gray-600">Total Items</p>
                    <p className="font-semibold">{items.length} products</p>
                  </div>

                </div>

                {notes && (
                  <div>
                    <p className="text-sm text-gray-600">Notes</p>
                    <p className="text-gray-800">{notes}</p>
                  </div>
                )}
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-3 font-semibold text-gray-700">Product</th>
                      <th className="text-center p-3 font-semibold text-gray-700">Quantity</th>
                      <th className="text-right p-3 font-semibold text-gray-700">Unit Cost</th>
                      <th className="text-right p-3 font-semibold text-gray-700">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={index} className="border-t">
                        <td className="p-3">{item.product_name}</td>
                        <td className="p-3 text-center">{item.quantity}</td>
                        <td className="p-3 text-right">{currency}{Number(item.unit_cost).toFixed(0)}</td>
                        <td className="p-3 text-right font-semibold">{currency}{Number(item.total_cost).toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 text-sm">
                    <tr>
                      <td colSpan={3} className="p-3 text-right font-bold text-gray-800">Total:</td>
                      <td className="p-3 text-right font-bold text-green-600 text-xl">
                        {calculateTotal().toFixed(0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50 flex items-center justify-between">
          <div>
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition"
              >
                <ChevronLeft size={20} />
                Previous
              </button>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition"
            >
              Cancel
            </button>

            {step < 3 ? (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition"
              >
                Next
                <ChevronRight size={20} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
              >
                {loading ? 'Saving...' : isEdit ? 'Update Purchase Order' : 'Create Purchase Order'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreatePOModal;
