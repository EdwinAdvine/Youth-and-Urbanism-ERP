/**
 * ChartRenderer — Universal ECharts-based chart component for Y&U Analytics.
 *
 * Supports 20+ chart types with a single unified API. Takes widget config + data
 * and renders the appropriate visualization using Apache ECharts.
 *
 * Usage:
 *   <ChartRenderer type="bar" data={data} config={config} />
 */
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import {
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  RadarChart,
  FunnelChart,
  GaugeChart,
  TreemapChart,
  SankeyChart,
  BoxplotChart,
  CandlestickChart,
  HeatmapChart,
} from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  ToolboxComponent,
  DataZoomComponent,
  VisualMapComponent,
  MarkLineComponent,
  MarkPointComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useMemo, useRef } from 'react'
import type { EChartsOption } from 'echarts'
import { useBreakpoint } from '../../hooks/useMediaQuery'

// Register all required ECharts components
echarts.use([
  BarChart, LineChart, PieChart, ScatterChart, RadarChart, FunnelChart,
  GaugeChart, TreemapChart, SankeyChart, BoxplotChart, CandlestickChart, HeatmapChart,
  TitleComponent, TooltipComponent, GridComponent, LegendComponent,
  ToolboxComponent, DataZoomComponent, VisualMapComponent,
  MarkLineComponent, MarkPointComponent, CanvasRenderer,
])

// ── Design tokens ───────────────────────────────────────────────────────────
const COLORS = [
  '#51459d', '#6fd943', '#3ec9d6', '#ffa21d', '#ff3a6e',
  '#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444', '#22c55e',
  '#a855f7', '#14b8a6', '#f97316', '#ec4899', '#6366f1',
]

const THEME = {
  fontFamily: 'Open Sans, sans-serif',
  borderRadius: 10,
  backgroundColor: 'transparent',
}

// ── Types ───────────────────────────────────────────────────────────────────
export type ChartType =
  | 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'scatter' | 'radar'
  | 'funnel' | 'gauge' | 'treemap' | 'sankey' | 'heatmap' | 'boxplot'
  | 'candlestick' | 'waterfall' | 'combo' | 'histogram' | 'bullet'
  | 'sparkline' | 'kpi' | 'table'

export interface ChartConfig {
  xKey?: string
  yKeys?: string[]
  nameKey?: string
  valueKey?: string
  colors?: string[]
  showLegend?: boolean
  showGrid?: boolean
  showToolbox?: boolean
  showDataZoom?: boolean
  stacked?: boolean
  horizontal?: boolean
  smooth?: boolean
  areaFill?: boolean
  innerRadius?: string
  title?: string
  subtitle?: string
  formatValue?: (v: number) => string
  conditionalFormatting?: ConditionalRule[]
  drillThrough?: DrillThroughConfig
  showAnomalyOverlay?: boolean
}

export interface ConditionalRule {
  field: string
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'between'
  value: number | [number, number]
  color: string
  label?: string
}

export interface DrillThroughConfig {
  targetRoute: string
  filterParam: string
  dimensionKey: string
}

interface ChartRendererProps {
  type: ChartType
  data: Record<string, unknown>[]
  config?: ChartConfig
  height?: number | string
  /** When true, height auto-adjusts: 200px mobile, 300px tablet, 400px desktop */
  responsive?: boolean
  loading?: boolean
  onDataClick?: (params: { name: string; value: unknown; dataIndex: number; data: Record<string, unknown> }) => void
  className?: string
}

// ── Conditional formatting helpers ──────────────────────────────────────────

function evalRule(value: number, rule: ConditionalRule): boolean {
  const rv = rule.value
  switch (rule.operator) {
    case 'gt': return value > (rv as number)
    case 'lt': return value < (rv as number)
    case 'gte': return value >= (rv as number)
    case 'lte': return value <= (rv as number)
    case 'eq': return value === (rv as number)
    case 'between': return value >= (rv as [number, number])[0] && value <= (rv as [number, number])[1]
    default: return false
  }
}

/**
 * Apply conditional formatting rules to a data value, returning an item style.
 * Returns undefined if no rule matches.
 */
function applyConditionalColor(
  value: number,
  fieldKey: string,
  rules: ConditionalRule[] | undefined,
): string | undefined {
  if (!rules?.length) return undefined
  for (const rule of rules) {
    if (rule.field === fieldKey && evalRule(value, rule)) {
      return rule.color
    }
  }
  return undefined
}

/** Builds a responsive legend — scroll type + compact on mobile (fontSize ≤ 10) */
function buildLegend(config: ChartConfig, fontSize: number) {
  if (config.showLegend === false) return undefined
  return {
    bottom: 0,
    type: fontSize <= 10 ? ('scroll' as const) : ('plain' as const),
    orient: 'horizontal' as const,
    textStyle: { fontFamily: THEME.fontFamily, fontSize },
  }
}

// ── Option builders ─────────────────────────────────────────────────────────

function buildBarOptions(data: Record<string, unknown>[], config: ChartConfig, fontSize = 11): EChartsOption {
  const xKey = config.xKey || 'name'
  const yKeys = config.yKeys || Object.keys(data[0] || {}).filter(k => k !== xKey)
  const colors = config.colors || COLORS
  const rules = config.conditionalFormatting

  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: buildLegend(config, fontSize),
    grid: { left: '3%', right: '4%', bottom: config.showLegend !== false ? '15%' : '3%', top: '10%', containLabel: true },
    xAxis: config.horizontal
      ? { type: 'value', axisLabel: { fontSize } }
      : { type: 'category', data: data.map(d => String(d[xKey])), axisLabel: { fontSize, rotate: data.length > 8 ? 30 : 0 } },
    yAxis: config.horizontal
      ? { type: 'category', data: data.map(d => String(d[xKey])), axisLabel: { fontSize } }
      : { type: 'value', axisLabel: { fontSize } },
    color: colors,
    series: yKeys.map((key) => ({
      name: key,
      type: 'bar' as const,
      data: data.map(d => {
        const v = Number(d[key]) || 0
        const conditionalColor = applyConditionalColor(v, key, rules)
        return conditionalColor
          ? { value: v, itemStyle: { color: conditionalColor } }
          : v
      }),
      stack: config.stacked ? 'total' : undefined,
      barMaxWidth: 40,
      itemStyle: { borderRadius: [4, 4, 0, 0] },
    })),
  }
}

function detectInlineAnomalies(
  data: Record<string, unknown>[],
  valueKey: string,
  threshold = 2.0
): Array<{ index: number; value: number; zScore: number }> {
  const values = data.map(d => Number(d[valueKey]) || 0)
  if (values.length < 3) return []
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / values.length
  const std = Math.sqrt(variance)
  if (std === 0) return []
  return values
    .map((v, i) => ({ index: i, value: v, zScore: Math.abs((v - mean) / std) }))
    .filter(p => p.zScore > threshold)
}

function buildLineOptions(data: Record<string, unknown>[], config: ChartConfig, fontSize = 11): EChartsOption {
  const xKey = config.xKey || 'name'
  const yKeys = config.yKeys || Object.keys(data[0] || {}).filter(k => k !== xKey)
  const colors = config.colors || COLORS
  const isArea = config.areaFill

  let series: Record<string, unknown>[] = yKeys.map((key) => ({
    name: key,
    type: 'line' as const,
    data: data.map(d => Number(d[key]) || 0),
    smooth: config.smooth !== false,
    areaStyle: isArea ? { opacity: 0.15 } : undefined,
    symbolSize: 6,
  }))

  // Add anomaly overlay if enabled
  if (config.showAnomalyOverlay && data.length > 0) {
    series = series.map((s: Record<string, unknown>, idx: number) => {
      const key = yKeys[idx]
      const anomalies = detectInlineAnomalies(data, key)
      if (!anomalies.length) return s
      return {
        ...s,
        markPoint: {
          data: anomalies.map(p => ({
            coord: [p.index, p.value],
            itemStyle: { color: '#ff3a6e' },
            symbol: 'circle',
            symbolSize: 8,
            label: { show: false },
          })),
          silent: false,
          tooltip: { formatter: (params: Record<string, unknown>) => { const d = params.data as { coord?: unknown[] } | undefined; return `Anomaly: ${d?.coord?.[1] ?? ''}` } },
        },
      }
    })
  }

  return {
    tooltip: { trigger: 'axis' },
    legend: buildLegend(config, fontSize),
    grid: { left: '3%', right: '4%', bottom: config.showLegend !== false ? '15%' : '3%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: data.map(d => String(d[xKey])), axisLabel: { fontSize }, boundaryGap: false },
    yAxis: { type: 'value', axisLabel: { fontSize } },
    color: colors,
    series,
  }
}

function buildPieOptions(data: Record<string, unknown>[], config: ChartConfig, isDonut = false, fontSize = 11): EChartsOption {
  const nameKey = config.nameKey || config.xKey || 'name'
  const valueKey = config.valueKey || config.yKeys?.[0] || 'value'

  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: buildLegend(config, fontSize),
    color: config.colors || COLORS,
    series: [{
      type: 'pie',
      radius: isDonut ? ['40%', '70%'] : '70%',
      center: ['50%', '45%'],
      data: data.map(d => ({
        name: String(d[nameKey]),
        value: Number(d[valueKey]) || 0,
      })),
      label: { fontSize },
      emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' } },
    }],
  }
}

function buildScatterOptions(data: Record<string, unknown>[], config: ChartConfig, fontSize = 11): EChartsOption {
  const xKey = config.xKey || 'x'
  const yKey = config.yKeys?.[0] || 'y'

  return {
    tooltip: { trigger: 'item' },
    xAxis: { type: 'value', axisLabel: { fontSize }, name: xKey },
    yAxis: { type: 'value', axisLabel: { fontSize }, name: yKey },
    grid: { left: '10%', right: '5%', bottom: '10%', top: '10%' },
    series: [{
      type: 'scatter',
      data: data.map(d => [Number(d[xKey]) || 0, Number(d[yKey]) || 0]),
      symbolSize: 10,
      itemStyle: { color: COLORS[0] },
    }],
  }
}

function buildRadarOptions(data: Record<string, unknown>[], config: ChartConfig, fontSize = 11): EChartsOption {
  const keys = config.yKeys || Object.keys(data[0] || {}).filter(k => k !== (config.xKey || 'name'))
  const maxValues = keys.map(k => Math.max(...data.map(d => Number(d[k]) || 0)) * 1.2)

  return {
    tooltip: {},
    legend: { bottom: 0, type: fontSize <= 10 ? 'scroll' as const : 'plain' as const, orient: 'horizontal' as const, textStyle: { fontSize } },
    color: config.colors || COLORS,
    radar: {
      indicator: keys.map((k, i) => ({ name: k, max: maxValues[i] })),
    },
    series: [{
      type: 'radar',
      data: data.map(d => ({
        name: String(d[config.xKey || 'name']),
        value: keys.map(k => Number(d[k]) || 0),
      })),
    }],
  }
}

function buildFunnelOptions(data: Record<string, unknown>[], config: ChartConfig, fontSize = 11): EChartsOption {
  const nameKey = config.nameKey || config.xKey || 'name'
  const valueKey = config.valueKey || config.yKeys?.[0] || 'value'

  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c}' },
    legend: buildLegend(config, fontSize),
    color: config.colors || COLORS,
    series: [{
      type: 'funnel',
      left: '10%',
      top: 10,
      bottom: 40,
      width: '80%',
      sort: 'descending',
      gap: 2,
      label: { show: true, position: 'inside', fontSize },
      data: data.map(d => ({
        name: String(d[nameKey]),
        value: Number(d[valueKey]) || 0,
      })),
    }],
  }
}

function buildGaugeOptions(data: Record<string, unknown>[], config: ChartConfig): EChartsOption {
  const valueKey = config.valueKey || config.yKeys?.[0] || 'value'
  const value = data[0] ? Number(data[0][valueKey]) || 0 : 0

  return {
    series: [{
      type: 'gauge',
      startAngle: 200,
      endAngle: -20,
      min: 0,
      max: 100,
      detail: { valueAnimation: true, fontSize: 24, formatter: '{value}%', color: COLORS[0] },
      data: [{ value, name: config.title || '' }],
      axisLine: {
        lineStyle: {
          width: 20,
          color: [
            [0.3, '#ff3a6e'],
            [0.7, '#ffa21d'],
            [1, '#6fd943'],
          ],
        },
      },
      pointer: { width: 5 },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
    }],
  }
}

function buildTreemapOptions(data: Record<string, unknown>[], config: ChartConfig, fontSize = 11): EChartsOption {
  const nameKey = config.nameKey || config.xKey || 'name'
  const valueKey = config.valueKey || config.yKeys?.[0] || 'value'

  return {
    tooltip: { formatter: '{b}: {c}' },
    color: config.colors || COLORS,
    series: [{
      type: 'treemap',
      data: data.map(d => ({
        name: String(d[nameKey]),
        value: Number(d[valueKey]) || 0,
      })),
      label: { fontSize },
      breadcrumb: { show: false },
    }],
  }
}

function buildSankeyOptions(data: Record<string, unknown>[], config: ChartConfig, fontSize = 11): EChartsOption {
  // Expects data with {source, target, value} format
  const nodes = new Set<string>()
  const links = data.map(d => {
    const source = String(d.source || d.from || '')
    const target = String(d.target || d.to || '')
    nodes.add(source)
    nodes.add(target)
    return { source, target, value: Number(d.value) || 0 }
  })

  return {
    tooltip: { trigger: 'item' },
    color: config.colors || COLORS,
    series: [{
      type: 'sankey',
      data: Array.from(nodes).map(name => ({ name })),
      links,
      label: { fontSize },
      lineStyle: { color: 'gradient', curveness: 0.5 },
    }],
  }
}

function buildHeatmapOptions(data: Record<string, unknown>[], config: ChartConfig, fontSize = 11): EChartsOption {
  const xKey = config.xKey || 'x'
  const yKey = config.yKeys?.[0] || 'y'
  const valueKey = config.valueKey || 'value'

  const xCategories = [...new Set(data.map(d => String(d[xKey])))]
  const yCategories = [...new Set(data.map(d => String(d[yKey])))]
  const values = data.map(d => [
    xCategories.indexOf(String(d[xKey])),
    yCategories.indexOf(String(d[yKey])),
    Number(d[valueKey]) || 0,
  ])
  const maxVal = Math.max(...values.map(v => v[2]))

  return {
    tooltip: { position: 'top' },
    grid: { left: '15%', right: '5%', bottom: '15%', top: '5%' },
    xAxis: { type: 'category', data: xCategories, axisLabel: { fontSize } },
    yAxis: { type: 'category', data: yCategories, axisLabel: { fontSize } },
    visualMap: { min: 0, max: maxVal, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, inRange: { color: ['#e0e7ff', '#51459d'] } },
    series: [{
      type: 'heatmap',
      data: values,
      label: { show: true, fontSize },
    }],
  }
}

function buildWaterfallOptions(data: Record<string, unknown>[], config: ChartConfig, fontSize = 11): EChartsOption {
  const xKey = config.xKey || 'name'
  const valueKey = config.valueKey || config.yKeys?.[0] || 'value'

  let running = 0
  const bases: number[] = []
  const values: number[] = []
  data.forEach(d => {
    const val = Number(d[valueKey]) || 0
    if (val >= 0) {
      bases.push(running)
      values.push(val)
      running += val
    } else {
      running += val
      bases.push(running)
      values.push(Math.abs(val))
    }
  })

  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: data.map(d => String(d[xKey])), axisLabel: { fontSize } },
    yAxis: { type: 'value', axisLabel: { fontSize } },
    series: [
      { type: 'bar', stack: 'total', itemStyle: { borderColor: 'transparent', color: 'transparent' }, data: bases },
      {
        type: 'bar', stack: 'total', data: values,
        itemStyle: { color: (params: { dataIndex: number }) => (Number(data[params.dataIndex]?.[valueKey]) || 0) >= 0 ? '#6fd943' : '#ff3a6e' },
        label: { show: true, position: 'top', fontSize },
      },
    ],
  }
}

function buildComboOptions(data: Record<string, unknown>[], config: ChartConfig, fontSize = 11): EChartsOption {
  const xKey = config.xKey || 'name'
  const yKeys = config.yKeys || []

  return {
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, type: fontSize <= 10 ? 'scroll' as const : 'plain' as const, orient: 'horizontal' as const, textStyle: { fontSize } },
    grid: { left: '3%', right: '8%', bottom: '15%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: data.map(d => String(d[xKey])), axisLabel: { fontSize } },
    yAxis: [
      { type: 'value', axisLabel: { fontSize } },
      { type: 'value', axisLabel: { fontSize } },
    ],
    color: config.colors || COLORS,
    series: yKeys.map((key, i) => ({
      name: key,
      type: i === 0 ? ('bar' as const) : ('line' as const),
      yAxisIndex: i === 0 ? 0 : 1,
      data: data.map(d => Number(d[key]) || 0),
      smooth: true,
      ...(i > 0 ? { symbolSize: 6 } : { barMaxWidth: 40, itemStyle: { borderRadius: [4, 4, 0, 0] } }),
    })),
  }
}

function buildBoxplotOptions(data: Record<string, unknown>[], config: ChartConfig, fontSize = 11): EChartsOption {
  const xKey = config.xKey || 'name'

  return {
    tooltip: { trigger: 'item' },
    grid: { left: '10%', right: '10%', bottom: '10%', top: '10%' },
    xAxis: { type: 'category', data: data.map(d => String(d[xKey])), axisLabel: { fontSize } },
    yAxis: { type: 'value', axisLabel: { fontSize } },
    series: [{
      type: 'boxplot',
      data: data.map(d => {
        const vals = (d.values as number[]) || [0, 0, 0, 0, 0]
        return vals
      }),
      itemStyle: { color: '#51459d', borderColor: '#333' },
    }],
  }
}

// ── Option builder registry ─────────────────────────────────────────────────
function buildOptions(type: ChartType, data: Record<string, unknown>[], config: ChartConfig, fontSize = 11): EChartsOption {
  const baseOptions: Partial<EChartsOption> = {
    textStyle: { fontFamily: THEME.fontFamily, fontSize },
    toolbox: config.showToolbox ? {
      feature: { saveAsImage: { title: 'Save' }, dataView: { title: 'Data', readOnly: true }, restore: { title: 'Reset' } },
      right: 10,
      top: 0,
      iconStyle: { borderColor: '#9ca3af' },
    } : undefined,
    dataZoom: config.showDataZoom ? [{ type: 'inside' }, { type: 'slider', bottom: 25 }] : undefined,
  }

  let specific: EChartsOption
  switch (type) {
    case 'bar': specific = buildBarOptions(data, config, fontSize); break
    case 'line': specific = buildLineOptions(data, config, fontSize); break
    case 'area': specific = buildLineOptions(data, { ...config, areaFill: true }, fontSize); break
    case 'pie': specific = buildPieOptions(data, config, false, fontSize); break
    case 'donut': specific = buildPieOptions(data, config, true, fontSize); break
    case 'scatter': specific = buildScatterOptions(data, config, fontSize); break
    case 'radar': specific = buildRadarOptions(data, config, fontSize); break
    case 'funnel': specific = buildFunnelOptions(data, config, fontSize); break
    case 'gauge': specific = buildGaugeOptions(data, config); break
    case 'treemap': specific = buildTreemapOptions(data, config, fontSize); break
    case 'sankey': specific = buildSankeyOptions(data, config, fontSize); break
    case 'heatmap': specific = buildHeatmapOptions(data, config, fontSize); break
    case 'waterfall': specific = buildWaterfallOptions(data, config, fontSize); break
    case 'combo': specific = buildComboOptions(data, config, fontSize); break
    case 'boxplot': specific = buildBoxplotOptions(data, config, fontSize); break
    case 'histogram': specific = buildBarOptions(data, config, fontSize); break // Histogram uses bar internally
    case 'sparkline': specific = buildLineOptions(data, { ...config, showLegend: false, showGrid: false, smooth: true }, fontSize); break
    case 'bullet': specific = buildBarOptions(data, { ...config, horizontal: true }, fontSize); break
    default: specific = buildBarOptions(data, config, fontSize)
  }

  return { ...baseOptions, ...specific }
}

// ── Main component ──────────────────────────────────────────────────────────
export default function ChartRenderer({
  type,
  data,
  config = {},
  height = 300,
  responsive = false,
  loading = false,
  onDataClick,
  className = '',
}: ChartRendererProps) {
  const chartRef = useRef<ReactEChartsCore>(null)
  const breakpoint = useBreakpoint()

  const fontSize = breakpoint === 'mobile' ? 10 : breakpoint === 'tablet' ? 11 : 12
  const options = useMemo(() => buildOptions(type, data, config, fontSize), [type, data, config, fontSize])

  const onEvents = useMemo(() => {
    if (!onDataClick) return undefined
    return {
      click: (params: { name: string; value: unknown; dataIndex: number; data: Record<string, unknown> }) => {
        onDataClick({
          name: params.name,
          value: params.value,
          dataIndex: params.dataIndex,
          data: data[params.dataIndex] || {},
        })
      },
    }
  }, [onDataClick, data])

  const responsiveHeight = breakpoint === 'mobile' ? 200 : breakpoint === 'tablet' ? 300 : 400
  const style = useMemo(() => ({
    height: responsive
      ? `${responsiveHeight}px`
      : typeof height === 'number' ? `${height}px` : height,
    width: '100%',
  }), [height, responsive, responsiveHeight])

  if (type === 'kpi' || type === 'table') {
    return null // KPI cards and tables are handled by separate components
  }

  return (
    <div className={`chart-renderer ${className}`}>
      <ReactEChartsCore
        ref={chartRef}
        echarts={echarts}
        option={options}
        style={style}
        showLoading={loading}
        loadingOption={{
          text: 'Loading...',
          color: '#51459d',
          textColor: '#4b5563',
          maskColor: 'rgba(255, 255, 255, 0.8)',
        }}
        onEvents={onEvents}
        notMerge
        lazyUpdate
      />
    </div>
  )
}

// ── Re-export types for consumers ───────────────────────────────────────────
export { COLORS as CHART_COLORS }
