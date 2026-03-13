/**
 * ProjectLayout — persistent tab navigation wrapper for all project detail routes.
 *
 * Wraps /projects/:id/* routes so every view (Board, List, Gantt, Milestones, etc.)
 * has a visible tab bar at the top. This makes the full feature set discoverable
 * without relying on the user knowing the direct URLs.
 */
import { useParams, useLocation, NavLink, Outlet } from 'react-router-dom'
import { cn } from '../../components/ui'
import { useProject } from '../../api/projects'

const TABS = [
  { label: 'Board',       path: '',             title: 'Kanban board view' },
  { label: 'List',        path: '/list',         title: 'Task list view' },
  { label: 'Backlog',     path: '/backlog',       title: 'Backlog management' },
  { label: 'Calendar',    path: '/calendar',      title: 'Calendar view' },
  { label: 'Gantt',       path: '/gantt',         title: 'Gantt chart timeline' },
  { label: 'Milestones',  path: '/milestones',    title: 'Project milestones' },
  { label: 'Burndown',    path: '/burndown',      title: 'Sprint burndown chart' },
  { label: 'Dashboard',   path: '/dashboard',     title: 'Project analytics dashboard' },
  { label: 'Time Log',    path: '/time-report',   title: 'Time tracking & reports' },
  { label: 'Integrations',path: '/integrations',  title: 'Cross-module links' },
  { label: 'Automations', path: '/automations',   title: 'Task automation rules' },
  { label: 'Fields',      path: '/custom-fields', title: 'Custom field management' },
] as const

export default function ProjectLayout() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const { data: project } = useProject(id!)

  // Determine active tab — board is the index route (exact match /projects/:id)
  const suffix = location.pathname.replace(`/projects/${id}`, '') || ''

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Project name breadcrumb + tab strip */}
      <div className="shrink-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        {/* Project title row */}
        <div className="flex items-center gap-2 px-4 pt-3 pb-1">
          <NavLink
            to="/projects"
            className="text-xs text-gray-400 hover:text-primary transition-colors"
          >
            Projects
          </NavLink>
          <svg className="h-3 w-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
            {project?.name ?? '…'}
          </span>
          {project?.color && (
            <span
              className="inline-block h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: project.color }}
            />
          )}
        </div>

        {/* Tab strip — scrollable on small screens */}
        <div className="overflow-x-auto">
          <div className="flex gap-0 px-3 min-w-max">
            {TABS.map(({ label, path, title }) => {
              const href = `/projects/${id}${path}`
              // Board tab is active when suffix is empty (exact /projects/:id)
              const isActive = path === ''
                ? suffix === '' || suffix === '/'
                : suffix === path

              return (
                <NavLink
                  key={path}
                  to={href}
                  end={path === ''}
                  title={title}
                  className={cn(
                    'px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors',
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:border-gray-300'
                  )}
                >
                  {label}
                </NavLink>
              )
            })}
          </div>
        </div>
      </div>

      {/* Page content */}
      <div className="flex-1 min-h-0 overflow-auto">
        <Outlet />
      </div>
    </div>
  )
}
