import { atom, computed } from 'nanostores'

import { FALLBACK_CHARACTER_ID, getCharacter } from '@/app/jarvis/characters'
import { persistString, storedString } from '@/lib/storage'

// Which character answers is presentation, not agent behaviour: it changes the
// words on the home screen and which voice we hand the backend, so it lives in
// the renderer's own storage beside the other voice preferences.
const CHARACTER_KEY = 'hermes.desktop.characterId'

// An unpicked app — or one whose stored id this build no longer ships — reads as
// the neutral assistant, so an upgrade never changes how someone is greeted.
export const $characterId = atom<string>(storedString(CHARACTER_KEY) ?? FALLBACK_CHARACTER_ID)

/** The resolved character. Unknown ids resolve to the neutral assistant. */
export const $character = computed($characterId, getCharacter)

/** Persist the choice, resolving the id first so a typo can never be stored. */
export function setCharacter(id: string): void {
  const character = getCharacter(id)

  persistString(CHARACTER_KEY, character.id)
  $characterId.set(character.id)
}
