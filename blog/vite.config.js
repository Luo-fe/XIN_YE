import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFile } from 'node:fs/promises'
import { join, normalize } from 'node:path'

// 本地照片源目录（流年四季）：dev 下通过 /local-photo/* 中间件按需返回原图
const LOCAL_PHOTOS_DIR = 'f:/图片/照片'

// 本地照片原图服务插件：GET /local-photo/<相对路径> → 透传 f:\图片\照片 下的文件字节
// 用于流年四季照片墙点击加载原图（缩略图已在 /photo-thumbs/ 下）。
// 仅 dev 生效；生产部署时无此服务，前端会回退到缩略图。
function localPhotoPlugin() {
  return {
    name: 'local-photo-serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0]
        // 缩略图按 id 命名，内容在一天内稳定：给长缓存，避免翻页/切月时浏览器逐张重新校验
        // （sirv 静态服务会保留已设置的 Cache-Control，不会覆盖为 no-cache）
        if (url.startsWith('/photo-thumbs/')) {
          res.setHeader('Cache-Control', 'public, max-age=86400')
          return next()
        }
        if (!url.startsWith('/local-photo/')) return next()
        const rel = decodeURIComponent(url.slice('/local-photo/'.length))
        // 防止路径穿越：归一化后必须仍是相对路径
        const safe = normalize(rel).replace(/^([/\\])+/, '')
        if (safe.includes('..')) {
          res.statusCode = 400
          res.end('bad path')
          return
        }
        const abs = join(LOCAL_PHOTOS_DIR, safe)
        readFile(abs)
          .then((buf) => {
            const ext = safe.split('.').pop().toLowerCase()
            const ct =
              ext === 'png'
                ? 'image/png'
                : ext === 'webp'
                  ? 'image/webp'
                  : ext === 'gif'
                    ? 'image/gif'
                    : 'image/jpeg'
            res.setHeader('Content-Type', ct)
            res.setHeader('Cache-Control', 'public, max-age=86400')
            res.end(buf)
          })
          .catch(() => {
            res.statusCode = 404
            res.end('not found')
          })
      })
    },
  }
}

// https://vite.dev/config/
// 部署到 GitHub Pages 时，通过环境变量 VITE_BASE_PATH 注入仓库子路径
// 本地开发默认 '/'，CI 部署时设置为 '/<repo-name>/'
export default defineConfig({
  // base 路径：本地开发用 '/'，GitHub Pages 部署时由 CI 注入 '/<repo-name>/'
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), localPhotoPlugin()],
  server: {
    host: true,
    // 代理 admin dev server 的 API，避免浏览器跨域 ORB 拦截（图片/音频字节流）
    // 部署到 GitHub Pages 时无此代理，usePhotos 会自动回退到本地 manifest
    proxy: {
      '/api/baidu': {
        target: process.env.ADMIN_URL || 'http://localhost:5174',
        changeOrigin: true,
      },
      '/api/netease': {
        target: process.env.ADMIN_URL || 'http://localhost:5174',
        changeOrigin: true,
      },
      '/api/content': {
        target: process.env.ADMIN_URL || 'http://localhost:5174',
        changeOrigin: true,
      },
      '/api/comments': {
        target: process.env.ADMIN_URL || 'http://localhost:5174',
        changeOrigin: true,
      },
      '/api/comment-image': {
        target: process.env.ADMIN_URL || 'http://localhost:5174',
        changeOrigin: true,
      },
      '/api/diary-cover': {
        target: process.env.ADMIN_URL || 'http://localhost:5174',
        changeOrigin: true,
      },
      '/api/diary-covers': {
        target: process.env.ADMIN_URL || 'http://localhost:5174',
        changeOrigin: true,
      },
      '/api/diary-photo-cover': {
        target: process.env.ADMIN_URL || 'http://localhost:5174',
        changeOrigin: true,
      },
      '/api/diary-cover-area': {
        target: process.env.ADMIN_URL || 'http://localhost:5174',
        changeOrigin: true,
      },
    },
  },
  // echarts 等依赖体积较大，提高警告阈值避免构建噪音
  chunkSizeWarningLimit: 1500,
  build: {
    rollupOptions: {
      // 手动拆包：重依赖各自成 chunk，随路由懒加载按需下载，避免全部挤进首包
      // （Vite 8 / rolldown 要求 manualChunks 为函数形式）
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/echarts')) return 'echarts'
          if (id.includes('node_modules/aplayer')) return 'aplayer'
          if (
            id.includes('react-markdown') ||
            id.includes('remark-gfm') ||
            id.includes('rehype-highlight') ||
            id.includes('highlight.js')
          ) {
            return 'markdown'
          }
          if (id.includes('node_modules/framer-motion')) return 'framer'
          if (
            id.includes('node_modules/react') ||
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/react-router')
          ) {
            return 'vendor'
          }
        },
      },
    },
  },
})

