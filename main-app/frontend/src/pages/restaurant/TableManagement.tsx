import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, UtensilsCrossed, Users, X, Layers, Search } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';

interface RestaurantTable {
  table_id: number;
  table_name: string;
  floor: string;
  capacity: number;
  status: string;
  has_pending_order: number;
}

const TableManagement = () => {
  const toast = useToast();
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);
  const [form, setForm] = useState({ table_name: '', floor: '', capacity: '4' });
  const [saving, setSaving] = useState(false);
  const [selectedFloor, setSelectedFloor] = useState('All');
  const [search, setSearch] = useState('');

  // Floor management
  const [showFloorModal, setShowFloorModal] = useState(false);
  const [newFloorName, setNewFloorName] = useState('');
  const [customFloors, setCustomFloors] = useState<string[]>([]);

  const fetchTables = async () => {
    try {
      const res = await api.get('/restaurant/tables');
      const data: RestaurantTable[] = Array.isArray(res.data) ? res.data : [];
      setTables(data);
      const fromTables = Array.from(new Set(data.map(t => t.floor).filter(Boolean)));
      setCustomFloors(prev => Array.from(new Set([...prev, ...fromTables])));
    } catch {
      toast.error('Failed to load tables');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTables(); }, []);

  const allFloors = Array.from(new Set(customFloors));

  const openAdd = () => {
    setEditingTable(null);
    setForm({ table_name: '', floor: allFloors[0] || '', capacity: '4' });
    setShowForm(true);
  };

  const openEdit = (table: RestaurantTable) => {
    setEditingTable(table);
    setForm({ table_name: table.table_name, floor: table.floor, capacity: String(table.capacity) });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.table_name.trim()) { toast.error('Table name is required'); return; }
    setSaving(true);
    try {
      if (editingTable) {
        await api.put(`/restaurant/tables/${editingTable.table_id}`, form);
        toast.success('Table updated successfully');
      } else {
        await api.post('/restaurant/tables', form);
        toast.success('Table added successfully');
      }
      if (form.floor && !customFloors.includes(form.floor)) {
        setCustomFloors(prev => [...prev, form.floor]);
      }
      setShowForm(false);
      fetchTables();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (table: RestaurantTable) => {
    if (Number(table.has_pending_order) > 0) {
      toast.error('Cannot delete a table with active orders');
      return;
    }
    if (!confirm(`Are you sure you want to delete table "${table.table_name}"?`)) return;
    try {
      await api.delete(`/restaurant/tables/${table.table_id}`);
      toast.success('Table deleted');
      fetchTables();
    } catch {
      toast.error('Failed to delete table');
    }
  };

  const addFloor = () => {
    const name = newFloorName.trim();
    if (!name) return;
    if (customFloors.includes(name)) { toast.error('Floor already exists'); return; }
    setCustomFloors(prev => [...prev, name]);
    setNewFloorName('');
    toast.success(`Floor "${name}" created`);
  };

  const deleteFloor = (floor: string) => {
    if (tables.some(t => t.floor === floor)) {
      toast.error('Cannot delete — tables are assigned to this floor');
      return;
    }
    setCustomFloors(prev => prev.filter(f => f !== floor));
    if (selectedFloor === floor) setSelectedFloor('All');
  };

  const floorFilters = ['All', ...allFloors];
  const filtered = tables
    .filter(t => selectedFloor === 'All' || t.floor === selectedFloor)
    .filter(t => !search || t.table_name.toLowerCase().includes(search.toLowerCase()));

  const stats = {
    total: tables.length,
    available: tables.filter(t => Number(t.has_pending_order) === 0).length,
    occupied: tables.filter(t => Number(t.has_pending_order) > 0).length,
  };

  if (loading && tables.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <UtensilsCrossed className="text-emerald-600" size={22} />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-gray-900">Table Management</h1>
            <p className="text-gray-600 text-sm mt-1">Manage your restaurant floor plan and tables</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowFloorModal(true)}
            className="flex items-center gap-2 border border-gray-200 text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
          >
            <Layers size={16} /> Manage Floors
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-lg hover:bg-emerald-700 transition-colors font-medium"
          >
            <Plus size={18} /> Add Table
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-600 text-sm">Total Tables</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{stats.total}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-600 text-sm">Available</p>
          <p className="text-3xl font-bold text-emerald-600 mt-2">{stats.available}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-gray-600 text-sm">Occupied</p>
          <p className="text-3xl font-bold text-red-500 mt-2">{stats.occupied}</p>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">

        {/* Toolbar */}
        <div className="p-6 border-b border-gray-100 flex flex-wrap gap-4 items-center">
          <div className="flex-1 relative min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search tables..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            />
          </div>
          {/* Floor filter */}
          {floorFilters.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {floorFilters.map(floor => (
                <button
                  key={floor}
                  onClick={() => setSelectedFloor(floor)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    selectedFloor === floor
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {floor}
                  {floor !== 'All' && (
                    <span className="ml-1 opacity-70">({tables.filter(t => t.floor === floor).length})</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tables Grid */}
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <UtensilsCrossed className="mx-auto text-gray-300 mb-4" size={48} />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Tables Found</h3>
            <p className="text-gray-500 mb-6">
              {tables.length === 0
                ? 'Start by adding floors via "Manage Floors", then add your tables'
                : 'No tables match your current filters'}
            </p>
            {tables.length === 0 && (
              <button onClick={openAdd}
                className="inline-flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 transition">
                <Plus size={18} /> Add First Table
              </button>
            )}
          </div>
        ) : (
          <div className="p-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filtered.map(table => {
              const isOccupied = Number(table.has_pending_order) > 0;
              return (
                <div
                  key={table.table_id}
                  className="bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Status bar */}
                  <div className={`h-1.5 rounded-t-xl ${isOccupied ? 'bg-red-500' : 'bg-emerald-500'}`} />

                  <div className="p-4 text-center">
                    <div className="font-semibold text-gray-800 text-sm">{table.table_name}</div>
                    {table.floor && (
                      <div className="text-xs text-gray-400 mt-0.5">{table.floor}</div>
                    )}
                    <div className="flex items-center justify-center gap-1 text-xs text-gray-500 mt-1.5">
                      <Users size={10} /> {table.capacity} seats
                    </div>
                    <span className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      isOccupied ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {isOccupied ? 'Occupied' : 'Available'}
                    </span>

                    <div className="flex items-center justify-center gap-2 mt-3">
                      <button
                        onClick={() => openEdit(table)}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                        title="Edit"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(table)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Manage Floors Modal */}
      {showFloorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                <Layers size={18} className="text-emerald-600" /> Floors / Areas / Sections
              </h2>
              <button onClick={() => setShowFloorModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={22} />
              </button>
            </div>

            {/* Add floor */}
            <div className="flex gap-2 mb-6">
              <input
                type="text"
                placeholder="e.g. Ground Floor, Rooftop, Outdoor..."
                value={newFloorName}
                onChange={e => setNewFloorName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addFloor()}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                autoFocus
              />
              <button
                onClick={addFloor}
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition font-medium"
              >
                Add
              </button>
            </div>

            {allFloors.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                No floors yet — type a name above and click Add
              </div>
            ) : (
              <div className="space-y-2">
                {allFloors.map(floor => {
                  const count = tables.filter(t => t.floor === floor).length;
                  return (
                    <div key={floor} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                      <div>
                        <span className="font-medium text-gray-800 text-sm">{floor}</span>
                        <span className="text-xs text-gray-400 ml-2">{count} table{count !== 1 ? 's' : ''}</span>
                      </div>
                      <button
                        onClick={() => deleteFloor(floor)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                        title="Delete floor"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              onClick={() => setShowFloorModal(false)}
              className="w-full mt-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 font-medium transition text-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Add / Edit Table Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold text-gray-800">
                {editingTable ? 'Edit Table' : 'Add New Table'}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">
                <X size={22} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Table Name / Number *</label>
                <input
                  type="text"
                  value={form.table_name}
                  onChange={e => setForm(f => ({ ...f, table_name: e.target.value }))}
                  placeholder="e.g. T-01, Window Table, VIP Booth"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Floor / Area / Section
                </label>
                <input
                  type="text"
                  list="floor-options"
                  value={form.floor}
                  onChange={e => setForm(f => ({ ...f, floor: e.target.value }))}
                  placeholder="Select or type a floor"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
                <datalist id="floor-options">
                  {allFloors.map(floor => <option key={floor} value={floor} />)}
                </datalist>
                {allFloors.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {allFloors.map(floor => (
                      <button
                        key={floor}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, floor }))}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                          form.floor === floor
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {floor}
                      </button>
                    ))}
                  </div>
                )}
                {allFloors.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">Add floors first via "Manage Floors" button</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Seating Capacity</label>
                <input
                  type="number"
                  value={form.capacity}
                  onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))}
                  min="1" max="50"
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 font-medium transition text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 bg-emerald-600 text-white px-6 py-3 rounded-xl hover:bg-emerald-700 font-medium transition disabled:bg-gray-400 text-sm"
              >
                {saving ? 'Saving...' : editingTable ? 'Update Table' : 'Add Table'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableManagement;
