import { Head, Link } from '@inertiajs/react'
import AppLayout from '../../layouts/app_layout.js'
import RequestStatusBadge from '../../components/request_status_badge.js'

interface MediaRequest {
  id: number
  title: string
  media_type: 'movie' | 'tv'
  status: 'pending' | 'approved' | 'declined' | 'downloading' | 'available'
  requested_at: string
  responded_at: string | null
  notes: string | null
  user: { id: number; username: string }
}

interface ShowProps {
  request: MediaRequest
}

export default function RequestShow({ request }: ShowProps) {
  return (
    <AppLayout>
      <Head title={`${request.title} — Demande`} />
      <div className="page-header">
        <Link href="/requests" className="btn btn--ghost">
          ← Retour
        </Link>
      </div>
      <div className="detail-card">
        <div className="detail-card__header">
          <h1 className="detail-card__title">{request.title}</h1>
          <RequestStatusBadge status={request.status} />
        </div>
        <dl className="detail-list">
          <dt>Type</dt>
          <dd>{request.media_type === 'movie' ? 'Film' : 'Série'}</dd>
          <dt>Demandé par</dt>
          <dd>{request.user.username}</dd>
          <dt>Date de demande</dt>
          <dd>{new Date(request.requested_at).toLocaleString('fr-FR')}</dd>
          {request.responded_at && (
            <>
              <dt>Date de réponse</dt>
              <dd>{new Date(request.responded_at).toLocaleString('fr-FR')}</dd>
            </>
          )}
          {request.notes && (
            <>
              <dt>Notes</dt>
              <dd>{request.notes}</dd>
            </>
          )}
        </dl>
      </div>
    </AppLayout>
  )
}
