# Couple Blog

情侣专属个人博客。Monorepo 包含两个独立的 Vite + React 工程。

## 项目结构

    couple-blog/
    ├── blog/      # 前端博客站点（公开访问，部署 GitHub Pages）
    ├── admin/     # 本地管理后台（管理内容、上传照片至百度网盘）
    ├── .gitignore
    ├── .env.example
    └── README.md

## 技术栈

- Vite + React 18
- Tailwind CSS 3（毛玻璃 / 极光渐变主题，darkMode: 'class'）
- React Router（blog）
- framer-motion / lucide-react / clsx
- ESLint 9 (flat config) + Prettier

## 快速开始

### blog（前端博客）

    cd blog
    npm install
    npm run dev      # http://localhost:5173

### admin（本地管理后台）

    cd admin
    npm install
    cp .env.example .env.local   # 填入百度网盘凭证
    npm run dev      # http://localhost:5174

## 部署

blog 部署到 GitHub Pages 时，将 `blog/vite.config.js` 中预留的 `base` 取消注释并改为仓库名，例如 `base: '/couple-blog/'`。admin 仅本地运行，不部署。

## 代码规范

- 根目录 `.prettierrc`：无分号、单引号、2 空格缩进、es5 尾逗号。
- 每个工程可执行 `npm run lint`（ESLint）。
