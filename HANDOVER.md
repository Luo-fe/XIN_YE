# 芋泥椰奶 项目交接文档

> 本文档供后续 AI Agent 接手开发使用，覆盖架构、技术栈、目录、数据格式、运行与部署等关键信息。
> 项目根目录：`f:\图片\couple-blog`

---

## 1. 项目定位

情侣专属个人博客「芋泥椰奶」，记录两人从 2023-11 起的日记、心情、纪念日、时光轴、碎碎念、照片墙与音乐。

- **Monorepo 结构**：`blog/`（公开前端站点）+ `admin/`（本地管理后台）。
- **部署**：blog 通过 GitHub Actions 自动部署到 GitHub Pages；admin 仅本地运行，不构建生产产物。
- **设计风格**：毛玻璃 + 极光渐变（粉紫主色 `#8B5CF6 → #A78BFA → #C4B5FD`），字体 Noto Serif SC，参考 `XinghuisamaBlogs` 但有创新。

---

## 2. 技术栈

| 类别 | blog | admin |
|---|---|---|
| 构建 | Vite 8 + React 18 | Vite 8 + React 18 |
| 样式 | Tailwind 3（`darkMode: 'class'`） | Tailwind 3 |
| 路由 | react-router-dom 6（createBrowserRouter） | 无路由，状态切换视图 |
| 动效 | framer-motion | framer-motion |
| 图标 | lucide-react | lucide-react |
| Markdown | react-markdown + remark-gfm + rehype-highlight + highlight.js | react-markdown + remark-gfm |
| 可视化 | echarts + echarts-gl（3D 地图） | — |
| 网络 | — | axios |
| EXIF | — | exifr |
| Lint | ESLint 9 (flat config) + Oxlint + Prettier | 同左 |

**代码规范**（根目录 `.prettierrc`）：无分号、单引号、2 空格缩进、es5 尾逗号。

---

## 3. 目录结构

```
couple-blog/
├── .github/workflows/deploy.yml      # GitHub Pages 部署工作流
├── .env.example                       # 百度凭证模板
├── .prettierrc
├── README.md
├── HANDOVER.md                        # 本文档
│
├── blog/                              # 前端公开站点
│   ├── vite.config.js                 # base 由 VITE_BASE_PATH 注入
│   ├── tailwind.config.js             # 极光主题色/动画/字体
│   ├── index.html                     # 引入 Noto Serif SC
│   ├── public/
│   │   ├── photos/                    # 本地照片静态资源（按年份/事件分类）
│   │   │   ├── 2023/early/
│   │   │   ├── 2024/{9-4-afternoon,misc}/
│   │   │   ├── 2025/shandong/
│   │   │   └── 2026/{graduation,jiumu,pingyao}/
│   │   ├── .nojekyll
│   │   ├── 404.html
│   │   ├── favicon.svg
│   │   └── icons.svg
│   ├── scripts/
│   │   ├── add-bom.mjs                # 给 md 文件加 BOM
│   │   ├── copy-photos.ps1            # PowerShell 拷贝照片
│   │   ├── diary-summary.json         # 日记摘要
│   │   ├── gen-manifest.mjs           # 生成 photos-manifest.json
│   │   └── parse-diary.mjs            # 解析 diaries/*.md
│   └── src/
│       ├── App.jsx / main.jsx / index.css
│       ├── config/site.js             # 站点全局配置（名称、导航、歌单、占位图）
│       ├── router/index.jsx           # 11 条路由
│       ├── pages/                     # 11 个页面组件
│       ├── components/
│       │   ├── layout/                # Layout, Navbar, Footer, ProfileCard, PageTransition
│       │   ├── photowall/             # Lightbox, LocationView, Map3DView, PhotoThumb, TimeView
│       │   ├── ui/                    # 17 个 UI 组件 + index.js 桶导出
│       │   ├── FloatingPlayer.jsx     # 悬浮网易云播放器
│       │   ├── ImageGallery.jsx
│       │   └── MoodTrend.jsx
│       ├── data/                      # JSON 数据 + Markdown 日记
│       ├── hooks/                     # useDiaries, usePhotos, useTheme
│       └── utils/markdown.js
│
└── admin/                             # 本地管理后台（端口 5174）
    ├── vite.config.js                 # 注入 adminServerPlugin + 百度 proxy
    ├── server-plugin.js               # 自定义 Vite 插件，提供本地 API
    ├── .env.local                     # 百度凭证（不入库）
    ├── .baidu-token.json              # 百度 token 持久化（不入库）
    └── src/
        ├── App.jsx                    # 状态切换视图（非路由）
        ├── config/navigation.js       # 9 个后台导航项
        ├── api/                       # baiduAuth, baiduConfig, baiduFiles, baiduShare
        ├── components/                # Sidebar, TopBar, Toast, JsonDataEditor
        ├── utils/                     # configStore, diaryParser, exif, fileSystem,
        │                              #   geocode, markdown, photoManifest, thumbnail
        └── views/                     # 9 个管理视图
```

---

## 4. blog 路由表

定义于 [blog/src/router/index.jsx](file:///f:/图片/couple-blog/blog/src/router/index.jsx)，全部由 `Layout` 包裹（极光背景 + 导航 + 页脚 + 悬浮播放器 + 全局工具箱）。

| 路径 | 页面 | 说明 |
|---|---|---|
| `/` | Home | 首页 |
| `/diaries` | DiaryList | 日记列表 |
| `/diaries/:slug` | DiaryDetail | 日记详情（slug = 文件名去 `.md`） |
| `/moods` | Mood | 心情记录 |
| `/anniversaries` | Anniversary | 纪念日 |
| `/timeline` | Timeline | 时光轴（带搜索/排序） |
| `/moments` | Moments | 碎碎念（带搜索/排序） |
| `/photos` | PhotoWall | 照片墙（时间视图 + 地理视图 + 3D 地图） |
| `/music` | Music | 音乐 |
| `/friends` | Friends | 友链 |
| `/about` | About | 关于 |
| `*` | NotFound | 404 |

`basename` 取自 `import.meta.env.BASE_URL`，自动适配本地 `/` 与 GitHub Pages 子路径 `/<repo>/`。

---

## 5. admin 后台模块

定义于 [admin/src/config/navigation.js](file:///f:/图片/couple-blog/admin/src/config/navigation.js)，`App.jsx` 用 `activeKey` 状态切换视图。

| key | 标题 | 视图组件 | 主要职责 |
|---|---|---|---|
| overview | 概览 | OverviewView | 数据总览 |
| diaries | 日记管理 | DiaryManageView | 增删改 Markdown 日记 |
| moods | 心情记录 | MoodManageView | 管理 moods.json |
| anniversaries | 纪念日 | AnniversaryManageView | 管理 anniversaries.json |
| whispers | 碎碎念 | MomentsManageView | 管理 moments.json |
| photos | 照片墙 | PhotoUploadView | 上传照片至百度网盘 + 生成 manifest |
| baidu | 百度网盘 | BaiduView | OAuth 扫码授权 + 网盘浏览 |
| sync | 同步部署 | SyncView | 推送至 GitHub 触发部署 |
| settings | 设置 | SettingsView | 站点配置 |

---

## 6. 数据格式

所有数据存放于 [blog/src/data/](file:///f:/图片/couple-blog/blog/src/data/)，JSON 文件为 UTF-8 数组。

### timeline.json（时光轴大事件）
```json
{ "id": "t1", "date": "2023-11-01", "title": "日记开始记录", "description": "...", "image": "" }
```

### moods.json（心情记录）
```json
{ "id": "m1", "date": "2023-11-06", "mood": "tired", "text": "...", "images": [] }
```
`mood` 枚举：`happy / sad / excited / calm / tired` 等。

### moments.json（碎碎念）
```json
{ "id": "mo1", "datetime": "2023-11-10T23:30:00", "text": "...", "images": [] }
```

### anniversaries.json（纪念日）
```json
{ "id": "a1", "title": "恋爱纪念日", "date": "2023-11-07", "type": "anniversary", "description": "..." }
```
`type` 枚举：`anniversary / birthday / graduation / travel` 等。

### friends.json（友链）
当前为空数组 `[]`，元素结构待定。

### photos-manifest.json（照片清单）
由 [scripts/gen-manifest.mjs](file:///f:/图片/couple-blog/blog/scripts/gen-manifest.mjs) 扫描 `public/photos/` 生成：
```json
{
  "id": "p001",
  "thumbPath": "/photos/2023/early/IMG_20230923_215430.jpg",
  "baiduPath": "",
  "shareLink": "",
  "dateTime": "2023-09-23 21:54:30",
  "timestamp": 1695477270,
  "gps": null,
  "location": { "province": "", "city": "" },
  "camera": {},
  "dimensions": {}
}
```
- `thumbPath`：本地静态资源路径（部署到 GitHub Pages）。
- `baiduPath` / `shareLink`：百度网盘原图路径与分享链接（可选，由 admin 写入）。
- `gps` / `location`：由 EXIF 提取，配合 [Map3DView.jsx](file:///f:/图片/couple-blog/blog/src/components/photowall/Map3DView.jsx) 在中国 3D 地图上标记。
- `camera` / `dimensions`：相机型号与照片尺寸。

### diaries/*.md（日记）
文件名 = `YYYY-MM-DD[-n].md`（同日多篇加 `-2`、`-3` 后缀），slug = 文件名去 `.md`。约 98 篇，时间跨度 2023-11 ~ 2026-07。解析逻辑见 [hooks/useDiaries.js](file:///f:/图片/couple-blog/blog/src/hooks/useDiaries.js) 与 [scripts/parse-diary.mjs](file:///f:/图片/couple-blog/blog/scripts/parse-diary.mjs)。

---

## 7. UI 组件清单

[blog/src/components/ui/index.js](file:///f:/图片/couple-blog/blog/src/components/ui/index.js) 桶导出 17 个组件：

| 组件 | 作用 |
|---|---|
| ThemeProvider | 主题（亮/暗）上下文 |
| AuroraBackground | 极光渐变背景层 |
| DanmakuBackground | 弹幕背景（可关闭） |
| ClickEffect | canvas 点击涟漪（z-[9999]，移动端隐藏） |
| GlobalToolbox | 左下角浮动工具箱（回顶/随机日记/主题切换） |
| SplashScreen | 2.2s 启动闪屏（sessionStorage 记忆） |
| GlassCard / GlassButton / TiltCard | 毛玻璃卡片/按钮/倾斜卡片 |
| Modal | 模态框 |
| Parallax | 视差滚动 |
| ParticleEffect | 粒子特效 |
| Section | 通用区块 |
| Skeleton | 骨架屏 |
| Toast / ToastContainer | 全局通知（用 `toast.info/success/warning`） |
| AnimatedNumber | 数字滚动动画 |

> ⚠️ 历史坑：`GlobalToolbox` 曾误用 `toast(msg, type)`，正确写法是 `toast.info/success/warning`。

---

## 8. 百度网盘集成（admin 核心）

### 凭证配置
[admin/.env.local](file:///f:/图片/couple-blog/admin/.env.local)（不入库，需手动创建）：
```
VITE_BAIDU_APP_KEY=你的AppKey
VITE_BAIDU_SECRET_KEY=你的SecretKey
VITE_BAIDU_APP_NAME=芋泥椰奶
```
模板见 [admin/.env.example](file:///f:/图片/couple-blog/admin/.env.example) 与根目录 [.env.example](file:///f:/图片/couple-blog/.env.example)。
> 历史还配过 `VITE_BAIDU_SIGN_KEY`（签名密钥），当前未使用，保留备用。

### 网盘目录约定
照片源目录：`/小昕昕❤小叶叶`（在 [server-plugin.js](file:///f:/图片/couple-blog/admin/server-plugin.js) 顶部 `PHOTO_SOURCE_DIR` 常量）。

### OAuth 流程
1. admin「百度网盘」页 → 点「获取二维码」→ 调百度 OAuth 授权接口。
2. 用户扫码 → 拿到 `access_token` + `refresh_token`。
3. 前端 POST `/api/baidu/save-token` → 服务端持久化到 [admin/.baidu-token.json](file:///f:/图片/couple-blog/admin/.baidu-token.json)（不入库）。
4. token 过期前 5 分钟自动刷新（`ensureValidToken`）。

### 本地 API（admin/server-plugin.js 提供，仅 dev 生效）
| 接口 | 方法 | 作用 |
|---|---|---|
| `/api/health` | GET | 健康检查 |
| `/api/music/:id` | GET | 网易云音乐代理（解决 ORB 限制，伪装 UA + Referer，非音频返回 404 让前端跳下一首） |
| `/api/baidu/save-token` | POST | 保存百度 token |
| `/api/baidu/status` | GET | 查询授权状态 + 网盘照片目录 |
| `/api/baidu/photos` | GET | 列出网盘照片（递归子目录 + 翻页，单页 1000） |
| `/api/baidu/image/:fsid` | GET | 图片字节代理（dlink 缓存 7h，浏览器缓存 1d） |
| `/api/baidu/debug` | GET | 探测多个候选目录可访问性（排错用） |

### Vite proxy（[admin/vite.config.js](file:///f:/图片/couple-blog/admin/vite.config.js)）
顺序敏感，更长前缀必须在 `/baidu` 之前：
- `/baidu-oauth` → `https://openapi.baidu.com`（OAuth）
- `/baidu-pcs` → `https://d.pcs.baidu.com`（PCS 分片上传 superfile2）
- `/baidu` → `https://pan.baidu.com`（xpan 业务接口 + share 兜底）

### 关键实现细节
- `listPanFiles`：递归遍历子目录，自动翻页（单页 1000），按图片扩展名过滤，安全上限 100000 张。
- `getDlink`：fs_id → dlink 缓存（Map），TTL 7 小时（百度 dlink 8h 过期留 1h 缓冲）。
- 错误处理：`errno=-9`（目录不存在）/`-10`（无权限）跳过该目录而非整体失败。

---

## 9. 站点配置

[blog/src/config/site.js](file:///f:/图片/couple-blog/blog/src/config/site.js) 关键字段：
- `siteName` / `author` / `navTitle`：`芋泥椰奶`
- `bio` / `description`：站点简介
- `nav`：10 项顶部导航（含图标名）
- `social`：github / email 占位
- `startYear`：2024
- `songs`：5 首网易云歌单（外链 `https://music.163.com/song/media/outer/url?id=<id>.mp3`，部分版权受限播放失败自动跳下一首）
  - 晴天 / 云烟成雨 / 告白气球 / 小情歌 / Hello
- 占位图统一走 `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=...&image_size=...`

---

## 10. 主题与样式

[blog/tailwind.config.js](file:///f:/图片/couple-blog/blog/tailwind.config.js)：
- `darkMode: 'class'`
- `colors.primary`：`DEFAULT #8B5CF6 / light #A78BFA / lighter #C4B5FD / dark #7C3AED`
- `colors.aurora`：`pink #EC4899 / purple #8B5CF6 / lavender #A78BFA / lilac #C4B5FD`
- `boxShadow`：`glass / glass-dark / glass-lg / glow`
- `backgroundImage.aurora-gradient`：`linear-gradient(135deg, #8B5CF6 0%, #A78BFA 50%, #C4B5FD 100%)`
- `animation`：`pulse-slow / float / gradient-drift / gradient-move`
- `fontFamily.serif`：`Noto Serif SC` 优先（在 `index.html` 引入）

---

## 11. 运行与部署

### 本地开发
```bash
# blog（前端，默认 5173，host 开放）
cd blog
npm install
npm run dev

# admin（后台，固定 5174）
cd admin
npm install
cp .env.example .env.local   # 填百度凭证
npm run dev
```

### 构建
```bash
cd blog && npm run build      # 产物 blog/dist
cd admin && npm run build     # 仅验证可构建，不部署
```

### GitHub Pages 部署
[.github/workflows/deploy.yml](file:///f:/图片/couple-blog/.github/workflows/deploy.yml)：
- 触发：push 到 `main` / `master`，或手动 `workflow_dispatch`。
- Node 20，`npm ci`（缓存 `blog/package-lock.json`）。
- 构建时注入 `VITE_BASE_PATH=/<repo-name>/`，由 [blog/vite.config.js](file:///f:/图片/couple-blog/blog/vite.config.js) 读取作为 `base`。
- 上传 `blog/dist` 到 GitHub Pages。
- `concurrency.group: pages`，`cancel-in-progress: true`（同时间只跑一个部署）。

> ⚠️ 早期 README 提到手动改 `vite.config.js` 的 `base`，现已改为 CI 环境变量注入，无需手改。

---

## 12. 历史决策与注意事项

1. **admin 不部署**：仅本地运行工具，所有需要服务端的逻辑（百度代理、音乐代理）都通过 `server-plugin.js` 在 Vite dev server 中间件实现。
2. **照片双源**：本地 `public/photos/` 提供 thumbnail（部署到 GitHub Pages），百度网盘存原图（通过 admin 代理访问）。`photos-manifest.json` 同时记录两者路径。
3. **音乐版权**：网易云外链部分歌曲受限，`server-plugin.js` 检测到返回非音频（HTML 404 页）时回 404，前端 `onError` 自动跳下一首。
4. **dlink 缓存**：百度 dlink 8 小时过期，本地缓存 7 小时留 1 小时缓冲。
5. **闪屏记忆**：`SplashScreen` 用 `sessionStorage` 避免会话内重复播放。
6. **毛玻璃层级**：`ClickEffect` 固定 `z-[9999]` 且移动端隐藏；`FloatingPlayer` + `DanmakuBackground` 关闭按钮 + `GlobalToolbox` 三者浮层位置需协调。
7. **`.nojekyll`**：`blog/public/.nojekyll` 确保 GitHub Pages 不用 Jekyll 处理，避免 `_` 开头文件被忽略。
8. **404.html**：`blog/public/404.html` 用于 GitHub Pages 刷新路由不 404。

---

## 13. 后续可扩展方向（参考）

- 友链页数据填充（`friends.json` 当前为空）。
- 照片墙地理视图依赖 `gps` 字段，目前多数照片 `gps: null`，可通过 admin 批量补 EXIF/GPS。
- `VITE_BAIDU_SIGN_KEY` 签名密钥已配置但未使用，若启用服务端签名接口需补对应逻辑。
- 日记搜索/标签/归档等增强功能。
- admin「同步部署」视图（SyncView）的具体实现状态需核查。

---

## 14. 快速接手指令清单

```bash
# 1. 安装依赖
cd f:\图片\couple-blog\blog && npm install
cd f:\图片\couple-blog\admin && npm install

# 2. 配置百度凭证（仅 admin 需要）
cp f:\图片\couple-blog\admin\.env.example f:\图片\couple-blog\admin\.env.local
# 编辑 .env.local 填入 VITE_BAIDU_APP_KEY / VITE_BAIDU_SECRET_KEY / VITE_BAIDU_APP_NAME

# 3. 启动
cd f:\图片\couple-blog\blog && npm run dev      # http://localhost:5173
cd f:\图片\couple-blog\admin && npm run dev     # http://localhost:5174

# 4. Lint
cd f:\图片\couple-blog\blog && npm run lint
cd f:\图片\couple-blog\admin && npm run lint

# 5. 重新生成照片 manifest（照片有变动时）
cd f:\图片\couple-blog\blog && node scripts/gen-manifest.mjs

# 6. 部署（推送到 main/master 自动触发）
git -C f:\图片\couple-blog push origin main
```
