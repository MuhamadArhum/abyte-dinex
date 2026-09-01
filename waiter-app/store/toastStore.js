import { create } from 'zustand';

const useToastStore = create((set) => ({
  visible: false,
  message: '',
  type: 'info',
  showToast: (message, type = 'info') => set({ visible: true, message, type }),
  hideToast: () => set({ visible: false }),
}));

export default useToastStore;
