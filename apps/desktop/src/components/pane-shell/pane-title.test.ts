import { describe, expect, it } from 'vitest'

import { en } from '@/i18n/en'
import { pl } from '@/i18n/pl'

import { localizePaneTitle } from './pane-title'

describe('localizePaneTitle', () => {
  it('shows built-in panes in the UI language and leaves live titles alone', () => {
    expect(localizePaneTitle('sessions', 'sessions', pl.zones.paneNames)).toBe(pl.zones.paneNames.sessions)
    expect(localizePaneTitle('Bots', 'x', pl.zones.paneNames)).toBe(pl.zones.paneNames.bots)
    expect(localizePaneTitle(undefined, 'terminal', en.zones.paneNames)).toBe(en.zones.paneNames.terminal)
    expect(localizePaneTitle('Oferta dla klienta', 'workspace', pl.zones.paneNames)).toBe('Oferta dla klienta')
  })

  it('translates every built-in pane into Polish', () => {
    for (const key of Object.keys(en.zones.paneNames) as (keyof typeof en.zones.paneNames)[]) {
      expect(pl.zones.paneNames[key]).toBeTruthy()
    }
  })
})
