import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, Warehouse, ToggleLeft, ToggleRight } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';

interface Section {
  section_id: number;
  section_name: string;
  description: string | null;
  is_active: number;
}

const Sections = () => {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Section | null>(null);
  const [form, setForm] = useState({ section_name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const { error, success } = useToast();
  const confirm = useConfirm();

  const fetchSections = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/sections');
      setSections(res.data.data || []);
    } catch (err) {
      console.error('fetchSections error:', err);
      error('Failed to load sections');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSections(); }, [fetchSections]);

  const openAdd = () => { setEditing(null); setForm({ section_name: '', description: '' }); setShowForm(true); };
  const openEdit = (s: Section) => { setEditing(s); setForm({ section_name: s.section_name, description: s.description || '' }); setShowForm(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.section_name.trim()) return error('Section name is required');
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/sections/${editing.section_id}`, { ...form, is_active: editing.is_active });
        success('Section updated');
      } else {
        await api.post('/sections', form);
        success('Section created');
      }
      setShowForm(false);
      await fetchSections();
    } catch (err: any) {
      console.error('handleSubmit error:', err);
      error(err.response?.data?.message || 'Error saving section');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm({ title: 'Delete Section', message: 'Delete this section?', type: 'danger' });
    if (!ok) return;
    try {
      await api.delete(`/sections/${id}`);
      success('Section deleted');
      await fetchSections();
    } catch (err: any) {
      error(err.response?.data?.message || 'Cannot delete');
    }
  };

  const toggleActive = async (s: Section) => {
    try {
      await api.put(`/sections/${s.section_id}`, { section_name: s.section_name, description: s.description, is_active: s.is_active ? 0 : 1 });
      await fetchSections();
    } catch { error('Error'); }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-2"><Warehouse size={20} className="text-emerald-600" /> Sections Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage sections/departments for stock issuance</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium">
          <Plus size={18} /> <span className="hidden sm:inline">Add Section</span>
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4">{editing ? 'Edit Section' : 'New Section'}</h2>
          <form onSubmit={handleSubmit} className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Section Name *</label>
              <input
                type="text" value={form.section_name} onChange={e => setForm(f => ({ ...f, section_name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="e.g. Production, Packing, QC"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                type="text" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="Optional"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-60">
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" /></div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Section Name</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sections.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-400">No sections found. Add one above.</td></tr>
              ) : sections.map((s, i) => (
                <tr key={s.section_id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-400">{i + 1}</td>
                  <td className="px-5 py-3 font-medium text-gray-900">{s.section_name}</td>
                  <td className="px-5 py-3 text-gray-500">{s.description || '-'}</td>
                  <td className="px-5 py-3">
                    <button onClick={() => toggleActive(s)} title="Toggle active">
                      {s.is_active ? <ToggleRight size={20} className="text-emerald-600" /> : <ToggleLeft size={20} className="text-gray-400" />}
                    </button>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(s)} className="text-emerald-600 hover:text-emerald-800"><Edit size={16} /></button>
                      <button onClick={() => handleDelete(s.section_id)} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sections;
