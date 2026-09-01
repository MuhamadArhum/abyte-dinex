import { useState, useEffect } from 'react';
import { Save, History, X, PackageOpen } from 'lucide-react';
import api from '../../utils/api';
import { localToday } from '../../utils/dateUtils';
import { useToast } from '../../components/Toast';

interface Product {
  product_id: number;
  product_name: string;
  barcode?: string;
  current_stock: number;
  avg_cost: number;
  opening_qty: number;
}

interface HistoryEntry {
  entry_id: number;
  product_name: string;
  quantity: number;
  unit_cost: number;
  entry_date: string;
  notes?: string;
  created_by_name: string;
}

export default function OpeningStock() {
  const { error, success } = useToast();
  const [products, setProducts]     = useState<Product[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [entries, setEntries]       = useState<Record<number, { qty: string; cost: string }>>({});
  const [entryDate, setEntryDate]   = useState(localToday());
  const [notes, setNotes]           = useState('');
  const [search, setSearch]         = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory]       = useState<HistoryEntry[]>([]);
  const [histLoading, setHistLoading] = useState(false);

  useEffect(() => { loadProducts(); }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/opening-stock');
      setProducts(res.data.data || []);
    } catch { error('Failed to load products'); }
    finally { setLoading(false); }
  };

  const loadHistory = async () => {
    setHistLoading(true);
    try {
      const res = await api.get('/opening-stock/history');
      setHistory(res.data.data || []);
    } catch { error('Failed to load history'); }
    finally { setHistLoading(false); }
  };

  const handleOpenHistory = () => {
    setShowHistory(true);
    loadHistory();
  };

  const handleChange = (productId: number, field: 'qty' | 'cost', value: string) => {
    setEntries(prev => ({
      ...prev,
      [productId]: { ...prev[productId], [field]: value },
    }));
  };

  const handleSave = async () => {
    const items = Object.entries(entries)
      .filter(([, v]) => v.qty && Number(v.qty) > 0)
      .map(([id, v]) => ({
        product_id: Number(id),
        quantity: Number(v.qty),
        unit_cost: Number(v.cost) || 0,
      }));

    if (!items.length) { error('Enter at least one product quantity'); return; }

    setSaving(true);
    try {
      await api.post('/opening-stock', { entry_date: entryDate, notes, items });
      success(`Opening stock saved for ${items.length} product(s)`);
      setEntries({});
      loadProducts();
    } catch (err: any) {
      error(err?.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const filtered = products.filter(p =>
    p.product_name.toLowerCase().includes(search.toLowerCase())
  );

  const changedCount = Object.values(entries).filter(v => v.qty && Number(v.qty) > 0).length;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <PackageOpen size={22} className="text-teal-600" /> Opening Stock Entry
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Set initial stock quantities and costs for products</p>
        </div>
        <button onClick={handleOpenHistory}
          className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <History size={16} /> History
        </button>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border p-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Entry Date</label>
          <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Initial stock setup"
            className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium text-gray-600 mb-1">Search Product</label>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Filter by name..."
            className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <button onClick={handleSave} disabled={saving || changedCount === 0}
          className="flex items-center gap-2 px-5 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
          <Save size={16} /> {saving ? 'Saving...' : `Save (${changedCount})`}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Product</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Current Stock</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Avg Cost</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Opening Entries</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Add Qty</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Unit Cost</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">No products found</td></tr>
            ) : filtered.map(p => {
              const entry = entries[p.product_id] || { qty: '', cost: '' };
              const hasEntry = entry.qty && Number(entry.qty) > 0;
              return (
                <tr key={p.product_id} className={`border-b hover:bg-gray-50 ${hasEntry ? 'bg-teal-50' : ''}`}>
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-gray-800">{p.product_name}</div>
                    {p.barcode && <div className="text-xs text-gray-400">{p.barcode}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">{Number(p.current_stock).toFixed(3)}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{Number(p.avg_cost).toFixed(0)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-500">{Number(p.opening_qty).toFixed(3)}</td>
                  <td className="px-4 py-2.5 text-center">
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={entry.qty}
                      onChange={e => handleChange(p.product_id, 'qty', e.target.value)}
                      placeholder="0"
                      className="w-28 border rounded-lg px-2 py-1.5 text-sm text-right focus:ring-2 focus:ring-teal-300 focus:border-teal-400"
                    />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={entry.cost}
                      onChange={e => handleChange(p.product_id, 'cost', e.target.value)}
                      placeholder={Number(p.avg_cost).toFixed(0)}
                      className="w-28 border rounded-lg px-2 py-1.5 text-sm text-right focus:ring-2 focus:ring-teal-300 focus:border-teal-400"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h2 className="font-semibold">Opening Stock History</h2>
              <button onClick={() => setShowHistory(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="overflow-auto flex-1">
              {histLoading ? (
                <div className="text-center py-12 text-gray-400">Loading...</div>
              ) : history.length === 0 ? (
                <div className="text-center py-12 text-gray-400">No history found</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Product</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Qty</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Cost</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(h => (
                      <tr key={h.entry_id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium">{h.product_name}</td>
                        <td className="px-4 py-2.5 text-right font-mono">{Number(h.quantity).toFixed(3)}</td>
                        <td className="px-4 py-2.5 text-right font-mono">{Number(h.unit_cost).toFixed(0)}</td>
                        <td className="px-4 py-2.5 text-gray-500">{h.entry_date}</td>
                        <td className="px-4 py-2.5 text-gray-500">{h.created_by_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
