import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, ArrowLeft, Loader2, Eye, EyeOff, CheckCircle, ShieldCheck, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';

const rules = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'Contains uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Contains a number', test: (p: string) => /\d/.test(p) },
];

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const strength = rules.filter(r => r.test(password)).length;
  const strengthColor = strength === 0 ? 'bg-gray-200' : strength === 1 ? 'bg-red-400' : strength === 2 ? 'bg-yellow-400' : 'bg-emerald-500';
  const strengthLabel = ['', 'Weak', 'Fair', 'Strong'][strength];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (strength < 2) { setError('Please choose a stronger password.'); return; }
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      setError(msg || 'Invalid or expired reset link. Please request a new one.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden flex-col justify-between p-12"
        style={{ background: 'linear-gradient(160deg, #0a1628 0%, #0f172a 50%, #111827 100%)' }}>

        <div className="absolute inset-0 pointer-events-none">
          <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-32 -right-32 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl" />
          <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
            className="absolute -bottom-40 -left-20 w-96 h-96 bg-teal-500/8 rounded-full blur-3xl" />
          <div className="absolute inset-0 opacity-[0.04]" style={{
            backgroundImage: 'radial-gradient(circle, #10b981 1px, transparent 1px)',
            backgroundSize: '28px 28px'
          }} />
        </div>

        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-900/50">
            <span className="text-lg font-black text-white">A</span>
          </div>
          <div>
            <p className="text-white font-bold text-base leading-tight">AByte <span className="text-emerald-400">ERP</span></p>
            <p className="text-[10px] text-slate-500">Business Solution</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }}
          className="relative z-10 flex-1 flex flex-col justify-center">
          <div className="inline-flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/25 rounded-full px-4 py-1.5 mb-6 w-fit">
            <ShieldCheck size={13} className="text-emerald-400" />
            <span className="text-emerald-300 text-xs font-semibold">Secure Reset</span>
          </div>
          <h1 className="text-3xl xl:text-4xl font-black text-white leading-tight mb-4">
            Create a new<br />
            <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              secure password
            </span>
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
            Choose a strong password to protect your AByte ERP account. It must be at least 8 characters with a mix of letters and numbers.
          </p>

          <div className="mt-10 p-5 bg-white/[0.04] border border-white/[0.08] rounded-2xl space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Password Tips</p>
            {rules.map(r => (
              <div key={r.label} className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${r.test(password) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'}`}>
                  {r.test(password) && <CheckCircle size={10} className="text-white" />}
                </div>
                <span className={`text-xs transition-colors ${r.test(password) ? 'text-emerald-400' : 'text-slate-500'}`}>{r.label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
          className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap size={12} className="text-emerald-500/50" />
            <span className="text-slate-600 text-xs">Secure & Encrypted</span>
          </div>
          <span className="text-slate-700 text-xs">© 2025 AByte</span>
        </motion.div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 via-gray-50 to-emerald-50/30 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-200/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-56 h-56 bg-teal-200/15 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />
        </div>

        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }}
          className="w-full max-w-md relative z-10">

          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-gray-200/60 border border-white/60 p-8">

            <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
              <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="font-black text-white">A</span>
              </div>
              <span className="text-lg font-bold text-gray-800">AByte ERP</span>
            </div>

            <AnimatePresence mode="wait">
              {!done ? (
                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -10 }}>

                  <Link to="/login" className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-emerald-600 transition mb-6">
                    <ArrowLeft size={14} /> Back to Login
                  </Link>

                  <div className="mb-7">
                    <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200/60 rounded-full px-3 py-1 mb-4">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      <span className="text-emerald-700 text-xs font-semibold">New Password</span>
                    </div>
                    <h2 className="text-2xl font-black text-gray-900">Set New Password</h2>
                    <p className="text-gray-400 mt-1 text-sm">Must be different from your previous password</p>
                  </div>

                  {!token && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-4 mb-5 text-sm">
                      Invalid reset link. Please request a new password reset.
                    </div>
                  )}

                  {error && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-5 text-sm flex items-start gap-3">
                      <div className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      </div>
                      {error}
                    </motion.div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
                      <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={17} />
                        <input type={showPassword ? 'text' : 'password'} value={password}
                          onChange={e => setPassword(e.target.value)} placeholder="Enter new password" required
                          className="w-full pl-11 pr-12 py-3.5 bg-white border-2 border-gray-200 rounded-xl focus:ring-0 focus:border-emerald-500 outline-none transition text-gray-800 placeholder-gray-400 text-sm" />
                        <button type="button" onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition" tabIndex={-1}>
                          {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      </div>
                      {password && (
                        <div className="mt-2 space-y-1.5">
                          <div className="flex gap-1">
                            {[1, 2, 3].map(i => (
                              <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strength ? strengthColor : 'bg-gray-200'}`} />
                            ))}
                          </div>
                          {strengthLabel && <p className={`text-xs font-medium ${strength === 3 ? 'text-emerald-600' : strength === 2 ? 'text-yellow-600' : 'text-red-500'}`}>{strengthLabel} password</p>}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm Password</label>
                      <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={17} />
                        <input type={showConfirm ? 'text' : 'password'} value={confirm}
                          onChange={e => setConfirm(e.target.value)} placeholder="Re-enter new password" required
                          className={`w-full pl-11 pr-12 py-3.5 bg-white border-2 rounded-xl focus:ring-0 outline-none transition text-gray-800 placeholder-gray-400 text-sm ${confirm && confirm !== password ? 'border-red-400 focus:border-red-400' : 'border-gray-200 focus:border-emerald-500'}`} />
                        <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition" tabIndex={-1}>
                          {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      </div>
                      {confirm && confirm !== password && (
                        <p className="text-xs text-red-500 mt-1.5">Passwords do not match</p>
                      )}
                    </div>

                    <motion.button whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }}
                      type="submit" disabled={loading || !token}
                      className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold py-3.5 rounded-xl transition shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed text-sm mt-2">
                      {loading ? <><Loader2 className="animate-spin" size={17} /> Updating...</> : 'Update Password'}
                    </motion.button>
                  </form>
                </motion.div>
              ) : (
                <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-6">
                  <div className="w-16 h-16 bg-emerald-50 border-2 border-emerald-200 rounded-2xl flex items-center justify-center mx-auto mb-5">
                    <ShieldCheck size={30} className="text-emerald-500" />
                  </div>
                  <h3 className="text-xl font-black text-gray-900 mb-2">Password Updated!</h3>
                  <p className="text-gray-500 text-sm leading-relaxed mb-6">
                    Your password has been changed successfully. You can now sign in with your new password.
                  </p>
                  <motion.button whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }}
                    onClick={() => navigate('/login')}
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold py-3.5 rounded-xl transition shadow-lg shadow-emerald-500/25 text-sm">
                    Continue to Login
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <p className="text-center text-xs text-gray-400 mt-4">AByte ERP © 2025 · All rights reserved</p>
        </motion.div>
      </div>
    </div>
  );
}
