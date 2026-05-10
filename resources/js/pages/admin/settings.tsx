import type { FormEvent } from 'react'
import { Head, useForm } from '@inertiajs/react'
import AppLayout from '../../layouts/app_layout.js'

interface NotificationSettings {
  smtp_enabled: boolean
  discord_enabled: boolean
  slack_enabled: boolean
  ntfy_enabled: boolean
}

interface AdminSettingsProps {
  notifications: NotificationSettings
}

export default function AdminSettings({ notifications }: AdminSettingsProps) {
  const { data, setData, patch, processing } = useForm({
    smtp_enabled: notifications.smtp_enabled,
    discord_enabled: notifications.discord_enabled,
    slack_enabled: notifications.slack_enabled,
    ntfy_enabled: notifications.ntfy_enabled,
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    patch('/admin/settings/notifications')
  }

  const fields = [
    ['smtp_enabled', 'Email (SMTP)'],
    ['discord_enabled', 'Discord Webhook'],
    ['slack_enabled', 'Slack Webhook'],
    ['ntfy_enabled', 'Ntfy'],
  ] as const

  return (
    <AppLayout>
      <Head title="Paramètres — Admin" />
      <div className="page-header">
        <h1 className="page-title">Paramètres</h1>
      </div>

      <div className="settings-sections">
        <section className="settings-section">
          <h2 className="settings-section__title">Notifications</h2>
          <p className="settings-section__hint">
            Les credentials (SMTP, webhooks…) sont configurés via les variables d'environnement.
          </p>
          <form onSubmit={handleSubmit}>
            <div className="toggle-group">
              {fields.map(([field, label]) => (
                <label key={field} className="toggle-row">
                  <span className="toggle-row__label">{label}</span>
                  <input
                    type="checkbox"
                    checked={data[field]}
                    onChange={(e) => setData(field, (e.target as HTMLInputElement).checked)}
                    className="toggle-checkbox"
                  />
                </label>
              ))}
            </div>
            <button type="submit" disabled={processing} className="btn btn--primary">
              {processing ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </form>
        </section>
      </div>
    </AppLayout>
  )
}
