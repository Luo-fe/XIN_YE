import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'

/**
 * 富文本内容渲染：管理后台（富文本编辑器）写入的内容可能带 Markdown 语法
 * （**加粗**、# 标题、列表等），博客端用 react-markdown 渲染而不是原样显示字符。
 * 渲染结果与正文排版一致（段落间距、列表、粗斜体、行内代码）。
 * rehypeRaw：编辑器保存的颜色/高亮/字号等格式以 raw HTML 形式存在 Markdown 里，
 * 需要透传渲染（与 XinghuisamaBlogs 的 allowDangerousHtml 方案一致），
 * 否则这些标签会作为转义文本原样显示。
 */
export default function MarkdownText({ children, className = '' }) {
  return (
    <div className={`markdown-text ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
        {String(children ?? '')}
      </ReactMarkdown>
    </div>
  )
}
