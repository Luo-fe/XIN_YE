import { useEffect, useState } from 'react'
import clsx from 'clsx'

/**
 * 背景：固定背景图 + 毛玻璃虚化遮罩
 * 深色模式适配。
 *
 * 背景图来源（优先级）：
 * 1. url prop —— 管理后台配置的网站背景（照片墙一键设置 / 上传 / URL），
 *    每次打开页面由 useSiteBackground 随机抽取一张
 * 2. /bg.jpg —— 默认背景
 */
export default function AuroraBackground({ url = '', className = '' }) {
  // 背景图加载失败时回退默认图（如本地照片在部署环境不可达）
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    setFailed(false)
  }, [url])

  const bgUrl = url && !failed ? url : '/bg.jpg'

  return (
    <div
      className={clsx('fixed inset-0 -z-10 overflow-hidden', className)}
      aria-hidden
    >
      {/* 第 1 层：背景图片全屏铺满 */}
      <div
        className="absolute inset-0 transition-opacity duration-500"
        style={{
          backgroundImage: `url(${bgUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      {/* 探测背景图加载失败（div 的 onError 不生效，用隐藏 img）：
          配置的背景图不可达（如部署环境无本地照片服务）时回退默认 /bg.jpg */}
      {url && (
        <img
          src={url}
          alt=""
          aria-hidden
          className="hidden"
          onError={() => setFailed(true)}
        />
      )}

      {/* 第 2 层：毛玻璃虚化遮罩 */}
      <div className="absolute inset-0 bg-white/30 backdrop-blur-md transition-colors duration-1000 dark:bg-slate-900/40" />
    </div>
  )
}
