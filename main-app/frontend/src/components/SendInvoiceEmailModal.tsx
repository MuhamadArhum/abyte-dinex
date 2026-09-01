import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Send, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import api from '../utils/api';

interface Props {
  isOpen:      boolean;
  onClose:     () => void;
  saleId:      number;
  invoiceNo?:  string;
  customerEmail?: string;
}

const SendInvoiceEmailModal: React.FC<Props> = ({ isOpen, onClose, saleId, invoiceNo, customerEmail }) => {
  const [email, setEmail]     = useState(customerEmail || '');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');

  const handleClose = () => {
    if (loading) return;
    setSent(false);
    setError('');
    setEmail(customerEmail || '');
    onClose();
  };

  const handleSend = async () => {
    setError('');
    const trimmed = email.trim();
    if (!trimmed) { setError('Please enter an email address'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setError('Please enter a valid email address'); return; }

    setLoading(true);
    try {
      await api.post('/email/send-invoice', { sale_id: saleId, email: trimmed });
      setSent(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Email Invoice</h2>
                  {invoiceNo && <p className="text-xs text-gray-400">Invoice {invoiceNo}</p>}
                </div>
              </div>
              <button
                onClick={handleClose}
                disabled={loading}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5">
              {sent ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                  </div>
                  <p className="text-sm font-medium text-gray-800">Invoice sent successfully!</p>
                  <p className="text-xs text-gray-500">Sent to <span className="font-medium text-gray-700">{email}</span></p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-500 mb-4">
                    Enter the customer's email address to send the invoice.
                  </p>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      <input
                        type="email"
                        value={email}
                        onChange={e => { setEmail(e.target.value); setError(''); }}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                        placeholder="customer@example.com"
                        disabled={loading}
                        autoFocus
                        className={`w-full pl-9 pr-4 py-2.5 text-sm border rounded-xl outline-none transition-colors
                          ${error
                            ? 'border-red-300 bg-red-50 focus:border-red-400'
                            : 'border-gray-200 bg-white focus:border-blue-400 hover:border-gray-300'
                          } disabled:opacity-60`}
                      />
                    </div>
                    {error && (
                      <div className="flex items-center gap-1.5 text-xs text-red-600 mt-1">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        {error}
                      </div>
                    )}
                  </div>

                  {customerEmail && customerEmail !== email && (
                    <button
                      onClick={() => { setEmail(customerEmail); setError(''); }}
                      className="mt-2 text-xs text-blue-500 hover:text-blue-700 transition-colors"
                    >
                      Use customer email: {customerEmail}
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-5 flex gap-3">
              {sent ? (
                <button
                  onClick={handleClose}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
              ) : (
                <>
                  <button
                    onClick={handleClose}
                    disabled={loading}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={loading || !email.trim()}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                    ) : (
                      <><Send className="w-4 h-4" /> Send Invoice</>
                    )}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default SendInvoiceEmailModal;
