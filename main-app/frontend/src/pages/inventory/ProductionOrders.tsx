import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Factory, Check, X, ChevronDown, ChevronUp, AlertTriangle, Search, Calendar, TrendingUp, BarChart3 } from 'lucide-react';
import api from '../../utils/api';
import Pagination from '../../components/Pagination';

interface Recipe {
  recipe_id: number;
  recipe_name: string;
  output_product_name: string;
  output_product_type: string;
  output_quantity: number;
  output_stock: number;
  is_active: number;
  ingredients: {
    ingredient_id: number;
    product_id: number;
    product_name: string;
    product_type: string;
    quantity: number;
    unit: string;
    available_stock: number;
  }[];
}

interface ProductionOrder {
  production_id: number;
  recipe_id: number;
  recipe_name: string;
  output_product_name: string;
  batches: number;
  output_quantity: number;
  status: string;
  notes: string;
  produced_by_name: string;
  produced_at: string;
}

const isSameDay = (dateStr: string, ref: Date) => {
  const d = new Date(dateStr);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
};

const isSameWeek = (dateStr: string, ref: Date) => {
  const d = new Date(dateStr);
  const startOfWeek = new Date(ref);
  startOfWeek.setDate(ref.getDate() - ref.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  return d >= startOfWeek && d < endOfWeek;
};

const ProductionOrders = () => {
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [allOrders, setAllOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [recipeFilter, setRecipeFilter] = useState<string>('');

  // New order modal
  const [showModal, setShowModal] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [batches, setBatches] = useState<number>(1);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page: currentPage, limit: itemsPerPage };
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await api.get('/production-orders', { params });
      setOrders(res.data.data || []);
      if (res.data.pagination) {
        setTotalItems(res.data.pagination.total);
        setTotalPages(res.data.pagination.totalPages);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [currentPage, itemsPerPage, dateFrom, dateTo]);

  const fetchAllOrdersForStats = useCallback(async () => {
    try {
      const res = await api.get('/production-orders', { params: { limit: 9999 } });
      setAllOrders(res.data.data || []);
    } catch { /* silent */ }
  }, []);

  const fetchRecipes = async () => {
    try {
      const res = await api.get('/recipes', { params: { is_active: 1 } });
      setRecipes(res.data.data || []);
    } catch { /* silent */ }
  };

  useEffect(() => { fetchOrders(); }, [fetchOrders]);
  useEffect(() => { fetchAllOrdersForStats(); }, [fetchAllOrdersForStats]);

  // Stats computed from all orders
  const stats = useMemo(() => {
    const now = new Date();
    const todayOutput = allOrders
      .filter(o => isSameDay(o.produced_at, now))
      .reduce((s, o) => s + Number(o.output_quantity || 0), 0);
    const weekOutput = allOrders
      .filter(o => isSameWeek(o.produced_at, now))
      .reduce((s, o) => s + Number(o.output_quantity || 0), 0);
    const totalRuns = allOrders.length;
    const totalOutput = allOrders.reduce((s, o) => s + Number(o.output_quantity || 0), 0);
    return { todayOutput, weekOutput, totalRuns, totalOutput };
  }, [allOrders]);

  // Unique recipes for filter dropdown (from current page orders)
  const uniqueRecipes = useMemo(() => {
    const seen = new Map<number, string>();
    allOrders.forEach(o => { if (!seen.has(o.recipe_id)) seen.set(o.recipe_id, o.recipe_name); });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [allOrders]);

  // Client-side filtering on loaded orders
  const filteredOrders = useMemo(() => {
    let result = orders;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(o =>
        o.recipe_name?.toLowerCase().includes(q) ||
        o.output_product_name?.toLowerCase().includes(q)
      );
    }
    if (recipeFilter) {
      result = result.filter(o => String(o.recipe_id) === recipeFilter);
    }
    return result;
  }, [orders, search, recipeFilter]);

  const openModal = async () => {
    await fetchRecipes();
    setSelectedRecipe(null);
    setBatches(1);
    setNotes('');
    setError('');
    setShowModal(true);
  };

  const handleRecipeSelect = (id: string) => {
    const r = recipes.find(r => r.recipe_id === Number(id)) || null;
    setSelectedRecipe(r);
    setError('');
  };

  const getNeeded = (qty: number) => Number((qty * batches).toFixed(3));
  const hasInsufficientStock = selectedRecipe?.ingredients.some(
    i => getNeeded(i.quantity) > Number(i.available_stock || 0)
  );

  const handleProduce = async () => {
    setError('');
    if (!selectedRecipe) return setError('Select a recipe');
    if (!batches || batches <= 0) return setError('Batches must be > 0');
    setSaving(true);
    try {
      await api.post('/production-orders', { recipe_id: selectedRecipe.recipe_id, batches, notes });
      setShowModal(false);
      fetchOrders();
      fetchAllOrdersForStats();
    } catch (err: any) {
      const details = err.response?.data?.details;
      setError(err.response?.data?.message || 'Failed to create production order');
      if (details) setError(prev => prev + '\n' + details.join('\n'));
    } finally {
      setSaving(false);
    }
  };

  const typeBadge = (t: string) => {
    if (t === 'finished_good') return 'bg-emerald-100 text-emerald-700';
    if (t === 'semi_finished') return 'bg-blue-100 text-blue-700';
    return 'bg-orange-100 text-orange-700';
  };
  const typeLabel = (t: string) =>
    t === 'finished_good' ? 'FG' : t === 'semi_finished' ? 'SF' : 'RM';

  const statCards = [
    { label: "Today's Output", value: stats.todayOutput, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'This Week', value: stats.weekOutput, icon: BarChart3, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Total Runs', value: stats.totalRuns, icon: Factory, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Total Output', value: stats.totalOutput, icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-wrap justify-between items-start gap-3 mb-6">
        <div>
          <h1 className="text-lg md:text-xl font-semibold tracking-tight text-gray-900 flex items-center gap-2">
            <Factory className="text-emerald-600" size={20} />
            Production Orders
          </h1>
          <p className="text-gray-500 mt-0.5 text-sm">Convert raw materials into finished goods via recipes</p>
        </div>
        <button onClick={openModal}
          className="bg-emerald-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-emerald-700 flex items-center gap-1.5 text-sm">
          <Plus size={16} /> New Production Run
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {statCards.map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-3">
            <div className={`${card.bg} rounded-lg p-2.5`}>
              <card.icon size={18} className={card.color} />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">{card.label}</p>
              <p className={`text-xl font-bold ${card.color} mt-0.5`}>{card.value.toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
            <input
              type="text" placeholder="Search recipe or product..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Recipe filter */}
          <select
            value={recipeFilter}
            onChange={e => setRecipeFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-700"
          >
            <option value="">All Recipes</option>
            {uniqueRecipes.map(r => (
              <option key={r.id} value={String(r.id)}>{r.name}</option>
            ))}
          </select>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <Calendar size={15} className="text-gray-400 shrink-0" />
            <input
              type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setCurrentPage(1); }}
              className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-700"
            />
            <span className="text-gray-400 text-xs">to</span>
            <input
              type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setCurrentPage(1); }}
              className="border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-700"
            />
            {(dateFrom || dateTo) && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); setCurrentPage(1); }}
                className="text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Factory size={40} className="mx-auto mb-3 opacity-30" />
            <p>No production orders found.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-8"></th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recipe</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Output Product</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Batches</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty Produced</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produced By</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredOrders.map(o => (
                    <>
                      <tr key={o.production_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <button className="text-gray-400 hover:text-gray-600"
                            onClick={() => setExpandedId(expandedId === o.production_id ? null : o.production_id)}>
                            {expandedId === o.production_id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">{o.recipe_name}</td>
                        <td className="px-4 py-3 text-gray-700">{o.output_product_name}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{o.batches}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="bg-emerald-100 text-emerald-700 font-medium px-2 py-0.5 rounded-full text-xs">
                            +{o.output_quantity}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-xs font-medium px-2 py-0.5 rounded-full">
                            <Check size={10} /> Completed
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{o.produced_by_name || '-'}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{new Date(o.produced_at).toLocaleString()}</td>
                      </tr>
                      {expandedId === o.production_id && o.notes && (
                        <tr key={`${o.production_id}-note`}>
                          <td colSpan={8} className="px-12 py-2 bg-gray-50 text-xs text-gray-500 italic">{o.notes}</td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage}
              totalItems={totalItems} itemsPerPage={itemsPerPage}
              onItemsPerPageChange={v => { setItemsPerPage(v); setCurrentPage(1); }} />
          </>
        )}
      </div>

      {/* New Production Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Factory size={16} className="text-emerald-600" /> New Production Run</h2>
              <button onClick={() => setShowModal(false)}><X size={18} className="text-gray-400 hover:text-gray-600" /></button>
            </div>
            <div className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2.5 text-sm whitespace-pre-line">{error}</div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recipe *</label>
                <select onChange={e => handleRecipeSelect(e.target.value)} defaultValue=""
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                  <option value="">Select recipe...</option>
                  {recipes.map(r => (
                    <option key={r.recipe_id} value={r.recipe_id}>
                      {r.recipe_name} → {r.output_product_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Batches *</label>
                  <input type="number" min="0.001" step="0.001" value={batches}
                    onChange={e => setBatches(Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
                {selectedRecipe && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Will Produce</label>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm font-semibold text-emerald-700">
                      {(selectedRecipe.output_quantity * batches).toFixed(3)} units of {selectedRecipe.output_product_name}
                    </div>
                  </div>
                )}
              </div>

              {selectedRecipe && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Ingredients Required</p>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-gray-500 font-medium">Ingredient</th>
                          <th className="px-3 py-2 text-right text-gray-500 font-medium">Need</th>
                          <th className="px-3 py-2 text-right text-gray-500 font-medium">In Stock</th>
                          <th className="px-3 py-2 text-center text-gray-500 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedRecipe.ingredients.map(ing => {
                          const needed = getNeeded(ing.quantity);
                          const sufficient = Number(ing.available_stock || 0) >= needed;
                          return (
                            <tr key={ing.ingredient_id} className={!sufficient ? 'bg-red-50' : ''}>
                              <td className="px-3 py-2">
                                <span className={`mr-1 text-xs px-1 py-0.5 rounded ${typeBadge(ing.product_type)}`}>{typeLabel(ing.product_type)}</span>
                                {ing.product_name}
                              </td>
                              <td className="px-3 py-2 text-right font-medium">{needed} {ing.unit}</td>
                              <td className="px-3 py-2 text-right text-gray-500">{ing.available_stock ?? 0}</td>
                              <td className="px-3 py-2 text-center">
                                {sufficient
                                  ? <Check size={13} className="text-emerald-500 mx-auto" />
                                  : <AlertTriangle size={13} className="text-red-500 mx-auto" />}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {hasInsufficientStock && (
                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                      <AlertTriangle size={12} /> Insufficient stock for some ingredients
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
              <button onClick={handleProduce} disabled={saving || !selectedRecipe}
                className="px-5 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-1.5">
                {saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Factory size={14} />}
                Produce
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductionOrders;
