import ChartRenderer from '../../../components/charts/ChartRenderer'
import { KPICard } from '../../../components/charts'
import { Spinner } from '../../../components/ui'
import { useCRMDashboard } from '../../../api/analytics_dashboards'
import DashboardHeader from './DashboardHeader'

function formatKSh(value: number) {
  if (value >= 1_000_000) return `KSh ${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `KSh ${(value / 1_000).toFixed(0)}K`
  return `KSh ${value.toLocaleString()}`
}

export default function CRMDashboard() {
  const { data, isLoading } = useCRMDashboard()
  if (isLoading || !data) return <div className="flex items-center justify-center min-h-[60vh]"><Spinner size="lg" /></div>
  const { pipeline_stages, lead_sources, conversion_data, velocity_data, deal_sizes, kpis } = data
  const exportSections = [
    { title: 'Pipeline Stages', data: pipeline_stages },
    { title: 'Lead Sources', data: lead_sources },
    { title: 'Conversion Rate Trend', data: conversion_data },
    { title: 'Deal Velocity', data: velocity_data },
    { title: 'Deal Size Distribution', data: deal_sizes },
  ]
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <DashboardHeader title="CRM Dashboard" subtitle="Pipeline, conversions, deal velocity and lead analytics" exportSections={exportSections} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Pipeline Deals" value={kpis.pipeline_deals} color="#51459d" />
        <KPICard label="Pipeline Value" value={formatKSh(kpis.pipeline_value)} color="#6fd943" />
        <KPICard label="Conversion Rate" value={`${kpis.conversion_rate}%`} color="#3ec9d6" />
        <KPICard label="Avg Deal Size" value={formatKSh(kpis.avg_deal_size)} color="#ffa21d" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Sales Pipeline</h3><p className="text-xs text-gray-400 mb-4">Funnel conversion by stage</p>
          <ChartRenderer type="funnel" data={pipeline_stages} config={{nameKey:'name',valueKey:'value',colors:['#51459d','#6fd943','#3ec9d6','#ffa21d','#ff3a6e'],showLegend:true}} height={260} />
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Lead Sources</h3><p className="text-xs text-gray-400 mb-4">Where leads come from</p>
          <ChartRenderer type="donut" data={lead_sources} config={{nameKey:'name',valueKey:'value',colors:['#51459d','#6fd943','#3ec9d6','#ffa21d','#ff3a6e'],showLegend:true}} height={260} />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Conversion Rate Trend</h3><p className="text-xs text-gray-400 mb-4">Monthly lead-to-deal conversion</p>
          <ChartRenderer type="line" data={conversion_data} config={{xKey:'month',yKeys:['rate'],colors:['#6fd943'],showGrid:true,showLegend:false,smooth:true}} height={240} />
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Deal Velocity</h3><p className="text-xs text-gray-400 mb-4">Average days to close</p>
          <ChartRenderer type="bar" data={velocity_data} config={{xKey:'month',yKeys:['days'],colors:['#3ec9d6'],showGrid:true,showLegend:false}} height={240} />
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-[10px] p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Deal Size Distribution</h3><p className="text-xs text-gray-400 mb-4">Number of deals by value range</p>
        <ChartRenderer type="bar" data={deal_sizes} config={{xKey:'range',yKeys:['count'],colors:['#51459d'],showGrid:true,showLegend:false}} height={240} />
      </div>
    </div>
  )
}
