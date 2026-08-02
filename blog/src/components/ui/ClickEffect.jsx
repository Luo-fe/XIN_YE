import { useEffect, useRef } from 'react'

/**
 * 点击涟漪粒子特效
 * - canvas 全屏覆盖（fixed inset-0 pointer-events-none z-[9999]）
 * - 仅 PC 端显示（md+），移动端隐藏避免性能负担
 * - 参考 XinghuisamaBlogs ClickEffect.tsx：Ripple 类扩散 + 速度衰减 + 透明度线性衰减
 * - 主题色靛蓝 rgba(129,140,248,opacity)，附加 shadowBlur 增加云朵质感
 */
export default function ClickEffect() {
  const canvasRef = useRef(null)

  useEffect(() => {
    // 移动端 / 窄屏不启用（matchMedia 与 Tailwind md 断点对齐）
    const mql = window.matchMedia('(min-width: 768px)')
    if (!mql.matches) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let ripples = []
    let rafId = 0
    let cancelled = false

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    class Ripple {
      constructor(x, y) {
        this.x = x
        this.y = y
        this.r = 0
        this.maxR = 60
        this.opacity = 0.6
        this.velocity = 2.5
      }
      update() {
        this.r += this.velocity
        // 半径越大，扩散越慢（物理模拟）
        this.velocity *= 0.96
        // 透明度线性衰减
        this.opacity -= 0.015
      }
      draw() {
        if (!ctx) return
        // 外环
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(129, 140, 248, ${this.opacity})`
        ctx.lineWidth = 2
        ctx.stroke()

        // 内部实心圆，增加触碰感
        ctx.beginPath()
        ctx.arc(this.x, this.y, this.r * 0.5, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(129, 140, 248, ${this.opacity * 0.3})`
        ctx.fill()
      }
    }

    const handleClick = (e) => {
      ripples.push(new Ripple(e.clientX, e.clientY))
    }
    window.addEventListener('click', handleClick)

    const animate = () => {
      if (cancelled) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      // 全局模糊让涟漪更柔和
      ctx.shadowBlur = 15
      ctx.shadowColor = 'rgba(129, 140, 248, 0.5)'

      for (let i = 0; i < ripples.length; i++) {
        const rp = ripples[i]
        rp.update()
        rp.draw()
        if (rp.opacity <= 0) {
          ripples.splice(i, 1)
          i--
        }
      }
      rafId = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('click', handleClick)
      ripples = []
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[9999] hidden md:block"
      aria-hidden="true"
    />
  )
}
