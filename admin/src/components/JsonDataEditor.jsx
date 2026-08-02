import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  X,
  Save,
  RefreshCw,
  Inbox,
  CloudUpload,
  Clock,
} from 'lucide-react'
import { useToast } from './Toast'
import {
  listItems,
  createItem,
  updateItem,
  deleteItem,
} from '../api/contentApi'
import RichTextEditor from './editor/RichTextEditor'
import FloatingImageTool from './editor/FloatingImageTool'

/**
 * 通用 JSON 数组 CRUD 组件（双栏编辑器版）
 *
 * 数据流：API ↔ 列表展示 ↔ 双栏 Modal 编辑（左富文本 + 右元数据）
 * 所有操作直接通过 /api/content/* 接口读写 blog/src/data/*.json
 *
 * @param {{
 *   title: string,
 *   storageKey: string,
 *   fields: Array<{key, label, type, options?, placeholder?}>,
 *   bodyField?: string,  // 指定哪个字段作为正文用 RichTextEditor（左侧）
 *   titleField?: string, // 指定哪个字段作为 RichTextEditor 的标题（可选）
 *   jsonPath: string,
 *   renderItem: (item: object) => React.ReactNode,
 * }} props
 */
export default function JsonDataEditor({ title, storageKey, fields, bodyField, titleField, renderItem }) {
  const { showToast } = useToast()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listItems(storageKey)
      setItems(data)
    } catch (e) {
      showToast(e.message || '加载失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [storageKey, showToast])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleAdd = () => {
    setEditing({ __new: true, data: emptyForm(fields) })
  }

  const handleEdit = (item) => {
    setEditing({ __new: false, data: { ...item } })
  }

  const handleDelete = async (item) => {
    if (!window.confirm('确定要删除这条记录吗？')) return
    try {
      await deleteItem(storageKey, item.id)
      setItems((prev) => prev.filter((it) => it.id !== item.id))
      showToast('已删除', 'success')
    } catch (e) {
      showToast(e.message || '删除失败', 'error')
    }
  }

  const handleSaveForm = async (formData) => {
    setSaving(true)
    try {
      if (editing.__new) {
        const newItem = await createItem(storageKey, formData)
        setItems((prev) => [newItem, ...prev])
        showToast('已新增一条记录', 'success')
      } else {
        const updated = await updateItem(storageKey, editing.data.id, formData)
        setItems((prev) => prev.map((it) => (it.id === editing.data.id ? updated : it)))
        showToast('已保存修改', 'success')
      }
      setEditing(null)
    } catch (e) {
      showToast(e.message || '保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const hasItems = items.length > 0

  return (
    <div className="space-y-5">
      {/* 顶部操作栏 */}
      <div className="glass-card flex flex-wrap items-center justify-between gap-3 rounded-3xl p-5">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-gray-800 dark:text-gray-100">{title}</h3>
          <p className="mt-0.5 text-xs text-gray-400">
            共 {items.length} 条记录 · 直接写入博客数据文件
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-2xl bg-sky-500/15 px-4 py-2.5 text-xs font-bold text-sky-600 transition-all hover:bg-sky-500/25 active:scale-95 disabled:opacity-60 dark:text-sky-300"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            刷新
          </button>
          <button
            onClick={handleAdd}
            className="flex items-center gap-1.5 rounded-2xl bg-gradient-to-r from-primary to-aurora-pink px-4 py-2.5 text-xs font-bold text-white shadow-glow transition-all hover:-translate-y-0.5 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            新增
          </button>
        </div>
      </div>

      {/* 列表 */}
      {loading ? (
        <div className="glass-card flex items-center justify-center rounded-3xl p-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : hasItems ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="glass-card group flex items-start gap-3 rounded-2xl p-4 transition-all hover:-translate-y-0.5"
            >
              <div className="min-w-0 flex-1">{renderItem(item)}</div>
              <div className="flex shrink-0 flex-col gap-1.5 opacity-60 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => handleEdit(item)}
                  className="rounded-lg bg-white/60 p-1.5 text-gray-500 transition-colors hover:bg-primary/10 hover:text-primary dark:bg-white/10 dark:text-gray-300"
                  title="编辑"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(item)}
                  className="rounded-lg bg-white/60 p-1.5 text-gray-500 transition-colors hover:bg-rose-500/10 hover:text-rose-500 dark:bg-white/10 dark:text-gray-300"
                  title="删除"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card flex flex-col items-center justify-center rounded-3xl p-10 text-center">
          <div className="mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-tr from-primary/15 to-aurora-pink/15">
            <Inbox className="h-7 w-7 text-primary" />
          </div>
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">暂无记录</p>
          <p className="mt-1 text-xs text-gray-400">点击右上角「新增」开始记录</p>
        </div>
      )}

      {/* 双栏编辑 Modal */}
      {editing && (
        <DualEditorModal
          title={editing.__new ? `新增${title}` : `编辑${title}`}
          fields={fields}
          bodyField={bodyField}
          titleField={titleField}
          initial={editing.data}
          onClose={() => setEditing(null)}
          onSave={handleSaveForm}
          saving={saving}
        />
      )}
    </div>
  )
}

/** 生成空表单对象 */
function emptyForm(fields) {
  const obj = {}
  for (const f of fields) {
    obj[f.key] = f.type === 'images' ? [] : ''
  }
  return obj
}

/**
 * 双栏编辑 Modal：左 RichTextEditor + 右元数据面板
 */
function DualEditorModal({ title, fields, bodyField, titleField, initial, onClose, onSave, saving }) {
  const [form, setForm] = useState(() => {
    const base = emptyForm(fields)
    return { ...base, ...initial }
  })
  const editorRef = useRef(null)
  const [imgToolOpen, setImgToolOpen] = useState(false)
  const [imgToolTarget, setImgToolTarget] = useState('editor')

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  // 正文字段（用 RichTextEditor）
  const bodyFieldDef = bodyField ? fields.find((f) => f.key === bodyField) : null
  // 元数据字段（右侧面板，排除正文和标题字段）
  const metaFields = fields.filter((f) => f.key !== bodyField && f.key !== titleField)

  const handleSubmit = (e) => {
    e?.preventDefault?.()
    // 合并 RichTextEditor 的正文内容
    const finalForm = { ...form }
    if (bodyField && editorRef.current) {
      finalForm[bodyField] = editorRef.current.getContent()
    }
    onSave(finalForm)
  }

  // 标题值
  const editorTitle = titleField ? form[titleField] || '' : ''
  const setEditorTitle = titleField ? (v) => update(titleField, v) : undefined

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-[40px] border border-white/50 bg-white/80 shadow-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] backdrop-blur-2xl dark:border-white/10 dark:bg-slate-900/80"
      >
        {/* 左侧：富文本编辑器 */}
        <section className="flex h-[80vh] min-w-0 flex-1 flex-col overflow-hidden rounded-[40px] border border-white/30 bg-white/30 dark:border-white/10 dark:bg-slate-800/40">
          {bodyFieldDef ? (
            <RichTextEditor
              ref={editorRef}
              title={editorTitle}
              setTitle={setEditorTitle}
              initialContent={form[bodyField] || ''}
              onOpenImageTool={() => {
                setImgToolTarget('editor')
                setImgToolOpen(true)
              }}
              isTitleLocked={!titleField}
            />
          ) : (
            // 无正文字段时，左侧显示提示
            <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
              <CloudUpload size={40} className="opacity-30" />
              <p className="text-xs font-bold">在右侧面板填写内容</p>
            </div>
          )}
        </section>

        {/* 右侧：元数据面板 */}
        <aside className="flex h-[80vh] w-[360px] shrink-0 flex-col overflow-hidden border-l border-white/30 bg-white/30 dark:border-white/10 dark:bg-slate-800/40">
          {/* 头部 */}
          <div className="shrink-0 border-b border-white/20 bg-white/5 px-6 pb-4 pt-7 dark:bg-black/20">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500">
              {title}
            </span>
            <h2 className="mt-1 text-lg font-black text-slate-800 dark:text-white">属性设置</h2>
          </div>

          {/* 字段区 */}
          <div className="custom-scrollbar flex-1 overflow-y-auto px-6 py-5">
            <div className="flex flex-col gap-5">
              {metaFields.map((field) => (
                <FieldRenderer
                  key={field.key}
                  field={field}
                  value={form[field.key]}
                  onChange={(v) => update(field.key, v)}
                  onOpenImageTool={() => {
                    setImgToolTarget('field:' + field.key)
                    setImgToolOpen(true)
                  }}
                />
              ))}
            </div>
          </div>

          {/* 底部保存按钮 */}
          <div className="shrink-0 border-t border-white/20 bg-white/5 px-6 py-5 backdrop-blur-md dark:bg-black/20">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-bold text-slate-400">
              <Clock size={12} />
              {saving ? '正在保存...' : '就绪'}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-2xl border border-white/30 bg-white/20 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-700 transition-all hover:bg-white/30 active:scale-95 dark:text-white"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-indigo-500 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-500/30 transition-all hover:bg-indigo-600 active:scale-95 disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                保存
              </button>
            </div>
          </div>
        </aside>
      </form>

      {/* 浮动图床工具 */}
      <FloatingImageTool
        isOpen={imgToolOpen}
        onClose={() => setImgToolOpen(false)}
        onInsert={(url) => {
          if (imgToolTarget === 'editor' && editorRef.current) {
            editorRef.current.insertImage(url)
          } else if (imgToolTarget.startsWith('field:')) {
            const key = imgToolTarget.slice(6)
            // images 类型追加，text 类型替换
            const fieldDef = fields.find((f) => f.key === key)
            if (fieldDef?.type === 'images') {
              const arr = Array.isArray(form[key]) ? [...form[key], url] : [url]
              update(key, arr)
            } else {
              update(key, url)
            }
          }
        }}
      />
    </div>
  )
}

/**
 * 字段渲染器
 */
function FieldRenderer({ field, value, onChange, onOpenImageTool }) {
  const Label = ({ icon: Icon, text, color }) => (
    <div className={`mb-2 flex items-center gap-2 border-l-4 ${color || 'border-indigo-500'} pl-3`}>
      <Icon size={12} className="text-slate-400" />
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-700 dark:text-slate-200">
        {text}
      </span>
    </div>
  )

  const labelEl = (
    <label className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">
      {field.label}
    </label>
  )

  if (field.type === 'textarea') {
    return (
      <div>
        <Label icon={CloudUpload} text={field.label} color="border-emerald-500" />
        <textarea
          rows={4}
          className="w-full resize-none rounded-[32px] border border-white/10 bg-black/5 px-6 py-5 text-xs leading-relaxed text-slate-800 shadow-inner outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 dark:bg-white/5 dark:text-slate-200"
          placeholder={field.placeholder || `请输入${field.label}`}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    )
  }

  if (field.type === 'select') {
    return (
      <div>
        {labelEl}
        <select
          className="w-full rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-xs text-slate-800 shadow-inner outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:bg-black/20 dark:text-slate-200"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">请选择{field.label}</option>
          {(field.options || []).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    )
  }

  if (field.type === 'images') {
    const arr = Array.isArray(value) ? value : []
    return (
      <div>
        <Label icon={CloudUpload} text={field.label} color="border-pink-500" />
        {/* 已添加图片预览 */}
        {arr.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {arr.map((img, i) => (
              <div
                key={i}
                className="group relative h-14 w-14 overflow-hidden rounded-lg border border-white/40 dark:border-white/10"
              >
                <img src={img} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => onChange(arr.filter((_, idx) => idx !== i))}
                  className="absolute right-0 top-0 grid h-4 w-4 place-items-center bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={onOpenImageTool}
          className="flex w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-white/20 bg-black/5 py-3 text-xs font-bold text-slate-500 shadow-inner transition-all hover:border-indigo-400 hover:bg-indigo-50/30 hover:text-indigo-500 dark:bg-white/5"
        >
          <CloudUpload size={14} />
          添加图片
        </button>
      </div>
    )
  }

  // text / date / datetime-local
  return (
    <div>
      {labelEl}
      <input
        type={field.type}
        className="w-full rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-xs text-slate-800 shadow-inner outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 dark:bg-black/20 dark:text-slate-200"
        placeholder={field.placeholder || `请输入${field.label}`}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
