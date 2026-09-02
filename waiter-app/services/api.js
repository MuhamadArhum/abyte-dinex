import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useAuthStore from '../store/authStore';

const SERVER_KEY = '@waiter_server_url';

// Create axios instance with a placeholder base URL.
// The request interceptor sets the real URL dynamically from AsyncStorage
// so that it works even when serverStore hasn't hydrated yet.
const api = axios.create({ baseURL: 'http://localhost:5000/api', timeout: 15000 });

api.interceptors.request.use(async (config) => {
  // Always read the latest server URL from storage
  const serverUrl = await AsyncStorage.getItem(SERVER_KEY);
  if (serverUrl) config.baseURL = serverUrl;

  const token = await AsyncStorage.getItem('@waiter_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      await useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export const BASE_URL = api.defaults.baseURL;
export default api;
