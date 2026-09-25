import { hermesApi, profileScoped } from './client'

export type PulseKind = 'failing_job' | 'first_automation' | 'know_owner' | 'resume_session'

export interface PulseMatter {
  id: string
  kind: PulseKind
  params: Record<string, string>
  score: number
}

/** `GET /api/pulse` — at most a few matters worth raising, already filtered by what the owner dismissed. */
export function getPulse(): Promise<{ generated_at: number; matters: PulseMatter[] }> {
  return hermesApi({ ...profileScoped(), path: '/api/pulse' })
}

export function sendPulseFeedback(matter: PulseMatter, reaction: 'accept' | 'decline'): Promise<{ ok: boolean }> {
  return hermesApi({
    ...profileScoped(),
    path: '/api/pulse/feedback',
    method: 'POST',
    body: { id: matter.id, kind: matter.kind, reaction }
  })
}
