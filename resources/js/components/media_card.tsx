export interface MediaItem {
  id: number
  title: string
  name?: string
  poster_path: string | null
  release_date?: string
  first_air_date?: string
  vote_average?: number
  media_type?: 'movie' | 'tv'
  overview?: string
}

interface MediaCardProps {
  item: MediaItem
  type?: 'movie' | 'tv'
  onRequest?: (item: MediaItem, type: 'movie' | 'tv') => void
}

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w300'

export default function MediaCard({ item, type = 'movie', onRequest }: MediaCardProps) {
  const title = item.title || item.name || 'Unknown'
  const year = (item.release_date || item.first_air_date || '').slice(0, 4)
  const mediaType = item.media_type || type
  const posterUrl = item.poster_path ? `${TMDB_IMAGE_BASE}${item.poster_path}` : null

  return (
    <div className="media-card">
      <div className="media-card__poster">
        {posterUrl ? (
          <img src={posterUrl} alt={title} loading="lazy" />
        ) : (
          <div className="media-card__no-poster">No image</div>
        )}
      </div>
      <div className="media-card__info">
        <h3 className="media-card__title">{title}</h3>
        {year && <span className="media-card__year">{year}</span>}
        {item.vote_average !== undefined && (
          <span className="media-card__score">★ {item.vote_average.toFixed(1)}</span>
        )}
      </div>
      {onRequest && (
        <button
          className="media-card__request-btn"
          onClick={() => onRequest(item, mediaType as 'movie' | 'tv')}
          type="button"
        >
          Demander
        </button>
      )}
    </div>
  )
}
