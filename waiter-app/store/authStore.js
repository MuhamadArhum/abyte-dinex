import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const useAuthStore = create((set) => ({
  user: null,
  token: null,
  isLoading: true,

  setAuth: async (user, token) => {
    await AsyncStorage.setItem('@waiter_token', token);
    await AsyncStorage.setItem('@waiter_user', JSON.stringify(user));
    set({ user, token });
  },

  loadAuth: async () => {
    try {
      const token = await AsyncStorage.getItem('@waiter_token');
      const userStr = await AsyncStorage.getItem('@waiter_user');
      if (token && userStr) {
        set({ token, user: JSON.parse(userStr), isLoading: false });
        return;
      }
    } catch {}
    set({ isLoading: false });
  },

  logout: async () => {
    await AsyncStorage.multiRemove(['@waiter_token', '@waiter_user']);
    set({ user: null, token: null });
  },
}));

export default useAuthStore;
