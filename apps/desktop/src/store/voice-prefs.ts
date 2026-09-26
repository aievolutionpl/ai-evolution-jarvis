import { atom } from 'nanostores'

import { persistBoolean, readKey, storedBoolean } from '@/lib/storage'

// Desktop read-aloud is local; voice.auto_tts belongs to the messaging gateway.
const AUTO_SPEAK_KEY = 'hermes.desktop.autoSpeakReplies'
export const $autoSpeakReplies = atom<boolean>(storedBoolean(AUTO_SPEAK_KEY, false))
// Best-effort persistence must not give config refresh authority again.
let autoSpeakChosen = readKey(AUTO_SPEAK_KEY) !== null

/** Migrate the legacy value once without editing the backend configuration. */
export function applyAutoSpeakFromConfig(config: { voice?: { auto_tts?: unknown } | null } | null | undefined) {
  if (config != null && !autoSpeakChosen) {
    void setAutoSpeakReplies(Boolean(config.voice?.auto_tts))
  }
}

// First configured `voice.stop_phrases` entry — drives the "Say "stop" to end
// the voice chat" notice shown when a voice conversation starts. `null` means
// the user disabled stop phrases (`stop_phrases: []`), so no notice is shown.
// Defaults to "stop" (the backend default) before config loads.
export const $voiceStopPhrase = atom<string | null>('stop')

/** Seed the stop-phrase atom from a loaded config payload (mount / refresh). */
export function applyVoiceStopPhraseFromConfig(
  config: { voice?: { stop_phrases?: unknown } | null } | null | undefined
) {
  const raw = config?.voice?.stop_phrases

  if (raw === undefined) {
    // Key absent — backend default applies.
    $voiceStopPhrase.set('stop')

    return
  }

  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : []
  const first = list.map(entry => String(entry).trim()).find(entry => entry.length > 0)

  $voiceStopPhrase.set(first ?? null)
}

// `voice.thinking_sound` — ambient bubble blips while the agent works during a
// voice conversation (default on, matching the backend default).
export const $thinkingSoundEnabled = atom<boolean>(true)

/** Seed the thinking-sound gate from a loaded config payload. */
export function applyThinkingSoundFromConfig(
  config: { voice?: { thinking_sound?: unknown } | null } | null | undefined
) {
  $thinkingSoundEnabled.set(config?.voice?.thinking_sound !== false)
}

/** Persist even an unchanged value, so migrating false is also one-time. */
export async function setAutoSpeakReplies(enabled: boolean): Promise<void> {
  autoSpeakChosen = true
  persistBoolean(AUTO_SPEAK_KEY, enabled)
  $autoSpeakReplies.set(enabled)
}

/**
 * `voice.engine` — which engine a voice conversation runs on. `classic` is the
 * STT → agent → TTS loop; `realtime` is Live voice (OpenAI Realtime speaks and
 * listens, the agent still does the work).
 */
export type VoiceEngine = 'classic' | 'realtime'

export const $voiceEngine = atom<VoiceEngine>('realtime')

/**
 * Who speaks when the engine is `realtime` (`voice.realtime.provider`), and
 * the model — shown on the home screen so the person knows which voice
 * answers. The backend is what actually picks it when it mints the session.
 */
export interface LiveVoiceChoice {
  model: string
  provider: 'gemini' | 'openai'
}

export const $liveVoiceChoice = atom<LiveVoiceChoice>({ model: 'gemini-3.8-live', provider: 'gemini' })

interface VoiceEngineConfig {
  voice?: {
    engine?: unknown
    realtime?: { gemini?: { model?: unknown } | null; model?: unknown; provider?: unknown } | null
  } | null
}

export function applyVoiceEngineFromConfig(config: null | undefined | VoiceEngineConfig) {
  $voiceEngine.set(config?.voice?.engine === 'classic' ? 'classic' : 'realtime')

  const realtime = config?.voice?.realtime
  const gemini = realtime?.provider !== 'openai'
  const model = gemini ? realtime?.gemini?.model : realtime?.model

  $liveVoiceChoice.set({
    model: typeof model === 'string' && model.trim() ? model.trim() : gemini ? 'gemini-3.8-live' : 'gpt-realtime',
    provider: gemini ? 'gemini' : 'openai'
  })
}

/**
 * `voice.briefing_phrases` — saying one of these asks Jarvis for the daily
 * briefing instead of sending the words as a message. Defaults mirror the
 * backend's until config loads; `[]` turns the trigger off.
 */
export const DEFAULT_BRIEFING_PHRASES = [
  'wake up tatuś wrócił',
  'tatuś wrócił',
  "daddy's home",
  'raport dnia',
  'daily briefing'
]

export const $briefingPhrases = atom<string[]>(DEFAULT_BRIEFING_PHRASES)

export function applyBriefingPhrasesFromConfig(
  config: { voice?: { briefing_phrases?: unknown } | null } | null | undefined
) {
  const raw = config?.voice?.briefing_phrases

  if (raw === undefined) {
    $briefingPhrases.set(DEFAULT_BRIEFING_PHRASES)

    return
  }

  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : []

  $briefingPhrases.set(list.map(entry => String(entry).trim()).filter(Boolean))
}
