import { atom, computed } from 'nanostores'

import { FALLBACK_CHARACTER_ID, getCharacter, getVoicePreset } from '@/app/jarvis/characters'
import { persistString, storedString } from '@/lib/storage'

// Which character answers is presentation, not agent behaviour: it changes the
// words on the home screen and which voice we hand the backend, so it lives in
// the renderer's own storage beside the other voice preferences.
const CHARACTER_KEY = 'hermes.desktop.characterId'
const VOICE_PRESET_KEY = 'hermes.desktop.voicePresetId'

// An unpicked app — or one whose stored id this build no longer ships — reads as
// the neutral assistant, so an upgrade never changes how someone is greeted.
export const $characterId = atom<string>(storedString(CHARACTER_KEY) ?? FALLBACK_CHARACTER_ID)

/** The resolved character. Unknown ids resolve to the neutral assistant. */
export const $character = computed($characterId, getCharacter)

/**
 * The picked voice preset, or `null` for "whatever the character ships with".
 * The stored id is only a *preference*: `$voicePreset` resolves it against the
 * current character, so a preset belonging to another character can never win.
 */
export const $voicePresetId = atom<null | string>(storedString(VOICE_PRESET_KEY))

/** The preset actually used for speech. Always defined — a character has voices. */
export const $voicePreset = computed([$character, $voicePresetId], (character, presetId) =>
  getVoicePreset(character, presetId)
)

/** Persist the choice, resolving the id first so a typo can never be stored. */
export function setCharacter(id: string): void {
  const character = getCharacter(id)

  persistString(CHARACTER_KEY, character.id)
  $characterId.set(character.id)

  // Voices do not travel between characters: the previous pick belonged to the
  // character we just left, so the new one starts from what it ships with.
  clearVoicePreset()
}

/** Persist a voice preset that belongs to the current character; ignore others. */
export function setVoicePreset(id: string): void {
  const character = $character.get()

  // Membership, not `getVoicePreset`: that helper falls back to the shipped
  // voice, so it would happily store a preset from another character.
  if (!character.voicePresets.some(preset => preset.id === id)) {
    return
  }

  persistString(VOICE_PRESET_KEY, id)
  $voicePresetId.set(id)
}

/** Back to the character's own voice (stored preference removed). */
export function clearVoicePreset(): void {
  persistString(VOICE_PRESET_KEY, null)
  $voicePresetId.set(null)
}
