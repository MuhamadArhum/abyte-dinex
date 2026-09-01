import { useState, useEffect, useCallback } from 'react';
import { Database, Download, Trash2, Upload, Loader2, AlertTriangle, Check, HardDrive, Clock, Shield, FileArchive, Save, Cloud, Wifi } from 'lucide-react';
import api from '../../utils/api';
import Pagination from '../../components/Pagination';
import { useConfirm } from '../../components/ConfirmDialog';

interface BackupEntry {
  backup_id: number;
  filename: string;
  file_size: number;
  created_by_name: string;
  created_at: string;
  type: 'manual' | 'scheduled';
  status: 'completed' | 'failed';
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const timeAgo = (dateStr: string): string => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
};

const Backup = () => {
  const confirm = useConfirm();
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // All backups for summary (from current page data we can estimate)
  const [allStats, setAllStats] = useState({ totalSize: 0, completedCount: 0, failedCount: 0 });

  // Schedule state
  const [schedule, setSchedule] = useState({ backup_schedule_enabled: true, backup_schedule_time: '02:00' });
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleMsg, setScheduleMsg] = useState({ type: '', text: '' });

  // Google Drive state
  interface DriveSettings {
    gdrive_enabled: boolean;
    gdrive_folder_id: string;
    gdrive_service_account_json: string;
    gdrive_last_upload_at: string | null;
    gdrive_last_upload_file: string | null;
    gdrive_last_upload_status: string | null;
  }
  const [drive, setDrive] = useState<DriveSettings>({
    gdrive_enabled: false, gdrive_folder_id: '', gdrive_service_account_json: '',
    gdrive_last_upload_at: null, gdrive_last_upload_file: null, gdrive_last_upload_status: null,
  });
  const [driveJsonInput, setDriveJsonInput] = useState('');
  const [driveSaving, setDriveSaving] = useState(false);
  const [driveTesting, setDriveTesting] = useState(false);
  const [driveMsg, setDriveMsg] = useState({ type: '', text: '' });

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/backup', {
        params: { page: currentPage, limit: itemsPerPage }
      });
      if (res.data.pagination) {
        setBackups(res.data.data);
        setTotalItems(res.data.pagination.total);
        setTotalPages(res.data.pagination.totalPages);

        // Calculate stats from current page data
        const data = res.data.data as BackupEntry[];
        const totalSize = data.reduce((sum: number, b: BackupEntry) => sum + Number(b.file_size || 0), 0);
        const completedCount = data.filter((b: BackupEntry) => b.status === 'completed').length;
        const failedCount = data.filter((b: BackupEntry) => b.status === 'failed').length;
        setAllStats({ totalSize, completedCount, failedCount });
      } else {
        setBackups(Array.isArray(res.data) ? res.data : []);
      }
    } catch (error) {
      console.error('Failed to fetch backups', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage]);

  useEffect(() => {
    fetchBackups();
    api.get('/backup/schedule').then(r => setSchedule(r.data)).catch(() => {});
    api.get('/backup/drive-settings').then(r => {
      setDrive(r.data);
      // Don't pre-fill the JSON textarea — user must paste again to change
    }).catch(() => {});
  }, [fetchBackups]);

  const handleSaveSchedule = async () => {
    setScheduleSaving(true);
    setScheduleMsg({ type: '', text: '' });
    try {
      const res = await api.put('/backup/schedule', schedule);
      setScheduleMsg({ type: 'success', text: res.data.message });
    } catch (err: any) {
      setScheduleMsg({ type: 'error', text: err.response?.data?.message || 'Failed to save schedule' });
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleSaveDrive = async () => {
    setDriveSaving(true);
    setDriveMsg({ type: '', text: '' });
    try {
      // If user left JSON blank, send '__SET__' to preserve existing value
      const jsonPayload = driveJsonInput.trim() || '__SET__';
      await api.put('/backup/drive-settings', {
        gdrive_enabled: drive.gdrive_enabled,
        gdrive_folder_id: drive.gdrive_folder_id,
        gdrive_service_account_json: jsonPayload,
      });
      setDriveMsg({ type: 'success', text: 'Google Drive settings saved' });
      if (driveJsonInput.trim()) setDriveJsonInput('');
      // Refresh to get updated last-upload info
      api.get('/backup/drive-settings').then(r => setDrive(r.data)).catch(() => {});
    } catch (err: any) {
      setDriveMsg({ type: 'error', text: err.response?.data?.message || 'Failed to save' });
    } finally {
      setDriveSaving(false);
    }
  };

  const handleTestDrive = async () => {
    setDriveTesting(true);
    setDriveMsg({ type: '', text: '' });
    try {
      const jsonPayload = driveJsonInput.trim() || '__SET__';
      const res = await api.post('/backup/test-drive', {
        gdrive_service_account_json: jsonPayload,
        gdrive_folder_id: drive.gdrive_folder_id,
      });
      setDriveMsg({ type: 'success', text: res.data.message });
    } catch (err: any) {
      setDriveMsg({ type: 'error', text: err.response?.data?.message || 'Connection failed' });
    } finally {
      setDriveTesting(false);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await api.post('/backup');
      setMessage({ type: 'success', text: `Backup created successfully: ${res.data.filename}` });
      fetchBackups();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to create backup' });
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (filename: string) => {
    const ok = await confirm({ title: 'Restore Backup', message: `WARNING: Restoring will overwrite the current database with "${filename}".\n\nA backup of the current state will be created first.\n\nAre you sure you want to continue?`, type: 'danger' });
    if (!ok) return;
    setRestoring(filename);
    setMessage({ type: '', text: '' });
    try {
      await api.post('/backup/restore', { filename });
      setMessage({ type: 'success', text: 'Backup restored successfully. Please refresh the page.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to restore backup' });
    } finally {
      setRestoring(null);
    }
  };

  const handleDownload = (filename: string) => {
    window.open(`/api/backup/download/${filename}`, '_blank');
  };

  const handleDelete = async (filename: string) => {
    const ok = await confirm({ title: 'Delete Backup', message: `Delete backup "${filename}"? This cannot be undone.`, type: 'danger' });
    if (!ok) return;
    try {
      await api.delete(`/backup/${filename}`);
      setMessage({ type: 'success', text: 'Backup deleted' });
      fetchBackups();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to delete backup' });
    }
  };

  const lastBackup = backups.length > 0 ? backups[0] : null;

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 flex items-center gap-3">
            <Database className="text-emerald-600" size={20} />
            Backup & Restore
          </h1>
          <p className="text-gray-500 mt-1">Manage database backups and recovery</p>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          {creating ? <Loader2 className="animate-spin" size={20} /> : <HardDrive size={20} />}
          <span className="hidden sm:inline">Create Backup Now</span>
        </button>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`p-4 rounded-xl mb-6 flex items-center gap-3 ${
          message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.type === 'success' ? <Check size={20} /> : <AlertTriangle size={20} />}
          <span className="font-medium">{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} className="ml-auto text-sm opacity-60 hover:opacity-100">Dismiss</button>
        </div>
      )}

      {/* Backup Schedule */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
            <Clock size={18} className="text-blue-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">Automatic Backup Schedule</h2>
            <p className="text-xs text-gray-500">Set the time for daily automatic backup</p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          {/* Enable toggle */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={schedule.backup_schedule_enabled}
                onChange={e => setSchedule(p => ({ ...p, backup_schedule_enabled: e.target.checked }))}
                className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
            <span className="text-sm font-medium text-gray-700">
              {schedule.backup_schedule_enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>

          {/* Time picker */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Backup Time (24-hour)</label>
            <input
              type="time"
              value={schedule.backup_schedule_time}
              onChange={e => setSchedule(p => ({ ...p, backup_schedule_time: e.target.value }))}
              disabled={!schedule.backup_schedule_enabled}
              className="px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-lg font-mono disabled:opacity-40 disabled:cursor-not-allowed"
            />
          </div>

          <button onClick={handleSaveSchedule} disabled={scheduleSaving}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition disabled:opacity-50">
            {scheduleSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save Schedule
          </button>
        </div>

        {scheduleMsg.text && (
          <div className={`mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium ${scheduleMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {scheduleMsg.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}
            {scheduleMsg.text}
          </div>
        )}

        {schedule.backup_schedule_enabled && (
          <p className="mt-3 text-xs text-gray-400">
            Next backup will run today / tomorrow at <strong>{schedule.backup_schedule_time}</strong>
          </p>
        )}
      </div>

      {/* Google Drive Settings */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center">
            <Cloud size={18} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">Google Drive Auto-Upload</h2>
            <p className="text-xs text-gray-500">Automatically upload each daily backup to Google Drive</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Enable toggle */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={drive.gdrive_enabled}
                onChange={e => setDrive(p => ({ ...p, gdrive_enabled: e.target.checked }))}
                className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
            <span className="text-sm font-medium text-gray-700">
              {drive.gdrive_enabled ? 'Upload Enabled' : 'Upload Disabled'}
            </span>
          </div>

          {/* Folder ID */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Google Drive Folder ID</label>
            <input
              type="text"
              value={drive.gdrive_folder_id}
              onChange={e => setDrive(p => ({ ...p, gdrive_folder_id: e.target.value }))}
              placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74O..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono"
            />
            <p className="text-xs text-gray-400 mt-1">Copy from Google Drive folder URL</p>
          </div>
        </div>

        {/* Service Account JSON */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-500 mb-1">
            Service Account JSON
            {drive.gdrive_service_account_json === '__SET__' && (
              <span className="ml-2 text-emerald-600 font-medium">✓ Already configured — paste new JSON to replace</span>
            )}
          </label>
          <textarea
            value={driveJsonInput}
            onChange={e => setDriveJsonInput(e.target.value)}
            rows={5}
            placeholder={'{\n  "type": "service_account",\n  "project_id": "...",\n  "private_key": "...",\n  ...\n}'}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
          />
          <p className="text-xs text-gray-400 mt-1">
            From Google Cloud Console → IAM → Service Accounts → Keys → Add Key → JSON.
            Share the Drive folder with the service account email.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button onClick={handleTestDrive} disabled={driveTesting || !drive.gdrive_folder_id}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition disabled:opacity-50 text-sm">
            {driveTesting ? <Loader2 size={15} className="animate-spin" /> : <Wifi size={15} />}
            Test Connection
          </button>
          <button onClick={handleSaveDrive} disabled={driveSaving}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition disabled:opacity-50 text-sm">
            {driveSaving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Save Drive Settings
          </button>
        </div>

        {driveMsg.text && (
          <div className={`mt-3 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium ${driveMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {driveMsg.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}
            {driveMsg.text}
          </div>
        )}

        {/* Last upload status */}
        {drive.gdrive_last_upload_at && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-6 text-xs text-gray-500">
            <span><strong>Last upload:</strong> {new Date(drive.gdrive_last_upload_at).toLocaleString()}</span>
            {drive.gdrive_last_upload_file && <span><strong>File:</strong> {drive.gdrive_last_upload_file}</span>}
            {drive.gdrive_last_upload_status && (
              <span className={drive.gdrive_last_upload_status === 'success' ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
                {drive.gdrive_last_upload_status}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 rounded-xl">
              <FileArchive size={24} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{totalItems}</p>
              <p className="text-sm text-gray-500">Total Backups</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 rounded-xl">
              <HardDrive size={24} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{formatFileSize(allStats.totalSize)}</p>
              <p className="text-sm text-gray-500">Page Storage</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 rounded-xl">
              <Shield size={24} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{allStats.completedCount}</p>
              <p className="text-sm text-gray-500">Successful</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-50 rounded-xl">
              <Clock size={24} className="text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-600">
                {lastBackup ? timeAgo(lastBackup.created_at) : 'Never'}
              </p>
              <p className="text-sm text-gray-500">Last Backup</p>
            </div>
          </div>
        </div>
      </div>

      {/* Backups Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Backup History</h3>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
          </div>
        ) : backups.length === 0 ? (
          <div className="p-12 text-center">
            <Database size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 mb-4">No backups yet. Create your first backup to protect your data.</p>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-medium inline-flex items-center gap-2"
            >
              <HardDrive size={18} />
              Create First Backup
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[800px]">
            <thead className="bg-gray-50 text-gray-600 font-medium">
              <tr>
                <th className="p-4">Filename</th>
                <th className="p-4">Size</th>
                <th className="p-4">Created</th>
                <th className="p-4">By</th>
                <th className="p-4">Type</th>
                <th className="p-4">Status</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {backups.map((backup) => (
                <tr key={backup.backup_id} className="hover:bg-gray-50">
                  <td className="p-4 font-medium text-gray-800 font-mono text-xs">{backup.filename}</td>
                  <td className="p-4 text-gray-600">{formatFileSize(Number(backup.file_size))}</td>
                  <td className="p-4 text-gray-500">
                    <div>
                      <div>{new Date(backup.created_at).toLocaleDateString()}</div>
                      <div className="text-xs text-gray-400">{new Date(backup.created_at).toLocaleTimeString()}</div>
                    </div>
                  </td>
                  <td className="p-4 text-gray-600">{backup.created_by_name}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      backup.type === 'scheduled' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {backup.type}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      backup.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {backup.status}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleDownload(backup.filename)}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Download"
                      >
                        <Download size={16} />
                      </button>
                      <button
                        onClick={() => handleRestore(backup.filename)}
                        disabled={restoring === backup.filename}
                        className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Restore"
                      >
                        {restoring === backup.filename ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                      </button>
                      <button
                        onClick={() => handleDelete(backup.filename)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          onItemsPerPageChange={(l) => { setItemsPerPage(l); setCurrentPage(1); }}
        />
      </div>
    </div>
  );
};

export default Backup;
