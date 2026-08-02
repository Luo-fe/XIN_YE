import { useState, useImperativeHandle, forwardRef, useEffect, useRef } from 'react'
import { useEditor, EditorContent, Extension } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Superscript from '@tiptap/extension-superscript'
import Subscript from '@tiptap/extension-subscript'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Markdown } from 'tiptap-markdown'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { createLowlight, all } from 'lowlight'
import {
  Undo2, Redo2, Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, List, ListOrdered, ListTodo,
  Highlighter, Code2, Heading1, Heading2, Heading3,
  Type, ImageIcon, Quote, Link2, Superscript as SupIcon, Subscript as SubIcon,
  Pipette, Hash, Check, Palette,
} from 'lucide-react'

const lowlight = createLowlight(all)

// 自定义图片：插入时带样式
const CustomImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: '100%',
        renderHTML: (attributes) => ({
          style: `width: ${attributes.width}; height: auto; display: block; margin: 1.5rem auto; border-radius: 1rem; box-shadow: 0 12px 30px rgba(0,0,0,0.12);`,
        }),
      },
    }
  },
})

// 字号扩展
const FontSize = Extension.create({
  name: 'fontSize',
  addOptions() {
    return { types: ['textStyle'] }
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize?.replace(/['"]+/g, ''),
            renderHTML: (attributes) =>
              attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {},
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setFontSize:
        (fontSize) =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize }).run(),
    }
  },
})

// 首行缩进用的全角空格（U+3000）
// 不能用 ASCII 空格：markdown 里行首 4 个 ASCII 空格会被当作"缩进代码块"语法，
// 保存后重新打开或前端渲染时都会变成代码块。全角空格是普通文本，安全。
const FULLWIDTH_SPACE = '　'
const PARAGRAPH_INDENT = FULLWIDTH_SPACE + FULLWIDTH_SPACE

// 段落首行自动缩进：回车新建正文段落时自动插入两个全角空格（　　）
// 列表、任务列表、引用、代码块内保持默认回车行为
const AutoIndent = Extension.create({
  name: 'autoIndent',
  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { $from } = this.editor.state.selection
        if ($from.parent.type.name !== 'paragraph') return false
        if (
          $from.ancestors.some(([node]) =>
            ['listItem', 'taskItem', 'blockquote', 'codeBlock'].includes(node.type.name),
          )
        ) {
          return false
        }
        this.editor.chain().focus().splitBlock().insertContent(PARAGRAPH_INDENT).run()
        return true
      },
    }
  },
})

// 颜色选择器弹窗
function CustomColorPicker({ activeColor, recentColors, onClose, onSelect, onConfirm }) {
  const presets = ['#000000', '#6366F1', '#EC4899', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6']
  const [hex, setHex] = useState(activeColor)
  return (
    <>
      <div
        className="fixed inset-0 z-[9990] bg-slate-900/20 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed left-1/2 top-1/2 z-[9999] w-72 -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/40 bg-white/95 p-6 shadow-2xl backdrop-blur-3xl dark:border-white/10 dark:bg-slate-900/95">
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Color Palette
            </span>
            <button
              type="button"
              onClick={() => onConfirm(hex)}
              className="grid h-8 w-8 place-items-center rounded-full bg-indigo-500 text-white transition-transform hover:scale-110"
            >
              <Check size={16} />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2.5">
            {presets.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => {
                  setHex(c)
                  onSelect(c)
                }}
                className="aspect-square w-full rounded-xl border border-white/20 transition-all hover:scale-110 hover:shadow-md"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/5 p-3 shadow-inner dark:bg-white/5">
            <Hash size={14} className="text-slate-400" />
            <input
              type="text"
              value={(hex || '').replace('#', '')}
              onChange={(e) => {
                const val = '#' + e.target.value
                setHex(val)
                if (val.length === 7) onSelect(val)
              }}
              className="w-full bg-transparent text-sm font-black uppercase text-slate-800 outline-none dark:text-slate-200"
            />
          </div>
          {recentColors && recentColors.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-slate-200/50 pt-3 dark:border-white/10">
              {recentColors.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setHex(c)
                    onSelect(c)
                  }}
                  className="h-6 w-6 rounded-full border border-white/40 shadow-sm transition-transform hover:scale-125"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export const RichTextEditorHandle = {
  insertImage: () => {},
  getContent: () => '',
}

/**
 * 富文本编辑器（tiptap）
 * - 支持工具栏：撤销/重做、字号、标题、粗体斜体下划线删除线、对齐、列表、引用、代码块、上下标、链接、图片、文字颜色、高亮颜色
 * - 通过 tiptap-markdown 支持 Markdown 输入/输出
 * @param {object} props
 * @param {string} props.title - 标题
 * @param {function} props.setTitle - 设置标题
 * @param {string} [props.initialContent] - 初始内容（Markdown 或 HTML）
 * @param {function} [props.onOpenImageTool] - 打开图片工具
 * @param {boolean} [props.isTitleLocked] - 锁定标题
 * @param {function} [props.onChange] - 内容变化回调
 * @param {React.Ref} ref - 暴露 insertImage / getContent
 */
const RichTextEditor = forwardRef(function RichTextEditor(
  { title, setTitle, initialContent, onOpenImageTool, isTitleLocked, onChange },
  ref,
) {
  const [textColors, setTextColors] = useState(['#6366F1', '#000000'])
  const [highlightColors, setHighlightColors] = useState(['#FEF08A', '#BBF7D0'])
  const [showTextPicker, setShowTextPicker] = useState(false)
  const [showHighlightPicker, setShowHighlightPicker] = useState(false)
  const loadedContentRef = useRef(null)
  const [, setRenderTrigger] = useState(0)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
      }),
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: 'javascript',
        HTMLAttributes: {
          class: 'bg-[#282c34] text-[#abb2bf] p-6 rounded-2xl font-mono my-6 overflow-x-auto shadow-inner',
        },
      }),
      Underline,
      Subscript,
      Superscript,
      TextStyle,
      Color,
      FontSize,
      CustomImage,
      AutoIndent,
      Link.configure({
        openOnClick: false,
        // 关闭自动识别：打字/粘贴时 URL 样式的文字不再被莫名转成链接
        autolink: false,
        linkOnPaste: false,
        HTMLAttributes: { class: 'text-indigo-500 underline cursor-pointer font-bold' },
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
      TaskList.configure({ HTMLAttributes: { class: 'not-prose space-y-3' } }),
      TaskItem.configure({ nested: true }),
      Markdown.configure({
        html: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: initialContent || '',
    immediatelyRender: false,
    onUpdate: () => {
      if (onChange) onChange()
    },
    onTransaction: () => {
      setRenderTrigger((v) => v + 1)
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-slate dark:prose-invert prose-lg max-w-none w-full focus:outline-none min-h-full pb-60 leading-relaxed px-4 editor-content-area',
      },
      // 纯文本多行粘贴：按行拆成独立段落，避免产生 \ 硬换行残留；
      // 粘贴到空段落开头时自动补首行缩进（与回车自动缩进保持一致）
      handlePaste: (view, event) => {
        const cd = event.clipboardData
        if (!cd) return false
        const types = cd.types || []
        if (types.includes('text/html')) return false
        const text = cd.getData('text/plain') || ''
        if (!text.includes('\n')) return false

        const paras = text
          .replace(/\r\n?/g, '\n')
          .split('\n')
          .map((l) => l.replace(/\s+$/g, ''))
          .filter((l) => l.trim() !== '')
        if (paras.length === 0) return false

        const { $from } = view.state.selection
        const target = $from.parent
        const atParaStart = target.type.name === 'paragraph' && $from.parentOffset <= 2
        const blankPara =
          target.type.name === 'paragraph' && target.textContent.replace(/　/g, '') === ''
        const addIndent = atParaStart && blankPara
        const firstHasIndent = target.textContent.startsWith(PARAGRAPH_INDENT)

        const escapeHtml = (s) =>
          s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        const html = paras
          .map((p, i) => {
            const prefix = addIndent && !(i === 0 && firstHasIndent) ? PARAGRAPH_INDENT : ''
            return `<p>${prefix}${escapeHtml(p)}</p>`
          })
          .join('')
        view.pasteHTML(html)
        return true
      },
    },
  })

  useImperativeHandle(
    ref,
    () => ({
      insertImage: (url) => {
        if (editor) {
          editor.chain().focus().setImage({ src: url }).run()
          if (onChange) onChange()
        }
      },
      getContent: () => {
        if (!editor) return ''
        // 优先用 Markdown 序列化
        try {
          const md = editor.storage.markdown?.getMarkdown?.()
          if (md) {
            // 清理历史遗留/粘贴产生的换行残留：
            // 1) 段落结尾的 \ 硬换行（纯文本粘贴时产生）
            // 2) 单独成行的 \（空段落里的硬换行）
            return md
              .replace(/\\\n\n/g, '\n\n')
              .replace(/\\\n$/, '\n')
              .replace(/(^|\n)\\\n/g, '$1')
          }
        } catch {
          // ignore
        }
        let html = editor.getHTML()
        html = html.replace(/<p><\/p>/gi, '<br>&zwj;')
        html = html.replace(/<p><br><\/p>/gi, '<br>&zwj;')
        return html
      },
    }),
    [editor, onChange],
  )

  useEffect(() => {
    if (!editor || !initialContent) return
    if (loadedContentRef.current !== initialContent) {
      const safeContent = initialContent.replace(/~~([\s\S]*?)~~/g, '<s>$1</s>')
      editor.commands.setContent(safeContent, false)
      loadedContentRef.current = initialContent
    }
  }, [editor, initialContent])

  if (!editor) return null

  const currentFontSize = editor.getAttributes('textStyle').fontSize || 'default'

  const toggleLink = () => {
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run()
      return
    }
    const previousUrl = editor.getAttributes('link').href || ''
    const url = window.prompt('请输入跳转链接 (URL):', previousUrl)
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    const safeUrl = /^https?:\/\//.test(url) ? url : `https://${url}`
    editor.chain().focus().extendMarkRange('link').setLink({ href: safeUrl }).run()
  }

  const Btn = ({ onClick, active, children, title }) => (
    // type="button" 必须：工具栏在 <form> 内部，button 默认 type="submit"，
    // 不加会点击任意工具栏按钮就触发表单提交（保存并关闭编辑器）
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex items-center justify-center rounded-xl p-2.5 transition-all duration-300 ease-out ${
        active
          ? 'scale-110 bg-indigo-500 text-white shadow-md shadow-indigo-500/40'
          : 'text-slate-500 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-slate-700/50'
      }`}
    >
      {children}
    </button>
  )

  return (
    <div className="relative flex h-full w-full min-h-0 flex-col bg-transparent">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .editor-content-area h1 { font-size: 2.2rem !important; font-weight: 900 !important; margin-bottom: 1.5rem !important; margin-top: 2rem !important; line-height: 1.1; color: inherit; }
        .editor-content-area h2 { font-size: 1.6rem !important; font-weight: 800 !important; margin-bottom: 1rem !important; margin-top: 1.5rem !important; }
        .editor-content-area h3 { font-size: 1.25rem !important; font-weight: 700 !important; margin-bottom: 0.75rem !important; }
        .editor-content-area p { font-size: 1.05rem !important; line-height: 1.8 !important; }
        .editor-content-area ul { list-style-type: disc !important; padding-left: 1.5rem !important; }
        .editor-content-area ol { list-style-type: decimal !important; padding-left: 1.5rem !important; }
        .editor-content-area s, .editor-content-area del { text-decoration-line: line-through !important; opacity: 0.6; }
        .editor-content-area blockquote {
          border-left: 4px solid #6366f1 !important;
          background-color: rgba(99, 102, 241, 0.05) !important;
          padding: 1rem 1.5rem !important;
          margin: 1.5rem 0 !important;
          border-radius: 0 1rem 1rem 0 !important;
          font-style: italic !important;
          color: #64748b !important;
        }
        .editor-content-area blockquote p { margin: 0 !important; color: inherit !important; }
        .dark .editor-content-area blockquote {
          border-left-color: #818cf8 !important;
          background-color: rgba(129, 140, 248, 0.1) !important;
          color: #94a3b8 !important;
        }
        .editor-content-area p code {
          background-color: rgba(99, 102, 241, 0.1) !important;
          color: #6366f1 !important;
          padding: 0.2rem 0.4rem !important;
          border-radius: 0.5rem !important;
          font-size: 0.85em !important;
        }
        .editor-content-area img { border-radius: 1rem; box-shadow: 0 12px 30px rgba(0,0,0,0.12); }
      `,
        }}
      />

      {/* 标题输入 */}
      <div className="shrink-0 flex items-center gap-4 px-8 pb-3 pt-10">
        <input
          type="text"
          value={title}
          onChange={(e) => !isTitleLocked && setTitle(e.target.value)}
          readOnly={isTitleLocked}
          placeholder="标题..."
          className={`flex-1 border-none bg-transparent text-5xl font-black tracking-tighter outline-none transition-all ${
            isTitleLocked
              ? 'cursor-default select-none text-slate-400 dark:text-slate-600'
              : 'text-slate-900 placeholder:text-slate-200 dark:text-white dark:placeholder:text-slate-800'
          }`}
        />
      </div>

      {/* 工具栏 */}
      <div className="z-50 flex shrink-0 flex-wrap items-center gap-1.5 border-y border-white/20 bg-white/10 px-6 py-2.5 backdrop-blur-md dark:border-white/10 dark:bg-black/20">
        <div className="flex items-center gap-1">
          <Btn onClick={() => editor.chain().focus().undo().run()} title="撤销">
            <Undo2 size={16} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().redo().run()} title="重做">
            <Redo2 size={16} />
          </Btn>
        </div>
        <div className="mx-1 h-6 w-px bg-slate-400/20" />

        {/* 字号 */}
        <div className="flex items-center gap-1 rounded-xl bg-black/5 px-2 dark:bg-white/5">
          <select
            value={currentFontSize}
            onChange={(e) => editor.chain().focus().setFontSize(e.target.value).run()}
            className="bg-transparent p-2 text-[10px] font-black text-slate-700 outline-none dark:text-slate-300"
          >
            <option value="default" disabled>
              字号
            </option>
            {['14px', '16px', '18px', '20px', '24px', '32px', '48px'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <Btn
            onClick={() => editor.chain().focus().setParagraph().run()}
            active={editor.isActive('paragraph') && !editor.isActive('heading')}
            title="正文"
          >
            <Type size={18} />
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive('heading', { level: 1 })}
            title="一级标题"
          >
            <Heading1 size={16} />
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive('heading', { level: 2 })}
            title="二级标题"
          >
            <Heading2 size={16} />
          </Btn>
          <Btn
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive('heading', { level: 3 })}
            title="三级标题"
          >
            <Heading3 size={16} />
          </Btn>
        </div>

        <div className="mx-1 h-6 w-px bg-slate-400/20" />
        <div className="flex items-center gap-1">
          <Btn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="粗体">
            <Bold size={16} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="斜体">
            <Italic size={16} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="下划线">
            <UnderlineIcon size={16} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="删除线">
            <Strikethrough size={16} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="代码块">
            <Code2 size={16} />
          </Btn>
        </div>

        <div className="mx-1 h-6 w-px bg-slate-400/20" />
        <div className="flex items-center gap-1">
          <Btn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="左对齐">
            <AlignLeft size={16} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="居中">
            <AlignCenter size={16} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="右对齐">
            <AlignRight size={16} />
          </Btn>
        </div>

        <div className="mx-1 h-6 w-px bg-slate-400/20" />
        <div className="flex items-center gap-1">
          <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="无序列表">
            <List size={16} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="有序列表">
            <ListOrdered size={16} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} title="任务列表">
            <ListTodo size={16} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="引用">
            <Quote size={16} />
          </Btn>
        </div>

        <div className="mx-1 h-6 w-px bg-slate-400/20" />
        <div className="flex items-center gap-1">
          <Btn onClick={() => editor.chain().focus().toggleSuperscript().run()} active={editor.isActive('superscript')} title="上标">
            <SupIcon size={16} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleSubscript().run()} active={editor.isActive('subscript')} title="下标">
            <SubIcon size={16} />
          </Btn>
          <Btn onClick={toggleLink} active={editor.isActive('link')} title="链接">
            <Link2 size={16} />
          </Btn>
          <Btn onClick={onOpenImageTool} title="插入图片">
            <ImageIcon size={16} className="text-indigo-500" />
          </Btn>
        </div>

        {/* 选中图片时的宽度调整 */}
        {editor.isActive('image') && (
          <div className="ml-4 flex items-center gap-1 rounded-2xl border border-dashed border-indigo-500/20 bg-indigo-500/10 p-1 px-3">
            {['25%', '50%', '75%', '100%'].map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => editor.chain().focus().updateAttributes('image', { width: s }).run()}
                className="rounded-lg px-2 py-1 text-[9px] font-bold transition-all hover:bg-white"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1" />

        {/* 文字颜色 */}
        <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-black/5 p-1.5 px-3 shadow-inner dark:bg-white/5">
          <Palette size={14} className="mr-2 text-slate-400" />
          <div className="flex items-center gap-1 border-r border-white/10 pr-2">
            {textColors.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => editor.chain().focus().setColor(c).run()}
                className="h-4 w-4 rounded-full border border-white/40 shadow-sm transition-all hover:scale-125"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setShowTextPicker(true)
              setShowHighlightPicker(false)
            }}
            className="ml-1 grid h-8 w-8 place-items-center rounded-xl border border-indigo-500/30 bg-white shadow-xl dark:bg-slate-800"
          >
            <Pipette size={14} className="text-indigo-500" />
          </button>
        </div>

        {/* 高亮颜色 */}
        <div className="flex items-center gap-1 rounded-2xl border border-white/10 bg-black/5 p-1.5 px-3 shadow-inner dark:bg-white/5">
          <Highlighter size={14} className="mr-2 text-slate-400" />
          <div className="flex items-center gap-1 border-r border-white/10 pr-2">
            {highlightColors.map((c) => (
              <button
                type="button"
                key={c}
                // toggleHighlight：再次点击同色可取消高亮（setHighlight 只能设置无法取消）
                onClick={() => editor.chain().focus().toggleHighlight({ color: c }).run()}
                className={`h-4 w-4 rounded-md border border-white/40 shadow-sm transition-all hover:scale-125 ${
                  editor.isActive('highlight', { color: c }) ? 'ring-2 ring-indigo-500 ring-offset-1' : ''
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setShowHighlightPicker(true)
              setShowTextPicker(false)
            }}
            className="ml-1 grid h-8 w-8 place-items-center rounded-xl border border-white/20 bg-yellow-400 shadow-xl"
          >
            <Highlighter size={14} className="text-white" />
          </button>
        </div>
      </div>

      {/* 颜色选择器弹窗 */}
      {showTextPicker && (
        <CustomColorPicker
          activeColor="#6366F1"
          recentColors={textColors}
          onClose={() => setShowTextPicker(false)}
          onSelect={(c) => editor.chain().focus().setColor(c).run()}
          onConfirm={(c) => {
            if (!textColors.includes(c)) setTextColors((p) => [c, ...p].slice(0, 6))
            setShowTextPicker(false)
          }}
        />
      )}
      {showHighlightPicker && (
        <CustomColorPicker
          activeColor="#FEF08A"
          recentColors={highlightColors}
          onClose={() => setShowHighlightPicker(false)}
          onSelect={(c) => editor.chain().focus().setHighlight({ color: c }).run()}
          onConfirm={(c) => {
            if (!highlightColors.includes(c)) setHighlightColors((p) => [c, ...p].slice(0, 6))
            setShowHighlightPicker(false)
          }}
        />
      )}

      {/* 编辑区 */}
      <div className="custom-scrollbar flex-1 overflow-y-auto px-8 py-8">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
})

export default RichTextEditor
