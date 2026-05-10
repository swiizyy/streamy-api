import { Head } from '@inertiajs/react'
import AppLayout from '../../layouts/app_layout.js'

interface User {
  id: number
  username: string
  email: string | null
  role: string
  created_at: string
}

interface AdminUsersProps {
  users: User[]
}

export default function AdminUsers({ users }: AdminUsersProps) {
  return (
    <AppLayout>
      <Head title="Utilisateurs — Admin" />
      <div className="page-header">
        <h1 className="page-title">Utilisateurs</h1>
        <span className="page-badge">{users.length} utilisateur(s)</span>
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Nom d'utilisateur</th>
              <th>Email</th>
              <th>Rôle</th>
              <th>Inscrit le</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.username}</td>
                <td>{user.email ?? '—'}</td>
                <td>
                  <span className={`role-badge role-badge--${user.role}`}>{user.role}</span>
                </td>
                <td>{new Date(user.created_at).toLocaleDateString('fr-FR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppLayout>
  )
}
