import JsonDataEditor from '../components/JsonDataEditor'

const FIELDS = [
  { key: 'date', label: '日期', type: 'date' },
  { key: 'title', label: '标题', type: 'text', placeholder: '例如：领证啦' },
  { key: 'description', label: '描述', type: 'textarea', placeholder: '记录这件大事…' },
  { key: 'image', label: '图片 URL', type: 'text', placeholder: 'https://example.com/photo.jpg' },
]

export default function TimelineManageView() {
  return (
    <JsonDataEditor
      title="时光轴"
      storageKey="timeline"
      jsonPath="src/data/timeline.json"
      fields={FIELDS}
      bodyField="description"
      titleField="title"
      renderItem={(item) => (
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-tr from-fuchsia-500 to-pink-500 text-white shadow-sm">
            <span className="text-base">⏳</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold text-gray-700 dark:text-gray-200">
                {item.title || '未命名'}
              </p>
              <span className="text-[11px] text-gray-400">{item.date}</span>
            </div>
            {item.description && (
              <p className="mt-1.5 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                {item.description}
              </p>
            )}
            {item.image && (
              <div className="mt-2 overflow-hidden rounded-lg">
                <img
                  src={item.image}
                  alt={item.title || ''}
                  className="max-h-24 w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    />
  )
}
