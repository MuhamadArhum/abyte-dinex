import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY        = '@waiter_offline_queue';
const FAILED_STORAGE_KEY = '@waiter_offline_failed_ids';

async function persistQueue(queue) {
  try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(queue)); } catch { /* ignore */ }
}

async function persistFailed(ids) {
  try { await AsyncStorage.setItem(FAILED_STORAGE_KEY, JSON.stringify(ids)); } catch { /* ignore */ }
}

const useOfflineQueue = create((set, get) => ({
  queue: [],
  failedIds: [],
  syncing: false,

  loadQueue: async () => {
    try {
      const [rawQueue, rawFailed] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(FAILED_STORAGE_KEY),
      ]);
      const queue     = rawQueue   ? JSON.parse(rawQueue)   : [];
      const failedIds = rawFailed  ? JSON.parse(rawFailed)  : [];
      set({ queue, failedIds });
    } catch {
      // ignore
    }
  },

  addToQueue: async (orderData) => {
    const entry = {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      ...orderData,
    };
    const queue = [...get().queue, entry];
    set({ queue });
    await persistQueue(queue);
    return entry.id;
  },

  removeFromQueue: async (id) => {
    const queue     = get().queue.filter((o) => o.id !== id);
    const failedIds = get().failedIds.filter((fid) => fid !== id);
    set({ queue, failedIds });
    await persistQueue(queue);
    await persistFailed(failedIds);
  },

  clearFailed: async () => {
    const failedIds = get().failedIds;
    const queue     = get().queue.filter((o) => !failedIds.includes(o.id));
    set({ queue, failedIds: [] });
    await persistQueue(queue);
    await persistFailed([]);
  },

  syncQueue: async (apiInstance) => {
    const { queue, syncing } = get();
    if (syncing || queue.length === 0) return;

    set({ syncing: true });
    const newFailedIds = [...get().failedIds];

    for (const order of queue) {
      if (newFailedIds.includes(order.id)) continue;
      try {
        await apiInstance.post('/sales', order.payload);
        await get().removeFromQueue(order.id);
      } catch (err) {
        if (!err.response) break; // network down — stop, keep order for next sync
        // server rejected (4xx/5xx) — mark as failed, do NOT delete
        if (!newFailedIds.includes(order.id)) {
          newFailedIds.push(order.id);
        }
      }
    }

    set({ syncing: false, failedIds: newFailedIds });
    await persistFailed(newFailedIds);
  },

  get pendingCount() {
    return get().queue.length;
  },

  get failedCount() {
    return get().failedIds.length;
  },
}));

export default useOfflineQueue;
