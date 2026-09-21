import { CheckCircle2, Clock, Wrench } from '@/lib/icons'

import type { JarvisEvent } from './types'

export interface JarvisActivityCopy {
  empty: string
  close: string
  title: string
  types: Record<string, string>
}

function activityLabel(event: JarvisEvent, copy: JarvisActivityCopy): string {
  return event.label?.trim() || copy.types[event.type] || event.type
}

function activityDetail(event: JarvisEvent): null | string {
  return event.detail?.trim() || null
}

function ActivityIcon({ type }: { type: string }) {
  if (type === 'tool.completed' || type === 'task.verified') {
    return <CheckCircle2 className="size-4 text-(--ui-accent)" />
  }

  if (type.startsWith('tool.')) {
    return <Wrench className="size-4 text-(--ui-text-tertiary)" />
  }

  return <Clock className="size-4 text-(--ui-text-tertiary)" />
}

/**
 * The raw event log, newest first. Deliberately the plainest of the three
 * insight views: it is the audit trail behind everything the charts and the
 * digest summarize.
 */
export function JarvisActivityList({ copy, events }: { copy: JarvisActivityCopy; events: readonly JarvisEvent[] }) {
  const visibleEvents = events.slice(-50).reverse()

  if (visibleEvents.length === 0) {
    return <p className="py-4 text-sm text-(--ui-text-secondary)">{copy.empty}</p>
  }

  return (
    <ol className="space-y-3">
      {visibleEvents.map((event, index) => {
        const detail = activityDetail(event)

        return (
          <li className="grid grid-cols-[1rem_1fr] gap-3 text-sm" key={`${event.at}:${event.type}:${index}`}>
            <ActivityIcon type={event.type} />
            <div className="min-w-0">
              <div className="truncate font-medium text-(--ui-text-primary)">{activityLabel(event, copy)}</div>
              {detail && <div className="truncate text-xs text-(--ui-text-secondary)">{detail}</div>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
