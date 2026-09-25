import { atom } from 'nanostores'

import { persistString, storedString } from '@/lib/storage'

/**
 * Focus mode hides the dashboard's side cards: only the orb and the
 * conversation stay. It is this window's presentation, so it lives in the
 * renderer; the key is global because it is a taste, not a per-profile fact.
 */
const FOCUS_MODE_KEY = 'ai-evolution-jarvis-focus-mode-v1'

export const $jarvisFocusMode = atom(storedString(FOCUS_MODE_KEY) === '1')

export function setJarvisFocusMode(on: boolean): void {
  $jarvisFocusMode.set(on)
  persistString(FOCUS_MODE_KEY, on ? '1' : '0')
}

/**
 * Whether the dashboard is showing its card rail right now. The home hero
 * reads it to decide where the quick-access list goes: in the rail when there
 * is one, inline under the orb when there is not (tablet, phone, focus mode).
 */
export const $jarvisRailVisible = atom(false)
