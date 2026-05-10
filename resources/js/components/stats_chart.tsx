export interface ChartDataPoint {
  date: string
  total_duration_hours: number
  count: number
}

interface StatsChartProps {
  data: ChartDataPoint[]
  title?: string
}

export default function StatsChart({ data, title }: StatsChartProps) {
  if (!data.length) {
    return <div className="stats-chart stats-chart--empty">Aucune donnée disponible</div>
  }

  const maxHours = Math.max(...data.map((d) => d.total_duration_hours), 1)

  return (
    <div className="stats-chart">
      {title && <h3 className="stats-chart__title">{title}</h3>}
      <div className="stats-chart__bars">
        {data.map((point) => (
          <div key={point.date} className="stats-chart__bar-group">
            <div
              className="stats-chart__bar"
              style={{ height: `${(point.total_duration_hours / maxHours) * 100}%` }}
              title={`${point.total_duration_hours.toFixed(1)}h — ${point.count} vue(s)`}
            />
            <span className="stats-chart__label">{point.date}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
