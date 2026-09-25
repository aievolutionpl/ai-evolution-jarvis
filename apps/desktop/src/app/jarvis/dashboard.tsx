import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { Activity } from '@/lib/icons'
import { cn } from '@/lib/utils'

import { JarvisCore } from './core'
import { JarvisInsightsPanel } from './insights-panel'
import { deriveJarvisMetrics } from './metrics'
import type { JarvisNewsItem } from './news'
import type { JarvisInsightsView } from './panel-copy'
import { JarvisStatusStrip } from './status-strip'
import { JarvisTipsLauncher } from './tips'
import type { JarvisUiState } from './types'

type DashboardLayout = 'desktop' | 'mobile' | 'tablet'

/** Work in flight — nothing may open itself over it. */
const BUSY_PHASES = new Set<JarvisUiState['task']['phase']>(['approval', 'cancelling', 'planning', 'running'])

export interface JarvisDashboardProps {
  children: ReactNode
  className?: string
  connected: boolean
  /**
   * A fresh draft is showing the home hero, which carries its own orb and
   * greeting — the header drops both so the screen says each thing once.
   */
  home?: boolean
  layout?: DashboardLayout
  /** The digest built from real update status and real session events. */
  news?: readonly JarvisNewsItem[]
  onOpenUpdate?: (target: 'backend' | 'client') => void
  profileDisplayName?: string
  /** Cards stacked above the insights panel in the desktop rail. */
  rail?: ReactNode
  state: JarvisUiState
  voiceControls?: ReactNode
}

function greeting(
  copy: ReturnType<typeof useI18n>['t']['jarvisShell']['dashboard'],
  profileDisplayName?: string
): string {
  const name = profileDisplayName?.trim()

  return name ? copy.emptyGreeting(name) : copy.emptyGreeting()
}

function dashboardLayoutForViewport(): DashboardLayout {
  if (window.matchMedia?.('(max-width: 767px)').matches) {
    return 'mobile'
  }

  if (window.matchMedia?.('(max-width: 1149px)').matches) {
    return 'tablet'
  }

  return 'desktop'
}

function useDashboardLayout(override: DashboardLayout | undefined): DashboardLayout {
  const [layout, setLayout] = useState<DashboardLayout>(() => override ?? dashboardLayoutForViewport())

  useEffect(() => {
    if (override) {
      setLayout(override)

      return undefined
    }

    const media = [window.matchMedia?.('(max-width: 767px)'), window.matchMedia?.('(max-width: 1149px)')].filter(
      Boolean
    ) as MediaQueryList[]

    const update = () => setLayout(dashboardLayoutForViewport())

    // The override may have just been dropped, so resync before listening.
    update()

    for (const query of media) {
      query.addEventListener?.('change', update)
      query.addListener?.(update)
    }

    return () => {
      for (const query of media) {
        query.removeEventListener?.('change', update)
        query.removeListener?.(update)
      }
    }
  }, [override])

  return layout
}

function ResultHeader({
  copy,
  profileDisplayName,
  state
}: {
  copy: ReturnType<typeof useI18n>['t']['jarvisShell']['dashboard']
  profileDisplayName?: string
  state: JarvisUiState
}) {
  const title = state.result?.trim()

  return (
    <header className="shrink-0 px-4 py-4 md:px-5">
      {title ? (
        // The result is the headline. Its "done" state is already on the
        // status strip above — repeating it here would say the same thing
        // twice on one screen.
        <h1 className="text-xl font-semibold leading-7 text-(--ui-text-primary)">{title}</h1>
      ) : (
        <p className="text-sm font-medium text-(--ui-text-secondary)">{greeting(copy, profileDisplayName)}</p>
      )}
    </header>
  )
}

export function JarvisDashboard({
  children,
  className,
  connected,
  home = false,
  layout: layoutOverride,
  news = [],
  onOpenUpdate,
  profileDisplayName,
  rail,
  state,
  voiceControls
}: JarvisDashboardProps) {
  const { t } = useI18n()
  const copy = t.jarvisShell.dashboard
  const layout = useDashboardLayout(layoutOverride)
  const [activityOpen, setActivityOpen] = useState(layout === 'desktop')
  const [view, setView] = useState<JarvisInsightsView>('activity')
  // The rail (desktop home cards) leaves the conversation column too narrow
  // for the full-size status orb beside the status pills.
  const compactCore = layout !== 'desktop' || Boolean(rail)
  const activityPanelId = useId()
  const activityTitleId = useId()
  const activityToggleRef = useRef<HTMLButtonElement>(null)
  const activityCloseRef = useRef<HTMLButtonElement>(null)

  // Derived, not stored: the activity list is the single source of truth, so
  // the charts can never disagree with the log above them.
  const metrics = useMemo(() => deriveJarvisMetrics(state.activity), [state.activity])
  const attention = news.filter(item => item.tone === 'warn').length
  const busy = BUSY_PHASES.has(state.task.phase)

  useEffect(() => {
    setActivityOpen(layout === 'desktop')
  }, [layout])

  const conversation = (
    <main
      aria-label={copy.conversationLabel}
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-(--ui-chat-surface-background)"
    >
      <div className="flex shrink-0 flex-col gap-4 px-4 pt-4 md:flex-row md:items-center md:justify-between md:px-5">
        {/* Centered while the column is stacked; flush left once the status
            strip sits beside it. */}
        {home ? null : (
          <JarvisCore className="mx-auto md:mx-0" compact={compactCore} live taskPhase={state.task.phase} voice={state.voice} />
        )}
        <div className={cn('flex flex-wrap items-center gap-2', home && 'md:ml-auto')}>
          <JarvisStatusStrip connected={connected} copy={copy.status} state={state} />
          {/* The deck is capability- and history-aware, so it lives here rather
              than behind a menu: it is the answer to "and now what?" that the
              empty greeting above raises. */}
          <JarvisTipsLauncher busy={busy} hasHistory={state.activity.length > 0} />
        </div>
      </div>
      {/* At rest on home the hero's talk button is the voice entry point; the
          full controls (mute, stop speaking, stop task) appear once there is
          something to control. */}
      {voiceControls && (!home || busy || state.voice !== 'idle') ? (
        <div className="shrink-0 px-4 pt-3 md:px-5">{voiceControls}</div>
      ) : null}
      {home ? null : <ResultHeader copy={copy} profileDisplayName={profileDisplayName} state={state} />}
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </main>
  )

  useEffect(() => {
    if (layout === 'desktop' || !activityOpen) {
      return undefined
    }

    activityCloseRef.current?.focus()

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      event.preventDefault()
      setActivityOpen(false)
      activityToggleRef.current?.focus()
    }

    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [activityOpen, layout])

  const closeActivity = () => {
    setActivityOpen(false)
    activityToggleRef.current?.focus()
  }

  const insightsPanel = (
    <JarvisInsightsPanel
      className={cn(
        layout === 'desktop' && (rail ? 'min-h-[22rem] shrink-0 rounded-xl border border-(--ui-stroke-tertiary)' : 'w-80'),
        layout === 'tablet' && 'absolute inset-y-4 right-4 z-20 w-80 rounded-md',
        layout === 'mobile' && 'absolute inset-x-3 bottom-16 z-20 max-h-[60vh] rounded-md'
      )}
      closeButtonRef={activityCloseRef}
      copy={{
        activity: copy.activity,
        news: copy.news,
        stats: copy.stats,
        tabs: copy.insightTabs,
        viewsLabel: copy.insightViewsLabel
      }}
      events={state.activity}
      id={activityPanelId}
      labelledBy={activityTitleId}
      metrics={metrics}
      news={news}
      onClose={layout === 'desktop' ? undefined : closeActivity}
      onOpenUpdate={onOpenUpdate}
      onViewChange={setView}
      surface={layout === 'desktop' ? 'panel' : layout === 'tablet' ? 'drawer' : 'bottom-sheet'}
      view={view}
    />
  )

  return (
    <section
      className={cn(
        'relative flex h-full min-h-0 min-w-0 overflow-hidden bg-(--ui-chat-surface-background) text-(--ui-text-primary)',
        layout === 'mobile' && 'flex-col',
        className
      )}
      data-jarvis-dashboard=""
      data-layout={layout}
      data-testid="jarvis-dashboard"
    >
      {conversation}
      {layout === 'desktop' &&
        (rail ? (
          // The rail scrolls as one column: the cards first, then the session's
          // own activity — so a long news list never squeezes the log away.
          <div
            className="flex w-80 shrink-0 flex-col gap-3 overflow-y-auto border-l border-(--ui-stroke-tertiary) p-3"
            data-testid="jarvis-rail"
          >
            {rail}
            {insightsPanel}
          </div>
        ) : (
          insightsPanel
        ))}
      {layout !== 'desktop' && (
        <Button
          aria-controls={activityPanelId}
          aria-expanded={activityOpen}
          aria-label={copy.showActivity}
          className="absolute right-4 top-4 z-20 min-h-11"
          onClick={() => setActivityOpen(open => !open)}
          ref={activityToggleRef}
          size="sm"
          type="button"
          variant="secondary"
        >
          <Activity />
          {copy.showActivity}
          {attention > 0 && (
            <Badge size="xs" variant="warn">
              {attention}
            </Badge>
          )}
        </Button>
      )}
      {layout !== 'desktop' && activityOpen && insightsPanel}
    </section>
  )
}
