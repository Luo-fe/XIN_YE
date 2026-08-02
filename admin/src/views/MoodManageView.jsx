import JsonDataEditor from '../components/JsonDataEditor'

/** 心情枚举 → emoji 与中文标签 */
const MOOD_OPTIONS = [
  { value: 'happy', label: '😊 开心' },
  { value: 'calm', label: '😌 平静' },
  { value: 'sad', label: '😢 难过' },
  { value: 'excited', label: '🤩 兴奋' },
  { value: 'angry', label: '😠 生气' },
  { value: 'tired', label: '😴 疲惫' },
]

const MOOD_EMOJI = {
  happy: '😊',
  calm: '😌',
  sad: '😢',
  excited: '🤩',
  angry: '😠',
  tired: '😴',
}

const MOOD_LABEL = {
  happy: '开心',
  calm: '平静',
  sad: '难过',
  excited: '兴奋',
  angry: '生气',
  tired: '疲惫',
}

const FIELDS = [
  { key: 'date', label: '日期', type: 'date' },
  { key: 'mood', label: '心情', type: 'select', options: MOOD_OPTIONS },
  { key: 'text', label: '内容', type: 'textarea', placeholder: '记录此刻的心情…' },
  { key: 'images', label: '图片', type: 'images' },
]

export default function MoodManageView() {
  return (
    <JsonDataEditor
      title="心情记录"
      storageKey="moods"
      jsonPath="src/data/moods.json"
      fields={FIELDS}
      bodyField="text"
      renderItem={(item) => (
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none" aria-hidden>
            {MOOD_EMOJI[item.mood] || '💭'}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                {MOOD_LABEL[item.mood] || item.mood || '未设置'}
              </span>
              <span className="text-[11px] text-gray-400">{item.date}</span>
            </div>
            <p className="mt-1.5 line-clamp-3 text-sm text-gray-600 dark:text-gray-300">
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
