import type { VoicePreset } from '@/app/jarvis/characters'

/** Which provider a profile's TTS wiring talks to. */
const PROVIDER_BY_WIRE = {
  'elevenlabs-tts': 'elevenlabs',
  'openai-speech': 'openai'
} as const

export interface VoiceOverrideTarget {
  model: null | string
  voice: null | string
  wire: string
}

/**
 * Apply the picked character voice to the profile's TTS config.
 *
 * A preset only applies when the profile has THAT provider wired: sending an
 * OpenAI voice id to ElevenLabs (or the reverse) does not fail loudly, it
 * silently picks a random voice — so the profile's own config keeps the call
 * when the providers differ. A profile with no pick, or none the current
 * character ships, is returned untouched.
 */
export function voiceForPreset<T extends VoiceOverrideTarget>(tts: T, preset: VoicePreset | undefined): T {
  if (!preset || PROVIDER_BY_WIRE[tts.wire as keyof typeof PROVIDER_BY_WIRE] !== preset.provider) {
    return tts
  }

  return { ...tts, model: preset.model, voice: preset.voiceId } as T
}
