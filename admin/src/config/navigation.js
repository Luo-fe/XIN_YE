import {
  LayoutDashboard,
  BookOpen,
  Heart,
  CalendarHeart,
  Clock,
  MessageCircle,
  Image,
  Cloud,
  Music,
  RefreshCw,
  Settings,
} from 'lucide-react'

/**
 * 后台导航项配置
 * key 用作激活态标识；title 用作 TopBar 标题；component 标记对应视图
 */
export const NAV_ITEMS = [
  { key: 'overview', label: '概览', title: '概览', icon: LayoutDashboard, component: 'overview' },
  { key: 'diaries', label: '日记管理', title: '日记管理', icon: BookOpen, component: 'diaries' },
  { key: 'moods', label: '心情记录', title: '心情记录', icon: Heart, component: 'moods' },
  { key: 'anniversaries', label: '纪念日', title: '纪念日', icon: CalendarHeart, component: 'anniversaries' },
  { key: 'timeline', label: '时间轴', title: '时间轴', icon: Clock, component: 'timeline' },
  { key: 'whispers', label: '碎碎念', title: '碎碎念', icon: MessageCircle, component: 'whispers' },
  { key: 'photos', label: '照片墙', title: '照片墙', icon: Image, component: 'photos' },
  { key: 'baidu', label: '百度网盘', title: '百度网盘', icon: Cloud, component: 'baidu' },
  { key: 'netease', label: '网易云', title: '网易云音乐', icon: Music, component: 'netease' },
  { key: 'sync', label: '同步部署', title: '同步部署', icon: RefreshCw, component: 'sync' },
  { key: 'settings', label: '设置', title: '设置', icon: Settings, component: 'settings' },
]

export const DEFAULT_NAV_KEY = 'overview'

/** 根据 key 查找导航项 */
export function findNavByKey(key) {
  return NAV_ITEMS.find((item) => item.key === key) || NAV_ITEMS[0]
}
