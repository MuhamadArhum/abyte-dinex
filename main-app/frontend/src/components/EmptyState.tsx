import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  iconColor?: string;
}

const EmptyState = ({ icon: Icon, title, description, action, iconColor = 'text-gray-300' }: EmptyStateProps) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
    className="flex flex-col items-center justify-center py-16 px-4 text-center"
  >
    <motion.div
      initial={{ scale: 0.8 }}
      animate={{ scale: 1 }}
      transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
      className="w-16 h-16 rounded-2xl bg-gray-50 border-2 border-gray-100 flex items-center justify-center mb-4"
    >
      <Icon size={28} className={iconColor} />
    </motion.div>
    <p className="text-gray-700 font-semibold text-base mb-1">{title}</p>
    {description && <p className="text-gray-400 text-sm max-w-xs">{description}</p>}
    {action && (
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={action.onClick}
        className="mt-4 px-4 py-2 bg-emerald-600 text-white text-sm rounded-xl font-medium hover:bg-emerald-700 transition"
      >
        {action.label}
      </motion.button>
    )}
  </motion.div>
);

export default EmptyState;
