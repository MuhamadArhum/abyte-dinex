import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { Lock, Mail, Loader2, Eye, EyeOff, ShoppingCart, BarChart3, Users, Package, Shield, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

const features = [
  { icon: ShoppingCart, label: 'Point of Sale', desc: 'Fast & intuitive POS system' },
  { icon: BarChart3, label: 'Sales Analytics', desc: 'Real-time reports & insights' },
  { icon: Package, label: 'Inventory Control', desc: 'Stock tracking & alerts' },
  { icon: Users, label: 'HR Management', desc: 'Staff, attendance & payroll' },
];

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [warming, setWarming] = useState(false);
  const [pinging, setPinging] = useState(true);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Ping the backend on mount so Render free tier wakes up before user submits
  React.useEffect(() => {
    const timer = setTimeout(() => setWarming(true), 3000);
    api.get('/ping').finally(() => {
      clearTimeout(timer);
      setWarming(false);
      setPinging(false);
    });
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user, permissions, modules } = response.data;
      login(token, user, permissions ?? null, modules ?? []);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">

      {/* ===== LEFT PANEL — Branding ===== */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 flex-col justify-between p-12">

        {/* Background decorations */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            animate={{ scale: [1, 1.2, 1], rotate: [0, 60, 0] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-emerald-500/12 rounded-full blur-3xl"
          />
          <motion.div
            animate={{ scale: [1, 1.25, 1], rotate: [0, -40, 0] }}
            transition={{ duration: 25, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
            className="absolute -bottom-48 -left-24 w-[600px] h-[600px] bg-teal-500/10 rounded-full blur-3xl"
          />
          <motion.div
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute top-1/3 left-1/2 -translate-x-1/2 w-64 h-64 bg-emerald-600/8 rounded-full blur-2xl"
          />
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle, rgba(16,185,129,0.07) 1px, transparent 1px)',
            backgroundSize: '28px 28px'
          }} />
        </div>

        {/* Top — Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 flex items-center gap-3"
        >
          <div className="w-11 h-11 rounded-xl overflow-hidden flex items-center justify-center shadow-lg shadow-emerald-500/30 bg-white">
            <img src="/logo.png" alt="AByte" className="w-full h-full object-contain" />
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-tight">AByte ERP</p>
            <p className="text-emerald-400/70 text-xs">Complete Business Solution</p>
          </div>
        </motion.div>

        {/* Center — Hero */}
        <div className="relative z-10 flex-1 flex flex-col justify-center py-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <div className="inline-flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-4 py-1.5 mb-6">
              <Zap size={14} className="text-emerald-400" />
              <span className="text-emerald-300 text-xs font-semibold">Complete Business Solution</span>
            </div>
            <h1 className="text-4xl xl:text-5xl font-black text-white leading-tight mb-4">
              Run Your Business<br />
              <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                Smarter & Faster
              </span>
            </h1>
            <p className="text-slate-400 text-base leading-relaxed max-w-md">
              Everything you need to manage sales, inventory, staff, and accounting — all in one powerful platform.
            </p>
          </motion.div>

          {/* Feature cards */}
          <div className="grid grid-cols-2 gap-3 mt-10">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 + i * 0.1 }}
                  className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 hover:bg-white/[0.07] hover:border-emerald-500/20 transition-all duration-300 group"
                >
                  <div className="w-9 h-9 bg-emerald-500/15 border border-emerald-500/20 rounded-xl flex items-center justify-center mb-3 group-hover:bg-emerald-500/25 transition-colors">
                    <Icon size={17} className="text-emerald-400" />
                  </div>
                  <p className="text-white/90 font-semibold text-sm">{f.label}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{f.desc}</p>
                </motion.div>
              );
            })}
          </div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            className="flex items-center gap-6 mt-8 pt-6 border-t border-white/[0.07]"
          >
            {[
              { value: '10K+', label: 'Transactions' },
              { value: '99.9%', label: 'Uptime' },
              { value: '5★', label: 'Rated' },
            ].map(s => (
              <div key={s.label}>
                <p className="text-white font-black text-lg leading-tight">{s.value}</p>
                <p className="text-slate-500 text-xs">{s.label}</p>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Bottom — Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="relative z-10 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-emerald-500/60" />
            <span className="text-slate-500 text-xs">Secure & Encrypted</span>
          </div>
          <span className="text-slate-600 text-xs">v1.0.0 &copy; 2025 AByte</span>
        </motion.div>
      </div>

      {/* ===== RIGHT PANEL — Form ===== */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 via-gray-50 to-emerald-50/30 relative overflow-hidden">

        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-200/25 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-200/20 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-100/15 rounded-full blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="w-full max-w-md relative z-10"
        >
          {/* Form card */}
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-gray-200/60 border border-white/60 p-8">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-lg font-black text-white">A</span>
            </div>
            <span className="text-xl font-bold text-gray-800">AByte ERP</span>
          </div>

          {/* Heading */}
          <div className="mb-7">
            <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200/60 rounded-full px-3 py-1 mb-4">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-emerald-700 text-xs font-semibold">Secure Login</span>
            </div>
            <h2 className="text-2xl font-black text-gray-900">Welcome back</h2>
            <p className="text-gray-400 mt-1 text-sm">Sign in with your credentials</p>
          </div>

          {/* Error message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6 text-sm flex items-start gap-3"
            >
              <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
              </div>
              {error}
            </motion.div>
          )}

          {/* Server connecting indicator */}
          {pinging && (
            <div className={`border rounded-xl p-3 mb-4 text-xs flex items-center gap-2 ${warming ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
              <Loader2 size={14} className="animate-spin flex-shrink-0" />
              {warming ? 'Server is waking up, please wait...' : 'Connecting to server...'}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
              <div className="relative group">
                <Mail
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors duration-200"
                  size={18}
                />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-white border-2 border-gray-200 rounded-xl focus:ring-0 focus:border-emerald-500 outline-none transition-all duration-200 text-gray-800 placeholder-gray-400 text-sm"
                  placeholder="name@company.com"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">Password</label>
                <Link to="/forgot-password" className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold transition">Forgot password?</Link>
              </div>
              <div className="relative group">
                <Lock
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors duration-200"
                  size={18}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-3.5 bg-white border-2 border-gray-200 rounded-xl focus:ring-0 focus:border-emerald-500 outline-none transition-all duration-200 text-gray-800 placeholder-gray-400 text-sm"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <motion.button
              whileHover={{ scale: 1.015 }}
              whileTap={{ scale: 0.985 }}
              type="submit"
              disabled={loading || pinging}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2 text-sm tracking-wide"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Signing in...
                </>
              ) : pinging ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Connecting...
                </>
              ) : (
                'Sign In to Dashboard'
              )}
            </motion.button>

          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            Protected by enterprise-grade security
          </p>
          </div>{/* end card */}

          <p className="text-center text-xs text-gray-400 mt-4">
            AByte ERP &copy; 2025 &nbsp;&middot;&nbsp; All rights reserved
          </p>
        </motion.div>
      </div>

    </div>
  );
};

export default Login;
