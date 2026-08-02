import { useEffect, useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import router from './router'
import { loadRuntimeSiteConfig } from './config/site'

// 应用入口：路由已接管布局（极光背景、导航、页脚、Toast 均在 Layout 内初始化）
// 启动时先读取 admin「设置」页保存的站点配置（本地文件，毫秒级），再渲染页面
function App() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    loadRuntimeSiteConfig().finally(() => setReady(true))
  }, [])
  if (!ready) return null
  return <RouterProvider router={router} />
}

export default App
