type RequestStatus = 'pending' | 'approved' | 'declined' | 'downloading' | 'available'

interface RequestStatusBadgeProps {
  status: RequestStatus
}

const LABELS: Record<RequestStatus, string> = {
  pending: 'En attente',
  approved: 'Approuvée',
  declined: 'Refusée',
  downloading: 'Téléchargement',
  available: 'Disponible',
}

export default function RequestStatusBadge({ status }: RequestStatusBadgeProps) {
  return <span className={`status-badge status-badge--${status}`}>{LABELS[status] ?? status}</span>
}
