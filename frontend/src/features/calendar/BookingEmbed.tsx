import { useParams, useSearchParams } from 'react-router-dom'
import BookingWidget from './BookingWidget'

/**
 * BookingEmbed — standalone public page for /book/:slug
 *
 * Renders BookingWidget in a full-page, no-nav, no-sidebar layout.
 *
 * Supported query params:
 *   ?color=%2351459d   — accent hex color (URL-encoded)
 *   ?compact=true      — compact mode for smaller containers
 */
export default function BookingEmbed() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams] = useSearchParams()

  const rawColor = searchParams.get('color')
  const accentColor = rawColor
    ? rawColor.startsWith('#')
      ? rawColor
      : `#${rawColor}`
    : undefined

  const compact = searchParams.get('compact') === 'true'

  if (!slug) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-400">No booking page specified.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-start justify-center px-4 py-8 sm:py-14">
      <div className="w-full" style={{ maxWidth: 500 }}>
        <BookingWidget
          slug={slug}
          accentColor={accentColor}
          compact={compact}
        />
      </div>
    </div>
  )
}
