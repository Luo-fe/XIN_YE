import { useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'

// 页面过渡：淡入 + 轻微上移，以 location.pathname 为 key 触发动画
// 注：外层无 AnimatePresence，exit 永不执行，仅保留入场动画
export default function PageTransition({ children }) {
  const location = useLocation()
  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
