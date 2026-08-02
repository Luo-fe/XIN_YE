// 站点全局配置：供 Navbar / ProfileCard / Footer 复用
//
// 管理后台「设置」页保存的站点信息会写入 blog/public/site-config.json，
// 应用启动时调用 loadRuntimeSiteConfig() 覆盖下方默认值（昵称/头像/签名/起始年份）。
// 直接部署/未配置时保持静态默认值不变。

// 合照 Hero 图（本地文件）
export const coupleHero = '/couple-hero.jpg'

// 头像：使用网站图标（芋泥椰椰）
export const avatarUrl = '/icon.png'

// 照片墙海报占位图
export const photoWallPoster =
  'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=dreamy%20couple%20polaroid%20wall%20soft%20purple%20light&image_size=landscape'

// 最近文章封面占位
export const diaryCover =
  'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=cozy%20diary%20notebook%20lavender%20desk%20flat&image_size=landscape'

// 碎碎念封面占位
export const momentCover =
  'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=starry%20night%20thoughts%20purple%20gradient&image_size=landscape'

export const siteConfig = {
  siteName: '昕昕公主和小熊骑士的小小王国',
  author: '小熊骑士 & 昕昕公主',
  navTitle: '芋泥椰奶',
  navSuffix: '',
  navAfter: '',
  bio: '一对小情侣的毛玻璃极光博客，收藏每一个值得纪念的瞬间。',
  description: '一对小情侣的毛玻璃极光博客，收藏每一个值得纪念的瞬间。',
  avatarUrl,
  photoWallPoster,
  coupleHero,
  // 「关于」页个人简介卡片（后台设置可覆盖）
  author: '小熊骑士 & 昕昕公主',
  locationTag: '在这个小小星球上的某个角落',
  aboutParagraphs: [
    '二零二三年三月，春天刚冒头的时候，我在山西大学学生会遇见了小昕昕。从春天的学生会到秋天的通识课，从六月加上微信的那句你好，到十一月七日我牵起她的手——从此日记里全是一个人。今天，是我们在一起的整整一千天。',
    '这一千天里，我们一起去听邓紫棋和张杰的演唱会，一起在鸟巢和天坛前拍照；去平遥古城看砖墙、在绵山脚下仰望星空，去北京野生动物园喂猛兽，在开封和天津的大街小巷找好吃的。她保研去了北京的中央民族大学，我考研也上了岸，我们各自努力，又从来没有走散。回到小屋，我们玩我的世界——她开局就杀了三个僵尸，比我还厉害；还一起拼豆、打桌游、煮自制火锅，把每个平常的夜晚都过成纪念日。',
    '没有花的世界是多么单调啊，没有你那么我的世界是多么无聊啊。我想起一千天前的雪夜，我送出那对对戒，说要当你的骑士——这个誓约我一天都没有忘。愿我们一直在一起，度过一千天，七千天，七万天。',
  ],
  // 「关于」页三张特色卡片
  features: [
    { title: '用心记录', desc: '日记 · 心情 · 碎碎念', icon: 'heart' },
    { title: '慢慢生活', desc: '旅行 · 美食 · 日常', icon: 'coffee' },
    { title: '温柔陪伴', desc: '照片 · 音乐 · 时光', icon: 'sparkles' },
  ],
  // 主页主题卡片展示区域（0-1，后台固定取景框框选）；无值时整图 cover 展示
  heroArea: null,
  /** Giscus 评论配置（未配置时评论回退本地模式，仅 dev 可用） */
  giscus: null,
  // 顶部导航项（已移除友链）
  nav: [
    { name: '首页', path: '/', icon: 'home' },
    { name: '日记', path: '/diaries', icon: 'book' },
    { name: '微信聊天', path: '/chat', icon: 'message-circle' },
    { name: '心情', path: '/moods', icon: 'smile' },
    { name: '纪念日', path: '/anniversaries', icon: 'calendar-heart' },
    { name: '时光轴', path: '/timeline', icon: 'clock' },
    { name: '碎碎念', path: '/moments', icon: 'message' },
    { name: '照片墙', path: '/photos', icon: 'image' },
    { name: '音乐', path: '/music', icon: 'music' },
    { name: '关于', path: '/about', icon: 'user' },
  ],
  // 社交按钮
  social: {
    github: 'https://github.com/Luo-fe',
    email: '2564118019@qq.com',
  },
  startYear: 2023,
  // 页脚署名（可随设置页持久化或直接修改）
  footerNote: 'for 1000days纪念日',
}

export default siteConfig

let _runtimeLoaded = false

/**
 * 启动时读取 admin 保存的站点配置（public/site-config.json）并覆盖默认值。
 * 只执行一次；文件不存在/解析失败时保持静态默认值。
 * @returns {Promise<void>}
 */
export async function loadRuntimeSiteConfig() {
  if (_runtimeLoaded) return
  _runtimeLoaded = true
  try {
    const base = import.meta.env.BASE_URL || '/'
    const resp = await fetch(`${base}site-config.json`)
    if (!resp.ok) return
    const cfg = await resp.json()
    if (!cfg || typeof cfg !== 'object') return
    if (cfg.navTitle) siteConfig.navTitle = cfg.navTitle
    if (cfg.avatarUrl) siteConfig.avatarUrl = cfg.avatarUrl
    if (cfg.bio) siteConfig.bio = cfg.bio
    if (cfg.coupleHero) siteConfig.coupleHero = cfg.coupleHero
    if (cfg.heroArea) siteConfig.heroArea = cfg.heroArea
    if (cfg.startYear) siteConfig.startYear = Number(cfg.startYear) || siteConfig.startYear
    // Giscus 评论配置（静态站评论）：由 giscus.app 向导生成后填入 site-config.json
    if (cfg.giscus && typeof cfg.giscus === 'object' && cfg.giscus.repo) {
      siteConfig.giscus = cfg.giscus
    }
    // 「关于」页内容：admin 会把 profile 对象整体落盘，新字段从 profile 读取
    const p = cfg.profile
    if (p && typeof p === 'object') {
      if (p.author) siteConfig.author = p.author
      if (p.location) siteConfig.locationTag = p.location
      if (Array.isArray(p.aboutParagraphs)) siteConfig.aboutParagraphs = p.aboutParagraphs
      if (Array.isArray(p.features)) siteConfig.features = p.features
    }
  } catch {
    /* 保持默认值 */
  }
}
