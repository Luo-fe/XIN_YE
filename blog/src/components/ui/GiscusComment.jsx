import { useEffect, useRef } from 'react'
import { MessageSquare } from 'lucide-react'

/**
 * Giscus 评论（GitHub Discussions 驱动，静态站可用的评论方案，方案 B 5.3）
 *
 * 启用方式：在 blog/public/site-config.json 里填入 giscus.app 向导生成的配置：
 *   "giscus": {
 *     "repo": "Luo-fe/XIN_YE",
 *     "repoId": "...",
 *     "category": "Announcements",
 *     "categoryId": "...",
 *     "mapping": "pathname",
 *     "theme": "preferred_color_scheme"
 *   }
 * 未配置时评论自动回退本地模式（仅本地 admin 可用）。
 *
 * 前提：仓库已开启 Discussions 且已安装 giscus GitHub App（见 docs/Giscus接入.md）
 */
export default function GiscusComment({ config, title = '评论' }) {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!config?.repo || !containerRef.current) return
    const script = document.createElement('script')
    script.src = 'https://giscus.app/client.js'
    script.async = true
    script.crossOrigin = 'anonymous'
    const attrs = {
      'data-repo': config.repo,
      'data-repo-id': config.repoId || '',
      'data-category': config.category || '',
      'data-category-id': config.categoryId || '',
      'data-mapping': config.mapping || 'pathname',
      'data-strict': '0',
      'data-reactions-enabled': '1',
      'data-emit-metadata': '0',
      'data-input-position': 'top',
      'data-theme': config.theme || 'preferred_color_scheme',
      'data-lang': 'zh-CN',
    }
    for (const [k, v] of Object.entries(attrs)) {
      if (v) script.setAttribute(k, v)
    }
    containerRef.current.innerHTML = ''
    containerRef.current.appendChild(script)
    return () => {
      if (containerRef.current) containerRef.current.innerHTML = ''
    }
  }, [config])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">{title}</h3>
      </div>
      <div ref={containerRef} className="giscus" />
    </div>
  )
}
