import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, ChevronDown, ChevronUp, FlaskConical, Search, X, Check, Copy, AlertTriangle } from 'lucide-react';
import api from '../../utils/api';
import { useConfirm } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';

interface Ingredient {
  ingredient_id?: number;
  product_id: number;
  product_name?: string;
  product_type?: string;
  quantity: number;
  unit: string;
  available_stock?: number;
}

interface Recipe {
  recipe_id: number;
  recipe_name: string;
  output_product_id: number;
  output_product_name: string;
  output_product_type: string;
  output_quantity: number;
  output_stock: number;
  notes: string;
  is_active: number;
  ingredients: Ingredient[];
}

interface Product {
  product_id: number;
  product_name: string;
  product_type: string;
  available_stock?: number;
  unit?: string;
}

type ActiveFilter = 'all' | 'active' | 'inactive';

const emptyForm = () => ({
  recipe_name: '',
  output_product_id: '',
  output_quantity: 1,
  notes: '',
  is_active: 1,
  ingredients: [] as Ingredient[],
});

const Recipes = () => {
  const confirm = useConfirm();
  const { error: toastError, success: toastSuccess } = useToast();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editRecipe, setEditRecipe] = useState<Recipe | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [duplicating, setDuplicating] = useState<number | null>(null);
  const [error, setError] = useState('');

  // Products for dropdowns
  const [outputProducts, setOutputProducts] = useState<Product[]>([]);
  const [ingredientProducts, setIngredientProducts] = useState<Product[]>([]);

  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (search) params.search = search;
      if (activeFilter !== 'all') params.is_active = activeFilter === 'active' ? 1 : 0;
      const res = await api.get('/recipes', { params });
      setRecipes(res.data.data || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [search, activeFilter]);

  const fetchProducts = async () => {
    try {
      const [fg, sf] = await Promise.all([
        api.get('/products', { params: { type: 'finished_good', limit: 500 } }),
        api.get('/products', { params: { type: 'semi_finished', limit: 500 } }),
      ]);
      setOutputProducts([
        ...(fg.data.data || fg.data || []).map((p: Product) => ({ ...p, product_type: 'finished_good' })),
        ...(sf.data.data || sf.data || []).map((p: Product) => ({ ...p, product_type: 'semi_finished' })),
      ]);
      const [rm, sf2] = await Promise.all([
        api.get('/products', { params: { type: 'raw_material', limit: 500 } }),
        api.get('/products', { params: { type: 'semi_finished', limit: 500 } }),
      ]);
      setIngredientProducts([
        ...(rm.data.data || rm.data || []).map((p: Product) => ({ ...p, product_type: 'raw_material' })),
        ...(sf2.data.data || sf2.data || []).map((p: Product) => ({ ...p, product_type: 'semi_finished' })),
      ]);
    } catch { /* silent */ }
  };

  useEffect(() => { fetchProducts(); }, []);
  useEffect(() => { fetchRecipes(); }, [fetchRecipes]);

  // Stats computed from loaded data
  const totalRecipes = recipes.length;
  const activeRecipes = recipes.filter(r => r.is_active).length;
  const totalIngredients = recipes.reduce((sum, r) => sum + (r.ingredients?.length || 0), 0);

  const openAdd = () => {
    setEditRecipe(null);
    setForm(emptyForm());
    setError('');
    setShowModal(true);
  };

  const openEdit = (r: Recipe) => {
    setEditRecipe(r);
    setForm({
      recipe_name: r.recipe_name,
      output_product_id: String(r.output_product_id),
      output_quantity: r.output_quantity,
      notes: r.notes || '',
      is_active: r.is_active,
      ingredients: r.ingredients.map(i => ({ ...i })),
    });
    setError('');
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditRecipe(null); };

  const handleDuplicate = async (r: Recipe) => {
    setDuplicating(r.recipe_id);
    try {
      await api.post('/recipes', {
        recipe_name: `${r.recipe_name} (Copy)`,
        output_product_id: r.output_product_id,
        output_quantity: r.output_quantity,
        notes: r.notes || '',
        is_active: r.is_active,
        ingredients: r.ingredients.map(i => ({
          product_id: i.product_id,
          quantity: i.quantity,
          unit: i.unit,
        })),
      });
      toastSuccess('Recipe duplicated');
      fetchRecipes();
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to duplicate recipe');
    } finally {
      setDuplicating(null);
    }
  };

  const addIngredient = () => {
    setForm(f => ({ ...f, ingredients: [...f.ingredients, { product_id: 0, quantity: 1, unit: 'pcs' }] }));
  };

  const removeIngredient = (idx: number) => {
    setForm(f => ({ ...f, ingredients: f.ingredients.filter((_, i) => i !== idx) }));
  };

  const updateIngredient = (idx: number, field: string, value: any) => {
    setForm(f => {
      const ings = [...f.ingredients];
      if (field === 'product_id') {
        const prod = ingredientProducts.find(p => p.product_id === Number(value));
        ings[idx] = { ...ings[idx], product_id: Number(value), unit: prod?.unit || 'pcs' };
      } else {
        ings[idx] = { ...ings[idx], [field]: value };
      }
      return { ...f, ingredients: ings };
    });
  };

  const handleSave = async () => {
    setError('');
    if (!form.recipe_name.trim()) return setError('Recipe name is required');
    if (!form.output_product_id) return setError('Output product is required');
    if (form.ingredients.length === 0) return setError('Add at least one ingredient');
    if (form.ingredients.some(i => !i.product_id || i.quantity <= 0)) return setError('All ingredients must have a product and valid quantity');

    setSaving(true);
    try {
      const payload = { ...form, output_product_id: Number(form.output_product_id) };
      if (editRecipe) {
        await api.put(`/recipes/${editRecipe.recipe_id}`, payload);
      } else {
        await api.post('/recipes', payload);
      }
      closeModal();
      fetchRecipes();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save recipe');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({ title: 'Delete Recipe', message: 'Delete this recipe?', type: 'danger' });
    if (!ok) return;
    try {
      await api.delete(`/recipes/${id}`);
      fetchRecipes();
    } catch (err: any) {
      toastError(err.response?.data?.message || 'Failed to delete recipe');
    }
  };

  const typeLabel = (t: string) =>
    t === 'finished_good' ? 'Finished Good' : t === 'semi_finished' ? 'Semi-Finished' : 'Raw Material';

  const typeBadge = (t: string) => {
    if (t === 'finished_good') return 'bg-emerald-100 text-emerald-700';
    if (t === 'semi_finished') return 'bg-blue-100 text-blue-700';
    return 'bg-orange-100 text-orange-700';
  };

  const filterTabs: { key: ActiveFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'inactive', label: 'Inactive' },
  ];

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-start gap-3 mb-6">
        <div>
          <h1 className="text-lg md:text-xl font-semibold tracking-tight text-gray-900 flex items-center gap-2">
            <FlaskConical className="text-emerald-600" size={20} />
            Recipes
          </h1>
          <p className="text-gray-500 mt-0.5 text-sm">Define how raw materials produce semi-finished and finished goods</p>
        </div>
        <button onClick={openAdd}
          className="bg-emerald-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-emerald-700 flex items-center gap-1.5 text-sm">
          <Plus size={16} /> Add Recipe
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Recipes</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalRecipes}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Active Recipes</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{activeRecipes}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Ingredients</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{totalIngredients}</p>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text" placeholder="Search recipes..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          {/* Active/Inactive filter tabs */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5 gap-0.5">
            {filterTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeFilter === tab.key
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
          </div>
        ) : recipes.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <FlaskConical size={40} className="mx-auto mb-3 opacity-30" />
            <p>No recipes found. {activeFilter !== 'all' && 'Try changing the filter.'}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recipes.map(r => (
              <div key={r.recipe_id}>
                <div
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50"
                  onMouseEnter={() => setHoveredId(r.recipe_id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <button className="text-gray-400 hover:text-gray-600"
                    onClick={() => setExpandedId(expandedId === r.recipe_id ? null : r.recipe_id)}>
                    {expandedId === r.recipe_id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900">{r.recipe_name}</span>
                      {!r.is_active && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Produces: <span className={`font-medium px-1.5 py-0.5 rounded ${typeBadge(r.output_product_type)}`}>{r.output_product_name}</span>
                      &nbsp;× {r.output_quantity} per batch &nbsp;·&nbsp; Current stock: {r.output_stock ?? 0}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0 items-center">
                    {/* Duplicate button — visible on hover */}
                    <button
                      title="Duplicate recipe"
                      onClick={() => handleDuplicate(r)}
                      disabled={duplicating === r.recipe_id}
                      className={`transition-opacity text-gray-400 hover:text-emerald-600 ${
                        hoveredId === r.recipe_id ? 'opacity-100' : 'opacity-0'
                      }`}
                    >
                      {duplicating === r.recipe_id
                        ? <div className="w-3.5 h-3.5 border-2 border-emerald-400/40 border-t-emerald-500 rounded-full animate-spin" />
                        : <Copy size={15} />}
                    </button>
                    <button className="text-emerald-600 hover:text-emerald-800" onClick={() => openEdit(r)}><Edit size={15} /></button>
                    <button className="text-red-500 hover:text-red-700" onClick={() => handleDelete(r.recipe_id)}><Trash2 size={15} /></button>
                  </div>
                </div>

                {/* Expanded ingredients */}
                {expandedId === r.recipe_id && (
                  <div className="bg-gray-50 px-12 py-3 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Ingredients per batch</p>
                    <div className="space-y-1.5">
                      {r.ingredients.map(ing => (
                        <div key={ing.ingredient_id} className="flex items-center gap-3 text-sm flex-wrap">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${typeBadge(ing.product_type || '')}`}>{typeLabel(ing.product_type || '')}</span>
                          <span className="font-medium text-gray-800">{ing.product_name}</span>
                          <span className="text-gray-500">× {ing.quantity} {ing.unit}</span>
                          <span className="text-gray-400 text-xs">(stock: {ing.available_stock ?? 0})</span>
                          {(ing.available_stock ?? 0) === 0 && (
                            <span className="inline-flex items-center gap-1 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                              <AlertTriangle size={11} /> Out of Stock
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                    {r.notes && <p className="mt-2 text-xs text-gray-400 italic">{r.notes}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{editRecipe ? 'Edit Recipe' : 'New Recipe'}</h2>
              <button onClick={closeModal}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
            </div>
            <div className="p-6 space-y-5">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2.5 text-sm">{error}</div>}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Recipe Name *</label>
                  <input value={form.recipe_name} onChange={e => setForm(f => ({ ...f, recipe_name: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Output Product *</label>
                  <select value={form.output_product_id} onChange={e => setForm(f => ({ ...f, output_product_id: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                    <option value="">Select product...</option>
                    {['finished_good', 'semi_finished'].map(type => (
                      <optgroup key={type} label={typeLabel(type)}>
                        {outputProducts.filter(p => p.product_type === type).map(p => (
                          <option key={p.product_id} value={p.product_id}>{p.product_name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Output Qty per Batch *</label>
                  <input type="number" min="0.001" step="0.001" value={form.output_quantity}
                    onChange={e => setForm(f => ({ ...f, output_quantity: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none" />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <input type="checkbox" id="is_active" checked={!!form.is_active}
                    onChange={e => setForm(f => ({ ...f, is_active: e.target.checked ? 1 : 0 }))} />
                  <label htmlFor="is_active" className="text-sm text-gray-700">Active</label>
                </div>
              </div>

              {/* Ingredients */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Ingredients *</span>
                  <button onClick={addIngredient}
                    className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg hover:bg-emerald-100 flex items-center gap-1">
                    <Plus size={12} /> Add Ingredient
                  </button>
                </div>
                {form.ingredients.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-3 border border-dashed border-gray-200 rounded-lg">No ingredients yet</p>
                )}
                <div className="space-y-2">
                  {form.ingredients.map((ing, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <select value={ing.product_id || ''} onChange={e => updateIngredient(idx, 'product_id', e.target.value)}
                        className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                        <option value="">Select ingredient...</option>
                        {['raw_material', 'semi_finished'].map(type => (
                          <optgroup key={type} label={typeLabel(type)}>
                            {ingredientProducts.filter(p => p.product_type === type).map(p => (
                              <option key={p.product_id} value={p.product_id}>{p.product_name}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      <input type="number" min="0.001" step="0.001" placeholder="Qty" value={ing.quantity}
                        onChange={e => updateIngredient(idx, 'quantity', Number(e.target.value))}
                        className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                      <input type="text" placeholder="Unit" value={ing.unit}
                        onChange={e => updateIngredient(idx, 'unit', e.target.value)}
                        className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                      <button onClick={() => removeIngredient(idx)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={closeModal} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-1.5">
                {saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Check size={14} />}
                {editRecipe ? 'Save Changes' : 'Create Recipe'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Recipes;
