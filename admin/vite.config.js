import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { adminServerPlugin } from './server-plugin.js'

// https://vite.dev/config/
// admin 仅本地运行，无需配置 base
export default defineConfig({
  plugins: [react(), adminServerPlugin()],
  server: {
    host: true,
    port: 5174,
    proxy: {
      // 博客静态资源（主页图/背景/默认图）：admin 端预览时转发到 blog dev server。
      // 这些文件实际在 blog/public 下，admin 自身没有该目录，直接请求会 404
      '/photos': {
        target: 'http://localhost:5173',
        changeOrigin: true,
      },
      '/backgrounds': {
        target: 'http://localhost:5173',
        changeOrigin: true,
      },
      // 日记封面相关静态资源：上传的封面（blog/public/diary-covers）、
      // 照片墙缩略图（blog/public/photo-thumbs）、原图（dev 由 blog 中间件服务）
      '/diary-covers': {
        target: 'http://localhost:5173',
        changeOrigin: true,
      },
      '/photo-thumbs': {
        target: 'http://localhost:5173',
        changeOrigin: true,
      },
      '/local-photo': {
        target: 'http://localhost:5173',
        changeOrigin: true,
      },
      // 顺序敏感：更长的前缀必须放在 /baidu 之前，避免被 /baidu 抢先匹配
      // OAuth 授权/ token 接口
      '/baidu-oauth': {
        target: 'https://openapi.baidu.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/baidu-oauth/, ''),
      },
      // PCS 分片上传 superfile2
      '/baidu-pcs': {
        target: 'https://d.pcs.baidu.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/baidu-pcs/, ''),
      },
      // xpan 业务接口 + share（兜底前缀，放最后）
      '/baidu': {
        target: 'https://pan.baidu.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/baidu/, ''),
      },
    },
  },
})
