/**
 * Jarvis Pulse and the living greeting, after Leon (leon-ai/leon, MIT).
 *
 * Leon keeps a small queue of things worth raising and learns which ones its
 * owner waves away; its persona also shifts with the time of day. Here the
 * backend (`/api/pulse`) owns the queue and the learning, and this module only
 * turns a matter into words in the user's language. A suggestion never runs by
 * itself: taking it fills the composer, like every other shortcut on the home
 * screen.
 */

import type { PulseKind, PulseMatter } from '@/api/pulse'
import type { Translations } from '@/i18n/types'

export type JarvisDaypart = 'afternoon' | 'evening' | 'morning' | 'night'

/** Upper bound (exclusive) of each part of the day, in local hours. */
const DAYPARTS: readonly [number, JarvisDaypart][] = [
  [5, 'night'],
  [12, 'morning'],
  [18, 'afternoon'],
  [23, 'evening'],
  [24, 'night']
]

export function jarvisDaypart(date: Date): JarvisDaypart {
  const hour = date.getHours()

  return DAYPARTS.find(([end]) => hour < end)?.[1] ?? 'night'
}

export interface PulseSuggestion {
  detail: string
  matter: PulseMatter
  prompt: string
  title: string
}

type PulseCopy = Translations['jarvisShell']['pulse']

/** Words for each matter; a kind this build does not know yet is skipped, not guessed. */
export function pulseSuggestions(matters: readonly PulseMatter[], copy: PulseCopy): PulseSuggestion[] {
  return matters.flatMap(matter => {
    const kind = copy.kinds[matter.kind as PulseKind] as PulseCopy['kinds'][PulseKind] | undefined

    if (!kind) {
      return []
    }

    return [{ detail: kind.detail, matter, prompt: kind.prompt(matter.params), title: kind.title(matter.params) }]
  })
}
