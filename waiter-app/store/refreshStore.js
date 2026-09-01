import { create } from 'zustand';

const useRefreshStore = create((set) => ({
  refreshing: false,
  startRefresh: () => set({ refreshing: true }),
  endRefresh: () => set({ refreshing: false }),
}));

export default useRefreshStore;
