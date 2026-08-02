# 百度网盘原图代理 Worker（B2 大图查看）

GitHub Pages 静态站上，点击照片"查看原图"时浏览器无法直连百度网盘
（`d.pcs.baidu.com` 有 CORS 限制）。本 Worker 在 Cloudflare 免费额度内代理原图，
同时自动维护网盘 access_token（30 天自动刷新，无需人工干预）。

## 部署（约 10 分钟，一次性）

### 1. 注册 Cloudflare（免费）
- https://dash.cloudflare.com/sign-up 注册 → 控制台

### 2. 创建 Worker + KV
- 左侧 **Workers 和 Pages → 创建 → Worker** → 名称 `baidu-image-proxy` → 部署
- 左侧 **Workers 和 Pages → KV** → 创建命名空间 → 名称 `baidu-token-kv`
- 回到 Worker → **设置 → 绑定 → 添加绑定**：变量名 `KV`，选择 `baidu-token-kv`

### 3. 写入 Worker 代码
- Worker → **编辑代码** → 全选删除 → 粘贴 `worker.js` 的内容 → 保存并部署

### 4. 配置环境变量
- Worker → **设置 → 变量** → 添加 4 个：
  | 变量名 | 值（从百度开放平台获取） |
  |---|---|
  | `BAIDU_APP_KEY` | 百度应用 API Key |
  | `BAIDU_SECRET_KEY` | 百度应用 Secret Key |
  | `BAIDU_REFRESH_TOKEN` | 见下方"获取 refresh_token" |
- 其中 refresh_token 可留空：Worker 第一次请求时若 KV 无 token 会报错，
  之后每次自动刷新并存 KV（KV 里的 refresh_token 优先）。

### 5. 获取 refresh_token（若上一步留空）
本机 admin 的 `admin/.baidu-token.json` 里就有 `refresh_token` 字段，
填入即可（或等首次报错后手动换一次）。

### 6. 接入网站
- GitHub 仓库 → Settings → **Secrets and variables → Actions → New repository secret**
- Name: `VITE_BAIDU_PROXY`，Value: 你 Worker 的地址（如 `https://baidu-image-proxy.xxx.workers.dev`）
- 下一次 push 构建时前端自动启用"原图"按钮（大图走代理拉取网盘原图）

## 验证
浏览器打开：
```
https://<你的-worker域名>/img?path=%2F%E5%B0%8F%E6%98%95%E6%98%95%E2%9D%A4%EF%B8%8F%E5%B0%8F%E5%8F%B6%E5%8F%B6%2F2026%2F%E7%85%A7%E7%89%87%E5%A2%99%2Fdemo.jpg
```
（path 为网盘内完整路径的 URL 编码）返回图片字节即成功。

## 说明与限制
- Cloudflare 免费版：10 万次请求/天，足够个人站使用
- 图片 30 天强缓存（URL 不变内容不变）
- 网盘目录/文件被移动后链接失效 → 重新上传时更新 manifest 的 baiduPath 即可
