import { useCallback, useEffect, useState } from 'react'

/**
 * 评论数据 Hook
 * @param {string} targetType  目标类型：diary/moment/mood/anniversary/timeline/photo/chat
 * @param {string} targetId    目标 ID（slug/id 等）
 * @returns {{ comments, loading, addComment, deleteComment, reload }}
 */
export function useComments(targetType, targetId) {
  const key = `${targetType}:${targetId}`
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    if (!targetType || !targetId) return
    setLoading(true)
    try {
      const resp = await fetch(`/api/comments?key=${encodeURIComponent(key)}`)
      const json = await resp.json()
      setComments(json.data || [])
    } catch {
      setComments([])
    } finally {
      setLoading(false)
    }
  }, [key, targetType, targetId])

  useEffect(() => {
    reload()
  }, [reload])

  const addComment = useCallback(
    async ({ author, text, images }) => {
      const resp = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, author, text, images }),
      })
      const json = await resp.json()
      if (json.data) {
        setComments((prev) => [...prev, json.data])
        return json.data
      }
      throw new Error(json.error || '评论失败')
    },
    [key],
  )

  const deleteComment = useCallback(
    async (id) => {
      const resp = await fetch(
        `/api/comments/${encodeURIComponent(id)}?key=${encodeURIComponent(key)}`,
        { method: 'DELETE' },
      )
      const json = await resp.json()
      if (json.ok) {
        setComments((prev) => prev.filter((c) => c.id !== id))
      }
      return json.ok
    },
    [key],
  )

  return { comments, loading, addComment, deleteComment, reload }
}

/**
 * 上传单张评论图片
 * @param {File} file
 * @returns {Promise<string>} 图片路径如 "comments/xxx.jpg"
 */
export async function uploadCommentImage(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
  const resp = await fetch('/api/comment-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataUrl }),
  })
  const json = await resp.json()
  if (json.data && json.data.path) return json.data.path
  throw new Error('图片上传失败')
}

// 身份记忆（localStorage）
const IDENTITY_KEY = 'comment-identity'

export function getIdentity() {
  try {
    return localStorage.getItem(IDENTITY_KEY) || '小叶叶'
  } catch {
    return '小叶叶'
  }
}

export function setIdentity(name) {
  try {
    localStorage.setItem(IDENTITY_KEY, name)
  } catch {
    /* ignore */
  }
}
