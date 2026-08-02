# Giscus 评论接入（方案 B 5.3）

静态站（GitHub Pages）无法写入本地评论文件，改用 **Giscus**：
评论数据存在仓库的 Discussions 里，免费、无需服务器、GitHub 账号即可评论。
代码已就绪（`blog/src/components/ui/GiscusComment.jsx`），只差以下 3 步配置。

## 步骤

### 1. 开启仓库 Discussions
GitHub 仓库 **Settings → General → Features → Discussions** 勾选启用 → Create。
（或用命令行：`gh api -X PATCH repos/Luo-fe/XIN_YE -f has_discussions=true`）

### 2. 安装 giscus GitHub App
打开 https://github.com/apps/giscus → **Install** → 选择仓库 `Luo-fe/XIN_YE`
（Install 页面会让你选仓库，选完后点 Install）

### 3. 生成配置并填入 site-config.json
打开 https://giscus.app ：
1. **仓库**：填 `Luo-fe/XIN_YE` → 页面会自动验证
2. 页面往下滚到 **Discussion 分类**，如果下拉为空，回仓库在 Discussions 页新建一个分类
3. 选择分类后，页面底部会出现一段 `<script>` 代码，其中包含：
   - `data-repo="Luo-fe/XIN_YE"`
   - `data-repo-id="R_kgDO..."`（一段字母数字）
   - `data-category="Announcements"`（分类名）
   - `data-category-id="DIC_kwDO..."`（一段字母数字）
4. 把以上 4 个值填入本机 `blog/public/site-config.json` 的 `giscus` 字段：

```json
{
  "giscus": {
    "repo": "Luo-fe/XIN_YE",
    "repoId": "R_kgDO...",
    "category": "Announcements",
    "categoryId": "DIC_kwDO...",
    "mapping": "pathname",
    "theme": "preferred_color_scheme"
  }
}
```

5. `git add -A && git commit -m "开启 giscus 评论" && git push`
   （或双击根目录的 `sync-and-publish.bat`）

## 生效说明
- 配置未填写时网站评论自动回退本地模式（仅本机 admin 可用，静态站上不可写）
- 填好后：所有页面的评论变为 GitHub Discussions 讨论串
  （`mapping: pathname` 按页面 URL 区分，每个日记/照片各是一个讨论帖）
- 旧的本地评论（`blog/src/data/comments*.json`）不会被迁移，
  如需保留可后续把重点评论手动发成 Discussion 帖子

## 常见问题
- 评论框不显示：多半是 `repoId`/`categoryId` 填错或 App 未安装 → 重新检查 giscus.app 生成的代码
- 主题：`theme` 支持 `light` / `dark` / `preferred_color_scheme`（跟随系统）
