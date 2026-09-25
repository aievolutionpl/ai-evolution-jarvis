/**
 * One entry point for Live voice, whichever provider speaks.
 *
 * The backend decides the provider (`voice.realtime.provider`) when it mints
 * the session, so the renderer asks once and follows the answer: OpenAI
 * Realtime over WebRTC, or Gemini Live over a WebSocket. Both share the same
 * handlers — status, level, `ask_jarvis` → a normal agent turn — so the
 * composer's conversation surface does not care which one it got.
 */

import type { GeminiLiveVoiceSessionResponse, RealtimeVoiceSessionResponse } from '@/api/voice-realtime'

import { startGeminiLiveVoice } from '../gemini-live-voice'
import { type RealtimeVoiceHandlers, type RealtimeVoiceSession, startRealtimeVoice } from '../realtime-voice'

export interface LiveVoiceDeps {
  createSession: () => Promise<RealtimeVoiceSessionResponse>
}

export async function startLiveVoice(
  handlers: RealtimeVoiceHandlers,
  { createSession }: LiveVoiceDeps
): Promise<RealtimeVoiceSession> {
  handlers.onStatus('connecting')

  const session = await createSession()

  if (session.provider === 'gemini') {
    // Reconnects mint again; a provider switch mid-call ends the call rather
    // than feeding an OpenAI secret to the Gemini socket.
    const again = async (): Promise<GeminiLiveVoiceSessionResponse> => {
      const next = await createSession()

      if (next.provider !== 'gemini') {
        throw new Error('The Live voice provider changed; start the conversation again.')
      }

      return next
    }

    return startGeminiLiveVoice(handlers, { createSession: again, session })
  }

  // Older backends answer without `provider`: that is OpenAI.
  return startRealtimeVoice(handlers, { createSession: async () => session })
}
