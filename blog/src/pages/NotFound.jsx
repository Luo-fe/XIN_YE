import { useNavigate } from 'react-router-dom'
import { Compass, Home } from 'lucide-react'
import { GlassCard, GlassButton } from '../components/ui'

// 404 页面
export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="mx-auto flex max-w-2xl items-center justify-center">
      <GlassCard className="flex flex-col items-center gap-4 p-12 text-center">
        <Compass className="h-12 w-12 text-primary" />
        <h1 className="gradient-text text-6xl font-black">404</h1>
        <p className="text-slate-600 dark:text-slate-300">
          哎呀，这片极光里好像没有你要找的页面。
        </p>
        <GlassButton variant="primary" onClick={() => navigate('/')}>
          <Home className="h-4 w-4" /> 返回首页
        </GlassButton>
      </GlassCard>
    </div>
  )
}
