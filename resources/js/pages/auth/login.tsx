import type { FormEvent } from 'react'
import { Head, useForm } from '@inertiajs/react'
import AuthLayout from '../../layouts/auth_layout.js'

export default function LoginPage() {
  const { data, setData, post, processing, errors } = useForm({
    username: '',
    password: '',
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    post('/auth/login')
  }

  return (
    <AuthLayout title="Connexion avec Jellyfin">
      <Head title="Connexion — StreamyAPI" />
      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <label htmlFor="username">Nom d'utilisateur</label>
          <input
            id="username"
            type="text"
            value={data.username}
            onChange={(e) => setData('username', (e.target as HTMLInputElement).value)}
            autoComplete="username"
            required
          />
          {errors.username && <span className="form-error">{errors.username}</span>}
        </div>
        <div className="form-group">
          <label htmlFor="password">Mot de passe</label>
          <input
            id="password"
            type="password"
            value={data.password}
            onChange={(e) => setData('password', (e.target as HTMLInputElement).value)}
            autoComplete="current-password"
            required
          />
          {errors.password && <span className="form-error">{errors.password}</span>}
        </div>
        <button type="submit" disabled={processing} className="btn btn--primary btn--full">
          {processing ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </AuthLayout>
  )
}
