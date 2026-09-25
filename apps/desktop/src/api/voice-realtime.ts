import { hermesApi, profileScoped } from './client'

/** `GET /api/voice/realtime/status` — whether Live voice can start (an OpenAI key is set). */
export interface RealtimeVoiceStatusResponse {
  available: boolean
  language: string
  model: string
  voice: string
}

/**
 * `POST /api/voice/realtime/session` — a short-lived client secret for a
 * session the backend has already configured. The OpenAI key itself never
 * reaches the renderer.
 */
export interface RealtimeVoiceSessionResponse {
  calls_url: string
  client_secret: string
  expires_at: null | number
  model: string
  voice: string
}

export function getRealtimeVoiceStatus(): Promise<RealtimeVoiceStatusResponse> {
  return hermesApi<RealtimeVoiceStatusResponse>({ ...profileScoped(), path: '/api/voice/realtime/status' })
}

export function createRealtimeVoiceSession(): Promise<RealtimeVoiceSessionResponse> {
  return hermesApi<RealtimeVoiceSessionResponse>({
    ...profileScoped(),
    method: 'POST',
    path: '/api/voice/realtime/session'
  })
}
