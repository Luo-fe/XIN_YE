# 方案 B：原图进百度网盘 + GitHub Pages 静态部署

> 目标：网站"上线"到 GitHub Pages，任何人通过链接访问；原图（大图）全部存放百度网盘，本机 64GB 磁盘不再存放全量照片。本地 admin 保留为唯一的写作/管理后台。

---

## 1. 现状与问题

整个网站目前完全依赖本地电脑：

- **原图 64GB / 12,000+ 张**存放在 `f:\图片\照片`，由 dev 中间件 `/local-photo/` 按需读取
- **admin**（Vite dev 插件）承担全部写操作：日记、评论、封面取景、站点配置、照片上传、百度网盘/网易云对接
- 数据（manifest / 日记 / 评论 / 配置）是 `blog/src/data/*.json` 与 `blog/public/` 下的文件，只存在于本机

所以网站在线 = 电脑开机 + dev 服务运行。要真正"部署上线"，必须把可静态化的数据抽出来推给 GitHub，把原图交给网盘。

## 2. 数据分层（2026-08-02 实测）

| 数据 | 大小 | 归属 |
|---|---|---|
| 缩略图（400px webp，5,588 张） | ≈145MB | GitHub 仓库 ✅ |
| 照片 manifest JSON | 2.9MB | GitHub 仓库 ✅ |
| 文本数据（日记/评论/纪念日/配置） | 3.9MB | GitHub 仓库 ✅ |
| 背景图 + 封面图 | 23MB | GitHub 仓库 ✅ |
| **原图（5,588 张，本机）** | **约 40GB** | **百度网盘（本机不留）** |

仓库总规模 ≈ **180MB**，远低于 GitHub 建议的 1GB，推拉顺畅。

> 注：2026-08-02 已同步网页端删除操作，从 `f:\图片\照片` 删除了 6,477 张原图（回收站可恢复），并清掉 684 个孤儿缩略图，manifest/缩略图/磁盘三者一致。

## 3. 目标架构

```
┌─────────────────┐   push    ┌────────────────────────────┐   HTTPS    ┌────────────┐
│ 本机 admin 后台  │ ────────► │ GitHub 仓库 couple-blog     │ ─────────► │ GitHub     │
│ 唯一写作入口      │           │ ├─ blog/public（缩略图等）   │            │ Pages 静态站 │
│ （不上线）        │           │ ├─ blog/src/data（JSON 数据）│            │（只读展示）  │
└─────────────────┘           │ └─ .github/workflows/deploy │            └─────┬──────┘
                              └────────────────────────────┘                  │ 大图
┌─────────────────┐              ┌──────────────────────────┐                ▼
│ 百度网盘（原图）   │ ◄──────────► │ （可选）Cloudflare Worker │ ◄──── 点击原图/网盘相册
│ /apps/芋泥椰奶/   │              │ 代理 d.pcs.baidu.com     │
└─────────────────┘              └──────────────────────────┘
```

**访客看到**：完整网站（日记、照片墙、回忆、音乐……），照片墙显示清晰的 400px 缩略图；点击"查看原图"走网盘（B2 方案为页内大图，B1 为跳网盘）。

**本机保留**：admin 管理后台 + 原图暂存目录（仅写作期间），每次更新内容后 `git push`，GitHub Actions 自动重新构建上线（约 2 分钟）。

## 4. 已经具备的条件（不用改）

| 已就绪 | 位置 |
|---|---|
| 子路径构建支持（`VITE_BASE_PATH`） | [blog/vite.config.js](../blog/vite.config.js) |
| GitHub Pages SPA 404 转发 | [blog/public/404.html](../blog/public/404.html) |
| 完整构建部署 workflow（push 自动触发） | [.github/workflows/deploy.yml](../.github/workflows/deploy.yml) |
| 无 admin 时照片墙自动回退本地 manifest（缩略图照常显示） | [blog/src/hooks/usePhotos.js](../blog/src/hooks/usePhotos.js) |
| 百度网盘 OAuth（扫码登录）+ 相册列表/照片 API | [admin/server-plugin.js](../admin/server-plugin.js) |
| 网站"网盘相册"浏览入口 | [blog/src/hooks/usePhotos.js](../blog/src/hooks/usePhotos.js) 349 行起 |

## 5. 需要新增的 4 件事（按顺序做）

### 5.1 原图上传到百度网盘（一次性，工作量：中）

- 在 admin 百度面板新增"本地照片上传到 `/apps/芋泥椰奶/照片墙/`"功能（分片上传，参考百度官方 API）
- 上传时保持相对路径结构（`2026/平遥/xxx.jpg`），manifest 每条记录增加 `baiduPath` 字段
- 上传完成后，`f:\图片\照片` 可整体移入回收站/外置盘，本机只留 manifest 指向网盘

### 5.2 静态站的"原图查看"降级（工作量：小）

- 现状：点击照片 → `/local-photo/<path>`（仅本机 dev 有）；线上会 404 并被 404.html 脚本重定向
- **B1（简单，先上线）**：点击原图 → 打开百度网盘分享页/网盘 App 对应目录
- **B2（体验好，后补）**：把 admin 里"百度图床 CORS 代理"逻辑复制成一个 **Cloudflare Worker**（免费额度足够），页面内直接看大图；需要 Worker 内做 token 刷新（网盘 token 30 天有效，Worker 可配置定时刷新或每次请求时用 refresh_token 换）

### 5.3 评论换成 Giscus（工作量：小）

- 现有评论存本地 `comments.json`，静态站上无法写入
- GitHub 仓库开启 **Discussions** → 安装 [giscus](https://giscus.app) → 按向导生成 `<script>`，嵌入博客评论组件，评论数据存在仓库 Discussions 里（免费、无需服务器、可与 GitHub 账号关联）
- 旧的本地评论可一次性导入为 Discussion 帖子（可选）

### 5.4 内容更新流程固化（工作量：小）

写一个 `sync-and-publish.bat`，一键完成：
1. 新增/删除照片后：`node scripts/analyze-photos.mjs`（生成缩略图 + manifest）
2. `git add -A && git commit`
3. `git push`（触发 Actions 自动部署）

## 6. 部署后的日常操作对照

| 操作 | 现在 | 部署后 |
|---|---|---|
| 写日记/改配置/换背景 | admin 页面 | 同样在 admin（本机），改完 push |
| 新增照片 | 拖进文件夹 → analyze | 拖进文件夹 → analyze → 传网盘 → push |
| 删除照片 | 网页删除 | 网页删除 + 删本机原图 + 删网盘 + push |
| 访客评论 | 页面直接写 | Giscus（GitHub 账号） |
| 访客看原图 | 本地直接加载 | 网盘（B1 跳转 / B2 页内大图） |

## 7. 风险与限制（明确告知）

1. **静态站只读**：访客无法管理照片/日记；所有写操作必须走本机 admin
2. **缩略图仅 400px 宽**：页面缩略展示足够清晰；全屏大图质量取决于网盘原图链路
3. **百度 API 频率限制**：相册列表有缓存（30 分钟），原图代理需控制并发
4. **GitHub 仓库建议 <1GB**：当前 180MB 安全；照片继续增长后需定期把旧缩略图搬到网盘或清理
5. **隐私**：建议仓库设为**私有**（Pages 仍可公开访问）；若要完全私密访问需付费方案，不在本方案范围
6. **网盘 token 过期**：B2 的 Worker 必须做自动刷新，否则大图失效（B1 无此问题）

## 8. 待办清单（2026-08-03 更新）

### ✅ 已完成
- 网站已部署上线：https://luo-fe.github.io/XIN_YE/（GitHub Actions 自动构建）
- 修复线上全站图片 404：12 处图片引用统一补 `BASE_URL`（`src/utils/assetUrl.js`），
  背景 / 日记封面 / 照片墙缩略图线上恢复正常；`coupleHero` 修正为仓库内图片
- 百度网盘批量上传脚本：`scripts/upload-to-baidu.mjs`
  （分片上传 + 断点续传 + 失败重试 + 完成后自动给 manifest 写 `baiduPath`）
- 一键发布脚本：`sync-and-publish.bat`（分析照片 → commit → push）
- Giscus 评论组件（双模式，配置后自动启用）：`blog/src/components/ui/GiscusComment.jsx`
- 网盘原图代理 Cloudflare Worker 代码 + 部署文档：`docs/baidu-image-proxy/`
- 大图查看前端支持：manifest 带 `baiduPath` 且配置 `VITE_BAIDU_PROXY` 后，
  照片墙点击大图自动走网盘原图

### ⏳ 待执行（我执行或你手动）
- [ ] `git add -A && git commit && git push`（base 修复上线，触发自动构建）
- [ ] 运行 `node scripts/upload-to-baidu.mjs` 上传原图到网盘（5,588 张 ≈ 40GB，跑数小时；
      断点续传，中断后重跑即可；完成后自动更新 manifest）

### 📋 需要你手动（约 10 分钟）
- [ ] 仓库 **Settings → Discussions** 开启 + 安装 giscus App + giscus.app 生成代码
      （详见 `docs/Giscus接入.md`，只需填 4 个值到 site-config.json 再 push）
- [ ] 注册 Cloudflare → 部署 `docs/baidu-image-proxy/worker.js`
      （详见 `docs/baidu-image-proxy/README.md`，之后大图从网盘拉原图）
- [ ] （可选）确认照片同步删除结果（回收站可恢复）
