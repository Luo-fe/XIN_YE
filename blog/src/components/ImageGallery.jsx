import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { assetUrl } from '../utils/assetUrl'

/**
 * 图片画廊：九宫格展示 + 点击放大灯箱
 * 用于心情卡片、碎碎念卡片等多图场景
 * @param {string[]} images - 图片地址数组（最多展示 9 张，超出显示 +N）
 */
export default function ImageGallery({ images }) {
  const [lightbox, setLightbox] = useState(null) // { index }

  if (!images || images.length === 0) return null
  const count = images.length
  const urls = images.map(assetUrl)

  const next = (e) => {
    e.stopPropagation()
    setLightbox((s) => (s ? { index: (s.index + 1) % count } : s))
  }
  const prev = (e) => {
    e.stopPropagation()
    setLightbox((s) => (s ? { index: (s.index - 1 + count) % count } : s))
  }

  return (
    <>
      {/* 单图：大图展示 */}
      {count === 1 ? (
        <div className="mt-3">
          <button
            onClick={() => setLightbox({ index: 0 })}
            className="block w-full overflow-hidden rounded-xl"
          >
            <img
              src={urls[0]}
              alt="配图"
              loading="lazy"
              className="max-h-64 w-full object-cover transition-transform duration-500 hover:scale-105"
            />
          </button>
        </div>
      ) : (
        <div
          className="mt-3 grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${count <= 4 ? 2 : 3}, 1fr)` }}
        >
          {images.slice(0, 9).map((src, idx) => {
            const isLast = idx === 8 && count > 9
            return (
              <button
                key={idx}
                onClick={() => setLightbox({ index: idx })}
                className="group relative aspect-square overflow-hidden rounded-lg"
              >
                <img
                  src={urls[idx]}
                  alt="配图"
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                {isLast && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-lg font-bold text-white backdrop-blur-sm">
                    +{count - 9}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* 灯箱 */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-xl"
          >
            <button
              onClick={() => setLightbox(null)}
              className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>
            {count > 1 && (
              <>
                <button
                  onClick={prev}
                  className="absolute left-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={next}
                  className="absolute right-4 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
            <motion.img
              key={lightbox.index}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              src={urls[lightbox.index]}
              alt="预览"
              className="max-h-[85vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
            />
            {count > 1 && (
              <div className="absolute bottom-6 rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium tracking-widest text-white">
                {lightbox.index + 1} / {count}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
