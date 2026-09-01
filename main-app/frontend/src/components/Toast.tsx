import React, { createContext, useContext, useCallback } from 'react';
import { Toaster, toast as sonnerToast } from 'sonner';

interface ToastContextType {
  success: (message: string) => void;
  error:   (message: string) => void;
  info:    (message: string) => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const success  = useCallback((m: string) => sonnerToast.success(m), []);
  const error    = useCallback((m: string) => sonnerToast.error(m),   []);
  const info     = useCallback((m: string) => sonnerToast.info(m),    []);
  const showToast = useCallback((type: 'success' | 'error' | 'info', m: string) => {
    if (type === 'success') sonnerToast.success(m);
    else if (type === 'error') sonnerToast.error(m);
    else sonnerToast.info(m);
  }, []);

  return (
    <ToastContext.Provider value={{ success, error, info, showToast }}>
      {children}
      <Toaster
        position="bottom-center"
        richColors
        closeButton
        duration={3500}
        toastOptions={{
          style: { fontFamily: 'inherit' },
        }}
      />
    </ToastContext.Provider>
  );
};
