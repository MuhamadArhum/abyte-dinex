import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Info, Trash2, CheckCircle } from 'lucide-react';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info' | 'success';
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useConfirm = (): ConfirmFn => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
};

interface DialogState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export const ConfirmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const confirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    return new Promise((resolve) => {
      const opts: ConfirmOptions = typeof options === 'string' ? { message: options, type: 'warning' } : options;
      setDialog({ ...opts, resolve });
    });
  }, []);

  const handleClose = (value: boolean) => {
    dialog?.resolve(value);
    setDialog(null);
  };

  const iconMap = {
    danger:  <Trash2     size={22} className="text-red-600"    />,
    warning: <AlertTriangle size={22} className="text-amber-600" />,
    info:    <Info       size={22} className="text-blue-600"   />,
    success: <CheckCircle  size={22} className="text-emerald-600" />,
  };

  const colorMap = {
    danger:  { bg: 'bg-red-100',     btn: 'bg-red-500 hover:bg-red-600'         },
    warning: { bg: 'bg-amber-100',   btn: 'bg-amber-500 hover:bg-amber-600'     },
    info:    { bg: 'bg-blue-100',    btn: 'bg-blue-500 hover:bg-blue-600'       },
    success: { bg: 'bg-emerald-100', btn: 'bg-emerald-500 hover:bg-emerald-600' },
  };

  const type = dialog?.type ?? 'warning';
  const colors = colorMap[type];

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AnimatePresence>
        {dialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center z-[200] p-4"
            onClick={() => handleClose(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 20 }}
              animate={{ opacity: 1, scale: 1,    y: 0  }}
              exit={{   opacity: 0, scale: 0.93, y: 20  }}
              transition={{ type: 'spring', stiffness: 340, damping: 30 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
              onClick={e => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-title"
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${colors.bg}`}>
                {iconMap[type]}
              </div>

              {dialog.title && (
                <h3 id="confirm-title" className="text-gray-900 font-semibold text-base mb-2">
                  {dialog.title}
                </h3>
              )}

              <p className="text-gray-600 text-sm leading-relaxed mb-6">{dialog.message}</p>

              <div className="flex gap-3">
                <button
                  onClick={() => handleClose(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {dialog.cancelText || 'Cancel'}
                </button>
                <button
                  onClick={() => handleClose(true)}
                  className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors ${colors.btn}`}
                >
                  {dialog.confirmText || 'Confirm'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
};
