import { useEffect, useState } from 'react'

/**
 * 拉取 admin server 端聚合好的网易云歌曲列表（已选歌单合并去重）。
 * 后端响应：{ count, songs: [{ id, name, artist, album, duration, coverUrl, url }] }
 * url 已是 `/api/netease/song-mp3/:id`，需通过 blog vite 代理转给 admin:5174。
 *
 * 未授权或 admin 未启动时返回空列表，播放器不渲染。
 *
 * @returns {{ songs: Array, loading: boolean, source: 'netease' | 'none' }}
 */
export function useNeteaseSongs() {
  const [songs, setSongs] = useState([])
  const [loading, setLoading] = useState(true)
  const [source, setSource] = useState('none')

  useEffect(() => {
    let cancelled = false

    fetch('/api/netease/songs')
      .then((r) => {
        // 未授权（未扫码登录）/ admin 未启动：返回空列表，避免播放器报错
        if (r.status === 401) {
          if (cancelled) return null
          setSongs([])
          setSource('netease')
          setLoading(false)
          return null
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data) => {
        if (cancelled || !data) return
        const list = Array.isArray(data.songs) ? data.songs : []
        setSongs(list)
        setSource('netease')
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setSongs([])
        setSource('none')
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { songs, loading, source }
}

export default useNeteaseSongs
