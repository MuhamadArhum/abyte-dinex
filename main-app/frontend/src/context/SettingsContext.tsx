import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import api from '../utils/api';

interface SettingsContextType {
  currencySymbol: string;
  refreshSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType>({
  currencySymbol: 'Rs.',
  refreshSettings: () => {},
});

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currencySymbol, setCurrencySymbol] = useState<string>(() => {
    return localStorage.getItem('currency_symbol') || 'Rs.';
  });

  const fetchSettings = useCallback(async () => {
    if (!localStorage.getItem('token')) return; // Don't call if not authenticated — prevents 401 redirect loop
    try {
      const res = await api.get('/settings');
      const symbol = res.data?.currency_symbol || 'Rs.';
      setCurrencySymbol(symbol);
      localStorage.setItem('currency_symbol', symbol);
    } catch {
      // keep cached value
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Memoize context value so all consumers only re-render when currencySymbol
  // actually changes — not on every parent re-render of SettingsProvider.
  const contextValue = useMemo(
    () => ({ currencySymbol, refreshSettings: fetchSettings }),
    [currencySymbol, fetchSettings]
  );

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);
