import { useState, useEffect } from 'react';
import { Mail, CheckCircle, Send, AlertTriangle, Loader2, Bell } from 'lucide-react';
import api from '../../utils/api';
import { useToast } from '../../components/Toast';

const EmailSettings = () => {
  const toast = useToast();
  const [status, setStatus] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [sendingAlert, setSendingAlert] = useState(false);
  const [testEmail, setTestEmail] = useState('');

  useEffect(() => {
    api.get('/email/status').then(r => setStatus(r.data)).catch(() => {});
  }, []);

  const testConnection = async () => {
    setTesting(true);
    try {
      await api.post('/email/test-connection');
      toast.success('Email connection successful!');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Connection failed');
    } finally {
      setTesting(false);
    }
  };

  const sendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingTest(true);
    try {
      const res = await api.post('/email/send-test', { to: testEmail });
      toast.success(res.data.message);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send test email');
    } finally {
      setSendingTest(false);
    }
  };

  const sendLowStockAlert = async () => {
    setSendingAlert(true);
    try {
      const res = await api.post('/email/low-stock-alert');
      toast.success(res.data.message);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send alert');
    } finally {
      setSendingAlert(false);
    }
  };

  const isConfigured = status?.configured;

  return (
    <div className="p-4 sm:p-6 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900 flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
            <Mail size={20} className="text-white" />
          </div>
          Email Notifications
        </h1>
        <p className="text-gray-500 mt-1">Configure and test email notification settings</p>
      </div>

      {/* Connection Status */}
      <div className={`rounded-xl border-2 p-5 mb-6 flex items-center gap-4 ${
        isConfigured ? 'border-emerald-200 bg-emerald-50' : 'border-orange-200 bg-orange-50'
      }`}>
        {isConfigured
          ? <CheckCircle size={24} className="text-emerald-600 shrink-0" />
          : <AlertTriangle size={24} className="text-orange-500 shrink-0" />
        }
        <div className="flex-1">
          <p className={`font-semibold ${isConfigured ? 'text-emerald-800' : 'text-orange-800'}`}>
            {isConfigured ? 'Email Configured' : 'Email Not Configured'}
          </p>
          {isConfigured
            ? <p className="text-sm text-emerald-700 mt-0.5">SMTP: {status.host} — {status.user}</p>
            : <p className="text-sm text-orange-700 mt-0.5">Add EMAIL_HOST, EMAIL_USER, EMAIL_PASS, EMAIL_FROM to your .env file</p>
          }
        </div>
        {isConfigured && (
          <button onClick={testConnection} disabled={testing}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
            {testing ? <Loader2 size={16} className="animate-spin" /> : null}
            Test Connection
          </button>
        )}
      </div>

      {/* Setup Instructions */}
      {!isConfigured && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4">Setup Instructions</h2>
          <div className="space-y-3 text-sm">
            <p className="text-gray-600">1. Install nodemailer in backend:</p>
            <code className="block bg-gray-900 text-green-400 p-3 rounded-lg font-mono text-xs">
              cd backend && npm install nodemailer
            </code>
            <p className="text-gray-600 mt-3">2. Add to your <strong>backend/.env</strong> file:</p>
            <code className="block bg-gray-900 text-green-400 p-3 rounded-lg font-mono text-xs whitespace-pre">
{`EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM="AByte ERP <noreply@yourstore.com>"
BACKUP_NOTIFY_EMAIL=admin@yourstore.com`}
            </code>
            <p className="text-gray-600 mt-3">3. For Gmail, use an App Password (not your account password). Enable 2FA first, then go to Google Account → Security → App Passwords.</p>
            <p className="text-gray-600">4. Restart the backend server after updating .env</p>
          </div>
        </div>
      )}

      {/* Send Test Email */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
          <Send size={16} className="text-blue-500" /> Send Test Email
        </h2>
        <p className="text-sm text-gray-500 mb-4">Verify that email delivery is working</p>
        <form onSubmit={sendTestEmail} className="flex gap-3">
          <input type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)}
            placeholder="recipient@example.com"
            className="flex-1 px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-blue-400 outline-none text-sm"
            required />
          <button type="submit" disabled={sendingTest || !isConfigured}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            {sendingTest ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Send
          </button>
        </form>
        {!isConfigured && <p className="text-xs text-gray-400 mt-2">Configure email first to send test emails.</p>}
      </div>

      {/* Notification Triggers */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
          <Bell size={16} className="text-purple-500" /> Manual Notifications
        </h2>
        <p className="text-sm text-gray-500 mb-4">Send notifications manually</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button onClick={sendLowStockAlert} disabled={sendingAlert || !isConfigured}
            className="flex items-center gap-3 p-4 border-2 border-orange-200 rounded-xl hover:bg-orange-50 disabled:opacity-50 text-left transition">
            {sendingAlert ? <Loader2 size={20} className="text-orange-500 animate-spin" /> : <AlertTriangle size={20} className="text-orange-500" />}
            <div>
              <p className="font-medium text-gray-800 text-sm">Low Stock Alert</p>
              <p className="text-xs text-gray-400">Email admin about low stock products</p>
            </div>
          </button>
        </div>
      </div>

      {/* Auto-notifications info */}
      <div className="mt-6 bg-blue-50 rounded-xl p-5">
        <h3 className="font-semibold text-blue-800 mb-2 text-sm">Automatic Notifications</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>✅ Daily backup completion (2:00 AM) — set BACKUP_NOTIFY_EMAIL in .env</li>
          <li>✅ Scheduled backup failure alerts</li>
          <li>✅ Invoice email to customer — use the <strong>✉ Email Invoice</strong> button on any completed order in Orders / Done Orders</li>
          <li>⏳ Low stock daily digest (coming soon)</li>
        </ul>
      </div>
    </div>
  );
};

export default EmailSettings;
