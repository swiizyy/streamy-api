import { Head, Link } from '@inertiajs/react'
import AppLayout from '../layouts/app_layout.js'
import RequestStatusBadge from '../components/request_status_badge.js'

interface MediaRequest {
  id: number
  title: string
  media_type: 'movie' | 'tv'
  status: 'pending' | 'approved' | 'declined' | 'downloading' | 'available'
  requested_at: string
}

interface UserStats {
  total_watch_hours: number
  movies_watched: number
  episodes_watched: number
}

interface DashboardProps {
  recentRequests: MediaRequest[]
  stats: UserStats | null
}

export default function Dashboard({ recentRequests, stats }: DashboardProps) {
  return (
    <AppLayout>
      <Head title="Dashboard — StreamyAPI" />
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <Link href="/search" className="btn btn--primary">
          + Nouvelle demande
        </Link>
      </div>

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-card__value">{stats.total_watch_hours.toFixed(0)}h</span>
            <span className="stat-card__label">Regardé</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__value">{stats.movies_watched}</span>
            <span className="stat-card__label">Films</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__value">{stats.episodes_watched}</span>
            <span className="stat-card__label">Épisodes</span>
          </div>
        </div>
      )}

      <section className="section">
        <div className="section-header">
          <h2 className="section-title">Mes dernières demandes</h2>
          <Link href="/requests" className="link">
            Voir tout
          </Link>
        </div>
        {recentRequests.length === 0 ? (
          <p className="empty-state">Aucune demande pour le moment.</p>
        ) : (
          <div className="request-list">
            {recentRequests.map((req) => (
              <Link key={req.id} href={`/requests/${req.id}`} className="request-row">
                <span className="request-row__title">{req.title}</span>
                <span className="request-row__type">{req.media_type === 'movie' ? 'Film' : 'Série'}</span>
                <RequestStatusBadge status={req.status} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </AppLayout>
  )
}
