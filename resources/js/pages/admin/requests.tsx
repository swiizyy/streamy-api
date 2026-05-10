import { Head, Link, router } from '@inertiajs/react'
import AppLayout from '../../layouts/app_layout.js'
import RequestStatusBadge from '../../components/request_status_badge.js'

interface MediaRequest {
  id: number
  title: string
  media_type: 'movie' | 'tv'
  status: 'pending' | 'approved' | 'declined' | 'downloading' | 'available'
  requested_at: string
  user: { id: number; username: string }
}

interface PaginatedRequests {
  data: MediaRequest[]
  meta: { total: number; current_page: number; last_page: number }
}

interface AdminRequestsProps {
  requests: PaginatedRequests
}

export default function AdminRequests({ requests }: AdminRequestsProps) {
  function handleApprove(id: number) {
    router.put(`/requests/${id}`, { action: 'approve' })
  }

  function handleDecline(id: number) {
    router.put(`/requests/${id}`, { action: 'decline' })
  }

  return (
    <AppLayout>
      <Head title="Toutes les demandes — Admin" />
      <div className="page-header">
        <h1 className="page-title">Toutes les demandes</h1>
        <span className="page-badge">{requests.meta.total} total</span>
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Titre</th>
              <th>Type</th>
              <th>Utilisateur</th>
              <th>Date</th>
              <th>Statut</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.data.map((req) => (
              <tr key={req.id}>
                <td>
                  <Link href={`/requests/${req.id}`}>{req.title}</Link>
                </td>
                <td>{req.media_type === 'movie' ? 'Film' : 'Série'}</td>
                <td>{req.user.username}</td>
                <td>{new Date(req.requested_at).toLocaleDateString('fr-FR')}</td>
                <td>
                  <RequestStatusBadge status={req.status} />
                </td>
                <td>
                  {req.status === 'pending' && (
                    <div className="action-group">
                      <button
                        className="btn btn--sm btn--success"
                        onClick={() => handleApprove(req.id)}
                        type="button"
                      >
                        Approuver
                      </button>
                      <button
                        className="btn btn--sm btn--danger"
                        onClick={() => handleDecline(req.id)}
                        type="button"
                      >
                        Refuser
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {requests.meta.last_page > 1 && (
        <div className="pagination">
          {Array.from({ length: requests.meta.last_page }, (_, i) => i + 1).map((page) => (
            <Link
              key={page}
              href={`/admin/requests?page=${page}`}
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
