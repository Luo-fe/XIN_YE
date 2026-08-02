import JsonDataEditor from '../components/JsonDataEditor'

const AUTHOR_OPTIONS = [
  { value: '小昕昕', label: '小昕昕' },
  { value: '小叶叶', label: '小叶叶' },
]

const FIELDS = [
  { key: 'datetime', label: '时间', type: 'datetime-local' },
  { key: 'text', label: '内容', type: 'textarea', placeholder: '说点什么…' },
  { key: 'author', label: '作者', type: 'select', options: AUTHOR_OPTIONS },
  { key: 'location', label: '位置', type: 'text', placeholder: '例如：山西大学' },
  { key: 'images', label: '图片', type: 'images' },
]

/** 格式化 datetime-local 值为可读时间（含年份） */
function formatDateTime(dt) {
  if (!dt) return ''
  // datetime-local 值形如 '2026-07-31T14:30'
  const d = new Date(dt)
  if (Number.isNaN(d.getTime())) return dt
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function MomentsManageView() {
  return (
    <JsonDataEditor
      title="碎碎念"
      storageKey="moments"
      jsonPath="src/data/moments.json"
      fields={FIELDS}
      bodyField="text"
      renderItem={(item) => (
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 text-white shadow-sm">
            <span className="text-base">💬</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-gray-400">{formatDateTime(item.datetime)}</p>
            <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap break-words text-sm text-gray-600 dark:text-gray-300">
              {item.text || '（无内容）'}
            </p>
            {Array.isArray(item.images) && item.images.length > 0 && (
              <p className="mt-1 text-[11px] text-gray-400">📷 {item.images.length} 张图片</p>
            )}
          </div>
        </div>
      )}
    />
  )
}
