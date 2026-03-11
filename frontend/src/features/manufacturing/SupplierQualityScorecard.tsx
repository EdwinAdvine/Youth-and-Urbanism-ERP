import { Card, Badge } from '../../components/ui'
import { useSupplierQualityScorecard } from '../../api/manufacturing_quality'

interface Props {
  supplierId: string
}

export default function SupplierQualityScorecard({ supplierId }: Props) {
  const { data: scorecard, isLoading } = useSupplierQualityScorecard(supplierId)

  if (isLoading) return <Card className="p-4">Loading scorecard...</Card>
  if (!scorecard) return <Card className="p-4 text-gray-500">No quality data for this supplier</Card>

  const scoreColor = scorecard.quality_score >= 80 ? 'green' : scorecard.quality_score >= 60 ? 'yellow' : 'red'

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Supplier Quality Scorecard</h3>
        <Badge variant={scoreColor} className="text-lg px-3 py-1">{scorecard.quality_score}/100</Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold">{scorecard.total_ncrs}</div>
          <div className="text-xs text-gray-500">Total NCRs</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">{scorecard.open_ncrs}</div>
          <div className="text-xs text-gray-500">Open NCRs</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-red-600">{scorecard.ncrs_by_severity.critical || 0}</div>
          <div className="text-xs text-gray-500">Critical</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-500">{scorecard.ncrs_by_severity.major || 0}</div>
          <div className="text-xs text-gray-500">Major</div>
        </div>
      </div>
    </Card>
  )
}
