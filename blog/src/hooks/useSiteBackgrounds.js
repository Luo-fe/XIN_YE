import { useEffect, useState } from 'react'
import { assetUrl } from '../utils/assetUrl'

/**
 * 网站背景 Hook
 *
 * 管理后台维护一个背景列表（site-backgrounds.json）：
 * - 本地照片（照片墙一键设置）
 * - 上传图片 / 外部 URL（后台添加）
 *
 * 每次打开网站（页面挂载）随机抽取一张作为全站背景；
 * 列表为空时回退到默认 /bg.jpg（由 AuroraBackground 处理）。
 *
 * @returns {{ backgroundUrl: string, backgrounds: Array, loading: boolean }}
 */
export function useSiteBackground() {
  const [backgrounds, setBackgrounds] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const base = import.meta.env.BASE_URL || '/'
        const resp = await fetch(`${base}site-backgrounds.json`)
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const data = await resp.json()
        if (cancelled) return
        const list = Array.isArray(data) ? data.filter((b) => b && b.url) : []
        setBackgrounds(list)
      } catch {
        if (!cancelled) setBackgrounds([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // 每次打开随机抽取一张；列表变化（后台增删）时重新抽取
  const backgroundUrl = backgrounds.length > 0
    ? assetUrl(backgrounds[Math.floor(Math.random() * backgrounds.length)].url)
    : ''

  return { backgroundUrl, backgrounds, loading }
}
