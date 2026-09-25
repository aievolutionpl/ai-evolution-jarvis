import { describe, expect, it } from 'vitest'

import type { PulseMatter } from '@/api/pulse'
import { en } from '@/i18n/en'
import { pl } from '@/i18n/pl'

import { jarvisDaypart, pulseSuggestions } from './pulse'

const at = (hour: number) => new Date(2026, 8, 25, hour, 15)

describe('jarvisDaypart', () => {
  it('names every hour of the day, moving forward through the day without gaps', () => {
    const order = ['morning', 'afternoon', 'evening', 'night']
    const parts = Array.from({ length: 24 }, (_, hour) => jarvisDaypart(at(hour)))

    // From 05:00 the parts only move forward, and every part appears.
    const fromDawn = parts.slice(5).map(part => order.indexOf(part))

    expect(fromDawn).toEqual([...fromDawn].sort((a, b) => a - b))
    expect(new Set(parts)).toEqual(new Set(order))
    expect(jarvisDaypart(at(2))).toBe(jarvisDaypart(at(23)))
  })
})

describe('pulseSuggestions', () => {
  it('puts the matter parameters into the words it shows and the request it fills', () => {
    const matter: PulseMatter = {
      id: 'resume_session:s1',
      kind: 'resume_session',
      params: { session_id: 's1', title: 'Plan kampanii' },
      score: 0.7
    }

    for (const locale of [en, pl]) {
      const [suggestion] = pulseSuggestions([matter], locale.jarvisShell.pulse)

      expect(suggestion.title).toContain('Plan kampanii')
      expect(suggestion.prompt).toContain('s1')
    }
  })

  it('skips a kind this build does not know instead of guessing words for it', () => {
    const unknown = { id: 'x', kind: 'from_the_future', params: {}, score: 1 } as unknown as PulseMatter

    expect(pulseSuggestions([unknown], en.jarvisShell.pulse)).toEqual([])
  })
})
