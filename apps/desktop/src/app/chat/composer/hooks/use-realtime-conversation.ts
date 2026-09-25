import { useCallback, useEffect, useRef, useState } from 'react'

import { createRealtimeVoiceSession } from '@/api/voice-realtime'
import { chatMessageText } from '@/lib/chat-messages'
import { type RealtimeVoiceSession, type RealtimeVoiceStatus, startRealtimeVoice } from '@/lib/realtime-voice'
import { notifyError } from '@/store/notifications'

import type { ConversationStatus } from './use-voice-conversation'

/** How long one `ask_jarvis` turn may run before the voice gives up on it. */
const ASK_TIMEOUT_MS = 5 * 60_000
const ASK_POLL_MS = 300

interface ReplyMessage {
  hidden?: boolean
  id: string
  pending?: boolean
  role: string
}

interface UseRealtimeConversationArgs {
  enabled: boolean
  failureLabel: string
  /** Current transcript of this composer's chat. */
  messages: () => readonly ReplyMessage[]
  /** True while an agent turn is in flight. */
  busy: () => boolean
  /** Mark a reply as already voiced, so read-aloud never speaks it twice. */
  markSpoken: (id: string) => void
  onFatalError: () => void
  onSubmit: (text: string) => Promise<void> | void
}

const STATUS: Record<RealtimeVoiceStatus, ConversationStatus> = {
  connecting: 'transcribing',
  listening: 'listening',
  speaking: 'speaking',
  thinking: 'thinking'
}

/**
 * Live voice for the composer: the same conversation surface as the classic
 * loop (`status`, `muted`, `end`, …), backed by an OpenAI Realtime session. A
 * spoken request that needs the agent runs as a normal turn in this chat, so
 * it stays in the transcript like any typed one.
 */
export function useRealtimeConversation({
  busy,
  enabled,
  failureLabel,
  markSpoken,
  messages,
  onFatalError,
  onSubmit
}: UseRealtimeConversationArgs) {
  const [status, setStatus] = useState<ConversationStatus>('idle')
  const [muted, setMuted] = useState(false)
  const [level, setLevel] = useState(0)
  const sessionRef = useRef<null | RealtimeVoiceSession>(null)
  const args = useRef({ busy, failureLabel, markSpoken, messages, onFatalError, onSubmit })
  args.current = { busy, failureLabel, markSpoken, messages, onFatalError, onSubmit }

  const ask = useCallback(async (request: string) => {
    const known = new Set(args.current.messages().map(message => message.id))

    await args.current.onSubmit(request)

    const started = Date.now()

    // The reply is the newest visible assistant message this turn produced,
    // once the turn is over — tool narration mid-turn is not the answer.
    for (;;) {
      await new Promise(resolve => setTimeout(resolve, ASK_POLL_MS))

      if (!args.current.busy()) {
        const reply = args.current
          .messages()
          .findLast(message => message.role === 'assistant' && !message.hidden && !known.has(message.id))

        if (reply && !reply.pending) {
          args.current.markSpoken(reply.id)

          return chatMessageText(reply as Parameters<typeof chatMessageText>[0])
        }

        if (Date.now() - started > 2_000) {
          return 'The task finished without a written answer.'
        }
      }

      if (Date.now() - started > ASK_TIMEOUT_MS) {
        return 'This is taking long; the task keeps running in the chat.'
      }
    }
  }, [])

  const end = useCallback(async () => {
    sessionRef.current?.stop()
    sessionRef.current = null
    setMuted(false)
    setStatus('idle')
    setLevel(0)
  }, [])

  // eslint-disable-next-line no-restricted-syntax -- session lifecycle (open/close a WebRTC call), not an atom mirror
  useEffect(() => {
    if (!enabled) {
      void end()

      return undefined
    }

    let cancelled = false

    void startRealtimeVoice(
      {
        onAsk: ask,
        onError: message => {
          notifyError(new Error(message), args.current.failureLabel)
          args.current.onFatalError()
        },
        // Quantized: the meter needs ~32 steps, not a re-render per sample.
        onLevel: next => setLevel(Math.round(next * 32) / 32),
        onStatus: next => setStatus(STATUS[next])
      },
      { createSession: createRealtimeVoiceSession }
    ).then(
      session => {
        if (cancelled) {
          session.stop()
        } else {
          sessionRef.current = session
        }
      },
      error => {
        if (!cancelled) {
          notifyError(error, args.current.failureLabel)
          setStatus('idle')
          args.current.onFatalError()
        }
      }
    )

    return () => {
      cancelled = true
      void end()
    }
  }, [ask, enabled, end])

  const toggleMute = useCallback(() => {
    setMuted(value => {
      sessionRef.current?.setMuted(!value)

      return !value
    })
  }, [])

  // Turn detection is server-side: there is no local "end my turn" to force.
  const stopTurn = useCallback(() => undefined, [])
  const start = useCallback(async () => undefined, [])

  return { end, level, muted, start, status, stopTurn, toggleMute }
}
