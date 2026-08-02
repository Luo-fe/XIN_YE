import JsonDataEditor from '../components/JsonDataEditor'

const TYPE_OPTIONS = [
  { value: 'anniversary', label: '纪念日' },
  { value: 'birthday', label: '生日' },
  { value: 'graduation', label: '毕业' },
  { value: 'travel', label: '旅行' },
  { value: 'event', label: '事件' },
  { value: 'holiday', label: '节日' },
]

const TYPE_LABEL = {
  anniversary: '纪念日',
  birthday: '生日',
  graduation: '毕业',
  travel: '旅行',
  event: '事件',
  holiday: '节日',
}

const TYPE_STYLE = {
  anniversary: 'from-pink-500 to-rose-500',
  birthday: 'from-amber-500 to-orange-500',
  graduation: 'from-violet-500 to-purple-500',
  travel: 'from-sky-500 to-cyan-500',
  event: 'from-indigo-500 to-blue-500',
  holiday: 'from-emerald-500 to-teal-500',
}

const FIELDS = [
  { key: 'title', label: '标题', type: 'text', placeholder: '例如：第一次约会' },
  { key: 'date', label: '日期', type: 'date' },
  { key: 'type', label: '类型', type: 'select', options: TYPE_OPTIONS },
  { key: 'description', label: '描述', type: 'textarea', placeholder: '写点纪念意义…' },
]

export default function AnniversaryManageView() {
  return (
    <JsonDataEditor
      title="纪念日"
      storageKey="anniversaries"
      jsonPath="src/data/anniversaries.json"
      fields={FIELDS}
      bodyField="description"
      titleField="title"
      renderItem={(item) => {
        const style = TYPE_STYLE[item.type] || 'from-primary to-aurora-pink'
        return (
          <div className="flex items-start gap-3">
            <div
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-tr ${style} text-white shadow-sm`}
            >
              <span className="text-base">🎉</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-gray-700 dark:text-gray-200">
                  {item.title || '未命名'}
                </p>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  {TYPE_LABEL[item.type] || item.type || '未分类'}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-gray-400">{item.date}</p>
              {item.description && (
                <p className="mt-1.5 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                  {item.description}
                </p>
              )}
            </div>
          </div>
        )
      }}
    />
  )
}
