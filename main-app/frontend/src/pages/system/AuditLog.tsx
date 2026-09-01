import { useState, useEffect, Fragment } from 'react';
import { ScrollText, Clock, User, ChevronDown, ChevronRight, Download } from 'lucide-react';
import DateRangeFilter from '../../components/DateRangeFilter';
import api from '../../utils/api';
import Pagination from '../../components/Pagination';
import { localToday } from '../../utils/dateUtils';
import ReportPasswordGate from '../../components/ReportPasswordGate';

interface AuditEntry {
  log_id: number;
  action: string;
  entity_type: string;
  entity_id: number;
  user_id: number;
  user_name: string;
  details: string;
  old_values: string | null;
  new_values: string | null;
  ip_address: string;
  created_at: string;
}

const ACTION_COLORS: Record<string, string> = {
  USER_LOGIN: 'bg-emerald-100 text-emerald-700',
  USER_LOGOUT: 'bg-emerald-100 text-emerald-700',
  USER_CREATED: 'bg-emerald-100 text-emerald-700',
  USER_UPDATED: 'bg-emerald-100 text-emerald-700',
  USER_DELETED: 'bg-red-100 text-red-700',
  SALE_CREATED: 'bg-emerald-100 text-emerald-700',
  SALE_COMPLETED: 'bg-emerald-100 text-emerald-700',
  SALE_DELETED: 'bg-red-100 text-red-700',
  SALE_REFUNDED: 'bg-orange-100 text-orange-700',
  PRODUCT_CREATED: 'bg-emerald-100 text-emerald-700',
  PRODUCT_UPDATED: 'bg-emerald-100 text-emerald-700',
  PRODUCT_DELETED: 'bg-red-100 text-red-700',
  STOCK_UPDATED: 'bg-yellow-100 text-yellow-700',
  STOCK_ADJUSTED: 'bg-yellow-100 text-yellow-700',
  STOCK_TRANSFERRED: 'bg-yellow-100 text-yellow-700',
  SETTINGS_UPDATED: 'bg-gray-100 text-gray-700',
  REGISTER_OPENED: 'bg-teal-100 text-teal-700',
  REGISTER_CLOSED: 'bg-teal-100 text-teal-700',
  CASH_MOVEMENT: 'bg-yellow-100 text-yellow-700',
  RETURN_CREATED: 'bg-orange-100 text-orange-700',
  BACKUP_CREATED: 'bg-emerald-100 text-emerald-700',
  BACKUP_RESTORED: 'bg-emerald-100 text-emerald-700',
  BACKUP_DELETED: 'bg-red-100 text-red-700',
  BARCODE_GENERATED: 'bg-emerald-100 text-emerald-700',
  CUSTOMER_CREATED: 'bg-emerald-100 text-emerald-700',
  CUSTOMER_UPDATED: 'bg-emerald-100 text-emerald-700',
  CUSTOMER_DELETED: 'bg-red-100 text-red-700',
  STAFF_CREATED: 'bg-emerald-100 text-emerald-700',
  STAFF_UPDATED: 'bg-emerald-100 text-emerald-700',
  STAFF_DEACTIVATED: 'bg-red-100 text-red-700',
  SALARY_PAID: 'bg-emerald-100 text-emerald-700',
  SALARY_INCREMENT: 'bg-emerald-100 text-emerald-700',
  LOAN_ISSUED: 'bg-amber-100 text-amber-700',
  LOAN_REPAYMENT: 'bg-amber-100 text-amber-700',
  LOAN_CANCELLED: 'bg-red-100 text-red-700',
  LEAVE_REQUESTED: 'bg-sky-100 text-sky-700',
  LEAVE_APPROVED: 'bg-emerald-100 text-emerald-700',
  LEAVE_REJECTED: 'bg-red-100 text-red-700',
  HOLIDAY_CREATED: 'bg-sky-100 text-sky-700',
  ATTENDANCE_MARKED: 'bg-teal-100 text-teal-700',
  SUPPLIER_CREATED: 'bg-lime-100 text-lime-700',
  SUPPLIER_UPDATED: 'bg-lime-100 text-lime-700',
  SUPPLIER_DELETED: 'bg-red-100 text-red-700',
  PO_CREATED: 'bg-orange-100 text-orange-700',
  PO_RECEIVED: 'bg-emerald-100 text-emerald-700',
  PO_CANCELLED: 'bg-red-100 text-red-700',
  EXPENSE_CREATED: 'bg-rose-100 text-rose-700',
  EXPENSE_UPDATED: 'bg-rose-100 text-rose-700',
  EXPENSE_DELETED: 'bg-red-100 text-red-700',
  ACCOUNT_CREATED: 'bg-emerald-100 text-emerald-700',
  ACCOUNT_UPDATED: 'bg-emerald-100 text-emerald-700',
  JOURNAL_ENTRY_CREATED: 'bg-emerald-100 text-emerald-700',
  PAYMENT_VOUCHER_CREATED: 'bg-emerald-100 text-emerald-700',
  RECEIPT_VOUCHER_CREATED: 'bg-emerald-100 text-emerald-700',
  COUPON_CREATED: 'bg-pink-100 text-pink-700',
  COUPON_UPDATED: 'bg-pink-100 text-pink-700',
};

function parseJSON(val: string | null): Record<string, unknown> | null {
  if (!val) return null;
  try {
    return typeof val === 'string' ? JSON.parse(val) : val as Record<string, unknown>;
  } catch {
    return null;
  }
}

function FieldDiffTable({ oldValues, newValues }: { oldValues: Record<string, unknown>; newValues: Record<string, unknown> }) {
  const allKeys = Array.from(new Set([...Object.keys(oldValues), ...Object.keys(newValues)]));
  const changedKeys = allKeys.filter(k => String(oldValues[k] ?? '') !== String(newValues[k] ?? ''));

  if (changedKeys.length === 0) return <p className="text-xs text-gray-400 italic">No field changes detected</p>;

  return (
    <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
      <thead>
        <tr className="bg-gray-100 text-gray-600 font-semibold">
          <th className="px-3 py-2 text-left w-1/4">Field</th>
          <th className="px-3 py-2 text-left w-5/12">Before</th>
          <th className="px-3 py-2 text-left w-5/12">After</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {changedKeys.map(key => (
          <tr key={key}>
            <td className="px-3 py-2 font-medium text-gray-700 capitalize">{key.replace(/_/g, ' ')}</td>
            <td className="px-3 py-2 bg-red-50 text-red-700 font-mono">
              {oldValues[key] != null ? String(oldValues[key]) : <span className="italic text-gray-400">empty</span>}
            </td>
            <td className="px-3 py-2 bg-emerald-50 text-emerald-700 font-mono">
              {newValues[key] != null ? String(newValues[key]) : <span className="italic text-gray-400">empty</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ExpandedRow({ log }: { log: AuditEntry }) {
  const details = parseJSON(log.details);
  const oldValues = parseJSON(log.old_values);
  const newValues = parseJSON(log.new_values);
  const hasDiff = oldValues && newValues;

  return (
    <tr>
      <td colSpan={5} className="px-6 pb-4 bg-gray-50 border-b border-gray-100">
        <div className="space-y-3 pt-2">
          {hasDiff && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Field Changes</p>
              <FieldDiffTable oldValues={oldValues} newValues={newValues} />
            </div>
          )}
          {details && Object.keys(details).length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Details</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(details).map(([k, v]) => (
                  <span key={k} className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded px-2 py-0.5 text-xs text-gray-600">
                    <span className="font-medium text-gray-500">{k.replace(/_/g, ' ')}:</span>
                    <span>{String(v)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span>Log ID: #{log.log_id}</span>
            {log.ip_address && <span>IP: {log.ip_address}</span>}
            <span>Entity: {log.entity_type}{log.entity_id ? ` #${log.entity_id}` : ''}</span>
          </div>
        </div>
      </td>
    </tr>
  );
}

const AuditLog = () => {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actions, setActions] = useState<string[]>([]);
  const [selectedAction, setSelectedAction] = useState('');
  const [dateStart, setDateStart] = useState(localToday());
  const [dateEnd, setDateEnd] = useState(localToday());
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(30);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedLog, setExpandedLog] = useState<number | null>(null);

  useEffect(() => {
    fetchActions();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [page, itemsPerPage, selectedAction, dateStart, dateEnd]);

  const fetchActions = async () => {
    try {
      const res = await api.get('/audit/actions');
      setActions(res.data);
    } catch (error) {
      console.error('Failed to fetch actions', error);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(itemsPerPage) });
      if (selectedAction) params.append('action', selectedAction);
      if (dateStart) params.append('date_start', dateStart);
      if (dateEnd) params.append('date_end', dateEnd);

      const res = await api.get(`/audit?${params.toString()}`);
      setLogs(res.data.logs);
      setTotalPages(res.data.pagination.totalPages);
      setTotal(res.data.pagination.total);
    } catch (error) {
      console.error('Failed to fetch logs', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedAction) params.append('action', selectedAction);
      if (dateStart) params.append('date_start', dateStart);
      if (dateEnd) params.append('date_end', dateEnd);
      const res = await api.get(`/audit/export?${params.toString()}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${localToday()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed', error);
    }
  };

  const toggleExpand = (logId: number) => {
    setExpandedLog(prev => (prev === logId ? null : logId));
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-gray-900 flex items-center gap-3">
            <ScrollText className="text-emerald-600" size={20} />
            Audit Log
          </h1>
          <p className="text-gray-500 mt-1">{total} total entries</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium"
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6 flex flex-wrap items-center gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Action Type</label>
          <select
            value={selectedAction}
            onChange={(e) => { setSelectedAction(e.target.value); setPage(1); }}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
          >
            <option value="">All Actions</option>
            {actions.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <DateRangeFilter
          standalone={false}
          dateFrom={dateStart}
          dateTo={dateEnd}
          onFromChange={(d) => { setDateStart(d); setPage(1); }}
          onToChange={(d) => { setDateEnd(d); setPage(1); }}
        />
        <button
          onClick={() => { setSelectedAction(''); setDateStart(localToday()); setDateEnd(localToday()); setPage(1); }}
          className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 border border-gray-200 rounded-lg transition-colors"
        >
          Reset
        </button>
      </div>

      {/* Log Table */}
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
                  <th className="p-4 w-8"></th>
                  <th className="p-4">Time</th>
                  <th className="p-4">User</th>
                  <th className="p-4">Action</th>
                  <th className="p-4">Entity</th>
                  <th className="p-4">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => {
                  const isExpanded = expandedLog === log.log_id;
                  const hasDiff = log.old_values && log.new_values;
                  const details = parseJSON(log.details);
                  const detailSummary = details
                    ? Object.entries(details).slice(0, 2).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(' · ')
                    : '';

                  return (
                    <Fragment key={log.log_id}>
                      <tr
                        className={`hover:bg-gray-50 transition-colors cursor-pointer ${isExpanded ? 'bg-gray-50' : ''}`}
                        onClick={() => toggleExpand(log.log_id)}
                      >
                        <td className="pl-4 py-3 text-gray-400">
                          {isExpanded
                            ? <ChevronDown size={15} />
                            : <ChevronRight size={15} />}
                        </td>
                        <td className="p-4 whitespace-nowrap text-gray-500 text-xs">
                          <div className="flex items-center gap-1.5">
                            <Clock size={13} />
                            {new Date(log.created_at).toLocaleString()}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5">
                            <User size={13} className="text-gray-400" />
                            <span className="font-medium text-gray-700">{log.user_name}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-700'}`}>
                            {log.action.replace(/_/g, ' ')}
                          </span>
                          {hasDiff && (
                            <span className="ml-1.5 inline-flex px-1.5 py-0.5 rounded text-xs bg-amber-50 text-amber-600 border border-amber-200">
                              diff
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-gray-600 text-xs">
                          <span className="capitalize">{log.entity_type?.replace(/_/g, ' ')}</span>
                          {log.entity_id ? <span className="text-gray-400"> #{log.entity_id}</span> : ''}
                        </td>
                        <td className="p-4 text-gray-400 text-xs max-w-xs truncate">
                          {detailSummary || '-'}
                        </td>
                      </tr>
                      {isExpanded && <ExpandedRow log={log} />}
                    </Fragment>
                  );
                })}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-gray-400">
                      No audit logs found
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
    </div>
  );
};

const AuditLogWithGate = () => <ReportPasswordGate><AuditLog /></ReportPasswordGate>;
export default AuditLogWithGate;
