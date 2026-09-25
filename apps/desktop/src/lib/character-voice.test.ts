import { describe, expect, it } from 'vitest'

import { getCharacter } from '@/app/jarvis/characters'
import { voiceForPreset } from '@/lib/character-voice'

const CZESIEK = getCharacter('czesiek')

const elevenlabsTts = {
  api_key: 'k',
  base_url: 'https://api.elevenlabs.io/v1',
  model: 'eleven_multilingual_v2',
  provider: 'elevenlabs',
  speed: 1,
  voice: 'profile-default-voice',
  wire: 'elevenlabs-tts'
}

describe('voiceForPreset', () => {
  it('speaks with the picked voice when the profile has that provider wired', () => {
    const preset = CZESIEK.voicePresets.find(candidate => candidate.id === 'czesiek-b')
    const resolved = voiceForPreset(elevenlabsTts, preset)

    expect(resolved.voice).toBe(preset?.voiceId)
    expect(resolved.model).toBe(preset?.model)
    expect(resolved.api_key).toBe('k')
  })

  it('keeps the profile voice when the picked voice belongs to another provider', () => {
    const openaiPreset = CZESIEK.voicePresets.find(candidate => candidate.provider === 'openai')

    expect(voiceForPreset(elevenlabsTts, openaiPreset)).toEqual(elevenlabsTts)
  })

  it('leaves the config untouched with no pick', () => {
    expect(voiceForPreset(elevenlabsTts, undefined)).toEqual(elevenlabsTts)
  })
})
