import { hermesApi, profileScoped } from './client'

/** The native-notification kinds worth a phone buzz, plus the settings test. */
export type PushKind = 'approval' | 'backgroundDone' | 'input' | 'test' | 'turnDone' | 'turnError'

export interface PushStatus {
  available: boolean
  platform: string
  target: null | string
}

/** `GET /api/notify/push/status` — is ntfy set up for this profile, and to which topic. */
export function getPushStatus(): Promise<PushStatus> {
  return hermesApi<PushStatus>({ ...profileScoped(), path: '/api/notify/push/status' })
}

/** `POST /api/notify/push` — the same alert the OS shows, sent to the phone over ntfy. */
export function sendPushNotification(push: { body?: string; kind: PushKind; title: string }): Promise<{ ok: boolean }> {
  return hermesApi({ ...profileScoped(), path: '/api/notify/push', method: 'POST', body: push })
}
