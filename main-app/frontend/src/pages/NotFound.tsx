import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, ArrowLeft, Search, LayoutDashboard, ShoppingCart, Package, Users, DollarSign } from 'lucide-react';

const quickLinks = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/', color: 'text-blue-500 bg-blue-50 border-blue-100' },
  { icon: ShoppingCart,   label: 'POS',       path: '/pos', color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
  { icon: Package,        label: 'Inventory', path: '/products', color: 'text-purple-600 bg-purple-50 border-purple-100' },
  { icon: Users,          label: 'HR',        path: '/staff', color: 'text-cyan-600 bg-cyan-50 border-cyan-100' },
  { icon: DollarSign,     label: 'Accounts',  path: '/chart-of-accounts', color: 'text-rose-600 bg-rose-50 border-rose-100' },
  { icon: Search,         label: 'Help',      path: '/help', color: 'text-gray-600 bg-gray-50 border-gray-100' },
];

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-emerald-50/20 flex items-center justify-center p-6 relative overflow-hidden">

      {/* Background blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-200/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-200/15 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />
        <div className="absolute inset-0 opacity-[0.025]" style={{
          backgroundImage: 'radial-gradient(circle, #10b981 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }} />
      </div>

      <div className="relative z-10 text-center max-w-xl w-full">

        {/* Logo */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="flex items-center justify-center gap-2.5 mb-10">
          <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200">
            <span className="text-base font-black text-white">A</span>
          </div>
          <span className="text-gray-700 font-bold text-base">AByte <span className="text-emerald-600">ERP</span></span>
        </motion.div>

        {/* 404 Display */}
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.1 }}>
          <div className="relative inline-block mb-6">
            <span className="text-[9rem] font-black leading-none select-none"
              style={{
                background: 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 40%, #e2e8f0 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
              404
            </span>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 bg-white rounded-2xl shadow-xl border border-gray-100 flex items-center justify-center">
                <Search size={32} className="text-gray-300" />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Message */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
          <h1 className="text-2xl font-black text-gray-900 mb-2">Page not found</h1>
          <p className="text-gray-500 text-sm leading-relaxed mb-8">
            The page you're looking for doesn't exist or has been moved.<br />
            Let's get you back on track.
          </p>
        </motion.div>

        {/* Action Buttons */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}
          className="flex items-center justify-center gap-3 mb-10">
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-700 text-sm font-semibold hover:bg-gray-50 hover:border-gray-300 transition shadow-sm">
            <ArrowLeft size={16} /> Go Back
          </motion.button>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Link to="/"
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-sm font-bold transition shadow-lg shadow-emerald-200">
              <Home size={16} /> Go to Dashboard
            </Link>
          </motion.div>
        </motion.div>

        {/* Quick Links */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }}>
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest mb-4">Or jump to</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {quickLinks.map(l => (
              <Link key={l.path} to={l.path}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border ${l.color} hover:shadow-sm transition text-left`}>
                <l.icon size={15} />
                <span className="text-xs font-semibold">{l.label}</span>
              </Link>
            ))}
          </div>
        </motion.div>

        <p className="text-xs text-gray-300 mt-10">AByte ERP © 2025</p>
      </div>
    </div>
  );
}
