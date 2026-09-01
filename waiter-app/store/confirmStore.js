import { create } from 'zustand';

const useConfirmStore = create((set) => ({
  visible: false,
  title: '',
  message: '',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  confirmColor: null,
  onConfirm: null,

  show: ({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', confirmColor = null, onConfirm }) =>
    set({ visible: true, title, message, confirmText, cancelText, confirmColor, onConfirm }),

  hide: () => set({ visible: false, onConfirm: null }),
}));

export default useConfirmStore;
