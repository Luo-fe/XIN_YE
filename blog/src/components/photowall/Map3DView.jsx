import { useEffect, useMemo, useRef, useState } from 'react'
import * as echarts from 'echarts'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, AlertTriangle, ArrowLeft, MapPinned, ImageIcon, MousePointerClick } from 'lucide-react'
import { GlassCard } from '../ui'
import PhotoThumb from './PhotoThumb'
import photoAlbumsIndex from '../../data/photo-albums-index.json'

// DataV 公共 CDN：全国 + 各省 GeoJSON
const CHINA_GEOJSON_URL = 'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json'
const PROVINCE_GEOJSON_URL = (adcode) =>
  `https://geo.datav.aliyun.com/areas_v3/bound/${adcode}_full.json`

// 省份名称 → 行政区划代码（用于 drill-down 拉取省级 GeoJSON）
const PROVINCE_ADCODE = {
  北京市: '110000',
  天津市: '120000',
  河北省: '130000',
  山西省: '140000',
  内蒙古自治区: '150000',
  辽宁省: '210000',
  吉林省: '220000',
  黑龙江省: '230000',
  上海市: '310000',
  江苏省: '320000',
  浙江省: '330000',
  安徽省: '340000',
  福建省: '350000',
  江西省: '360000',
  山东省: '370000',
  河南省: '410000',
  湖北省: '420000',
  湖南省: '430000',
  广东省: '440000',
  广西壮族自治区: '450000',
  海南省: '460000',
  重庆市: '500000',
  四川省: '510000',
  贵州省: '520000',
  云南省: '530000',
  西藏自治区: '540000',
  陕西省: '610000',
  甘肃省: '620000',
  青海省: '630000',
  宁夏回族自治区: '640000',
  新疆维吾尔自治区: '650000',
  台湾省: '710000',
  香港特别行政区: '810000',
  澳门特别行政区: '820000',
}

const registeredMaps = new Set()

async function loadMap(mapName, url) {
  if (registeredMaps.has(mapName)) return true
  const resp = await fetch(url)
  if (!resp.ok) throw new Error('geojson fetch failed')
  const geoJson = await resp.json()
  echarts.registerMap(mapName, geoJson)
  registeredMaps.add(mapName)
  return true
}

const ALBUM_PAGE_SIZE = 60

/**
 * 中国足迹地图（三视图）：
 * - national（全国）：省份按照片数填色
 *     · 左键省份 → 进入该省相册
 *     · 右键省份 → 进入该省市级/区级页面
 * - province-cities（省级子区域）：该省 GeoJSON + 子区域（市/区）填色
 *     · 左键子区域 → 进入该子区域相册
 * - album（相册）：照片网格，按时间倒序，分页加载
 *
 * 地图导航数据来自构建期缓存的 photo-albums-index.json（地址/时间分析一次后缓存），
 * 相册照片来自 allPhotos（全量 seasons），按当前省/子区域过滤。
 *
 * 注意：地图容器始终挂载，相册视图仅隐藏地图（display:none），
 * 避免 ECharts 实例因 DOM 卸载而失效（返回地图后无法渲染）。
 *
 * @param {object} props
 * @param {Array} props.allPhotos - 全量照片，相册视图过滤使用
 * @param {function} props.onPhotoClick - (photoList, index) => void 打开灯箱
 */
export default function Map3DView({ allPhotos, onPhotoClick }) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)
  const [mapError, setMapError] = useState(false)
  const [chartReady, setChartReady] = useState(false)
  const [drilling, setDrilling] = useState(false)

  // 视图状态机
  const [view, setView] = useState('national') // 'national' | 'province-cities' | 'album'
  const [currentProvince, setCurrentProvince] = useState('')
  const [currentSubRegion, setCurrentSubRegion] = useState('') // 市/区名
  const [albumSubType, setAlbumSubType] = useState('province') // 'province' | 'city' | 'district'
  const [albumFrom, setAlbumFrom] = useState('national') // 相册返回目标

  // 相册分页
  const [albumVisible, setAlbumVisible] = useState(ALBUM_PAGE_SIZE)

  // 让 chart 事件回调能读到最新状态
  const viewRef = useRef(view)
  const provinceRef = useRef(currentProvince)
  useEffect(() => {
    viewRef.current = view
    provinceRef.current = currentProvince
  }, [view, currentProvince])

  const index = photoAlbumsIndex
  const provinces = index.provinces || []
  const maxCount = useMemo(
    () => provinces.reduce((m, p) => Math.max(m, p.count), 0) || 1,
    [provinces],
  )

  const currentProvData = useMemo(
    () => provinces.find((p) => p.province === currentProvince) || null,
    [provinces, currentProvince],
  )

  // 相册照片：从全量照片按省/子区域过滤，按时间倒序
  const albumPhotos = useMemo(() => {
    if (view !== 'album' || !allPhotos) return []
    let list = allPhotos.filter((p) => p.location?.province === currentProvince)
    if (albumSubType === 'city') {
      list = list.filter((p) => p.location?.city === currentSubRegion)
    } else if (albumSubType === 'district') {
      list = list.filter((p) => p.location?.district === currentSubRegion)
    }
    return list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
  }, [view, allPhotos, currentProvince, currentSubRegion, albumSubType])

  const albumMeta = useMemo(() => {
    if (albumSubType === 'province') return currentProvData
    return currentProvData?.subRegions?.find((s) => s.name === currentSubRegion) || null
  }, [albumSubType, currentProvData, currentSubRegion])

  // ---- 进入各视图 ----
  const openProvinceAlbum = (provinceName) => {
    if (!provinces.some((p) => p.province === provinceName)) return
    setCurrentProvince(provinceName)
    setAlbumSubType('province')
    setCurrentSubRegion('')
    setAlbumFrom('national')
    setAlbumVisible(ALBUM_PAGE_SIZE)
    setView('album')
  }

  const openSubRegionAlbum = (provinceName, subName, subType) => {
    setCurrentProvince(provinceName)
    setAlbumSubType(subType) // 'city' | 'district'
    setCurrentSubRegion(subName)
    setAlbumFrom('province-cities')
    setAlbumVisible(ALBUM_PAGE_SIZE)
    setView('album')
  }

  const enterProvinceCities = async (provinceName) => {
    const adcode = PROVINCE_ADCODE[provinceName]
    if (!adcode) return
    setDrilling(true)
    try {
      await loadMap(`province_${adcode}`, PROVINCE_GEOJSON_URL(adcode))
      setCurrentProvince(provinceName)
      setView('province-cities')
    } catch {
      /* 省级 GeoJSON 拉取失败，留在全国视图 */
    } finally {
      setDrilling(false)
    }
  }

  const backToNational = () => {
    setView('national')
    setCurrentProvince('')
    setCurrentSubRegion('')
  }

  const backFromAlbum = () => {
    if (albumFrom === 'province-cities') {
      setView('province-cities')
    } else {
      backToNational()
    }
    setCurrentSubRegion('')
  }

  // ---- 初始化 chart（仅一次）----
  useEffect(() => {
    let disposed = false
    const init = async () => {
      try {
        await loadMap('china', CHINA_GEOJSON_URL)
      } catch {
        if (!disposed) setMapError(true)
        return
      }
      if (disposed || !containerRef.current) return
      // Strict Mode / HMR 下可能残留旧实例，先清理避免事件绑定到已废弃的 chart
      const existing = echarts.getInstanceByDom(containerRef.current)
      if (existing) existing.dispose()
      const chart = echarts.init(containerRef.current)
      chartRef.current = chart

      const onResize = () => chart.resize()
      window.addEventListener('resize', onResize)
      chart._onResize = onResize
      setChartReady(true)
      // 先渲染全国视图，再注册事件（部分 ECharts 版本需 setOption 后事件才能正确绑定）
      renderNational()

      // 左键：national→省相册 / province-cities→子区域相册（仅响应地图区域点击）
      chart.on('click', (params) => {
        const v = viewRef.current
        if (params.componentType !== 'geo' && params.seriesType !== 'map') return
        if (!params.name) return
        if (v === 'national') {
          openProvinceAlbum(params.name)
        } else if (v === 'province-cities') {
          const prov = provinces.find((p) => p.province === provinceRef.current)
          const subType = prov?.subRegionType === 'district' ? 'district' : 'city'
          openSubRegionAlbum(provinceRef.current, params.name, subType)
        }
      })

      // 右键：national→进入省级子区域页面
      chart.on('contextmenu', (params) => {
        if (viewRef.current !== 'national') return
        if (params.componentType !== 'geo' && params.seriesType !== 'map') return
        if (params.name && PROVINCE_ADCODE[params.name]) enterProvinceCities(params.name)
      })

      // ZRender 层兜底：若 chart.on('click') 未触发，用像素坐标 + convertFromPixel 兜底
      chart.getZr().on('click', (params) => {
        const px = [params.offsetX, params.offsetY]
        if (!chart.containPixel('geo', px)) return
        // 已由 chart.on('click') 处理则跳过（避免重复）
        if (params.target) return
        // convertFromPixel -> [lng, lat]，再用各区域 bbox 粗略匹配
        const [lng, lat] = chart.convertFromPixel({ geoIndex: 0 }, px)
        const v = viewRef.current
        if (v === 'national') {
          // 找到坐标落在哪个省份（用 index 里的 coord 近似最近邻）
          let nearest = null
          let minDist = Infinity
          for (const p of provinces) {
            if (!p.coord) continue
            const d = (p.coord[0] - lng) ** 2 + (p.coord[1] - lat) ** 2
            if (d < minDist) { minDist = d; nearest = p }
          }
          if (nearest && minDist < 10) openProvinceAlbum(nearest.province)
        }
      })
    }
    init()

    return () => {
      disposed = true
      if (chartRef.current) {
        if (chartRef.current._onResize) {
          window.removeEventListener('resize', chartRef.current._onResize)
        }
        try {
          chartRef.current.dispatchAction({ type: 'hideTip' })
          chartRef.current.off()
        } catch {
          /* noop */
        }
        chartRef.current.dispose()
        chartRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- 渲染：视图变化时重绘（先 resize 以应对隐藏后重新显示的尺寸恢复）----
  useEffect(() => {
    if (!chartReady) return
    const chart = chartRef.current
    if (!chart) return
    // 相册视图时地图被隐藏，返回时需 resize 恢复画布尺寸
    try {
      chart.resize()
    } catch {
      /* noop */
    }
    if (view === 'national') renderNational()
    else if (view === 'province-cities') renderProvinceCities()
    // album 视图不使用 chart
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartReady, view, currentProvince])

  // 渲染全国视图（仅地图区域填色，无散点标注）
  const renderNational = () => {
    const chart = chartRef.current
    if (!chart) return
    const mapData = provinces.map((p) => ({ name: p.province, value: p.count }))

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (p) => {
          const cnt = p.value != null ? p.value : 0
          return `<b>${p.name}</b><br/>照片数：${cnt}<br/><span style="color:#94a3b8">左键看相册 · 右键看城市</span>`
        },
      },
      visualMap: {
        type: 'continuous',
        min: 0,
        max: maxCount,
        left: 16,
        bottom: 24,
        text: ['多', '少'],
        textStyle: { color: '#94a3b8', fontSize: 11 },
        inRange: { color: ['#ede9fe', '#a78bfa', '#7c3aed', '#5b21b6'] },
        calculable: true,
        itemWidth: 12,
        itemHeight: 80,
      },
      geo: {
        map: 'china',
        roam: true,
        scaleLimit: { min: 1, max: 6 },
        zoom: 1.15,
        label: { show: false },
        itemStyle: {
          areaColor: '#f1f5f9',
          borderColor: '#c4b5fd',
          borderWidth: 0.6,
        },
        emphasis: {
          label: { show: true, color: '#1e293b', fontSize: 11 },
          itemStyle: { areaColor: '#ddd6fe', borderColor: '#7c3aed', borderWidth: 1 },
        },
      },
      series: [{ type: 'map', geoIndex: 0, data: mapData }],
    }
    chart.setOption(option, true)
  }

  // 渲染省级子区域视图（仅地图区域填色 + 名称标签，无散点标注）
  const renderProvinceCities = () => {
    const chart = chartRef.current
    if (!chart || !currentProvData) return
    const adcode = PROVINCE_ADCODE[currentProvince]
    const mapName = `province_${adcode}`
    const subType = currentProvData.subRegionType === 'district' ? 'district' : 'city'

    const mapData = currentProvData.subRegions
      .filter((s) => !s.name.startsWith('未知'))
      .map((s) => ({ name: s.name, value: s.count }))

    const subMax = currentProvData.subRegions.reduce((m, s) => Math.max(m, s.count), 0) || 1

    const option = {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: (p) => {
          if (p.value != null) {
            return `<b>${p.name}</b><br/>照片数：${p.value}<br/><span style="color:#94a3b8">左键进入相册</span>`
          }
          return p.name || ''
        },
      },
      visualMap: {
        type: 'continuous',
        min: 0,
        max: subMax,
        left: 16,
        bottom: 24,
        text: ['多', '少'],
        textStyle: { color: '#94a3b8', fontSize: 11 },
        inRange: { color: ['#ede9fe', '#a78bfa', '#7c3aed', '#5b21b6'] },
        calculable: true,
        itemWidth: 12,
        itemHeight: 60,
      },
      geo: {
        map: mapName,
        roam: true,
        scaleLimit: { min: 1, max: 10 },
        zoom: 1,
        label: { show: true, color: '#475569', fontSize: 10 },
        itemStyle: {
          areaColor: '#f1f5f9',
          borderColor: '#c4b5fd',
          borderWidth: 0.8,
        },
        emphasis: {
          label: { show: true, color: '#1e293b' },
          itemStyle: { areaColor: '#ddd6fe' },
        },
      },
      series: [{ type: 'map', geoIndex: 0, data: mapData }],
    }
    chart.setOption(option, true)
  }

  if (mapError) {
    return (
      <GlassCard className="flex flex-col items-center justify-center gap-3 p-10 text-center">
        <AlertTriangle className="h-10 w-10 text-aurora-pink" />
        <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200">
          地图数据加载失败
        </h3>
        <p className="max-w-md text-sm text-slate-500 dark:text-slate-400">
          无法连接地图 GeoJSON 服务，请稍后刷新重试。你也可以先浏览时间视图或地点视图。
        </p>
      </GlassCard>
    )
  }

  const subLabel = currentProvData?.subRegionType === 'district' ? '区' : '市'

  return (
    <div className="relative">
      {/* ---- 相册视图 ---- */}
      <AnimatePresence>
        {view === 'album' && (
          <motion.div
            key="album"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-4"
          >
            <GlassCard className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={backFromAlbum}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/40 bg-white/50 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-white/70 dark:border-white/10 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20"
                >
                  <ArrowLeft className="h-3 w-3" />
                  {albumFrom === 'province-cities' ? '返回地图' : '返回全国'}
                </button>
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/50 text-primary shadow-glass backdrop-blur-md dark:bg-white/10 dark:text-primary-lighter">
                  <ImageIcon className="h-4 w-4" />
                </span>
                <h3 className="gradient-text text-xl font-bold tracking-tight sm:text-2xl">
                  {albumSubType === 'province'
                    ? currentProvince
                    : `${currentProvince} · ${currentSubRegion}`}
                </h3>
                <span className="rounded-full border border-white/40 bg-white/40 px-2.5 py-0.5 text-xs font-medium text-slate-600 backdrop-blur-md dark:border-white/10 dark:bg-white/10 dark:text-slate-300">
                  {albumPhotos.length.toLocaleString()} 张
                </span>
                {albumMeta?.dateRange?.[0] && (
                  <span className="text-xs text-slate-400">
                    {albumMeta.dateRange[0].slice(0, 10)} ~ {albumMeta.dateRange[1].slice(0, 10)}
                  </span>
                )}
              </div>
            </GlassCard>

            {albumPhotos.length === 0 ? (
              <GlassCard className="flex flex-col items-center justify-center gap-3 p-12 text-center">
                <ImageIcon className="h-10 w-10 text-slate-300" />
                <p className="text-sm text-slate-500 dark:text-slate-400">该地区暂无照片</p>
              </GlassCard>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {albumPhotos.slice(0, albumVisible).map((p, i) => (
                    <PhotoThumb
                      key={p.id || `alb-${i}`}
                      photo={p}
                      className="aspect-square"
                      onClick={() => onPhotoClick?.(albumPhotos, i)}
                    />
                  ))}
                </div>
                {albumVisible < albumPhotos.length ? (
                  <div className="flex justify-center py-4">
                    <button
                      type="button"
                      onClick={() => setAlbumVisible((c) => c + ALBUM_PAGE_SIZE)}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/40 bg-white/50 px-5 py-2.5 text-sm font-medium text-slate-600 backdrop-blur-md transition-colors hover:bg-white/70 dark:border-white/10 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20"
                    >
                      加载更多 · 还剩 {(albumPhotos.length - albumVisible).toLocaleString()} 张
                    </button>
                  </div>
                ) : (
                  <div className="py-2 text-center text-xs text-slate-400 dark:text-slate-500">
                    共 {albumPhotos.length.toLocaleString()} 张照片
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- 地图视图（始终挂载，相册时隐藏以防 ECharts 实例失效）---- */}
      <div className={view === 'album' ? 'hidden' : undefined}>
        <GlassCard className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-white/30 px-4 py-3 dark:border-white/10">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {view === 'province-cities'
                ? `${currentProvince} · ${subLabel}级足迹`
                : '中国足迹地图'}
            </span>
            {view === 'national' && (
              <span className="ml-auto inline-flex items-center gap-1 text-xs text-slate-400">
                <MousePointerClick className="h-3.5 w-3.5" />
                左键看相册 · 右键看城市
              </span>
            )}
            {view === 'province-cities' && (
              <span className="ml-auto text-xs text-slate-400">左键{subLabel}进入相册</span>
            )}
            {view === 'province-cities' && (
              <button
                type="button"
                onClick={backToNational}
                disabled={drilling}
                className="inline-flex items-center gap-1 rounded-lg border border-white/40 bg-white/50 px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-white/70 disabled:opacity-50 dark:border-white/10 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20"
              >
                <ArrowLeft className="h-3 w-3" />
                返回全国
              </button>
            )}
          </div>
          <div
            ref={containerRef}
            onContextMenu={(e) => e.preventDefault()}
            className="h-[560px] w-full sm:h-[640px]"
          />
        </GlassCard>

        {/* province-cities 视图：子区域快捷入口（含未匹配到地图区域的"未知"项）*/}
        <AnimatePresence>
          {view === 'province-cities' && currentProvData && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="mt-4"
            >
              <GlassCard className="p-4">
                <div className="mb-3 flex items-center gap-2">
                  <MapPinned className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {currentProvince} 的{subLabel}列表
                  </span>
                  <span className="text-xs text-slate-400">
                    · 共 {currentProvData.subRegions.length} 个{subLabel}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {currentProvData.subRegions.map((s) => (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() =>
                        openSubRegionAlbum(
                          currentProvince,
                          s.name,
                          currentProvData.subRegionType === 'district' ? 'district' : 'city',
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/40 bg-white/40 px-3 py-1.5 text-xs font-medium text-slate-600 backdrop-blur-md transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary-dark dark:border-white/10 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-primary/20"
                    >
                      {s.name}
                      <span className="text-[10px] text-slate-400">{s.count}</span>
                    </button>
                  ))}
                </div>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
