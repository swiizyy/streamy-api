import { Head, Link } from '@inertiajs/react'
import AppLayout from '../../layouts/app_layout.js'
import RequestStatusBadge from '../../components/request_status_badge.js'

interface MediaRequest {
  id: number
  title: string
  media_type: 'movie' | 'tv'
  status: 'pending' | 'approved' | 'declined' | 'downloading' | 'available'
  requested_at: string
  notes: string | null
}

interface PaginatedRequests {
  data: MediaRequest[]
  meta: { total: number; per_page: number; current_page: number; last_page: number }
}

interface RequestsIndexProps {
  requests: PaginatedRequests
}

export default function RequestsIndex({ requests }: RequestsIndexProps) {
  return (
    <AppLayout>
      <Head title="Mes demandes — StreamyAPI" />
      <div className="page-header">
        <h1 className="page-title">Mes demandes</h1>
        <Link href="/search" className="btn btn--primary">
          + Nouvelle demande
        </Link>
      </div>

      {requests.data.length === 0 ? (
        <div className="empty-state">
          <p>Aucune demande.</p>
          <Link href="/search" className="btn btn--primary">
            Rechercher un média
          </Link>
        </div>
      ) : (
        <div className="request-list">
          {requests.data.map((req) => (
            <Link key={req.id} href={`/requests/${req.id}`} className="request-row">
              <div className="request-row__info">
                <span className="request-row__title">{req.title}</span>
                <span className="request-row__type">{req.media_type === 'movie' ? 'Film' : 'Série'}</span>
              </div>
              <div className="request-row__meta">
                <RequestStatusBadge status={req.status} />
                <span className="request-row__date">
                  {new Date(req.requested_at).toLocaleDateString('fr-FR')}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {requests.meta.last_page > 1 && (
        <div className="pagination">
          {Array.from({ length: requests.meta.last_page }, (_, i) => i + 1).map((page) => (
            <Link
              key={page}
              href={`/requests?page=${page}`}
              className={`pagination__btn${page === requests.meta.current_page ? ' pagination__btn--active' : ''}`}
            >
              {page}
            </Link>
          ))}
        </div>
      )}
    </AppLayout>
  )
}
