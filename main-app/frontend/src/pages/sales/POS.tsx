import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, ShoppingCart, Trash2, Minus, Plus, Archive, Barcode, Scan, FileText, User, UserPlus, BarChart, X, Lock, DollarSign, Loader2, ShoppingBag, Keyboard, Percent, Calculator, Tag, Phone, Truck, MapPin, CheckCircle, UtensilsCrossed, Coffee, Table2 } from 'lucide-react';
import Pagination from '../../components/Pagination';
import { useCart, Product } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import ProductCard from '../../components/ProductCard';
import CheckoutModal from '../../components/CheckoutModal';
import AddCustomerModal from '../../components/AddCustomerModal';
import DailyReportModal from '../../components/DailyReportModal';
import RegisterCloseModal from '../../components/RegisterCloseModal';
import ProductVariantModal from '../../components/ProductVariantModal';
import api from '../../utils/api';
import { printKOT } from '../../printing/agentPrinter';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';

// ── TableSearchInput ─────────────────────────────────────────
const TableSearchInput = ({
  tables, selectedTableId, onSelect, onClear, allowBusy = false,
}: {
  tables: any[];
  selectedTableId: number | null;
  onSelect: (id: number) => void;
  onClear: () => void;
  allowBusy?: boolean;
}) => {
  const [query, setQuery] = useState('');
  const [showDrop, setShowDrop] = useState(false);
  const [occupiedAlert, setOccupiedAlert] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShowDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedTable = tables.find(t => t.table_id === selectedTableId);

  const filtered = query.trim()
    ? tables.filter(t => t.table_name.toLowerCase().includes(query.toLowerCase()))
    : tables;

  const handlePick = (table: any) => {
    if (!allowBusy && Number(table.has_pending_order) > 0) {
      setOccupiedAlert(table.table_name);
      setQuery('');
      setShowDrop(false);
      return;
    }
    onSelect(table.table_id);
    setQuery('');
    setShowDrop(false);
  };

  return (
    <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex-shrink-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
          <Table2 size={12} /> Table
        </span>
        {selectedTableId && (
          <button onClick={onClear} className="text-xs text-red-500 hover:text-red-700 font-medium">Clear</button>
        )}
      </div>

      {selectedTable ? (
        <div className="flex items-center gap-2 bg-emerald-600 text-white rounded-lg px-3 py-2">
          <Table2 size={14} />
          <span className="font-semibold text-sm flex-1">{selectedTable.table_name}</span>
          {selectedTable.floor && <span className="text-emerald-200 text-xs">{selectedTable.floor}</span>}
          <button onClick={onClear} className="text-emerald-200 hover:text-white"><X size={14} /></button>
        </div>
      ) : (
        <div className="relative" ref={ref}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
          <input
            type="text"
            placeholder={tables.length === 0 ? 'No tables — add via Restaurant module' : 'Search table...'}
            disabled={tables.length === 0}
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none disabled:opacity-50"
            value={query}
            onChange={e => { setQuery(e.target.value); setShowDrop(true); setOccupiedAlert(null); }}
            onFocus={() => setShowDrop(true)}
          />
          {showDrop && filtered.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-auto z-40">
              {filtered.map((table: any) => {
                const isOccupied = Number(table.has_pending_order) > 0;
                return (
                  <button
                    key={table.table_id}
                    onClick={() => handlePick(table)}
                    className={`w-full text-left px-3 py-2.5 flex items-center justify-between text-sm border-b border-gray-100 last:border-0 transition-colors ${
                      isOccupied ? 'hover:bg-red-50' : 'hover:bg-emerald-50'
                    }`}
                  >
                    <div>
                      <span className="font-semibold text-gray-800">{table.table_name}</span>
                      {table.floor && <span className="text-xs text-gray-400 ml-2">{table.floor}</span>}
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      isOccupied ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {isOccupied ? 'Busy' : 'Free'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {occupiedAlert && (
        <div className="mt-2 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs font-medium">
          <X size={13} className="shrink-0 text-red-500" />
          <span><strong>{occupiedAlert}</strong> is currently occupied. Choose another table.</span>
          <button onClick={() => setOccupiedAlert(null)} className="ml-auto text-red-400 hover:text-red-600"><X size={12} /></button>
        </div>
      )}
    </div>
  );
};

// ── UserSelectInput ──────────────────────────────────────────
const UserSelectInput = ({
  users, selectedUserId, onSelect, saving,
}: {
  users: any[];
  selectedUserId: number | null;
  onSelect: (id: number) => void;
  saving?: boolean;
}) => {
  const [query, setQuery] = useState('');
  const [showDrop, setShowDrop] = useState(false);
  const [changing, setChanging] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowDrop(false);
        setChanging(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Reset changing state when selected user changes (e.g., after pick or edit load)
  useEffect(() => { setChanging(false); setQuery(''); }, [selectedUserId]);

  const selectedUser = users.find(u => u.user_id === selectedUserId);
  const showPill = selectedUser && !changing;

  const filtered = query.trim()
    ? users.filter(u => u.name.toLowerCase().includes(query.toLowerCase()))
    : users;

  const handlePick = (u: any) => {
    onSelect(u.user_id);
    setQuery('');
    setShowDrop(false);
    setChanging(false);
  };

  const startChanging = () => { setChanging(true); setShowDrop(true); };

  return (
    <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex-shrink-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
          <User size={12} /> User
          {saving && <span className="text-gray-400 font-normal normal-case ml-1">Saving...</span>}
        </span>
        {showPill && (
          <button onClick={startChanging} className="text-xs text-blue-500 hover:text-blue-700 font-medium">
            Change
          </button>
        )}
      </div>

      {showPill ? (
        <div className="flex items-center gap-2 bg-blue-600 text-white rounded-lg px-3 py-2">
          <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold shrink-0">
            {selectedUser.name.charAt(0).toUpperCase()}
          </div>
          <span className="font-semibold text-sm flex-1">{selectedUser.name}</span>
          <span className="text-blue-200 text-xs">{selectedUser.role_name}</span>
          <button onClick={startChanging} className="text-blue-200 hover:text-white">
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="relative" ref={ref}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
          <input
            type="text"
            placeholder={users.length === 0 ? 'No users available' : 'Search waiter...'}
            disabled={users.length === 0}
            autoFocus={changing}
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:opacity-50"
            value={query}
            onChange={e => { setQuery(e.target.value); setShowDrop(true); }}
            onFocus={() => setShowDrop(true)}
          />
          {showDrop && filtered.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-auto z-40">
              {filtered.map((u: any) => (
                <button
                  key={u.user_id}
                  onClick={() => handlePick(u)}
                  className="w-full text-left px-3 py-2.5 flex items-center gap-2 text-sm border-b border-gray-100 last:border-0 hover:bg-blue-50 transition-colors"
                >
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-semibold text-gray-800 flex-1">{u.name}</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                    {u.role_name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const POS = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    cart, addToCart, removeFromCart, updateQuantity, clearCart,
    subtotal, total,
    taxRate, setTaxRate,
    additionalRate, setAdditionalRate,
    taxAmount,
    appliedBundles, setAppliedBundles, bundleDiscount
  } = useCart();
  const { user, canDo, hasPermission } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  // ── Permission flags ──────────────────────────────────────────────────────
  const canCreateSale      = canDo('sales.pos', 'create');
  const canUpdateSale      = canDo('sales.pos', 'update');
  const canViewReports     = hasPermission('sales.reports');
  const canCloseRegister   = hasPermission('sales.register');
  const canCreateQuotation = hasPermission('sales.quotations');

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchName, setSearchName] = useState('');
  const [searchBarcode, setSearchBarcode] = useState('');
  const [searchCode, setSearchCode] = useState('');

  // Product pagination
  const [productPage, setProductPage] = useState(1);
  const [productTotalPages, setProductTotalPages] = useState(1);
  const [productTotalItems, setProductTotalItems] = useState(0);
  const [productLimit, setProductLimit] = useState(20);

  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [selectedPendingSale, setSelectedPendingSale] = useState<any>(null);

  // Edit pending order state
  const [editingSaleId, setEditingSaleId] = useState<number | null>(null);
  const [editingTokenNo, setEditingTokenNo] = useState<string | null>(null);

  // User reassignment state (shown in cart when editing)
  const [posUsers, setPosUsers] = useState<any[]>([]);
  const [assignedUserId, setAssignedUserId] = useState<number | null>(null);
  const [userAssigning, setUserAssigning] = useState(false);

  const [isDailyReportOpen, setIsDailyReportOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Register gate state
  const [register, setRegister] = useState<any>(null);
  const [registerLoading, setRegisterLoading] = useState(true);
  const [openingBalance, setOpeningBalance] = useState('');
  const [openingRegister, setOpeningRegister] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);

  // Customer state
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerSearchRef = useRef<HTMLDivElement>(null);

  // Variant modal state
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Hold order token display
  const [holdToken, setHoldToken] = useState<string | null>(null);
  const [deliveryConfirm, setDeliveryConfirm] = useState<string | null>(null);

  // Quotation modal
  const [showQuotationModal, setShowQuotationModal] = useState(false);
  const [quotationSaving, setQuotationSaving] = useState(false);
  const [quotationSuccess, setQuotationSuccess] = useState<string | null>(null);
  const [qtValidUntil, setQtValidUntil] = useState('');
  const [qtNotes, setQtNotes] = useState('');

  const [, setStoreSettings] = useState<any>(null);

  // Mobile cart drawer toggle
  const [showMobileCart, setShowMobileCart] = useState(false);

  // Default delivery charges from store settings
  const [defaultDeliveryCharges, setDefaultDeliveryCharges] = useState(0);

  // POS mode & per-category tax config from settings
  const [posMode, setPosMode] = useState<'simple' | 'category'>('simple');
  const [posTaxConfig, setPosTaxConfig] = useState<any>(null);

  // Per-category charges (local UI state - combined into taxRate/additionalRate)
  const [serviceRate, setServiceRate] = useState(0);
  const [otherRate, setOtherRate] = useState(0);
  const [otherLabel, setOtherLabel] = useState('Other Charges');

  // Delivery customer — 3 simple fields
  const [delivName, setDelivName] = useState('');
  const [delivMatchedCust, setDelivMatchedCust] = useState<any>(null);
  const [delivPhoneSuggestions, setDelivPhoneSuggestions] = useState<any[]>([]);

  // Order type: dine_in, takeaway, delivery, or on_spot (walk_in)
  type OrderType = 'dine_in' | 'takeaway' | 'delivery' | 'on_spot';
  const [orderType, setOrderType] = useState<OrderType>('dine_in');

  // When pos mode changes, reset to correct default order type
  useEffect(() => {
    if (posMode === 'simple') {
      setOrderType('on_spot');
      applyTaxConfig(posTaxConfig, 'walk_in');
    } else {
      setOrderType('dine_in');
      applyTaxConfig(posTaxConfig, 'dine_in');
    }
  }, [posMode]);

  const applyTaxConfig = (config: any, catKey: string) => {
    if (!config || typeof config !== 'object') return;
    const cat = config[catKey] || {};
    setTaxRate(cat.tax_enabled ? (parseFloat(cat.tax_rate) || 0) : 0);
    setServiceRate(cat.service_enabled ? (parseFloat(cat.service_rate) || 0) : 0);
    setOtherRate(cat.other_enabled ? (parseFloat(cat.other_rate) || 0) : 0);
    setOtherLabel(cat.other_label || 'Other Charges');
    setAdditionalRate(
      (cat.service_enabled ? (parseFloat(cat.service_rate) || 0) : 0) +
      (cat.other_enabled ? (parseFloat(cat.other_rate) || 0) : 0)
    );
  };

  const handleOrderTypeChange = (type: OrderType) => {
    setOrderType(type);
    setSelectedTableId(null);
    const catKey = type === 'on_spot' ? 'walk_in' : type;
    applyTaxConfig(posTaxConfig, catKey);
  };

  // Restaurant tables
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [deliveryInfo, setDeliveryInfo] = useState({
    delivery_address: '', delivery_city: '', delivery_phone: '',
    rider_name: '', rider_phone: '', delivery_charges: '',
    estimated_delivery: '', notes: '',
  });
  const resetDelivery = () => {
    const defaultType: OrderType = posMode === 'category' ? 'dine_in' : 'on_spot';
    setOrderType(defaultType);
    setSelectedTableId(null);
    setDeliveryInfo({ delivery_address: '', delivery_city: '', delivery_phone: '', rider_name: '', rider_phone: '', delivery_charges: '', estimated_delivery: '', notes: '' });
    setDelivName('');
    setDelivMatchedCust(null);
    setDelivPhoneSuggestions([]);
  };
  const delivCharges = orderType === 'delivery' ? (parseFloat(deliveryInfo.delivery_charges) || 0) : 0;

  const fetchTables = async () => {
    try {
      const res = await api.get('/restaurant/tables');
      setTables(Array.isArray(res.data) ? res.data : []);
    } catch { setTables([]); }
  };

  const handlePrintKOT = async (tokenNo?: string) => {
    const tableName = orderType === 'dine_in'
      ? (tables.find(t => t.table_id === selectedTableId)?.table_name || '')
      : orderType === 'takeaway' ? 'TAKEAWAY' : '';

    const kotItems = cart.map(item => ({
      name:          item.product_name + (item.variant_name ? ` (${item.variant_name})` : ''),
      quantity:      item.quantity,
      category_id:   item.category_id,
      category_name: item.category_name,
      note:          undefined,
    }));

    await printKOT({
      tokenNo:     tokenNo || undefined,
      tableNo:     tableName || undefined,
      date:        new Date().toLocaleString(),
      cashierName: user?.name || 'Staff',
      items:       kotItems,
    });
  };

  // Check register on mount + load store settings + fetch tables
  useEffect(() => {
    checkRegister();
    fetchTables();
    api.get('/settings').then(res => {
      const dc = parseFloat(res.data.default_delivery_charges) || 0;
      setDefaultDeliveryCharges(dc);
      setStoreSettings(res.data);
      setPosMode(res.data.pos_mode === 'category' ? 'category' : 'simple');
      setPosTaxConfig(res.data.pos_tax_config || null);
      // Apply default category rates based on current order type
      applyTaxConfig(res.data.pos_tax_config, res.data.pos_mode === 'category' ? 'dine_in' : 'walk_in');
    }).catch(() => {});
  }, []);

  // Handle pending sale from Orders page navigation
  useEffect(() => {
    if (location.state?.pendingSale) {
      setSelectedPendingSale(location.state.pendingSale);
      setIsCheckoutOpen(true);
      window.history.replaceState({}, document.title);
    }
    if (location.state?.editOrder) {
      loadEditOrder(location.state.editOrder);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const loadEditOrder = async (sale: any) => {
    try {
      const res = await api.get(`/sales/${sale.sale_id}`);
      const saleData = res.data;
      clearCart();
      const items: any[] = saleData.items || [];
      for (const item of items) {
        const product = {
          product_id: item.product_id,
          product_name: item.product_name,
          price: parseFloat(item.unit_price),
          stock_quantity: 999,
          barcode: null,
          has_variants: false,
        } as any;
        addToCart(product);
      }
      setTimeout(() => {
        for (const item of items) {
          const qty = parseInt(item.quantity);
          if (qty > 1) {
            updateQuantity(item.product_id, qty);
          }
        }
      }, 100);
      // Restore order type and table from sale
      const restoredType: OrderType = (['dine_in','takeaway','delivery','on_spot'].includes(saleData.order_type)
        ? saleData.order_type : 'on_spot') as OrderType;
      setOrderType(restoredType);
      if (restoredType === 'dine_in' && saleData.table_id) {
        setSelectedTableId(saleData.table_id);
      }
      // Set customer if available
      if (saleData.customer_id && saleData.customer_id !== 1) {
        const custRes = await api.get(`/customers/${saleData.customer_id}`).catch(() => null);
        if (custRes?.data) setSelectedCustomer(custRes.data);
      }
      if (saleData.tax_percent !== undefined) setTaxRate(parseFloat(saleData.tax_percent) || 0);
      if (saleData.additional_charges_percent !== undefined) setAdditionalRate(parseFloat(saleData.additional_charges_percent) || 0);
      setEditingSaleId(sale.sale_id);
      setEditingTokenNo(sale.token_no || null);
      setAssignedUserId(saleData.user_id || null);
    } catch (err) {
      console.error('Failed to load edit order', err);
      toast.error('Failed to load order for editing');
    }
  };

  const checkRegister = async () => {
    setRegisterLoading(true);
    try {
      const res = await api.get('/register/current');
      setRegister(res.data);
    } catch (error) {
      setRegister(null);
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleOpenRegister = async () => {
    const balance = parseFloat(openingBalance);
    if (isNaN(balance) || balance < 0) {
      toast.error('Please enter a valid opening balance');
      return;
    }
    setOpeningRegister(true);
    try {
      const res = await api.post('/register/open', { opening_balance: balance });
      setRegister(res.data);
      setOpeningBalance('');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to open register');
    } finally {
      setOpeningRegister(false);
    }
  };

  const handleForceReset = async () => {
    const ok = await confirm({ title: 'Force-Reset Register', message: 'Force-close any stuck open register? This is for Admin use only when a register is stuck.', type: 'danger' });
    if (!ok) return;
    try {
      const res = await api.post('/register/force-reset');
      toast.success(res.data.message);
      checkRegister();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to force-reset register');
    }
  };

  // Fetch products with server-side pagination, search, and category filter
  const fetchProducts = useCallback(async (page = 1, search = '', category = 'All') => {
    if (!register) return;
    setLoading(true);
    try {
      const params: any = { page, limit: productLimit, type: 'finished_good' };
      if (search) params.search = search;
      if (category !== 'All') params.category = category;
      const res = await api.get('/products', { params });
      const rows = res.data.data || res.data;
      const mappedProducts = (Array.isArray(rows) ? rows : []).map((p: any) => ({
        ...p,
        price: typeof p.price === 'string' ? parseFloat(p.price) : p.price,
        stock_quantity: p.available_stock || p.stock_quantity || 0
      }));
      setProducts(mappedProducts);
      if (res.data.pagination) {
        setProductTotalPages(res.data.pagination.totalPages || 1);
        setProductTotalItems(res.data.pagination.total || 0);
      }
    } catch (error) {
      console.error("Failed to fetch products", error);
    } finally {
      setLoading(false);
    }
  }, [register, productLimit]);

  // Initial load: categories + customers + products
  useEffect(() => {
    if (!register) return;
    const fetchCategories = async () => {
      try {
        const res = await api.get('/products/categories', { params: { type: 'finished_good' } });
        setCategories(res.data.data || res.data);
      } catch (error) {
        console.error("Failed to fetch categories", error);
      }
    };
    fetchCustomers();
    fetchCategories();
    fetchProducts(1, '', 'All');
    api.get('/sales/assignable-users').then(r => {
      const users = r.data || [];
      setPosUsers(users);
      // Only default to current user when not editing an existing order
      setAssignedUserId(prev => prev ?? (user?.user_id ?? null));
    }).catch(() => {});
  }, [register]);

  // Re-fetch when page, category, or search changes (debounce search)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!register) return;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setProductPage(1);
      fetchProducts(1, searchName, selectedCategory);
    }, 300);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [searchName, selectedCategory]);

  useEffect(() => {
    if (!register) return;
    fetchProducts(productPage, searchName, selectedCategory);
  }, [productPage]);

  // Barcode Auto-Add: search server-side for exact barcode match
  useEffect(() => {
    if (!searchBarcode) return;
    const findByBarcode = async () => {
      try {
        const res = await api.get('/products', { params: { search: searchBarcode, limit: 5 } });
        const rows: any[] = res.data.data || res.data;
        const match = rows.find((p: any) => p.barcode === searchBarcode);
        if (match) {
          const mapped = {
            ...match,
            price: typeof match.price === 'string' ? parseFloat(match.price) : match.price,
            stock_quantity: match.available_stock || match.stock_quantity || 0
          };
          if (mapped.stock_quantity > 0) {
            handleAddProduct(mapped);
          } else {
            toast.error('Product Out of Stock!');
          }
        }
      } catch (err) {
        console.error('Barcode search failed', err);
      } finally {
        setSearchBarcode('');
      }
    };
    findByBarcode();
  }, [searchBarcode]);

  // Hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setShowShortcuts(true);
      }
      if (e.key === 'F2') {
        e.preventDefault();
        const input = document.getElementById('barcode-input');
        if (input) input.focus();
      }
      if (e.key === 'F3') {
        e.preventDefault();
        const input = document.getElementById('search-name-input');
        if (input) input.focus();
      }
      if (e.key === 'F8') {
        e.preventDefault();
        if (cart.length > 0 && canCreateSale) handleHoldOrder();
      }
      if (e.key === 'F9') {
        e.preventDefault();
        if (cart.length > 0 && canCreateSale) setIsCheckoutOpen(true);
      }
      if (e.key === 'Escape') {
        setIsCheckoutOpen(false);
        setIsDailyReportOpen(false);
        setIsCustomerModalOpen(false);
        setShowCloseModal(false);
        setShowCustomerDropdown(false);
        setShowShortcuts(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart]);

  const fetchCustomers = async () => {
    try {
      const res = await api.get('/customers');
      const customerList = res.data.data || res.data;
      setCustomers(Array.isArray(customerList) ? customerList : []);
      // Auto-select Walk-in Customer (ID 1) if none selected
      const list = Array.isArray(customerList) ? customerList : [];
      const walkin = list.find((c: any) => c.customer_id === 1);
      setSelectedCustomer((prev: any) => prev ? prev : (walkin || null));
    } catch (error) {
      console.error("Failed to fetch customers", error);
    }
  };

  // Close customer dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerSearchRef.current && !customerSearchRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Bundle detection — debounced 400ms so rapid cart edits don't flood the API.
  // The ref holds the pending timer; each cart change cancels the previous one.
  const bundleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (bundleDebounceRef.current) clearTimeout(bundleDebounceRef.current);

    if (cart.length === 0) {
      setAppliedBundles([]);
      return;
    }

    bundleDebounceRef.current = setTimeout(async () => {
      try {
        const cartItems = cart.map(item => ({
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          quantity:   item.quantity,
          unit_price: item.price,
        }));
        const response = await api.post('/bundles/detect', { cart_items: cartItems });
        setAppliedBundles(response.data.applicable_bundles || []);
      } catch {
        setAppliedBundles([]);
      }
    }, 400);

    return () => {
      if (bundleDebounceRef.current) clearTimeout(bundleDebounceRef.current);
    };
  }, [cart, setAppliedBundles]);

  // Phone field → search existing customers, show suggestions
  useEffect(() => {
    if (orderType !== 'delivery') { setDelivPhoneSuggestions([]); return; }
    const q = deliveryInfo.delivery_phone.trim();
    if (q.length < 3) { setDelivPhoneSuggestions([]); return; }
    const results = customers
      .filter((c: any) => c.customer_id !== 1 && c.phone_number && c.phone_number.includes(q))
      .slice(0, 5);
    setDelivPhoneSuggestions(results);
  }, [deliveryInfo.delivery_phone, customers, orderType]);

  // Reset delivery fields on order type change
  useEffect(() => {
    setDeliveryInfo(d => ({ ...d, delivery_phone: '', delivery_address: '' }));
    setDelivName('');
    setDelivMatchedCust(null);
    setDelivPhoneSuggestions([]);
    if (orderType === 'delivery' && defaultDeliveryCharges > 0) {
      setDeliveryInfo(d => ({ ...d, delivery_charges: String(defaultDeliveryCharges) }));
    }
  }, [orderType]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return [];
    const q = customerSearch.toLowerCase();
    return customers.filter((c: any) =>
      c.customer_name.toLowerCase().includes(q) ||
      (c.phone_number && c.phone_number.includes(customerSearch))
    ).slice(0, 8);
  }, [customers, customerSearch]);

  const handleAssignUser = async (userId: number) => {
    if (userAssigning) return;
    // In edit mode: persist immediately to DB
    if (editingSaleId) {
      setUserAssigning(true);
      try {
        await api.put(`/sales/${editingSaleId}/assign-user`, { user_id: userId });
        setAssignedUserId(userId);
      } catch (err: any) {
        toast.error(err.response?.data?.message || 'Failed to assign user');
      } finally {
        setUserAssigning(false);
      }
    } else {
      // New order: just select for use when holding
      setAssignedUserId(userId);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingSaleId || cart.length === 0) return;
    try {
      await api.put(`/sales/${editingSaleId}/items`, {
        items: cart.map(item => ({
          product_id: item.product_id,
          variant_id: item.variant_id || null,
          variant_name: item.variant_name || null,
          quantity: item.quantity,
          unit_price: item.price,
        })),
        total_amount: total,
        tax_percent: taxRate,
        additional_charges_percent: additionalRate,
        customer_id: selectedCustomer?.customer_id || 1,
      });
      clearCart();
      setEditingSaleId(null);
      setEditingTokenNo(null);
      if (user?.user_id) setAssignedUserId(user.user_id);
      resetDelivery();
      const walkin = customers.find(c => c.customer_id === 1);
      setSelectedCustomer(walkin || null);
      toast.success('Order updated successfully');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save order');
    }
  };

  const handleHoldOrder = async () => {
    if (cart.length === 0) return;

    try {
      const payload = {
        items: cart.map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.price,
          variant_id: (item as any).variant_id || null,
          variant_name: (item as any).variant_name || null,
        })),
        customer_id: selectedCustomer?.customer_id || 1,
        discount: 0,
        total_amount: total,
        payment_method: 'cash',
        amount_paid: 0,
        user_id: assignedUserId || user?.user_id,
        status: 'pending',
        tax_percent: taxRate,
        additional_charges_percent: additionalRate,
        table_id: orderType === 'dine_in' ? selectedTableId : null,
        order_type: orderType,
      };

      const res = await api.post('/sales', payload);
      const newSaleId = res.data?.sale_id || null;
      clearCart();
      setSelectedTableId(null);
      fetchTables();
      if (user?.user_id) setAssignedUserId(user.user_id);
      const token = res.data?.token_no || null;
      setHoldToken(token);
      setTimeout(() => setHoldToken(null), 5000);
      if (orderType === 'dine_in' || orderType === 'takeaway') {
        handlePrintKOT(token || undefined);
        if (newSaleId) api.patch(`/sales/${newSaleId}/kot-printed`).catch(() => {});
      }
    } catch (error) {
      console.error('Failed to hold order', error);
      toast.error('Failed to hold order');
    }
  };

  const handleSendToDelivery = async () => {
    if (cart.length === 0) return;
    if (!deliveryInfo.delivery_phone.trim()) { toast.error('Please enter phone number'); return; }
    if (!delivName.trim()) { toast.error('Please enter customer name'); return; }
    if (!deliveryInfo.delivery_address.trim()) { toast.error('Please enter delivery address'); return; }

    let customerId: number;

    // Use existing matched customer if phone still matches
    if (delivMatchedCust && delivMatchedCust.phone_number === deliveryInfo.delivery_phone.trim()) {
      customerId = delivMatchedCust.customer_id;
    } else {
      // Create new customer
      try {
        const custRes = await api.post('/customers', {
          customer_name: delivName.trim(),
          phone_number: deliveryInfo.delivery_phone.trim(),
          address: deliveryInfo.delivery_address,
        });
        customerId = custRes.data.customer_id;
        fetchCustomers();
      } catch (e: any) {
        toast.error(e.response?.data?.message || 'Failed to create customer');
        return;
      }
    }

    try {
      const saleRes = await api.post('/sales', {
        items: cart.map(item => ({
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.price,
          variant_id: item.variant_id || null,
          variant_name: item.variant_name || null,
        })),
        customer_id: customerId,
        discount: 0,
        total_amount: total,
        payment_method: 'cash',
        amount_paid: 0,
        user_id: assignedUserId || user?.user_id,
        status: 'pending',
        tax_percent: taxRate,
        additional_charges_percent: additionalRate,
      });

      const delRes = await api.post('/deliveries', {
        sale_id: saleRes.data.sale_id,
        customer_id: customerId,
        delivery_address: deliveryInfo.delivery_address,
        delivery_city: '',
        delivery_phone: deliveryInfo.delivery_phone,
        rider_name: '',
        rider_phone: '',
        delivery_charges: parseFloat(deliveryInfo.delivery_charges) || 0,
        estimated_delivery: null,
        notes: '',
      });

      clearCart();
      resetDelivery();
      if (user?.user_id) setAssignedUserId(user.user_id);
      setDeliveryConfirm(delRes.data.delivery_number);
      setTimeout(() => setDeliveryConfirm(null), 6000);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create delivery order');
    }
  };

  const handleSaveAsQuotation = async () => {
    if (cart.length === 0) return;
    setQuotationSaving(true);
    try {
      const items = cart.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.price,
        variant_id: (item as any).variant_id || undefined,
      }));
      const res = await api.post('/quotations', {
        customer_id: selectedCustomer?.customer_id || 1,
        items,
        tax_amount: taxAmount,
        discount: bundleDiscount,
        valid_until: qtValidUntil || null,
        notes: qtNotes || null,
      });
      setShowQuotationModal(false);
      setQtValidUntil('');
      setQtNotes('');
      clearCart();
      resetDelivery();
      setQuotationSuccess(res.data.quotation_number);
      setTimeout(() => setQuotationSuccess(null), 6000);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save quotation');
    } finally {
      setQuotationSaving(false);
    }
  };

  const handleCartQtyChange = (productId: number, value: string) => {
    const qty = parseInt(value, 10);
    if (!isNaN(qty) && qty > 0) {
      updateQuantity(productId, qty);
    }
  };

  const handleCartQtyBlur = (productId: number, value: string) => {
    const qty = parseInt(value, 10);
    if (isNaN(qty) || qty < 1) {
      updateQuantity(productId, 1);
    }
  };

  // Handle product click - check for variants
  const handleAddProduct = (product: Product) => {
    // @ts-ignore - has_variants exists on product after backend query
    if (product.has_variants) {
      setSelectedProduct(product);
      setIsVariantModalOpen(true);
    } else {
      addToCart(product);
    }
  };

  // Handle variant selection from modal
  const handleVariantSelect = (variant: any) => {
    if (selectedProduct) {
      const finalPrice = selectedProduct.price + variant.price_adjustment;
      addToCart(selectedProduct, {
        variant_id: variant.variant_id,
        variant_name: variant.variant_name,
        price: finalPrice,
        available_stock: variant.available_stock,
      });
    }
  };

  // Client-side code search filter only (search/category handled server-side)
  const filteredProducts = searchCode
    ? products.filter(p => p.product_id.toString().includes(searchCode))
    : products;

  const expectedCash = register ? (
    parseFloat(register.opening_balance || 0) +
    parseFloat(register.cash_sales_total || 0) +
    parseFloat(register.total_cash_in || 0) -
    parseFloat(register.total_cash_out || 0)
  ) : 0;

  // Register loading screen
  if (registerLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-gradient-to-br from-emerald-50 to-teal-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-emerald-600 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading Register...</p>
        </div>
      </div>
    );
  }

  // Register gate: if no open register, show open register screen
  if (!register) {
    return (
      <div className="flex items-center justify-center h-full bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-md text-center border border-emerald-100">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/30">
            <DollarSign size={40} className="text-white" strokeWidth={2.5} />
          </div>
          <h2 className="text-base font-semibold text-gray-800 mb-3">Open Register</h2>
          <p className="text-gray-600 mb-8">Enter the opening cash balance to start your shift</p>

          <div className="relative mb-6">
            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-2xl">$</div>
            <input
              type="number"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              className="w-full pl-12 pr-6 py-5 border-2 border-gray-200 rounded-xl text-3xl font-bold text-center focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              placeholder="0.00"
              min="0"
              step="0.01"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleOpenRegister(); }}
            />
          </div>

          <button
            onClick={handleOpenRegister}
            disabled={openingRegister}
            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:from-gray-300 disabled:to-gray-400 text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3 text-lg"
          >
            {openingRegister ? (
              <>
                <Loader2 className="animate-spin" size={24} />
                Opening Register...
              </>
            ) : (
              <>
                <DollarSign size={24} />
                Open Register & Start
              </>
            )}
          </button>

          <p className="mt-6 text-sm text-gray-500">
            Logged in as <span className="font-semibold text-gray-700">{user?.name}</span>
          </p>

          {(user?.role_name === 'Admin' || user?.role_name === 'Manager') && (
            <div className="mt-6 pt-5 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-2">Admin / Manager Tools</p>
              <button
                onClick={handleForceReset}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl font-medium text-sm transition-colors"
              >
                <Lock size={15} />
                Force Reset Stuck Register
              </button>
              <p className="text-xs text-gray-400 mt-2 text-center">Use this if a register is stuck as "open" after a crash</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-gray-50 overflow-hidden">
      {/* Left Side: Product Grid */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Header / Search */}
        <div className="p-3 md:p-4 bg-white border-b border-gray-100 shadow-sm z-10 space-y-2 md:space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center shadow-md shrink-0">
                <ShoppingBag size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-base md:text-xl font-semibold text-gray-900 leading-tight">Point of Sale</h1>
                <p className="text-xs text-gray-500 hidden sm:block">Cashier: {user?.name}</p>
              </div>
            </div>
            <div className="flex-1"></div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setShowShortcuts(true)}
                className="flex items-center gap-1.5 px-2 py-1.5 md:px-3 md:py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium border border-gray-200"
                title="Keyboard Shortcuts (F1)"
              >
                <Keyboard size={16} />
                <span className="hidden md:inline text-sm">Keys</span>
              </button>
              {canViewReports && (
                <button
                  onClick={() => setIsDailyReportOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 md:px-4 md:py-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors font-medium border border-emerald-200 text-sm"
                >
                  <BarChart size={16} />
                  <span className="hidden sm:inline">Report</span>
                </button>
              )}
              {canCloseRegister && (
                <button
                  onClick={async () => {
                    try {
                      const res = await api.get('/register/current');
                      setRegister(res.data);
                    } catch (_) {}
                    setShowCloseModal(true);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 md:px-4 md:py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-medium border border-red-200 text-sm"
                >
                  <Lock size={16} />
                  <span className="hidden sm:inline">Close</span>
                </button>
              )}
              {/* Mobile cart toggle button */}
              <button
                onClick={() => setShowMobileCart(true)}
                className="lg:hidden relative flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 text-white rounded-lg font-medium text-sm"
              >
                <ShoppingCart size={16} />
                {cart.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-emerald-500 rounded-full text-xs font-black flex items-center justify-center">
                    {cart.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 md:gap-3">
            <div className="relative group">
              <Scan className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={16} />
              <input
                id="barcode-input"
                type="text"
                placeholder="Scan Barcode (F2)"
                className="w-full pl-9 pr-4 py-2 md:py-2.5 bg-gray-50 border-2 border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-sm"
                value={searchBarcode}
                onChange={(e) => setSearchBarcode(e.target.value)}
              />
            </div>
            <div className="relative group hidden sm:block">
              <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={16} />
              <input
                type="text"
                placeholder="Item Code"
                className="w-full pl-9 pr-4 py-2 md:py-2.5 bg-gray-50 border-2 border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-sm"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
              />
            </div>
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={16} />
              <input
                id="search-name-input"
                type="text"
                placeholder="Search Name (F3)"
                className="w-full pl-9 pr-4 py-2 md:py-2.5 bg-gray-50 border-2 border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-sm"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                autoFocus
              />
            </div>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="px-3 md:px-4 py-2 md:py-3 bg-white border-b border-gray-100 flex gap-2 shadow-sm overflow-x-auto scrollbar-hide flex-nowrap">
          <button
            onClick={() => setSelectedCategory('All')}
            className={`px-3 md:px-5 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-bold whitespace-nowrap transition-all shrink-0 ${
              selectedCategory === 'All'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
            }`}
          >
            All Items
          </button>
          {categories.map(cat => (
            <button
              key={cat.category_id}
              onClick={() => setSelectedCategory(cat.category_id.toString())}
              className={`px-3 md:px-5 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-bold whitespace-nowrap transition-all shrink-0 ${
                selectedCategory === cat.category_id.toString()
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
              }`}
            >
              {cat.category_name}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-3 md:p-4 lg:p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-emerald-600 border-t-transparent mx-auto mb-4"></div>
                <p className="text-gray-600 font-medium">Loading products...</p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-2 md:gap-3">
                {filteredProducts.map(product => (
                  <ProductCard
                    key={product.product_id}
                    product={product}
                    onAddToCart={canCreateSale ? handleAddProduct : undefined}
                  />
                ))}
                {filteredProducts.length === 0 && (
                  <div className="col-span-full text-center py-16">
                    <ShoppingBag size={64} className="mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 text-lg font-medium">No products found</p>
                    <p className="text-gray-400 text-sm mt-2">Try adjusting your search filters</p>
                  </div>
                )}
              </div>
              {/* Pagination */}
              <Pagination
                currentPage={productPage}
                totalPages={productTotalPages}
                onPageChange={setProductPage}
                totalItems={productTotalItems}
                itemsPerPage={productLimit}
                onItemsPerPageChange={(limit) => { setProductLimit(limit); setProductPage(1); }}
              />
            </>
          )}
        </div>
      </div>

      {/* Mobile Cart Overlay Backdrop */}
      {showMobileCart && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setShowMobileCart(false)}
        />
      )}

      {/* ═══ Right Side: Cart Sidebar ═══ */}
      <div className={`
        ${showMobileCart
          ? 'fixed inset-x-0 bottom-0 top-16 z-50 flex flex-col rounded-t-2xl shadow-2xl'
          : 'hidden lg:flex flex-col'
        }
        w-full lg:w-[340px] xl:w-[420px] 2xl:w-[480px] bg-white lg:bg-gray-50 border-l border-gray-200 h-full lg:shadow-2xl
      `}>

        {/* ── Cart Header ── */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-3 md:px-5 md:py-3.5 flex items-center justify-between flex-shrink-0 rounded-t-2xl lg:rounded-none">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
              {orderType === 'delivery'
                ? <Truck size={18} className="text-emerald-400" />
                : orderType === 'dine_in'
                ? <UtensilsCrossed size={18} className="text-orange-400" />
                : orderType === 'takeaway'
                ? <Coffee size={18} className="text-yellow-400" />
                : <ShoppingBag size={18} className="text-blue-400" />}
            </div>
            <div>
              <h2 className="text-white font-bold text-sm leading-tight">
                {editingSaleId
                  ? <span className="text-amber-400">Editing Token #{editingTokenNo || editingSaleId}</span>
                  : orderType === 'delivery' ? 'Delivery Order'
                  : orderType === 'dine_in' ? `Dine-In${selectedTableId ? ` · ${tables.find(t => t.table_id === selectedTableId)?.table_name || ''}` : ''}`
                  : orderType === 'takeaway' ? 'Takeaway'
                  : 'Walk-In'}
              </h2>
              <p className="text-gray-400 text-xs">
                {cart.length === 0 ? 'No items' : `${cart.length} item${cart.length > 1 ? 's' : ''} · Rs. ${subtotal.toFixed(0)}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Close cart on mobile */}
            <button
              onClick={() => setShowMobileCart(false)}
              className="lg:hidden p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
            {/* Order Type Toggle in header — only in Category mode */}
            {posMode === 'category' && (
              <div className="flex bg-white/10 rounded-lg p-0.5 gap-0.5">
                <button
                  onClick={() => handleOrderTypeChange('dine_in')}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    orderType === 'dine_in' ? 'bg-orange-500 text-white' : 'text-gray-300 hover:text-white'
                  }`}
                >
                  <UtensilsCrossed size={10} /> Dine
                </button>
                <button
                  onClick={() => handleOrderTypeChange('takeaway')}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    orderType === 'takeaway' ? 'bg-yellow-500 text-white' : 'text-gray-300 hover:text-white'
                  }`}
                >
                  <Coffee size={10} /> TA
                </button>
                <button
                  onClick={() => handleOrderTypeChange('delivery')}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    orderType === 'delivery' ? 'bg-emerald-500 text-white' : 'text-gray-300 hover:text-white'
                  }`}
                >
                  <Truck size={10} /> DL
                </button>
                <button
                  onClick={() => handleOrderTypeChange('on_spot')}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    orderType === 'on_spot' ? 'bg-blue-500 text-white' : 'text-gray-300 hover:text-white'
                  }`}
                >
                  <ShoppingBag size={10} /> WI
                </button>
              </div>
            )}
            {cart.length > 0 && (
              <button
                onClick={() => { clearCart(); setEditingSaleId(null); setEditingTokenNo(null); if (user?.user_id) setAssignedUserId(user.user_id); resetDelivery(); }}
                className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                title="Clear Cart"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {/* ── Editing Banner ── */}
        {editingSaleId && (
          <div className="bg-blue-600/20 border-b border-blue-500/30 px-4 py-2 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
              <p className="text-blue-300 text-xs font-semibold">
                Editing {editingTokenNo ? `Token ${editingTokenNo}` : `Order #${editingSaleId}`} — Save or Complete below
              </p>
            </div>
            <button
              onClick={() => { clearCart(); setEditingSaleId(null); setEditingTokenNo(null); if (user?.user_id) setAssignedUserId(user.user_id); resetDelivery(); }}
              className="text-blue-400 hover:text-blue-200 text-xs font-medium"
            >
              Cancel
            </button>
          </div>
        )}

        {/* ── Waiter / User Panel ── */}
        {posUsers.length > 0 && (
          <UserSelectInput
            users={posUsers}
            selectedUserId={assignedUserId}
            onSelect={handleAssignUser}
            saving={userAssigning}
          />
        )}

        {/* ── Dine-In: Table Search Input ── */}
        {orderType === 'dine_in' && (
          <TableSearchInput
            tables={tables}
            selectedTableId={selectedTableId}
            onSelect={setSelectedTableId}
            onClear={() => setSelectedTableId(null)}
            allowBusy={!!editingSaleId}
          />
        )}

        {/* ── Dine-In / Takeaway: Customer Panel ── */}
        {(orderType === 'dine_in' || orderType === 'takeaway' || orderType === 'on_spot') && (
          <div className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <User size={12} /> Customer
              </span>
              <button
                onClick={() => setIsCustomerModalOpen(true)}
                className="text-xs flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-semibold bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                <UserPlus size={12} /> Add New
              </button>
            </div>
            <div className="relative mb-2" ref={customerSearchRef}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                placeholder="Search by name or phone..."
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all focus:bg-white"
                value={customerSearch}
                onChange={(e) => { setCustomerSearch(e.target.value); setShowCustomerDropdown(true); }}
                onFocus={() => { if (customerSearch.trim()) setShowCustomerDropdown(true); }}
              />
              {showCustomerDropdown && filteredCustomers.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-auto z-30">
                  {filteredCustomers.map(c => (
                    <button
                      key={c.customer_id}
                      onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); setShowCustomerDropdown(false); }}
                      className="w-full text-left px-3 py-2.5 hover:bg-emerald-50 flex items-center gap-2.5 text-sm border-b border-gray-100 last:border-0 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs shrink-0">
                        {c.customer_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <p className="font-semibold text-gray-800">{c.customer_name}</p>
                        {c.phone_number && <p className="text-xs text-gray-500">{c.phone_number}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedCustomer && (
              <div className={`rounded-xl border flex items-center gap-2.5 px-3 py-2.5 ${
                selectedCustomer.customer_id === 1 ? 'border-gray-200 bg-gray-50' : 'border-emerald-200 bg-emerald-50'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                  selectedCustomer.customer_id === 1 ? 'bg-gray-200 text-gray-600' : 'bg-emerald-500 text-white'
                }`}>
                  {selectedCustomer.customer_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-800 text-sm truncate">{selectedCustomer.customer_name}</p>
                  {selectedCustomer.customer_id !== 1 && selectedCustomer.phone_number && (
                    <p className="text-xs text-gray-500 flex items-center gap-1"><Phone size={10} />{selectedCustomer.phone_number}</p>
                  )}
                </div>
                {selectedCustomer.customer_id !== 1 && (
                  <button
                    onClick={() => { const w = customers.find(c => c.customer_id === 1); setSelectedCustomer(w || null); }}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Delivery: 3 Simple Fields ── */}
        {orderType === 'delivery' && (
          <div className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0 space-y-2">

            {/* Phone — with autocomplete dropdown */}
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
              <input
                type="text"
                placeholder="Phone *"
                autoFocus
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none focus:bg-white transition-all"
                value={deliveryInfo.delivery_phone}
                onChange={e => {
                  setDeliveryInfo(d => ({ ...d, delivery_phone: e.target.value }));
                  // clear matched customer if phone is edited
                  if (delivMatchedCust && e.target.value !== delivMatchedCust.phone_number) {
                    setDelivMatchedCust(null);
                    setDelivName('');
                    setDeliveryInfo(d => ({ ...d, delivery_address: '' }));
                  }
                }}
              />
              {/* Suggestions dropdown */}
              {delivPhoneSuggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-30 overflow-hidden">
                  {delivPhoneSuggestions.map(c => (
                    <button
                      key={c.customer_id}
                      onClick={() => {
                        setDelivMatchedCust(c);
                        setDelivName(c.customer_name);
                        setDeliveryInfo(d => ({
                          ...d,
                          delivery_phone: c.phone_number || d.delivery_phone,
                          delivery_address: c.address || '',
                        }));
                        setDelivPhoneSuggestions([]);
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-emerald-50 flex items-center gap-2.5 text-sm border-b border-gray-100 last:border-0 transition-colors"
                    >
                      <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs shrink-0">
                        {c.customer_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 truncate">{c.customer_name}</p>
                        <p className="text-xs text-gray-400">{c.phone_number}</p>
                      </div>
                      {delivMatchedCust?.customer_id === c.customer_id && (
                        <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Name */}
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
              <input
                type="text"
                placeholder="Customer Name *"
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none focus:bg-white transition-all"
                value={delivName}
                onChange={e => setDelivName(e.target.value)}
              />
              {delivMatchedCust && delivMatchedCust.phone_number === deliveryInfo.delivery_phone && (
                <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none" size={15} />
              )}
            </div>

            {/* Address */}
            <div className="relative">
              <MapPin className="absolute left-3 top-3 text-gray-400 pointer-events-none" size={14} />
              <textarea
                placeholder="Delivery Address *"
                rows={2}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none focus:bg-white transition-all"
                value={deliveryInfo.delivery_address}
                onChange={e => setDeliveryInfo(d => ({ ...d, delivery_address: e.target.value }))}
              />
            </div>

            {/* Delivery Charges */}
            <div className="relative">
              <Truck className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
              <input
                type="number"
                placeholder="Delivery Charges (Rs.)"
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none focus:bg-white transition-all"
                value={deliveryInfo.delivery_charges}
                onChange={e => setDeliveryInfo(d => ({ ...d, delivery_charges: e.target.value }))}
              />
            </div>
          </div>
        )}

        {/* ── Cart Items ── */}
        <div className="flex-1 overflow-y-auto px-3 py-2 md:py-3 space-y-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12">
              <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                <ShoppingCart size={36} className="text-gray-300" />
              </div>
              <p className="font-semibold text-gray-500 text-base">Cart is empty</p>
              <p className="text-sm text-gray-400 mt-1">
                {orderType === 'delivery' ? 'Fill delivery info then add products' : 'Scan a barcode or tap a product'}
              </p>
            </div>
          ) : (
            cart.map((item, idx) => (
              <div key={item.product_id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all overflow-hidden">
                <div className="flex items-start gap-3 px-3 pt-3 pb-1.5">
                  <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 font-black text-xs shrink-0 mt-0.5">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-800 text-sm leading-tight truncate">{item.product_name}</h4>
                    {item.variant_name && (
                      <p className="text-xs text-emerald-600 font-medium mt-0.5">{item.variant_name}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-black text-emerald-600 text-base">Rs. {(item.price * item.quantity).toFixed(0)}</p>
                    <p className="text-xs text-gray-400">@ {item.price.toFixed(0)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                    <button
                      onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                      className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      <Minus size={12} />
                    </button>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleCartQtyChange(item.product_id, e.target.value)}
                      onBlur={(e) => handleCartQtyBlur(item.product_id, e.target.value)}
                      className="w-10 text-center text-sm font-black text-gray-800 bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      min="1"
                    />
                    <button
                      onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                      className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <span className="text-xs text-gray-400">× Rs. {item.price.toFixed(0)}</span>
                  <button
                    onClick={() => removeFromCart(item.product_id)}
                    className="w-7 h-7 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Totals + Actions ── */}
        <div className="bg-white border-t-2 border-gray-200 flex-shrink-0">

          {/* Charges breakdown */}
          <div className="px-4 pt-3 pb-2 space-y-1.5 border-b border-gray-100">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-bold text-gray-700">Rs. {subtotal.toFixed(0)}</span>
            </div>
            {/* Tax row */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1.5 text-gray-500">
                <Percent size={12} />
                <span>Tax</span>
                <input
                  type="number"
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                  className="w-11 px-1.5 py-0.5 border border-gray-200 rounded-lg text-center text-xs font-bold bg-gray-50 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  step="0.1"
                />
                <span className="text-gray-400 text-xs">%</span>
              </div>
              <span className="font-medium text-gray-600 text-sm">Rs. {taxAmount.toFixed(0)}</span>
            </div>
            {/* Service Charges row */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1.5 text-gray-500">
                <Tag size={12} />
                <span>Service</span>
                <input
                  type="number"
                  value={serviceRate}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setServiceRate(v);
                    setAdditionalRate(v + otherRate);
                  }}
                  className="w-11 px-1.5 py-0.5 border border-gray-200 rounded-lg text-center text-xs font-bold bg-gray-50 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  step="0.1"
                />
                <span className="text-gray-400 text-xs">%</span>
              </div>
              <span className="font-medium text-gray-600 text-sm">Rs. {(subtotal * serviceRate / 100).toFixed(0)}</span>
            </div>
            {/* Other Charges row */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1.5 text-gray-500">
                <Tag size={12} />
                <span className="truncate max-w-[60px]" title={otherLabel}>{otherLabel.length > 6 ? otherLabel.slice(0, 6) + '…' : otherLabel}</span>
                <input
                  type="number"
                  value={otherRate}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setOtherRate(v);
                    setAdditionalRate(serviceRate + v);
                  }}
                  className="w-11 px-1.5 py-0.5 border border-gray-200 rounded-lg text-center text-xs font-bold bg-gray-50 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  step="0.1"
                />
                <span className="text-gray-400 text-xs">%</span>
              </div>
              <span className="font-medium text-gray-600 text-sm">Rs. {(subtotal * otherRate / 100).toFixed(0)}</span>
            </div>
            {orderType === 'delivery' && delivCharges > 0 && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500 flex items-center gap-1.5"><Truck size={12} /> Delivery</span>
                <span className="font-medium text-gray-600">Rs. {delivCharges.toFixed(0)}</span>
              </div>
            )}
            {appliedBundles.length > 0 && (
              <div className="bg-emerald-50 border border-green-200 rounded-lg p-2 space-y-0.5">
                <div className="flex items-center justify-between text-sm font-bold text-emerald-700">
                  <span>🎁 Bundle Savings</span>
                  <span>- Rs. {bundleDiscount.toFixed(0)}</span>
                </div>
                {appliedBundles.map((bundle, idx) => (
                  <div key={idx} className="text-xs text-emerald-600 flex justify-between">
                    <span className="flex-1 truncate">{bundle.bundle_name}</span>
                    <span className="font-semibold ml-2">- Rs. {bundle.discount_amount.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Grand Total */}
          <div className="px-4 py-3 bg-slate-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calculator size={16} className="text-gray-400" />
              <span className="text-gray-300 font-semibold text-sm">Grand Total</span>
            </div>
            <span className="text-2xl font-black text-emerald-400">
              Rs. {(total + delivCharges).toFixed(0)}
            </span>
          </div>

          {/* Success Banners */}
          {holdToken && (
            <div className="mx-3 mt-2 px-4 py-2.5 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-600 font-medium">Order Dispatched</p>
                <p className="text-xl font-black text-amber-700">Token: {holdToken}</p>
              </div>
              <button onClick={() => setHoldToken(null)} className="text-amber-400 hover:text-amber-600">
                <X size={16} />
              </button>
            </div>
          )}
          {deliveryConfirm && (
            <div className="mx-3 mt-2 px-4 py-2.5 bg-emerald-50 border border-emerald-400 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-600 font-medium flex items-center gap-1"><Truck size={11} /> Delivery Created</p>
                <p className="text-lg font-black text-emerald-700">{deliveryConfirm}</p>
              </div>
              <button onClick={() => setDeliveryConfirm(null)} className="text-emerald-400 hover:text-emerald-600">
                <X size={16} />
              </button>
            </div>
          )}
          {quotationSuccess && (
            <div className="mx-3 mt-2 px-4 py-2.5 bg-indigo-50 border border-indigo-300 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs text-indigo-600 font-medium flex items-center gap-1"><FileText size={11} /> Quotation Saved</p>
                <p className="text-lg font-black text-indigo-700">{quotationSuccess}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => navigate('/quotations')} className="text-xs bg-indigo-600 text-white px-2 py-1 rounded-lg hover:bg-indigo-700 font-medium">View</button>
                <button onClick={() => setQuotationSuccess(null)} className="text-indigo-400 hover:text-indigo-600"><X size={16} /></button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="p-3 space-y-2">
            {editingSaleId ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleSaveEdit}
                  disabled={cart.length === 0 || !canUpdateSale}
                  className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold text-sm shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  title={!canUpdateSale ? 'No update permission' : undefined}
                >
                  <Archive size={16} /> Save Changes
                </button>
                <button
                  onClick={() => { setSelectedPendingSale({ sale_id: editingSaleId, token_no: editingTokenNo, isCartEdit: true }); setIsCheckoutOpen(true); }}
                  disabled={cart.length === 0 || !canCreateSale}
                  className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <DollarSign size={16} /> Complete <span className="text-white/60 text-xs">F9</span>
                </button>
              </div>
            ) : orderType === 'delivery' ? (
              <button
                onClick={handleSendToDelivery}
                disabled={cart.length === 0}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Truck size={16} /> Send to Delivery
              </button>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleHoldOrder}
                    disabled={cart.length === 0 || !canCreateSale}
                    className={`flex items-center justify-center gap-2 text-white py-3.5 rounded-xl font-bold text-sm transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed ${
                      orderType === 'dine_in'
                        ? 'bg-orange-500 hover:bg-orange-600'
                        : orderType === 'takeaway'
                        ? 'bg-amber-500 hover:bg-amber-600'
                        : 'bg-blue-500 hover:bg-blue-600'
                    }`}
                    title={!canCreateSale ? 'You do not have permission to punch orders' : undefined}
                  >
                    {orderType === 'dine_in'
                      ? <><UtensilsCrossed size={15} /> KOT + Hold</>
                      : orderType === 'takeaway'
                      ? <><Coffee size={15} /> Punch/Hold</>
                      : <><Archive size={15} /> Hold Order</>}
                    <span className="text-white/50 text-xs">F8</span>
                  </button>
                  <button
                    onClick={() => { setSelectedPendingSale(null); setIsCheckoutOpen(true); }}
                    disabled={cart.length === 0 || !canCreateSale}
                    className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    title={!canCreateSale ? 'You do not have permission to process payments' : undefined}
                  >
                    <DollarSign size={16} /> Pay Now <span className="text-white/60 text-xs">F9</span>
                  </button>
                </div>
                {canCreateQuotation && (
                  <button
                    onClick={() => { setQtValidUntil(''); setQtNotes(''); setShowQuotationModal(true); }}
                    disabled={cart.length === 0}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <FileText size={16} /> Save as Quotation
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowShortcuts(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Keyboard size={24} className="text-emerald-600" />
                Keyboard Shortcuts
              </h3>
              <button onClick={() => setShowShortcuts(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <div className="space-y-2">
              {[
                { key: 'F1',  desc: 'Show shortcuts' },
                { key: 'F2',  desc: 'Focus barcode scanner' },
                { key: 'F3',  desc: 'Focus name search' },
                { key: 'F6',  desc: 'Print Cash Bill (after checkout)' },
                { key: 'F7',  desc: 'Print Card Bill (after checkout)' },
                { key: 'F8',  desc: 'Punch/Dispatch order' },
                { key: 'F9',  desc: 'Pay now / Checkout' },
                { key: 'ESC', desc: 'Close modals' },
              ].map(({ key, desc }) => (
                <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-700">{desc}</span>
                  <kbd className="px-3 py-1 bg-white border-2 border-gray-300 rounded-lg font-mono font-bold text-sm shadow-sm">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => {
          setIsCheckoutOpen(false);
          setSelectedPendingSale(null);
        }}
        onSuccess={() => {
          setIsCheckoutOpen(false);
          setSelectedPendingSale(null);
          setEditingSaleId(null);
          setEditingTokenNo(null);
          if (user?.user_id) setAssignedUserId(user.user_id);
          setShowMobileCart(false);
          setSelectedTableId(null);
          fetchTables();
          resetDelivery();
          const walkin = customers.find(c => c.customer_id === 1);
          setSelectedCustomer(walkin || null);
        }}
        pendingSale={selectedPendingSale}
        selectedCustomer={selectedCustomer}
        appliedBundles={appliedBundles}
      />

      <AddCustomerModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onSuccess={(newCustomer?: any) => {
          if (newCustomer) setSelectedCustomer(newCustomer);
          fetchCustomers();
        }}
      />

      <DailyReportModal
        isOpen={isDailyReportOpen}
        onClose={() => setIsDailyReportOpen(false)}
      />

      <RegisterCloseModal
        isOpen={showCloseModal}
        onClose={() => setShowCloseModal(false)}
        onSuccess={() => {
          setShowCloseModal(false);
          setRegister(null);
        }}
        expectedCash={expectedCash}
        register={register}
      />

      {selectedProduct && (
        <ProductVariantModal
          isOpen={isVariantModalOpen}
          onClose={() => {
            setIsVariantModalOpen(false);
            setSelectedProduct(null);
          }}
          product={selectedProduct}
          onSelectVariant={handleVariantSelect}
        />
      )}


      {/* ── Save as Quotation Modal ────────────────────────────── */}
      {showQuotationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <FileText size={18} className="text-indigo-600" /> Save as Quotation
              </h2>
              <button onClick={() => setShowQuotationModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Cart Summary */}
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500 font-medium mb-2 uppercase tracking-wide">Cart Items ({cart.length})</p>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {cart.map(item => (
                    <div key={item.product_id} className="flex justify-between text-sm text-gray-700">
                      <span className="truncate flex-1">{item.product_name} × {item.quantity}</span>
                      <span className="font-medium ml-2">Rs. {(item.price * item.quantity).toFixed(0)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between text-sm font-bold text-gray-800">
                  <span>Total</span>
                  <span>Rs. {(total + delivCharges).toFixed(0)}</span>
                </div>
              </div>
              {/* Customer */}
              <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50 rounded-lg px-3 py-2">
                <User size={14} className="text-blue-500" />
                <span>Customer: <span className="font-medium text-gray-800">{selectedCustomer?.customer_name || 'Walk-in Customer'}</span></span>
              </div>
              {/* Valid Until */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="date"
                  value={qtValidUntil}
                  onChange={(e) => setQtValidUntil(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                />
              </div>
              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
                <textarea
                  value={qtNotes}
                  onChange={(e) => setQtNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm resize-none"
                  placeholder="Add any notes..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t">
              <button onClick={() => setShowQuotationModal(false)} className="px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleSaveAsQuotation}
                disabled={quotationSaving}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 font-medium"
              >
                {quotationSaving ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
                Save Quotation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;