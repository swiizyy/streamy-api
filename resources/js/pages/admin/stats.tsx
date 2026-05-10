import { Head } from '@inertiajs/react'
import AppLayout from '../../layouts/app_layout.js'
import StatsChart, { type ChartDataPoint } from '../../components/stats_chart.js'

interface GlobalStats {
  active_users: number
  total_watch_hours: number
  top_media: Array<{ jellyfin_item_id: string; title: string; count: number }>
  top_users: Array<{ user_id: number; username: string; watch_hours: number; views: number }>
  peak_hours: Array<{ hour: number; count: number }>
}

interface AdminStatsProps {
  stats: GlobalStats
  activity: ChartDataPoint[]
}

export default function AdminStats({ stats, activity }: AdminStatsProps) {
  return (
    <AppLayout>
      <Head title="Statistiques globales — Admin" />
      <div className="page-header">
        <h1 className="page-title">Statistiques globales</h1>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-card__value">{stats.active_users}</span>
          <span className="stat-card__label">Utilisateurs actifs</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__value">{stats.total_watch_hours.toFixed(0)}h</span>
          <span className="stat-card__label">Heures regardées</span>
        </div>
      </div>

      <StatsChart data={activity} title="Activité (30 derniers jours)" />

      <div className="admin-two-cols">
        <section className="section">
          <h2 className="section-title">Top médias</h2>
          <ol className="rank-list">
            {stats.top_media.map((item, i) => (
              <li key={item.jellyfin_item_id} className="rank-list__item">
                <span className="rank-list__position">{i + 1}</span>
                <span className="rank-list__name">{item.title}</span>
                <span className="rank-list__count">{item.count} vue(s)</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="section">
          <h2 className="section-title">Top utilisateurs</h2>
          <ol className="rank-list">
            {stats.top_users.map((user, i) => (
              <li key={user.user_id} className="rank-list__item">
                <span className="rank-list__position">{i + 1}</span>
                <span className="rank-list__name">{user.username}</span>
                <span className="rank-list__count">{user.watch_hours.toFixed(0)}h</span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </AppLayout>
  )
}
