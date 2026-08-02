import { useEffect, useState } from 'react'
import { animate } from 'framer-motion'

/**
 * 数字滚动动画，从 0 滚到 value
 * @param {object} props
 * @param {number} props.value - 目标值
 * @param {number} props.duration - 时长(秒)
 * @param {function} props.format - 格式化函数 (n) => string
 */
export default function AnimatedNumber({ value = 0, duration = 1.5, format }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const controls = animate(0, value, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => setDisplay(v),
    })
    return () => controls.stop()
  }, [value, duration])

  const text =
    typeof format === 'function'
      ? format(display)
      : Math.round(display).toLocaleString()

  return <span>{text}</span>
}
