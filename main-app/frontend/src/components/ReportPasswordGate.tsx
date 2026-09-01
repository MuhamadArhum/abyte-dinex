import { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import api from '../utils/api';

const SESSION_KEY = 'reports_unlocked';

interface Props {
  children: React.ReactNode;
}

const ReportPasswordGate: React.FC<Props> = ({ children }) => {
  const [status, setStatus] = useState<'loading' | 'unlocked' | 'locked'>('loading');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    api.get('/settings').then(res => {
      if (!res.data.reports_password_set) {
        setStatus('unlocked');
        return;
      }
      if (sessionStorage.getItem(SESSION_KEY) === 'yes') {
        setStatus('unlocked');
      } else {
        setStatus('locked');
      }
    }).catch(() => {
      setStatus('unlocked');
    });
  }, []);

  const handleUnlock = async () => {
    setChecking(true);
    setError('');
    try {
      const res = await api.post('/settings/verify-password', { type: 'reports', password });
      if (res.data.valid) {
        sessionStorage.setItem(SESSION_KEY, 'yes');
        setStatus('unlocked');
      } else {
        setError('Incorrect password. Please try again.');
        setPassword('');
      }
    } catch {
      setError('Verification failed. Please try again.');
    } finally {
      setChecking(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-emerald-200 border-t-emerald-600" />
      </div>
    );
  }

  if (status === 'unlocked') {
    return <>{children}</>;
  }

  return (
    <div className="flex items-center justify-center min-h-[70vh] bg-gray-50">
      <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 w-full max-w-sm p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-emerald-50 border-2 border-emerald-200 rounded-2xl flex items-center justify-center mb-4">
            <ShieldCheck size={32} className="text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">Reports Protected</h2>
          <p className="text-sm text-gray-500 mt-1 text-center">Enter password to access reports</p>
        </div>

        <div className="relative mb-3">
          <input
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }}
            onKeyDown={e => { if (e.key === 'Enter') handleUnlock(); }}
            placeholder="Enter reports password..."
            className="w-full pl-4 pr-10 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
            autoFocus
            disabled={checking}
          />
          <button
            type="button"
            onClick={() => setShowPw(!showPw)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        <button
          onClick={handleUnlock}
          disabled={checking}
          className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors"
        >
          <Lock size={18} />
          {checking ? 'Verifying...' : 'Unlock Reports'}
        </button>
      </div>
    </div>
  );
};

export default ReportPasswordGate;
