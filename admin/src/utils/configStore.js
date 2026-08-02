/**
 * 站点配置存储工具
 * 将站点配置读写到 localStorage（key: 'yn_blog_config'）
 *
 * 配置结构：
 * {
 *   profile: { nickname, signature, avatar, loveStartDate },
 *   paths: { blogPath, repoUrl },
 *   baidu: { appName }  // 凭证从 env 读，不存这里
 * }
 */

const STORAGE_KEY = 'yn_blog_config'

const DEFAULT_CONFIG = {
  profile: {
    nickname: '',
    signature: '',
    avatar: '',
    loveStartDate: '',
    coupleHero: '',
    heroArea: null,
    // 「关于」页个人简介卡片（与 blog/src/config/site.js 默认值保持一致，保证后台与博客显示一致）
    author: '小熊骑士 & 昕昕公主',
    location: '在这个小小星球上的某个角落',
    aboutParagraphs: [
      '二零二三年三月，春天刚冒头的时候，我在山西大学学生会遇见了小昕昕。从春天的学生会到秋天的通识课，从六月加上微信的那句你好，到十一月七日我牵起她的手——从此日记里全是一个人。今天，是我们在一起的整整一千天。',
      '这一千天里，我们一起去听邓紫棋和张杰的演唱会，一起在鸟巢和天坛前拍照；去平遥古城看砖墙、在绵山脚下仰望星空，去北京野生动物园喂猛兽，在开封和天津的大街小巷找好吃的。她保研去了北京的中央民族大学，我考研也上了岸，我们各自努力，又从来没有走散。回到小屋，我们玩我的世界——她开局就杀了三个僵尸，比我还厉害；还一起拼豆、打桌游、煮自制火锅，把每个平常的夜晚都过成纪念日。',
      '没有花的世界是多么单调啊，没有你那么我的世界是多么无聊啊。我想起一千天前的雪夜，我送出那对对戒，说要当你的骑士——这个誓约我一天都没有忘。愿我们一直在一起，度过一千天，七千天，七万天。',
    ],
    features: [
      { title: '用心记录', desc: '日记 · 心情 · 碎碎念' },
      { title: '慢慢生活', desc: '旅行 · 美食 · 日常' },
      { title: '温柔陪伴', desc: '照片 · 音乐 · 时光' },
    ],
  },
  paths: {
    blogPath: '',
    repoUrl: '',
  },
  baidu: {
    appName: '',
  },
}

/** 深合并两个对象（用于补全缺失字段） */
function deepMerge(base, override) {
  const result = { ...base }
  for (const key of Object.keys(override || {})) {
    if (
      base[key] &&
      typeof base[key] === 'object' &&
      !Array.isArray(base[key]) &&
      override[key] &&
      typeof override[key] === 'object' &&
      !Array.isArray(override[key])
    ) {
      result[key] = deepMerge(base[key], override[key])
    } else {
      result[key] = override[key]
    }
  }
  return result
}

/** 读取完整配置（自动补全缺失字段） */
export function getConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_CONFIG }
    const parsed = JSON.parse(raw)
    return deepMerge(DEFAULT_CONFIG, parsed)
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

/** 写入完整配置 */
function writeConfig(config) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    return true
  } catch {
    return false
  }
}

/**
 * 部分更新配置（浅合并顶层 key，深合并嵌套对象）
 * @param {Partial<typeof DEFAULT_CONFIG>} partial
 */
export function setConfig(partial = {}) {
  const current = getConfig()
  const next = deepMerge(current, partial)
  writeConfig(next)
  return next
}

/** 获取博客前端物理路径 */
export function getBlogPath() {
  return getConfig().paths.blogPath
}

/** 获取 GitHub 仓库远程地址 */
export function getRepoUrl() {
  return getConfig().paths.repoUrl
}

/** 获取个人简介 */
export function getProfile() {
  return getConfig().profile
}

/** 清空配置（恢复默认） */
export function clearConfig() {
  writeConfig({ ...DEFAULT_CONFIG })
  return { ...DEFAULT_CONFIG }
}

export default {
  getConfig,
  setConfig,
  getBlogPath,
  getRepoUrl,
  getProfile,
  clearConfig,
}
