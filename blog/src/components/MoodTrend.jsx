import { useEffect, useMemo, useRef } from 'react'
import * as echarts from 'echarts'
import { BarChart2 } from 'lucide-react'
import { GlassCard } from './ui'

// 心情元数据（与 Mood 页保持一致）
const MOOD_META = {
  happy: { label: '开心', color: '#fbbf24' },
  calm: { label: '平静', color: '#38bdf8' },
  sad: { label: '难过', color: '#818cf8' },
  excited: { label: '兴奋', color: '#f472b6' },
  angry: { label: '生气', color: '#fb7185' },
  tired: { label: '疲惫', color: '#a78bfa' },
}

const MOOD_KEYS = Object.keys(MOOD_META)

/**
 * 心情趋势图：堆叠柱状图，按月统计各心情次数
 * @param {Array} moods - 心情数据 [{ date, mood, ... }]
 */
export default function MoodTrend({ moods }) {
  const chartRef = useRef(null)
  const containerRef = useRef(null)

  // 按月聚合各心情数量
  const { months, series } = useMemo(() => {
    const map = new Map() // 'YYYY-MM' -> { happy: 0, calm: 0, ... }
    for (const m of moods) {
      if (!m.date || !MOOD_META[m.mood]) continue
      const ym = String(m.date).slice(0, 7) // YYYY-MM
      if (!map.has(ym)) {
        map.set(ym, Object.fromEntries(MOOD_KEYS.map((k) => [k, 0])))
      }
      const bucket = map.get(ym)
      bucket[m.mood] = (bucket[m.mood] || 0) + 1
    }
    // 按月份升序
    const sortedMonths = [...map.keys()].sort()
    const seriesData = MOOD_KEYS.map((k) => ({
      name: MOOD_META[k].label,
      type: 'bar',
      stack: 'mood',
      emphasis: { focus: 'series' },
      itemStyle: { color: MOOD_META[k].color, borderRadius: [4, 4, 0, 0] },
      data: sortedMonths.map((ym) => map.get(ym)[k]),
    }))
    return { months: sortedMonths, series: seriesData }
  }, [moods])

  useEffect(() => {
    if (!containerRef.current) return
    const chart = echarts.init(containerRef.current)
    chartRef.current = chart

    const option = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderColor: 'rgba(139,92,246,0.3)',
        borderWidth: 1,
        textStyle: { color: '#334155', fontSize: 12 },
        extraCssText: 'backdrop-filter: blur(8px); border-radius: 12px;',
      },
      legend: {
        top: 0,
        right: 0,
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { fontSize: 11, color: '#64748b' },
        icon: 'circle',
      },
      grid: { top: 40, left: 28, right: 12, bottom: 24, containLabel: true },
      xAxis: {
        type: 'category',
        data: months,
        axisLine: { lineStyle: { color: 'rgba(148,163,184,0.3)' } },
        axisTick: { show: false },
        axisLabel: { color: '#64748b', fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: 'rgba(148,163,184,0.15)', type: 'dashed' } },
        axisLabel: { color: '#64748b', fontSize: 11 },
      },
      series,
    }
    // notMerge=true：完全替换 option，避免 tooltip/axisPointer 引用旧 series 模型
    chart.setOption(option, true)

    const handleResize = () => chart.resize()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      // 先隐藏 tooltip 并清事件，再 dispose，规避 "model or view can not be found by params" 警告
      try {
        chart.dispatchAction({ type: 'hideTip' })
        chart.off()
      } catch {
        /* noop */
      }
      chart.dispose()
      chartRef.current = null
    }
  }, [months, series])

  const total = useMemo(() => moods.length, [moods])

  return (
    <GlassCard className="p-5 md:p-6">
      <div className="mb-4 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary dark:text-primary-lighter">
          <BarChart2 className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">心情趋势</h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            按月统计各心情次数 · 共 {total} 条记录
          </p>
        </div>
      </div>
      <div ref={containerRef} className="h-64 w-full" />
    </GlassCard>
  )
}
