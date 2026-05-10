declare module '@adonisjs/inertia/types' {
  interface InertiaPages {
    'auth/login': Record<string, never>
    'dashboard': { recentRequests: unknown[]; stats: unknown | null }
    'search': { results: unknown[]; query: string; type: string }
    'requests/index': { requests: unknown }
    'requests/show': { request: unknown }
    'admin/requests': { requests: unknown }
    'admin/stats': { stats: unknown; activity: unknown[] }
    'admin/users': { users: unknown[] }
    'admin/settings': { notifications: unknown }
  }
}
