/**
 * 全局 body 滚动锁（引用计数版）
 *
 * 导航移动菜单 / 模态框 / 灯箱会同时或先后打开，各自直接写
 * document.body.style.overflow 会互相覆盖：先关的组件会把后开组件的
 * 滚动锁定清掉，残留滚动或锁死。用引用计数保证：
 * - 任意组件 lock() → body 锁定
 * - 最后一个 unlock() → body 恢复
 * 与打开顺序无关。
 */
let lockCount = 0

export function lockBodyScroll() {
  lockCount += 1
  document.body.style.overflow = 'hidden'
}

export function unlockBodyScroll() {
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount === 0) {
    document.body.style.overflow = ''
  }
}
