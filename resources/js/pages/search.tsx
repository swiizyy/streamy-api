import type { FormEvent } from 'react'
import { useState } from 'react'
import { Head, router } from '@inertiajs/react'
import AppLayout from '../layouts/app_layout.js'
import MediaCard, { type MediaItem } from '../components/media_card.js'

interface SearchProps {
  results?: MediaItem[]
  query?: string
  type?: 'movie' | 'tv'
}

export default function SearchPage({ results = [], query = '', type = 'movie' }: SearchProps) {
  const [searchQuery, setSearchQuery] = useState(query)
  const [mediaType, setMediaType] = useState<'movie' | 'tv'>(type)

  function handleSearch(e: FormEvent) {
    e.preventDefault()
    router.get('/search', { q: searchQuery, type: mediaType }, { preserveState: true })
  }

  function handleRequest(item: MediaItem, itemType: 'movie' | 'tv') {
    router.post('/requests', { tmdb_id: item.id, media_type: itemType })
  }

  return (
    <AppLayout>
      <Head title="Rechercher — StreamyAPI" />
      <div className="page-header">
        <h1 className="page-title">Rechercher un média</h1>
      </div>
      <form onSubmit={handleSearch} className="search-form">
        <div className="search-type-tabs">
          <button
            type="button"
            className={`tab${mediaType === 'movie' ? ' tab--active' : ''}`}
            onClick={() => setMediaType('movie')}
          >
            Films
          </button>
          <button
            type="button"
            className={`tab${mediaType === 'tv' ? ' tab--active' : ''}`}
            onClick={() => setMediaType('tv')}
          >
            Séries
          </button>
        </div>
        <div className="search-input-row">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
            placeholder="Titre du film ou de la série…"
            className="search-input"
          />
          <button type="submit" className="btn btn--primary">
            Rechercher
          </button>
        </div>
      </form>

      {results.length > 0 && (
        <div className="media-grid">
          {results.map((item) => (
            <MediaCard key={item.id} item={item} type={mediaType} onRequest={handleRequest} />
          ))}
        </div>
      )}

      {query && results.length === 0 && (
        <p className="empty-state">Aucun résultat pour « {query} ».</p>
      )}
    </AppLayout>
  )
}
