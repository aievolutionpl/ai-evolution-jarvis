/**
 * The "Newsy" insight view — the digest built by `buildJarvisNews`.
 *
 * It renders whatever the builder produced and nothing else: no placeholder
 * headlines, no "check back later" filler with a fake timestamp. When the
 * digest is empty the view says there is nothing new.
 */

import { Button } from '@/components/ui/button'
import { AlertTriangle, CheckCircle2, Download, ShieldLock, Wrench } from '@/lib/icons'
import { fmtDayTime } from '@/lib/time'
import { cn } from '@/lib/utils'

import type { JarvisNewsItem, JarvisNewsKind } from './news'
import type { JarvisNewsViewCopy } from './panel-copy'

const KIND_ICONS: Record<JarvisNewsKind, React.ComponentType<{ className?: string }>> = {
  approval: ShieldLock,
  engine: Download,
  failure: AlertTriangle,
  release: Download,
  result: CheckCircle2,
  tool: Wrench
}

function toneClass(tone: JarvisNewsItem['tone']): string {
  if (tone === 'warn') {
    return 'text-destructive'
  }

  if (tone === 'accent') {
    return 'text-(--ui-accent)'
  }

  return 'text-(--ui-text-tertiary)'
}

export function JarvisNewsView({
  copy,
  items,
  onOpenUpdate
}: {
  copy: JarvisNewsViewCopy
  items: readonly JarvisNewsItem[]
  onOpenUpdate?: (target: 'backend' | 'client') => void
}) {
  if (items.length === 0) {
    return <p className="py-4 text-sm text-(--ui-text-secondary)">{copy.empty}</p>
  }

  return (
    <ol className="flex flex-col gap-4">
      {items.map(item => {
        const Icon = KIND_ICONS[item.kind]
        const canOpen = Boolean(item.action && onOpenUpdate)

        return (
          <li className="grid grid-cols-[1rem_1fr] gap-3" key={item.id}>
            <Icon className={cn('mt-0.5 size-4 shrink-0', toneClass(item.tone))} />
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex min-w-0 items-baseline justify-between gap-2">
                <span className="min-w-0 text-sm font-medium leading-5 text-(--ui-text-primary)">{item.title}</span>
                {item.at !== undefined && (
                  <time
                    className="shrink-0 text-xs tabular-nums text-(--ui-text-tertiary)"
                    dateTime={new Date(item.at).toISOString()}
                  >
                    {fmtDayTime.format(item.at)}
                  </time>
                )}
              </div>
              {item.detail && <p className="text-xs leading-5 text-(--ui-text-secondary)">{item.detail}</p>}
              {canOpen && (
                <Button
                  className="self-start"
                  onClick={() => onOpenUpdate?.(item.action === 'update-backend' ? 'backend' : 'client')}
                  size="inline"
                  type="button"
                  variant="textStrong"
                >
                  {copy.openUpdate}
                </Button>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
