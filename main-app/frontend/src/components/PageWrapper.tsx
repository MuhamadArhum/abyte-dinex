import { motion } from 'framer-motion';
import { ReactNode } from 'react';

const PageWrapper = ({ children }: { children: ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.25, ease: 'easeOut' }}
    className="flex-1"
  >
    {children}
  </motion.div>
);

export default PageWrapper;
