/**
 * The dashboard's "Newsy" digest.
 *
 * Everything in this feed already happened: an approval the backend is waiting
 * on, the result it verified, the failure it reported, the release notes the
 * updater actually fetched. Nothing is a headline we wrote ourselves, and an
 * input we do not have simply produces no item — an empty digest is a correct
 * digest. Same rule as the rest of the dashboard: no decorative content
 * without data behind it (`docs/product/AI_EVOLUTION_JARVIS_DESIGN.md` §5).
 */

import type { DesktopUpdateStatus } from '@/global'
import { buildCommitChangelog } from '@/lib/commit-changelog'

import type { JarvisMetrics } from './metrics'
import type { JarvisEvent, JarvisUiState } from './types'

export type JarvisNewsKind = 'approval' | 'engine' | 'failure' | 'release' | 'result' | 'tool'

export type JarvisNewsTone = 'accent' | 'neutral' | 'warn'

export interface JarvisNewsItem {
  id: string
  kind: JarvisNewsKind
  title: string
  detail?: string
  /** Real event time, when the source carries one. */
  at?: number
  tone: JarvisNewsTone
  /** Set when the item has a real destination the shell can open. */
  action?: 'update-backend' | 'update-client'
}

export interface JarvisNewsCopy {
  approvalTitle: string
  approvalDetail: string
  engineTitle: string
  failureTitle: string
  releaseTitle: string
  releaseNoNotes: string
  resultTitle: string
  toolTitle: string
  toolDetail: (label: string, runs: number) => string
}

export interface JarvisNewsInput {
  backendUpdate: DesktopUpdateStatus | null
  clientUpdate: DesktopUpdateStatus | null
  copy: JarvisNewsCopy
  metrics: JarvisMetrics
  state: JarvisUiState
}

export const JARVIS_NEWS_LIMIT = 6

function lastEventOfType(events: readonly JarvisEvent[], type: string): JarvisEvent | undefined {
  return events.findLast(event => event.type === type)
}

function eventText(event: JarvisEvent | undefined): string | undefined {
  const value = (event?.detail ?? event?.label ?? '').trim()

  return value || undefined
}

/** The real commit subjects behind an update, joined into one readable line. */
function releaseDetail(status: DesktopUpdateStatus, fallback: string): string {
  const subjects = buildCommitChangelog(status.commits, { maxGroups: 3, maxPerGroup: 2, maxTotal: 3 }).flatMap(
    group => group.items
  )

  // `buildCommitChangelog` always returns something; its placeholder group is
  // not release notes, so treat "no real commits" as no notes.
  if (!status.commits?.length || subjects.length === 0) {
    return fallback
  }

  return subjects.join(' · ')
}

function updateItem(
  status: DesktopUpdateStatus | null,
  kind: 'engine' | 'release',
  title: string,
  noNotes: string,
  action: 'update-backend' | 'update-client'
): JarvisNewsItem | null {
  if (!status?.supported || !status.updateAvailable) {
    return null
  }

  return {
    action,
    at: status.fetchedAt,
    detail: releaseDetail(status, noNotes),
    id: `${kind}:${status.targetSha ?? status.currentSha ?? 'pending'}`,
    kind,
    title,
    tone: 'accent'
  }
}

/**
 * Build the digest, most urgent first: something waiting on the user, then
 * what just happened, then what changed in the product.
 */
export function buildJarvisNews({
  backendUpdate,
  clientUpdate,
  copy,
  metrics,
  state
}: JarvisNewsInput): JarvisNewsItem[] {
  const items: JarvisNewsItem[] = []

  if (state.task.phase === 'approval') {
    const event = lastEventOfType(state.activity, 'task.approval')

    items.push({
      at: event?.at,
      detail: eventText(event) ?? copy.approvalDetail,
      id: `approval:${state.task.id ?? 'current'}`,
      kind: 'approval',
      title: copy.approvalTitle,
      tone: 'warn'
    })
  }

  const failure = lastEventOfType(state.activity, 'task.failed')

  if (failure) {
    items.push({
      at: failure.at,
      detail: eventText(failure),
      id: `failure:${failure.at}`,
      kind: 'failure',
      title: copy.failureTitle,
      tone: 'warn'
    })
  }

  const verified = lastEventOfType(state.activity, 'task.verified')
  const verifiedText = eventText(verified)

  if (verified && verifiedText) {
    items.push({
      at: verified.at,
      detail: verifiedText,
      id: `result:${verified.at}`,
      kind: 'result',
      title: copy.resultTitle,
      tone: 'accent'
    })
  }

  const client = updateItem(clientUpdate, 'release', copy.releaseTitle, copy.releaseNoNotes, 'update-client')

  if (client) {
    items.push(client)
  }

  const backend = updateItem(backendUpdate, 'engine', copy.engineTitle, copy.releaseNoNotes, 'update-backend')

  if (backend) {
    items.push(backend)
  }

  const busiest = metrics.tools[0]

  if (busiest && busiest.runs > 0) {
    items.push({
      detail: copy.toolDetail(busiest.label, busiest.runs),
      id: `tool:${busiest.id}`,
      kind: 'tool',
      title: copy.toolTitle,
      tone: 'neutral'
    })
  }

  return items.slice(0, JARVIS_NEWS_LIMIT)
}
