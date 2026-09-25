import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { getCharacter } from '@/app/jarvis/characters'
import { I18nProvider } from '@/i18n'
import { $characterId, $voicePreset, $voicePresetId, setCharacter, setVoicePreset } from '@/store/character'

import { CharacterSettings } from './character-settings'

const CZESIEK = getCharacter('czesiek')
const NEUTRAL = getCharacter('jarvis')

function renderPane(locale: 'en' | 'pl' = 'pl') {
  render(
    <I18nProvider configClient={null} initialLocale={locale}>
      <CharacterSettings />
    </I18nProvider>
  )
}

beforeEach(() => setCharacter(NEUTRAL.id))

afterEach(() => {
  cleanup()
  setCharacter(NEUTRAL.id)
})

describe('CharacterSettings', () => {
  it('switching the assistant hands the voice to one that assistant ships with', () => {
    renderPane()

    fireEvent.click(screen.getByRole('radio', { name: /Czesiek/ }))

    expect($characterId.get()).toBe(CZESIEK.id)
    // The invariant: no voice preset outlives the character it belonged to.
    expect(CZESIEK.voicePresets.map(preset => preset.id)).toContain($voicePreset.get()?.id)
    expect($voicePreset.get()?.id).toBe(CZESIEK.voicePresets.find(preset => preset.recommended)?.id)
  })

  it('remembers a hand-picked voice and drops it when the assistant changes', () => {
    renderPane()

    fireEvent.click(screen.getByRole('radio', { name: /Czesiek/ }))
    fireEvent.click(screen.getByRole('radio', { name: /Czesiek B/ }))
    expect($voicePresetId.get()).toBe('czesiek-b')

    fireEvent.click(screen.getByRole('radio', { name: /Jarvis/ }))

    expect($characterId.get()).toBe(NEUTRAL.id)
    expect($voicePresetId.get()).toBeNull()
    expect($voicePreset.get()?.id).toBe(NEUTRAL.voicePresets[0]?.id)
  })

  it('ignores a voice that belongs to another assistant instead of going voiceless', () => {
    setCharacter(CZESIEK.id)
    const before = $voicePreset.get()?.id

    setVoicePreset('openai-alloy')

    expect($voicePresetId.get()).toBeNull()
    expect($voicePreset.get()?.id).toBe(before)
  })
})
