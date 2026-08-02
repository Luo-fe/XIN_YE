import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare,
  Send,
  Trash2,
  ImagePlus,
  X,
  Smile,
  Loader2,
  MessageCircle,
} from 'lucide-react'
import { GlassCard, toast } from '.'
import {
  useComments,
  uploadCommentImage,
  getIdentity,
  setIdentity,
} from '../../hooks/useComments'
import { getAuthorStyle, timeAgo } from '../../utils/content'

// 常用表情
const EMOJIS = [
  '😀', '😂', '🥰', '😍', '😘', '🤗', '😊', '😇',
  '🥺', '😢', '😭', '😅', '🤣', '😔', '😌', '😴',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
  '💕', '💖', '💝', '💘', '💗', '💓', '💟', '❣️',
  '🌹', '🌸', '🌺', '🌻', '🌷', '💐', '🍭', '🍬',
  '🎉', '🎊', '✨', '⭐', '🌟', '💫', '🔥', '🌈',
  '👍', '👏', '🙏', '💪', '🙌', '🤝', '👋', '✌️',
  '💋', '👄', '👀', '🙈', '🐰', '🐻', '🐱', '🐶',
]

/**
 * 评论区块组件
 * @param {string} targetType  目标类型
 * @param {string} targetId    目标 ID
 * @param {string} [title]     可选标题
 */
export default function CommentSection({ targetType, targetId, title = '评论' }) {
  const { comments, loading, addComment, deleteComment } = useComments(targetType, targetId)
  const [identity, setIdentityState] = useState(getIdentity())
  const [text, setText] = useState('')
  const [images, setImages] = useState([]) // 已上传的图片路径数组
  const [pendingFiles, setPendingFiles] = useState([]) // 待上传的 File 对象
  const [uploading, setUploading] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef(null)

  const switchIdentity = (name) => {
    setIdentityState(name)
    setIdentity(name)
  }

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    const remaining = 9 - pendingFiles.length
    const toAdd = files.slice(0, remaining)
    setPendingFiles((prev) => [...prev, ...toAdd])
    e.target.value = ''
  }

  const removePendingFile = (idx) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async () => {
    const trimmed = text.trim()
    if (!trimmed && pendingFiles.length === 0) {
      toast.info('说点什么吧~')
      return
    }
    setSubmitting(true)
    setUploading(true)
    try {
      // 上传图片
      const uploadedPaths = []
      for (const file of pendingFiles) {
        const path = await uploadCommentImage(file)
        uploadedPaths.push(path)
      }
      setUploading(false)

      await addComment({ author: identity, text: trimmed, images: uploadedPaths })
      setText('')
      setImages([])
      setPendingFiles([])
      toast.success('评论成功')
    } catch (err) {
      toast.error(err.message || '评论失败')
    } finally {
      setSubmitting(false)
      setUploading(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('确定删除这条评论吗？')) return
    const ok = await deleteComment(id)
    if (ok) toast.success('已删除')
    else toast.error('删除失败')
  }

  const insertEmoji = (emoji) => {
    setText((prev) => prev + emoji)
    setShowEmoji(false)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* 标题 */}
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
          {title}
        </h3>
        <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          {comments.length}
        </span>
      </div>

      {/* 身份切换 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 dark:text-slate-400">我是：</span>
        <div className="flex rounded-lg border border-white/50 bg-white/50 p-1 dark:border-white/10 dark:bg-white/5">
          {['小叶叶', '小昕昕'].map((name) => {
            const active = identity === name
            const style = getAuthorStyle(name)
            return (
              <button
                key={name}
                onClick={() => switchIdentity(name)}
                className={`rounded-md px-3 py-1 text-xs font-bold transition-all ${
                  active
                    ? `bg-gradient-to-tr ${style.gradient} text-white shadow-sm`
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                }`}
              >
                {name}
              </button>
            )
          })}
        </div>
      </div>

      {/* 输入区 */}
      <div className="relative rounded-2xl border border-white/40 bg-white/40 p-3 backdrop-blur-md dark:border-white/10 dark:bg-white/5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="写下想说的话..."
          rows={2}
          className="w-full resize-none bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none dark:text-slate-100"
        />

        {/* 待上传图片预览 */}
        {pendingFiles.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {pendingFiles.map((file, idx) => (
              <div
                key={idx}
                className="relative h-16 w-16 overflow-hidden rounded-lg border border-white/40 dark:border-white/10"
              >
                <img
                  src={URL.createObjectURL(file)}
                  alt=""
                  className="h-full w-full object-cover"
                />
                <button
                  onClick={() => removePendingFile(idx)}
                  className="absolute right-0 top-0 grid h-5 w-5 place-items-center bg-black/50 text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 工具栏 */}
        <div className="mt-2 flex items-center justify-between border-t border-slate-200/50 pt-2 dark:border-slate-700/50">
          <div className="flex items-center gap-1.5">
            {/* 表情按钮 */}
            <div className="relative">
              <button
                onClick={() => setShowEmoji((v) => !v)}
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-white/50 hover:text-primary dark:text-slate-400 dark:hover:bg-white/10"
                title="表情"
              >
                <Smile className="h-4 w-4" />
              </button>
              <AnimatePresence>
                {showEmoji && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowEmoji(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="absolute bottom-10 left-0 z-50 grid w-72 grid-cols-8 gap-1 rounded-2xl border border-white/40 bg-white/90 p-2 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-800/90"
                    >
                      {EMOJIS.map((e, i) => (
                        <button
                          key={i}
                          onClick={() => insertEmoji(e)}
                          className="grid h-8 w-8 place-items-center rounded-lg text-lg transition-colors hover:bg-primary/10"
                        >
                          {e}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* 图片上传按钮 */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={pendingFiles.length >= 9}
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-white/50 hover:text-primary disabled:opacity-40 dark:text-slate-400 dark:hover:bg-white/10"
              title="图片"
            >
              <ImagePlus className="h-4 w-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* 发送按钮 */}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-tr from-primary to-primary-lighter px-4 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:shadow-md disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {uploading ? '上传图片中...' : '发送'}
          </button>
        </div>
      </div>

      {/* 评论列表 */}
      <div className="flex flex-col gap-2">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> 加载中...
          </div>
        )}
        {!loading && comments.length === 0 && (
          <div className="flex flex-col items-center gap-1.5 py-6 text-center">
            <MessageCircle className="h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="text-xs text-slate-400">还没有评论，快来抢沙发~</p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {comments.map((c) => {
            const style = getAuthorStyle(c.author)
            return (
              <motion.div
                key={c.id}
                className="group"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
              >
                <GlassCard className="p-3">
                  <div className="flex items-start gap-2.5">
                    {/* 头像 */}
                    <div
                      className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg bg-gradient-to-tr ${style.gradient} text-xs font-black text-white`}
                    >
                      {c.author === '小昕昕' ? '昕' : '叶'}
                    </div>
                    <div className="min-w-0 flex-1">
                      {/* 名称 + 时间 */}
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${style.text}`}>
                          {c.author}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {timeAgo(c.createdAt)}
                        </span>
                      </div>
                      {/* 文本 */}
                      {c.text && (
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                          {c.text}
                        </p>
                      )}
                      {/* 图片 */}
                      {c.images && c.images.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {c.images.map((img, i) => (
                            <a
                              key={i}
                              href={img.startsWith('/') ? img : `/${img}`}
                              target="_blank"
                              rel="noreferrer"
                              className="block h-20 w-20 overflow-hidden rounded-lg border border-white/40 dark:border-white/10"
                            >
                              <img
                                src={img.startsWith('/') ? img : `/${img}`}
                                alt=""
                                className="h-full w-full object-cover transition-transform hover:scale-105"
                                loading="lazy"
                              />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* 删除按钮 */}
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="grid h-6 w-6 flex-shrink-0 place-items-center rounded text-slate-300 opacity-0 transition-all hover:bg-rose-500/10 hover:text-rose-500 group-hover:opacity-100"
                      title="删除"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </GlassCard>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
