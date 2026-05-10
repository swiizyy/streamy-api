import React from 'react'
import { Link, router, usePage } from '@inertiajs/react'

interface AppLayoutProps {
  children: React.ReactNode
}

interface PageProps {
  auth?: {
    user?: {
      id: number
      username: string
      role: string
    }
  }
}

function SidebarLink({
  href,
  children,
  active,
}: {
  href: string
  children: React.ReactNode
  active?: boolean
}) {
  return (
    <Link
      href={href}
      className={`sidebar-link${active ? ' sidebar-link--active' : ''}`}
    >
      {children}
    </Link>
  )
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { url, props } = usePage<PageProps>()
  const user = props.auth?.user
  const isAdmin = user?.role === 'admin'

  function handleLogout() {
    router.post('/auth/logout')
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-logo">StreamyAPI</span>
        </div>
        <nav className="sidebar-nav">
          <SidebarLink href="/" active={url === '/'}>
            Dashboard
          </SidebarLink>
          <SidebarLink href="/search" active={url.startsWith('/search')}>
            Rechercher
          </SidebarLink>
          <SidebarLink href="/requests" active={url.startsWith('/requests')}>
            Mes demandes
          </SidebarLink>
          {isAdmin && (
            <>
              <div className="sidebar-section">Administration</div>
              <SidebarLink href="/admin/requests" active={url.startsWith('/admin/requests')}>
                Toutes les demandes
              </SidebarLink>
              <SidebarLink href="/admin/stats" active={url.startsWith('/admin/stats')}>
                Statistiques
              </SidebarLink>
              <SidebarLink href="/admin/users" active={url.startsWith('/admin/users')}>
                Utilisateurs
              </SidebarLink>
              <SidebarLink href="/admin/settings" active={url.startsWith('/admin/settings')}>
                Paramètres
              </SidebarLink>
            </>
          )}
        </nav>
        <div className="sidebar-footer">
          <span className="sidebar-user">{user?.username}</span>
          <button className="sidebar-logout" onClick={handleLogout} type="button">
            Déconnexion
          </button>
        </div>
      </aside>
      <main className="app-content">{children}</main>
    </div>
  )
}
