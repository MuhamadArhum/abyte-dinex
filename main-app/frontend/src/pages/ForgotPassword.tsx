import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Loader2, CheckCircle, Zap, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../utils/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : undefined;
      setError(msg || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden flex-col justify-between p-12"
        style={{ background: 'linear-gradient(160deg, #0a1628 0%, #0f172a 50%, #111827 100%)' }}>

        {/* Background */}
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

        {/* Logo */}
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

        {/* Center content */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }}
          className="relative z-10 flex-1 flex flex-col justify-center">
          <div className="inline-flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/25 rounded-full px-4 py-1.5 mb-6 w-fit">
            <Shield size={13} className="text-emerald-400" />
            <span className="text-emerald-300 text-xs font-semibold">Account Recovery</span>
          </div>
          <h1 className="text-3xl xl:text-4xl font-black text-white leading-tight mb-4">
            Forgot your<br />
            <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
              password?
            </span>
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
            No worries. Enter your registered email address and we'll send you a secure link to reset your password.
          </p>

          <div className="mt-10 space-y-4">
            {[
              { step: '01', text: 'Enter your email address below' },
              { step: '02', text: 'Check your inbox for the reset link' },
              { step: '03', text: 'Create a new secure password' },
            ].map(s => (
              <div key={s.step} className="flex items-center gap-4">
                <span className="text-[10px] font-black text-emerald-500/60 w-6">{s.step}</span>
                <div className="w-px h-3 bg-slate-700" />
                <p className="text-sm text-slate-400">{s.text}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
          className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap size={12} className="text-emerald-500/50" />
            <span className="text-slate-600 text-xs">Secure & Encrypted</span>
          </div>
          <span className="text-slate-700 text-xs">© 2025 AByte</span>
        </motion.div>
      </div>

      {/* Right Panel — Form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 via-gray-50 to-emerald-50/30 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-72 h-72 bg-emerald-200/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-56 h-56 bg-teal-200/15 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />
        </div>

        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }}
          className="w-full max-w-md relative z-10">

          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-gray-200/60 border border-white/60 p-8">

            {/* Mobile logo */}
            <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
              <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="font-black text-white">A</span>
              </div>
              <span className="text-lg font-bold text-gray-800">AByte ERP</span>
            </div>

            <AnimatePresence mode="wait">
              {!sent ? (
                <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -10 }}>

                  <Link to="/login" className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-emerald-600 transition mb-6">
                    <ArrowLeft size={14} /> Back to Login
                  </Link>

                  <div className="mb-7">
                    <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200/60 rounded-full px-3 py-1 mb-4">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      <span className="text-emerald-700 text-xs font-semibold">Password Reset</span>
                    </div>
                    <h2 className="text-2xl font-black text-gray-900">Reset Password</h2>
                    <p className="text-gray-400 mt-1 text-sm">We'll email you a secure reset link</p>
                  </div>

                  {error && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-5 text-sm flex items-start gap-3">
                      <div className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      </div>
                      {error}
                    </motion.div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                      <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors" size={17} />
                        <input
                          type="email"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          placeholder="name@company.com"
                          required
                          className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-gray-200 rounded-xl focus:ring-0 focus:border-emerald-500 outline-none transition text-gray-800 placeholder-gray-400 text-sm"
                        />
                      </div>
                    </div>

                    <motion.button whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }}
                      type="submit" disabled={loading}
                      className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold py-3.5 rounded-xl transition shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed text-sm">
                      {loading ? <><Loader2 className="animate-spin" size={17} /> Sending...</> : 'Send Reset Link'}
                    </motion.button>
                  </form>

                  <p className="text-center text-xs text-gray-400 mt-6">
                    Remember your password?{' '}
                    <Link to="/login" className="text-emerald-600 font-semibold hover:text-emerald-700 transition">Sign In</Link>
                  </p>
                </motion.div>
              ) : (
                <motion.div key="sent" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-6">
                  <div className="w-16 h-16 bg-emerald-50 border-2 border-emerald-200 rounded-2xl flex items-center justify-center mx-auto mb-5">
                    <CheckCircle size={30} className="text-emerald-500" />
                  </div>
                  <h3 className="text-xl font-black text-gray-900 mb-2">Check your inbox</h3>
                  <p className="text-gray-500 text-sm leading-relaxed mb-1">
                    We've sent a password reset link to
                  </p>
                  <p className="font-bold text-gray-800 text-sm mb-6">{email}</p>
                  <p className="text-xs text-gray-400 mb-6">
                    Didn't receive it? Check your spam folder or{' '}
                    <button onClick={() => setSent(false)} className="text-emerald-600 font-semibold hover:text-emerald-700 transition">try again</button>.
                  </p>
                  <Link to="/login"
                    className="inline-flex items-center gap-2 bg-gray-900 text-white text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-gray-800 transition">
                    <ArrowLeft size={14} /> Back to Login
                  </Link>
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
