import { useState, useEffect, useCallback } from 'react';
import { Percent, Plus, Search, Edit2, Trash2, X, Tag, Clock, ShoppingBag, Layers } from 'lucide-react';
import api from '../../utils/api';
import Pagination from '../../components/Pagination';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PriceRule {
  rule_id: number;
  rule_name: string;
  rule_type: 'buy_x_get_y' | 'quantity_discount' | 'time_based' | 'category_discount';
  description: string;
  priority: number;
  start_date: string;
  end_date: string;
  min_quantity: number | null;
  buy_quantity: number | null;
  get_quantity: number | null;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  max_uses: number | null;
  total_used: number;
  applies_to: 'all' | 'product' | 'category';
  is_active: boolean;
  created_at: string;
}

interface PriceRuleStats {
  active_count: number;
  total_rules: number;
  expired_count: number;
  savings_this_month: number;
}

interface RuleFormData {
  rule_name: string;
  description: string;
  rule_type: 'buy_x_get_y' | 'quantity_discount' | 'time_based' | 'category_discount';
  priority: number;
  start_date: string;
  end_date: string;
  min_quantity: number | string;
  buy_quantity: number | string;
  get_quantity: number | string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number | string;
  max_uses: number | string;
  applies_to: 'all' | 'product' | 'category';
  product_ids: number[];
  category_ids: number[];
  is_active: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const RULE_TYPE_LABELS: Record<string, string> = {
  buy_x_get_y: 'Buy X Get Y',
  quantity_discount: 'Quantity Discount',
  time_based: 'Time Based',
  category_discount: 'Category Discount',
};

const RULE_TYPE_BADGE_CLASSES: Record<string, string> = {
  buy_x_get_y: 'bg-emerald-100 text-emerald-700',
  quantity_discount: 'bg-emerald-100 text-emerald-700',
  time_based: 'bg-orange-100 text-orange-700',
  category_discount: 'bg-emerald-100 text-emerald-700',
};

const RULE_TYPE_ICONS: Record<string, React.ReactNode> = {
  buy_x_get_y: <ShoppingBag size={14} />,
  quantity_discount: <Layers size={14} />,
  time_based: <Clock size={14} />,
  category_discount: <Tag size={14} />,
};

const DEFAULT_FORM_DATA: RuleFormData = {
  rule_name: '',
  description: '',
  rule_type: 'buy_x_get_y',
  priority: 1,
  start_date: '',
  end_date: '',
  min_quantity: '',
  buy_quantity: '',
  get_quantity: '',
  discount_type: 'percentage',
  discount_value: '',
  max_uses: '',
  applies_to: 'all',
  product_ids: [],
  category_ids: [],
  is_active: true,
};

// ── Create/Edit Modal ─────────────────────────────────────────────────────────

const RuleModal = ({
  isOpen,
  onClose,
  onSuccess,
  editRule,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editRule: PriceRule | null;
}) => {
  const [formData, setFormData] = useState<RuleFormData>({ ...DEFAULT_FORM_DATA });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (editRule) {
        setFormData({
          rule_name: editRule.rule_name,
          description: editRule.description || '',
          rule_type: editRule.rule_type,
          priority: editRule.priority,
          start_date: editRule.start_date ? editRule.start_date.split('T')[0] : '',
          end_date: editRule.end_date ? editRule.end_date.split('T')[0] : '',
          min_quantity: editRule.min_quantity ?? '',
          buy_quantity: editRule.buy_quantity ?? '',
          get_quantity: editRule.get_quantity ?? '',
          discount_type: editRule.discount_type || 'percentage',
          discount_value: editRule.discount_value ?? '',
          max_uses: editRule.max_uses ?? '',
          applies_to: editRule.applies_to || 'all',
          product_ids: [],
          category_ids: [],
          is_active: editRule.is_active,
        });
      } else {
        setFormData({ ...DEFAULT_FORM_DATA });
      }
      setError('');
    }
  }, [isOpen, editRule]);

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.rule_name.trim()) {
      setError('Rule name is required');
      return;
    }
    if (!formData.start_date) {
      setError('Start date is required');
      return;
    }
    if (!formData.discount_value && formData.discount_value !== 0) {
      setError('Discount value is required');
      return;
    }

    if (formData.rule_type === 'buy_x_get_y') {
      if (!formData.buy_quantity || !formData.get_quantity) {
        setError('Buy quantity and Get quantity are required for Buy X Get Y rules');
        return;
      }
    }
    if (formData.rule_type === 'quantity_discount') {
      if (!formData.min_quantity) {
        setError('Minimum quantity is required for Quantity Discount rules');
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        min_quantity: formData.min_quantity === '' ? null : Number(formData.min_quantity),
        buy_quantity: formData.buy_quantity === '' ? null : Number(formData.buy_quantity),
        get_quantity: formData.get_quantity === '' ? null : Number(formData.get_quantity),
        discount_value: Number(formData.discount_value),
        max_uses: formData.max_uses === '' ? null : Number(formData.max_uses),
        priority: Number(formData.priority),
      };

      if (editRule) {
        await api.put(`/price-rules/${editRule.rule_id}`, payload);
      } else {
        await api.post('/price-rules', payload);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save rule');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold text-gray-800">
            {editRule ? 'Edit Price Rule' : 'Create Price Rule'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Rule Name & Description */}
          <div className="grid grid-cols-1 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name *</label>
              <input
                type="text"
                value={formData.rule_name}
                onChange={(e) => updateField('rule_name', e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="e.g., Buy 2 Get 1 Free"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                rows={2}
                placeholder="Optional description of this rule"
              />
            </div>
          </div>

          {/* Rule Type Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Rule Type *</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => updateField('rule_type', 'buy_x_get_y')}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-sm font-medium ${
                  formData.rule_type === 'buy_x_get_y'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <ShoppingBag size={20} />
                Buy X Get Y
              </button>
              <button
                type="button"
                onClick={() => updateField('rule_type', 'quantity_discount')}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-sm font-medium ${
                  formData.rule_type === 'quantity_discount'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <Layers size={20} />
                Quantity Discount
              </button>
              <button
                type="button"
                onClick={() => updateField('rule_type', 'time_based')}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-sm font-medium ${
                  formData.rule_type === 'time_based'
                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <Clock size={20} />
                Time Based
              </button>
              <button
                type="button"
                onClick={() => updateField('rule_type', 'category_discount')}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-sm font-medium ${
                  formData.rule_type === 'category_discount'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <Tag size={20} />
                Category Discount
              </button>
            </div>
          </div>

          {/* Dynamic Fields Based on Rule Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {formData.rule_type === 'buy_x_get_y' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Buy Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.buy_quantity}
                    onChange={(e) => updateField('buy_quantity', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="e.g., 2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Get Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.get_quantity}
                    onChange={(e) => updateField('get_quantity', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="e.g., 1"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount on Free Items (%) *</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.discount_value}
                    onChange={(e) => updateField('discount_value', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="e.g., 100 for fully free"
                  />
                </div>
              </>
            )}

            {formData.rule_type === 'quantity_discount' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.min_quantity}
                    onChange={(e) => updateField('min_quantity', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="e.g., 5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount Type *</label>
                  <select
                    value={formData.discount_type}
                    onChange={(e) => updateField('discount_type', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Discount Value {formData.discount_type === 'percentage' ? '(%)' : '(Amount)'} *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.discount_value}
                    onChange={(e) => updateField('discount_value', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="e.g., 10"
                  />
                </div>
              </>
            )}

            {(formData.rule_type === 'time_based' || formData.rule_type === 'category_discount') && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount Type *</label>
                  <select
                    value={formData.discount_type}
                    onChange={(e) => updateField('discount_type', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Discount Value {formData.discount_type === 'percentage' ? '(%)' : '(Amount)'} *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.discount_value}
                    onChange={(e) => updateField('discount_value', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="e.g., 15"
                  />
                </div>
              </>
            )}
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => updateField('start_date', e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => updateField('end_date', e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* Priority, Max Uses, Applies To */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <input
                type="number"
                min="1"
                value={formData.priority}
                onChange={(e) => updateField('priority', e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Uses</label>
              <input
                type="number"
                min="0"
                value={formData.max_uses}
                onChange={(e) => updateField('max_uses', e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="Unlimited"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Applies To</label>
              <select
                value={formData.applies_to}
                onChange={(e) => updateField('applies_to', e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="all">All Products</option>
                <option value="product">Specific Products</option>
                <option value="category">Specific Categories</option>
              </select>
            </div>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center gap-3 mb-6">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => updateField('is_active', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
            <span className="text-sm font-medium text-gray-700">Active</span>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                editRule ? 'Update Rule' : 'Create Rule'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Delete Confirmation Modal ─────────────────────────────────────────────────

const DeleteModal = ({
  isOpen,
  onClose,
  onConfirm,
  ruleName,
  loading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  ruleName: string;
  loading: boolean;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-800">Delete Price Rule</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <p className="text-gray-600 mb-6">
          Are you sure you want to delete <span className="font-semibold">"{ruleName}"</span>? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Deleting...
              </>
            ) : (
              <>
                <Trash2 size={16} />
                Delete
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

const PriceRules = () => {
  const [rules, setRules] = useState<PriceRule[]>([]);
  const [stats, setStats] = useState<PriceRuleStats>({
    active_count: 0,
    total_rules: 0,
    expired_count: 0,
    savings_this_month: 0,
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [ruleTypeFilter, setRuleTypeFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  // Modals
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editRule, setEditRule] = useState<PriceRule | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PriceRule | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(itemsPerPage),
      });
      if (search) params.append('search', search);
      if (ruleTypeFilter) params.append('rule_type', ruleTypeFilter);
      if (activeFilter) params.append('is_active', activeFilter);

      const res = await api.get(`/price-rules?${params.toString()}`);
      setRules(res.data.data);
      setTotalPages(res.data.pagination.totalPages);
      setTotal(res.data.pagination.total);
    } catch (error) {
      console.error('Failed to fetch price rules', error);
    } finally {
      setLoading(false);
    }
  }, [page, itemsPerPage, search, ruleTypeFilter, activeFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/price-rules/stats');
      setStats(res.data);
    } catch (error) {
      console.error('Failed to fetch stats', error);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchRules();
  };

  const handleOpenCreate = () => {
    setEditRule(null);
    setShowRuleModal(true);
  };

  const handleOpenEdit = (rule: PriceRule) => {
    setEditRule(rule);
    setShowRuleModal(true);
  };

  const handleOpenDelete = (rule: PriceRule) => {
    setDeleteTarget(rule);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/price-rules/${deleteTarget.rule_id}`);
      setShowDeleteModal(false);
      setDeleteTarget(null);
      fetchRules();
      fetchStats();
    } catch (error) {
      console.error('Failed to delete rule', error);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleRuleSaved = () => {
    fetchRules();
    fetchStats();
  };

  const getRuleStatus = (rule: PriceRule): { label: string; className: string } => {
    if (!rule.is_active) {
      return { label: 'Inactive', className: 'bg-gray-100 text-gray-600' };
    }
    if (rule.end_date && new Date(rule.end_date) < new Date()) {
      return { label: 'Expired', className: 'bg-red-100 text-red-700' };
    }
    return { label: 'Active', className: 'bg-emerald-100 text-emerald-700' };
  };

  const formatDiscount = (rule: PriceRule): string => {
    if (rule.rule_type === 'buy_x_get_y') {
      return `Buy ${rule.buy_quantity} Get ${rule.get_quantity} (${rule.discount_value}% off)`;
    }
    if (rule.discount_type === 'percentage') {
      return `${rule.discount_value}%`;
    }
    return `Rs. ${Number(rule.discount_value).toFixed(0)}`;
  };

  const formatDateRange = (start: string, end: string | null): string => {
    const startStr = start ? new Date(start).toLocaleDateString() : '-';
    const endStr = end ? new Date(end).toLocaleDateString() : 'No end';
    return `${startStr} - ${endStr}`;
  };

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 flex items-center gap-3">
            <Percent className="text-emerald-600" size={20} />
            Price Rules
          </h1>
          <p className="text-gray-500 mt-1">Manage promotions, discounts, and pricing rules</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 rounded-lg">
              <Percent size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Rules</p>
              <p className="text-2xl font-bold text-gray-800">{stats.active_count}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 rounded-lg">
              <Layers size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Rules</p>
              <p className="text-2xl font-bold text-gray-800">{stats.total_rules}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-50 rounded-lg">
              <Clock size={20} className="text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Expired</p>
              <p className="text-2xl font-bold text-gray-800">{stats.expired_count}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 rounded-lg">
              <Tag size={20} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Savings This Month</p>
              <p className="text-2xl font-bold text-gray-800">Rs. {Number(stats.savings_this_month).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <form onSubmit={handleSearchSubmit} className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search rules..."
                className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
          </form>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Rule Type</label>
            <select
              value={ruleTypeFilter}
              onChange={(e) => { setRuleTypeFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="">All Types</option>
              <option value="buy_x_get_y">Buy X Get Y</option>
              <option value="quantity_discount">Quantity Discount</option>
              <option value="time_based">Time Based</option>
              <option value="category_discount">Category Discount</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select
              value={activeFilter}
              onChange={(e) => { setActiveFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium flex items-center gap-2"
          >
            <Plus size={16} />
            Create Rule
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[800px]">
                <thead className="bg-gray-50 text-gray-600 font-medium">
                  <tr>
                    <th className="p-4">Rule Name</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Discount</th>
                    <th className="p-4">Date Range</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-center">Priority</th>
                    <th className="p-4 text-center">Used / Max</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rules.map((rule) => {
                    const status = getRuleStatus(rule);
                    return (
                      <tr key={rule.rule_id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4">
                          <div className="font-medium text-gray-800">{rule.rule_name}</div>
                          {rule.description && (
                            <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">
                              {rule.description}
                            </div>
                          )}
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${RULE_TYPE_BADGE_CLASSES[rule.rule_type] || 'bg-gray-100 text-gray-700'}`}>
                            {RULE_TYPE_ICONS[rule.rule_type]}
                            {RULE_TYPE_LABELS[rule.rule_type] || rule.rule_type}
                          </span>
                        </td>
                        <td className="p-4 text-gray-700 font-medium">
                          {formatDiscount(rule)}
                        </td>
                        <td className="p-4 text-gray-500 text-xs whitespace-nowrap">
                          {formatDateRange(rule.start_date, rule.end_date)}
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="p-4 text-center text-gray-600">
                          {rule.priority}
                        </td>
                        <td className="p-4 text-center text-gray-600">
                          {rule.total_used ?? 0} / {rule.max_uses ?? '\u221E'}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenEdit(rule)}
                              className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleOpenDelete(rule)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {rules.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-gray-400">
                        <div className="flex flex-col items-center gap-2">
                          <Percent size={40} className="text-gray-300" />
                          <p className="text-lg font-medium">No price rules found</p>
                          <p className="text-sm">Create your first promotion or adjust your filters</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={total}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={(l) => { setItemsPerPage(l); setPage(1); }}
            />
          </>
        )}
      </div>

      {/* Modals */}
      <RuleModal
        isOpen={showRuleModal}
        onClose={() => { setShowRuleModal(false); setEditRule(null); }}
        onSuccess={handleRuleSaved}
        editRule={editRule}
      />
      <DeleteModal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeleteTarget(null); }}
        onConfirm={handleDelete}
        ruleName={deleteTarget?.rule_name || ''}
        loading={deleteLoading}
      />
    </div>
  );
};

export default PriceRules;
