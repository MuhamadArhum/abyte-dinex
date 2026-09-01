import React, { useState, useEffect, useCallback } from 'react';
import {
  Tag, Plus, Pencil, Trash2, Search, X, ChevronDown, ChevronRight,
  FlaskConical, Layers, CheckCircle, Package, FolderPlus
} from 'lucide-react';
import api from '../../utils/api';
import EmptyState from '../../components/EmptyState';
import { useConfirm } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';

type CategoryType = 'raw_material' | 'semi_finished' | 'finished_good';
type TabKey = 'finished_good' | 'raw_material' | 'semi_finished';

interface Category {
  category_id: number;
  category_name: string;
  category_type: CategoryType;
  parent_id: number | null;
  description: string | null;
  is_active: number;
  product_count: number;
  children?: Category[];
}

interface CategoriesProps {
  categoryType?: CategoryType;
}

const TABS: { key: TabKey; label: string; icon: React.ReactElement; color: string; active: string; ring: string; btn: string }[] = [
  {
    key: 'finished_good',
    label: 'Finished Goods',
    icon: <CheckCircle size={15} />,
    color: 'text-emerald-700',
    active: 'border-emerald-600 text-emerald-700 bg-emerald-50',
    ring: 'focus:ring-emerald-400',
    btn: 'bg-emerald-600 hover:bg-emerald-700',
  },
  {
    key: 'raw_material',
    label: 'Raw Materials',
    icon: <FlaskConical size={15} />,
    color: 'text-blue-700',
    active: 'border-blue-600 text-blue-700 bg-blue-50',
    ring: 'focus:ring-blue-400',
    btn: 'bg-blue-600 hover:bg-blue-700',
  },
  {
    key: 'semi_finished',
    label: 'Semi-Finished',
    icon: <Layers size={15} />,
    color: 'text-amber-700',
    active: 'border-amber-500 text-amber-700 bg-amber-50',
    ring: 'focus:ring-amber-400',
    btn: 'bg-amber-500 hover:bg-amber-600',
  },
];

const emptyForm = { category_name: '', description: '', is_active: 1, parent_id: null as number | null };

// Build tree from flat list
function buildTree(flat: Category[]): Category[] {
  const map = new Map<number, Category>();
  flat.forEach(c => map.set(c.category_id, { ...c, children: [] }));
  const roots: Category[] = [];
  map.forEach(c => {
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id)!.children!.push(c);
    } else {
      roots.push(c);
    }
  });
  return roots;
}

const Categories = ({ categoryType }: CategoriesProps = {}) => {
  const confirm = useConfirm();
  const { error } = useToast();
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<TabKey>(categoryType ?? 'finished_good');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [modalType, setModalType] = useState<CategoryType>('finished_good');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/products/categories');
      setAllCategories(res.data.data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  // Filter by current tab type, then build tree
  const tabCategories = allCategories.filter(c => c.category_type === tab);
  const tree = buildTree(tabCategories);

  // Search: if searching, flatten and filter
  const searchLower = search.toLowerCase();
  const displayList = search
    ? tabCategories.filter(c =>
        c.category_name.toLowerCase().includes(searchLower) ||
        (c.description && c.description.toLowerCase().includes(searchLower))
      )
    : tree;

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openAdd = (type: CategoryType, parentId: number | null = null) => {
    setEditCat(null);
    setModalType(type);
    setForm({ category_name: '', description: '', is_active: 1, parent_id: parentId });
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (cat: Category) => {
    setEditCat(cat);
    setModalType(cat.category_type);
    setForm({ category_name: cat.category_name, description: cat.description || '', is_active: cat.is_active, parent_id: cat.parent_id });
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.category_name.trim()) { setFormError('Category name is required'); return; }
    setSaving(true); setFormError('');
    try {
      const payload = {
        category_name: form.category_name.trim(),
        category_type: modalType,
        description: form.description.trim() || null,
        is_active: form.is_active,
        parent_id: form.parent_id || null,
      };
      if (editCat) {
        await api.put(`/products/categories/${editCat.category_id}`, payload);
      } else {
        await api.post('/products/categories', payload);
      }
      setShowModal(false);
      fetchCategories();
      if (form.parent_id) setExpanded(prev => new Set([...prev, form.parent_id!]));
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDelete = async (cat: Category) => {
    const ok = await confirm({ title: 'Delete Category', message: `Delete "${cat.category_name}"?`, type: 'danger' });
    if (!ok) return;
    try {
      await api.delete(`/products/categories/${cat.category_id}`);
      fetchCategories();
    } catch (err: any) {
      error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const currentTab = TABS.find(t => t.key === tab)!;
  const parentCategories = allCategories.filter(c => c.category_type === tab && c.parent_id === null);

  // Recursive row renderer
  const renderRow = (cat: Category, depth = 0): React.ReactElement => {
    const hasChildren = cat.children && cat.children.length > 0;
    const isExpanded = expanded.has(cat.category_id);
    const indent = depth * 24;

    return (
      <React.Fragment key={cat.category_id}>
        <tr className={`hover:bg-gray-50 border-b border-gray-100 ${depth > 0 ? 'bg-gray-50/50' : ''}`}>
          <td className="px-4 py-3">
            <span className="inline-block px-1.5 py-0.5 text-xs font-mono font-semibold bg-gray-100 text-gray-500 rounded">
              #{cat.category_id}
            </span>
          </td>
          <td className="px-4 py-3">
            <div className="flex items-center gap-2" style={{ paddingLeft: `${indent}px` }}>
              {/* Expand toggle */}
              <button
                onClick={() => hasChildren && toggleExpand(cat.category_id)}
                className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${hasChildren ? 'text-gray-500 hover:text-gray-700 hover:bg-gray-200' : 'text-transparent cursor-default'}`}
              >
                {hasChildren ? (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span className="w-4" />}
              </button>

              {/* Icon */}
              <div className={`p-1.5 rounded-lg ${depth === 0 ? 'bg-gray-100' : 'bg-white border border-gray-200'}`}>
                <Tag size={13} className={depth === 0 ? currentTab.color : 'text-gray-400'} />
              </div>

              <div>
                <span className={`font-medium ${depth === 0 ? 'text-gray-900' : 'text-gray-700'} text-sm`}>
                  {cat.category_name}
                </span>
                {cat.description && (
                  <p className="text-xs text-gray-400 mt-0.5">{cat.description}</p>
                )}
              </div>
            </div>
          </td>
          <td className="px-4 py-3 text-sm text-gray-500">
            {depth === 0
              ? <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded font-medium">Parent</span>
              : <span className="px-2 py-0.5 text-xs bg-blue-50 text-blue-600 rounded font-medium">Sub-category</span>
            }
          </td>
          <td className="px-4 py-3 text-sm text-gray-500 text-center">{cat.product_count}</td>
          <td className="px-4 py-3">
            <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${cat.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
              {cat.is_active ? 'Active' : 'Inactive'}
            </span>
          </td>
          <td className="px-4 py-3">
            <div className="flex items-center gap-1">
              {/* Add sub-category — only on parent rows */}
              {depth === 0 && (
                <button
                  onClick={() => openAdd(cat.category_type, cat.category_id)}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                  title="Add Sub-category"
                >
                  <FolderPlus size={13} /> Sub
                </button>
              )}
              <button onClick={() => openEdit(cat)} className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Edit">
                <Pencil size={14} />
              </button>
              <button onClick={() => handleDelete(cat)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                <Trash2 size={14} />
              </button>
            </div>
          </td>
        </tr>
        {/* Render children if expanded */}
        {hasChildren && isExpanded && cat.children!.map(child => renderRow(child, depth + 1))}
      </React.Fragment>
    );
  };

  const countByType = (type: CategoryType) => allCategories.filter(c => c.category_type === type).length;

  return (
    <div>
      {/* Tab Bar — like Products.tsx */}
      <div className="border-b border-gray-200 bg-white px-6 pt-4">
        <div className="flex gap-1">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSearch(''); }}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                tab === t.key ? t.active : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t.icon} {t.label}
              <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-white/70' : 'bg-gray-100 text-gray-500'}`}>
                {countByType(t.key)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              {currentTab.icon && React.cloneElement(currentTab.icon, { size: 20, className: currentTab.color } as any)}
              {currentTab.label} Categories
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {countByType(tab)} categories · {allCategories.filter(c => c.category_type === tab && c.parent_id !== null).length} sub-categories
            </p>
          </div>
          <button
            onClick={() => openAdd(tab)}
            className={`${currentTab.btn} text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors`}
          >
            <Plus size={18} /> <span className="hidden sm:inline">Add Category</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className="p-2.5 bg-gray-50 rounded-xl"><Tag size={20} className="text-gray-500" /></div>
            <div>
              <p className="text-xl font-bold text-gray-800">{allCategories.filter(c => c.category_type === tab && !c.parent_id).length}</p>
              <p className="text-xs text-gray-500">Parent Categories</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 rounded-xl"><FolderPlus size={20} className="text-blue-500" /></div>
            <div>
              <p className="text-xl font-bold text-blue-600">{allCategories.filter(c => c.category_type === tab && c.parent_id !== null).length}</p>
              <p className="text-xs text-gray-500">Sub-categories</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 rounded-xl"><Package size={20} className="text-emerald-500" /></div>
            <div>
              <p className="text-xl font-bold text-emerald-600">{allCategories.filter(c => c.category_type === tab).reduce((s, c) => s + Number(c.product_count), 0)}</p>
              <p className="text-xs text-gray-500">Products</p>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Search */}
          <div className="p-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
              <input
                type="text"
                placeholder="Search categories..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={`w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 ${currentTab.ring}`}
              />
            </div>
            {search && (
              <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Products</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {search
                    ? (displayList as Category[]).map(cat => renderRow(cat, cat.parent_id ? 1 : 0))
                    : (displayList as Category[]).map(cat => renderRow(cat, 0))
                  }
                  {displayList.length === 0 && (
                    <tr>
                      <td colSpan={6}>
                        <EmptyState
                          icon={Tag}
                          title={search ? 'No categories match your search' : `No ${currentTab.label.toLowerCase()} categories yet`}
                          description={search ? 'Try a different search term' : 'Click "Add Category" to create one'}
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <Tag size={18} className="text-emerald-600" />
                {editCat ? 'Edit Category' : form.parent_id ? 'Add Sub-category' : 'Add Category'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {formError && <div className="bg-red-50 text-red-600 text-sm px-4 py-2 rounded-lg border border-red-100">{formError}</div>}

              {/* Parent info if sub-category */}
              {form.parent_id && !editCat && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm">
                  <FolderPlus size={15} />
                  Sub-category of: <strong>{allCategories.find(c => c.category_id === form.parent_id)?.category_name}</strong>
                </div>
              )}

              {/* Parent selector — only for edit or when adding top-level */}
              {!form.parent_id || editCat ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Parent Category <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <select
                    value={form.parent_id ?? ''}
                    onChange={e => setForm(f => ({ ...f, parent_id: e.target.value ? Number(e.target.value) : null }))}
                    className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ${TABS.find(t => t.key === modalType)?.ring}`}
                  >
                    <option value="">— None (Top-level category) —</option>
                    {parentCategories
                      .filter(c => !editCat || c.category_id !== editCat.category_id)
                      .map(c => (
                        <option key={c.category_id} value={c.category_id}>{c.category_name}</option>
                      ))}
                  </select>
                </div>
              ) : null}

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category Name *</label>
                <input
                  type="text"
                  value={form.category_name}
                  onChange={e => setForm(f => ({ ...f, category_name: e.target.value }))}
                  placeholder="e.g. Cotton Fabric"
                  autoFocus
                  className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ${TABS.find(t => t.key === modalType)?.ring}`}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Optional..."
                  rows={2}
                  className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ${TABS.find(t => t.key === modalType)?.ring} resize-none`}
                />
              </div>

              {/* Status — edit only */}
              {editCat && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={form.is_active}
                    onChange={e => setForm(f => ({ ...f, is_active: Number(e.target.value) }))}
                    className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ${TABS.find(t => t.key === modalType)?.ring}`}
                  >
                    <option value={1}>Active</option>
                    <option value={0}>Inactive</option>
                  </select>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className={`px-5 py-2 text-sm text-white rounded-lg disabled:opacity-50 font-medium flex items-center gap-2 transition-colors ${TABS.find(t => t.key === modalType)?.btn}`}
              >
                {saving ? 'Saving...' : editCat ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Categories;
