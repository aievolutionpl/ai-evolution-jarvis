import { describe, expect, it } from 'vitest'

import type { DesktopUpdateStatus } from '@/global'

import { deriveJarvisMetrics } from './metrics'
import { buildJarvisNews, type JarvisNewsCopy } from './news'
import { initialJarvisUiState } from './projector'
import type { JarvisEvent, JarvisUiState } from './types'

const copy: JarvisNewsCopy = {
  approvalDetail: 'Sprawdź szczegóły i zdecyduj.',
  approvalTitle: 'Czeka na Twoją zgodę',
  engineTitle: 'Nowa wersja silnika',
  failureTitle: 'Zadanie nie powiodło się',
  releaseNoNotes: 'Brak opisu zmian.',
  releaseTitle: 'Nowa wersja Agenta Cześka',
  resultTitle: 'Gotowy rezultat',
  toolDetail: (label, runs) => `${label} — ${runs}`,
  toolTitle: 'Najczęstsze narzędzie'
}

function state(activity: readonly JarvisEvent[], overrides: Partial<JarvisUiState> = {}): JarvisUiState {
  return { ...initialJarvisUiState(), activity, sessionId: 's1', ...overrides }
}

function input(activity: readonly JarvisEvent[], overrides: Partial<Parameters<typeof buildJarvisNews>[0]> = {}) {
  return {
    backendUpdate: null,
    clientUpdate: null,
    copy,
    metrics: deriveJarvisMetrics(activity),
    state: state(activity),
    ...overrides
  }
}

describe('buildAgent CzesiekNews', () => {
  it('returns nothing when no real signal exists yet', () => {
    expect(buildJarvisNews(input([]))).toEqual([])
  })

  it('leads with an approval the backend is actually waiting on', () => {
    const activity: JarvisEvent[] = [
      { at: 5, detail: 'Usunięcie pliku raport.pdf', sessionId: 's1', taskId: 't1', type: 'task.approval' }
    ]

    const news = buildJarvisNews(input(activity, { state: state(activity, { task: { id: 't1', phase: 'approval' } }) }))

    expect(news[0]).toMatchObject({
      at: 5,
      detail: 'Usunięcie pliku raport.pdf',
      kind: 'approval',
      title: 'Czeka na Twoją zgodę',
      tone: 'warn'
    })
  })

  it('carries the real verified result text and skips an empty one', () => {
    const withText: JarvisEvent[] = [
      { at: 9, detail: 'Notatka została utworzona.', sessionId: 's1', type: 'task.verified' }
    ]

    expect(buildJarvisNews(input(withText))[0]).toMatchObject({
      detail: 'Notatka została utworzona.',
      kind: 'result'
    })

    const withoutText: JarvisEvent[] = [{ at: 9, sessionId: 's1', type: 'task.verified' }]
    expect(buildJarvisNews(input(withoutText))).toEqual([])
  })

  it('reports a failure with the detail the backend sent', () => {
    const activity: JarvisEvent[] = [{ at: 3, detail: 'Brak dostępu do folderu', sessionId: 's1', type: 'task.failed' }]

    expect(buildJarvisNews(input(activity))[0]).toMatchObject({
      detail: 'Brak dostępu do folderu',
      kind: 'failure',
      tone: 'warn'
    })
  })

  it('turns a fetched update into release news with its real commit subjects', () => {
    const clientUpdate: DesktopUpdateStatus = {
      commits: [
        { at: 1, author: 'a', sha: 'aaa', summary: 'feat(voice): add Polish TTS' },
        { at: 2, author: 'b', sha: 'bbb', summary: 'chore: bump deps' },
        { at: 3, author: 'c', sha: 'ccc', summary: 'fix(core): stop the pulse from stalling' }
      ],
      fetchedAt: 42,
      supported: true,
      targetSha: 'ccc',
      updateAvailable: true
    }

    const news = buildJarvisNews(input([], { clientUpdate }))

    expect(news[0]).toMatchObject({
      action: 'update-client',
      at: 42,
      id: 'release:ccc',
      kind: 'release',
      title: 'Nowa wersja Agenta Cześka'
    })
    expect(news[0].detail).toContain('Add Polish TTS')
    expect(news[0].detail).toContain('Stop the pulse from stalling')
    // Internal noise stays out of a customer-facing digest.
    expect(news[0].detail).not.toContain('bump deps')
  })

  it('says so honestly when an update carries no release notes', () => {
    const clientUpdate: DesktopUpdateStatus = { supported: true, updateAvailable: true }

    expect(buildJarvisNews(input([], { clientUpdate }))[0]).toMatchObject({
      detail: 'Brak opisu zmian.',
      kind: 'release'
    })
  })

  it('ignores an update the platform cannot check or that is already current', () => {
    expect(buildJarvisNews(input([], { clientUpdate: { supported: false, updateAvailable: true } }))).toEqual([])
    expect(buildJarvisNews(input([], { clientUpdate: { supported: true, updateAvailable: false } }))).toEqual([])
  })

  it('reports the busiest tool only once it has really finished a run', () => {
    const started: JarvisEvent[] = [
      { at: 1, label: 'Terminal', sessionId: 's1', toolCallId: 'a', type: 'tool.started' }
    ]

    expect(buildJarvisNews(input(started))).toEqual([])

    const finished: JarvisEvent[] = [
      ...started,
      { at: 2, label: 'Terminal', sessionId: 's1', toolCallId: 'a', type: 'tool.completed' }
    ]

    expect(buildJarvisNews(input(finished))[0]).toMatchObject({
      detail: 'Terminal — 1',
      kind: 'tool',
      tone: 'neutral'
    })
  })

  it('orders the digest by urgency and caps it', () => {
    const activity: JarvisEvent[] = [
      { at: 1, label: 'Terminal', sessionId: 's1', toolCallId: 'a', type: 'tool.started' },
      { at: 2, label: 'Terminal', sessionId: 's1', toolCallId: 'a', type: 'tool.completed' },
      { at: 3, detail: 'Nie udało się zapisać', sessionId: 's1', type: 'task.failed' },
      { at: 4, detail: 'Plik zapisany', sessionId: 's1', type: 'task.verified' },
      { at: 5, detail: 'Wyślij e-mail', sessionId: 's1', type: 'task.approval' }
    ]

    const news = buildJarvisNews(
      input(activity, {
        backendUpdate: { supported: true, targetSha: 'eee', updateAvailable: true },
        clientUpdate: { supported: true, targetSha: 'ccc', updateAvailable: true },
        state: state(activity, { task: { id: 't1', phase: 'approval' } })
      })
    )

    expect(news.map(item => item.kind)).toEqual(['approval', 'failure', 'result', 'release', 'engine', 'tool'])
    expect(news).toHaveLength(6)
    expect(new Set(news.map(item => item.id)).size).toBe(6)
  })
})
