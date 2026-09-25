import { describe, expect, it } from 'vitest'

import { en } from '@/i18n/en'
import { pl } from '@/i18n/pl'
import { zh } from '@/i18n/zh'

import { appViewForPath } from '../routes'

import { JARVIS_API_KEYS, JARVIS_API_SERVER, JARVIS_CONNECTIONS, JARVIS_KEY_ROUTES } from './connections-catalog'

describe('connections catalog', () => {
  it('sends every settings button to a real page, never back to the chat by fallback', () => {
    const routes = [
      ...JARVIS_CONNECTIONS.flatMap(connection => (connection.setup.kind === 'page' ? [connection.setup.route] : [])),
      ...Object.values(JARVIS_KEY_ROUTES),
      JARVIS_API_SERVER.route
    ]

    for (const route of routes) {
      expect(appViewForPath(new URL(route, 'http://jarvis.local').pathname)).not.toBe('chat')
    }
  })

  it('has words for every connection and key in every full locale, and a guided prompt for agent setups', () => {
    for (const locale of [en, pl, zh]) {
      for (const connection of JARVIS_CONNECTIONS) {
        const entry = locale.jarvisConnections.entries[connection.id]

        expect(entry.name.length).toBeGreaterThan(0)
        expect(entry.steps.length).toBeGreaterThan(0)
        expect(locale.jarvisConnections.auth[connection.auth].length).toBeGreaterThan(0)

        if (connection.setup.kind === 'agent') {
          expect(entry.prompt.length).toBeGreaterThan(20)
        }
      }

      for (const key of JARVIS_API_KEYS) {
        expect(locale.jarvisConnections.keys.purposes[key.id].length).toBeGreaterThan(0)
      }
    }
  })

  it('points every credential link at https', () => {
    const urls = [
      ...JARVIS_CONNECTIONS.flatMap(c => (c.credentialUrl ? [c.credentialUrl] : [])),
      ...JARVIS_API_KEYS.map(k => k.url)
    ]

    for (const url of urls) {
      expect(new URL(url).protocol).toBe('https:')
    }
  })
})
