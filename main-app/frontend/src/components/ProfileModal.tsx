import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, User, Mail, Lock, Eye, EyeOff, Save, Shield,
  CheckCircle, AlertCircle, Camera, Edit3
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'profile' | 'security';

const ROLE_COLORS: Record<string, string> = {
  Admin:   'bg-purple-100 text-purple-700 border-purple-200',
  Manager: 'bg-blue-100   text-blue-700   border-blue-200',
  Cashier: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

const ProfileModal = ({ isOpen, onClose }: ProfileModalProps) => {
  const { user, updateUser } = useAuth();

  const [tab, setTab] = useState<Tab>('profile');

  // Profile tab state
  const [name,  setName]  = useState(user?.name  || '');
  const [email, setEmail] = useState(user?.email || '');

  // Security tab state
  const [currentPwd,  setCurrentPwd]  = useState('');
  const [newPwd,      setNewPwd]      = useState('');
  const [confirmPwd,  setConfirmPwd]  = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Feedback
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState('');
  const [error,   setError]   = useState('');

  const clearFeedback = () => { setSuccess(''); setError(''); };

  const resetSecurity = () => {
    setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    setShowCurrent(false); setShowNew(false); setShowConfirm(false);
  };

  const handleTabChange = (t: Tab) => {
    setTab(t);
    clearFeedback();
  };

  const handleSaveProfile = async () => {
    clearFeedback();
    if (!name.trim()) { setError('Name cannot be empty'); return; }
    if (!email.trim()) { setError('Email cannot be empty'); return; }
    setSaving(true);
    try {
      const res = await api.put('/auth/profile', { name: name.trim(), email: email.trim() });
      updateUser({ name: res.data.user.name, email: res.data.user.email });
      setSuccess('Profile updated successfully!');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePassword = async () => {
    clearFeedback();
    if (!currentPwd) { setError('Enter your current password'); return; }
    if (!newPwd)      { setError('Enter a new password'); return; }
    if (newPwd.length < 8) { setError('New password must be at least 8 characters'); return; }
    if (newPwd !== confirmPwd) { setError('Passwords do not match'); return; }
    setSaving(true);
    try {
      await api.put('/auth/profile', { current_password: currentPwd, new_password: newPwd });
      resetSecurity();
      setSuccess('Password changed successfully!');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const initials = (user?.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const roleColor = ROLE_COLORS[user?.role_name || ''] || 'bg-gray-100 text-gray-600 border-gray-200';

  // Password strength
  const pwdStrength = (() => {
    if (!newPwd) return 0;
    let s = 0;
    if (newPwd.length >= 8)              s++;
    if (/[A-Z]/.test(newPwd))           s++;
    if (/[0-9]/.test(newPwd))           s++;
    if (/[^A-Za-z0-9]/.test(newPwd))   s++;
    return s;
  })();
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][pwdStrength];
  const strengthColor = ['', 'bg-red-400', 'bg-amber-400', 'bg-blue-400', 'bg-emerald-500'][pwdStrength];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
          />

          {/* Slide-over panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-sm">
                  <User size={18} className="text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">My Profile</h2>
                  <p className="text-xs text-gray-400">Manage your account settings</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            {/* ── Avatar Section ── */}
            <div className="px-6 py-6 bg-gradient-to-br from-slate-50 to-emerald-50/40 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-emerald-500/25 ring-4 ring-white">
                    {initials}
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-white border-2 border-gray-200 rounded-lg flex items-center justify-center shadow-sm">
                    <Camera size={12} className="text-gray-500" />
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-bold text-gray-900 truncate">{user?.name || 'User'}</p>
                  <p className="text-sm text-gray-500 truncate">{user?.email || ''}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${roleColor}`}>
                      <Shield size={10} />
                      {user?.role_name || 'Staff'}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                      Online
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Tabs ── */}
            <div className="flex border-b border-gray-100 flex-shrink-0 bg-white">
              {(['profile', 'security'] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => handleTabChange(t)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-colors relative ${
                    tab === t ? 'text-emerald-600' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t === 'profile' ? <Edit3 size={15} /> : <Lock size={15} />}
                  {t === 'profile' ? 'Edit Profile' : 'Change Password'}
                  {tab === t && (
                    <motion.div
                      layoutId="tabLine"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-full"
                    />
                  )}
                </button>
              ))}
            </div>

            {/* ── Body (scrollable) ── */}
            <div className="flex-1 overflow-y-auto px-6 py-6">

              {/* Feedback */}
              <AnimatePresence mode="wait">
                {success && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 mb-5 text-sm"
                  >
                    <CheckCircle size={16} className="flex-shrink-0" />
                    {success}
                  </motion.div>
                )}
                {error && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-5 text-sm"
                  >
                    <AlertCircle size={16} className="flex-shrink-0" />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Profile Tab ── */}
              {tab === 'profile' && (
                <motion.div
                  key="profile"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Full Name
                    </label>
                    <div className="relative">
                      <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={name}
                        onChange={e => { setName(e.target.value); clearFeedback(); }}
                        className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl text-sm text-gray-800 focus:border-emerald-400 focus:ring-0 outline-none transition-colors bg-white"
                        placeholder="Enter your full name"
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={e => { setEmail(e.target.value); clearFeedback(); }}
                        className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl text-sm text-gray-800 focus:border-emerald-400 focus:ring-0 outline-none transition-colors bg-white"
                        placeholder="Enter your email"
                      />
                    </div>
                  </div>

                  {/* Role — read only */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Role <span className="text-xs font-normal text-gray-400">(cannot be changed here)</span>
                    </label>
                    <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl">
                      <Shield size={16} className="text-gray-400" />
                      <span className="text-sm text-gray-600 font-medium">{user?.role_name || 'Staff'}</span>
                      <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-semibold border ${roleColor}`}>
                        {user?.role_name}
                      </span>
                    </div>
                  </div>

                  {/* Username — read only */}
                  {user?.username && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Username
                      </label>
                      <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl">
                        <span className="text-sm text-gray-500 font-mono">@{user.username}</span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                  >
                    {saving ? (
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Save size={16} />
                    )}
                    {saving ? 'Saving…' : 'Save Profile'}
                  </button>
                </motion.div>
              )}

              {/* ── Security Tab ── */}
              {tab === 'security' && (
                <motion.div
                  key="security"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-5"
                >
                  <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <Shield size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 leading-relaxed">
                      Choose a strong password with letters, numbers, and symbols. Minimum 8 characters.
                    </p>
                  </div>

                  {/* Current Password */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Current Password</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type={showCurrent ? 'text' : 'password'}
                        value={currentPwd}
                        onChange={e => { setCurrentPwd(e.target.value); clearFeedback(); }}
                        className="w-full pl-10 pr-11 py-3 border-2 border-gray-200 rounded-xl text-sm text-gray-800 focus:border-emerald-400 focus:ring-0 outline-none transition-colors bg-white"
                        placeholder="Enter current password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrent(v => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type={showNew ? 'text' : 'password'}
                        value={newPwd}
                        onChange={e => { setNewPwd(e.target.value); clearFeedback(); }}
                        className="w-full pl-10 pr-11 py-3 border-2 border-gray-200 rounded-xl text-sm text-gray-800 focus:border-emerald-400 focus:ring-0 outline-none transition-colors bg-white"
                        placeholder="Enter new password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew(v => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>

                    {/* Strength meter */}
                    {newPwd && (
                      <div className="mt-2.5 space-y-1.5">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4].map(i => (
                            <div
                              key={i}
                              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                                i <= pwdStrength ? strengthColor : 'bg-gray-200'
                              }`}
                            />
                          ))}
                        </div>
                        <p className={`text-xs font-semibold ${
                          pwdStrength <= 1 ? 'text-red-500' :
                          pwdStrength === 2 ? 'text-amber-500' :
                          pwdStrength === 3 ? 'text-blue-500' : 'text-emerald-600'
                        }`}>
                          {strengthLabel}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm New Password</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        value={confirmPwd}
                        onChange={e => { setConfirmPwd(e.target.value); clearFeedback(); }}
                        className={`w-full pl-10 pr-11 py-3 border-2 rounded-xl text-sm text-gray-800 focus:ring-0 outline-none transition-colors bg-white ${
                          confirmPwd && confirmPwd !== newPwd
                            ? 'border-red-300 focus:border-red-400'
                            : confirmPwd && confirmPwd === newPwd
                            ? 'border-emerald-300 focus:border-emerald-400'
                            : 'border-gray-200 focus:border-emerald-400'
                        }`}
                        placeholder="Confirm new password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(v => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      {confirmPwd && confirmPwd === newPwd && (
                        <CheckCircle size={15} className="absolute right-9 top-1/2 -translate-y-1/2 text-emerald-500" />
                      )}
                    </div>
                    {confirmPwd && confirmPwd !== newPwd && (
                      <p className="text-xs text-red-500 mt-1.5 font-medium">Passwords do not match</p>
                    )}
                  </div>

                  <button
                    onClick={handleSavePassword}
                    disabled={saving || (!!confirmPwd && confirmPwd !== newPwd)}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white font-semibold py-3.5 rounded-xl transition-all shadow-lg disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                  >
                    {saving ? (
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Lock size={16} />
                    )}
                    {saving ? 'Updating…' : 'Update Password'}
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ProfileModal;
