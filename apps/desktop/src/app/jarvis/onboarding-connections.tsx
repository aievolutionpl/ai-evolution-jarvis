/**
 * Setup step: which tools the person wants connected, plus the two words the
 * rest of the product uses for "connecting" — API keys and Jarvis's own API.
 *
 * Nothing is connected here. The choice is a selection like any other; when
 * setup finishes, the Połączenia page opens with the chosen entries first and
 * a guided setup for each (connections-catalog.ts owns what exists).
 */

import type { Translations } from '@/i18n'
import { Check, KeyRound, Network } from '@/lib/icons'
import { cn } from '@/lib/utils'

import { CONNECTION_ICONS } from './connection-icons'
import { JARVIS_CONNECTIONS, type JarvisConnectionId } from './connections-catalog'

export interface ConnectionsStepProps {
  catalog: Translations['jarvisConnections']
  copy: Translations['jarvisOnboarding']['connections']
  onToggle: (id: JarvisConnectionId) => void
  selected: readonly JarvisConnectionId[]
}

export function ConnectionsStep({ catalog, copy, onToggle, selected }: ConnectionsStepProps) {
  return (
    <div className="grid gap-4" data-testid="jarvis-onboarding-connections">
      <div>
        <p className="text-lg font-semibold">{copy.title}</p>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-[#C7CBD1]">{copy.body}</p>
      </div>

      <div aria-label={copy.title} className="grid gap-2 sm:grid-cols-2" role="group">
        {JARVIS_CONNECTIONS.map(connection => {
          const { icon: Icon, tile } = CONNECTION_ICONS[connection.id]
          const entry = catalog.entries[connection.id]
          const checked = selected.includes(connection.id)

          return (
            <button
              aria-checked={checked}
              className={cn(
                'flex min-h-20 items-start gap-3 rounded-md border p-3 text-left transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#00B7FF]/50',
                checked ? 'border-[#00B7FF] bg-[#00B7FF]/12' : 'border-white/10 bg-black/20 hover:border-white/20'
              )}
              data-connection={connection.id}
              key={connection.id}
              onClick={() => onToggle(connection.id)}
              role="checkbox"
              type="button"
            >
              <span className={cn('grid size-9 shrink-0 place-items-center rounded-md', tile)}>
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  {entry.name}
                  {checked ? <Check className="size-4 text-[#00B7FF]" /> : null}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-[#C7CBD1]">{entry.description}</span>
                <span className="mt-1.5 inline-block rounded-full border border-white/12 px-2 py-0.5 text-[0.68rem] text-[#9299A5]">
                  {catalog.auth[connection.auth]}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <p aria-live="polite" className="text-sm text-[#9299A5]">
        {copy.selected(selected.length)}
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-md border border-white/10 bg-black/20 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="size-4 text-[#00B7FF]" />
            {copy.keysTitle}
          </p>
          <p className="mt-1 text-sm leading-5 text-[#C7CBD1]">{copy.keysBody}</p>
        </div>
        <div className="rounded-md border border-white/10 bg-black/20 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Network className="size-4 text-[#00B7FF]" />
            {copy.apiTitle}
          </p>
          <p className="mt-1 text-sm leading-5 text-[#C7CBD1]">{copy.apiBody}</p>
        </div>
      </div>
      <p className="text-xs text-[#9299A5]">{copy.later}</p>
    </div>
  )
}
