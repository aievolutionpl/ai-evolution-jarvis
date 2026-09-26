import { describe, expect, it } from 'vitest'

import { initialPresetMetadata, normalizePresetMetadata, skillAvailability } from './presets'

describe('subagent preset catalog', () => {
  it('seeds named presets with backend skill identities', () => {
    const metadata = initialPresetMetadata('2026-09-26T10:00:00.000Z')
    expect(metadata.schema_version).toBe(1)
    expect(metadata.presets.map(preset => preset.id)).toEqual(['marketing', 'research', 'competitor-monitoring'])
    expect(metadata.presets.every(preset => preset.skills.every(skill => !skill.name.includes('/')))).toBe(true)
  })

  it('maps availability from the selected backend, including missing skills', () => {
    expect(
      skillAvailability(
        [{ name: 'installed' }, { name: 'disabled' }, { name: 'remote-only' }],
        [
          { name: 'installed', enabled: true },
          { name: 'disabled', enabled: false }
        ]
      )
    ).toEqual([
      { name: 'installed', state: 'enabled' },
      { name: 'disabled', state: 'disabled' },
      { name: 'remote-only', state: 'missing' }
    ])
  })

  it('rejects malformed metadata without inventing a persisted preset', () => {
    expect(normalizePresetMetadata({ schema_version: 2, presets: [{ id: 'bad' }] })).toEqual({
      schema_version: 1,
      presets: []
    })
  })
})
