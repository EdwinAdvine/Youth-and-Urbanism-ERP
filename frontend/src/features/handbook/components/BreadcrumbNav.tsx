import { Link } from 'react-router-dom'
import type { HandbookCategory } from '@/api/handbook'

interface BreadcrumbNavProps {
  category?: HandbookCategory | null
  articleTitle?: string
}

export default function BreadcrumbNav({ category, articleTitle }: BreadcrumbNavProps) {
  return (
    <nav className="flex items-center gap-1.5 text-sm text-gray-500">
      <Link to="/handbook" className="hover:text-primary transition-colors">
        Handbook
      </Link>
      {category && (
        <>
          <span>/</span>
          <Link
            to={`/handbook/category/${category.slug}`}
            className="hover:text-primary transition-colors"
          >
            {category.name}
          </Link>
        </>
      )}
      {articleTitle && (
        <>
          <span>/</span>
          <span className="text-gray-900 font-medium truncate max-w-[300px]">{articleTitle}</span>
        </>
      )}
    </nav>
  )
}
