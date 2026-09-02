import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SERVER_KEY = '@waiter_server_url';

const useServerStore = create((set, get) => ({
  serverUrl: null,
  isLoaded: false,

  loadServerUrl: async () => {
    try {
      const url = await AsyncStorage.getItem(SERVER_KEY);
      set({ serverUrl: url || null, isLoaded: true });
    } catch {
      set({ isLoaded: true });
    }
  },

  saveServerUrl: async (url) => {
    const clean = url.trim().replace(/\/+$/, ''); // remove trailing slash
    await AsyncStorage.setItem(SERVER_KEY, clean);
    set({ serverUrl: clean });
  },

  clearServerUrl: async () => {
    await AsyncStorage.removeItem(SERVER_KEY);
    set({ serverUrl: null });
  },
}));

export default useServerStore;
