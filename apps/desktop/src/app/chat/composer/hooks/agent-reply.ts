import { chatMessageText } from '@/lib/chat-messages'
import type { ChatMessage } from '@/lib/chat-messages/types'

export type ReplyMessage = Pick<ChatMessage, 'hidden' | 'id' | 'parts' | 'pending' | 'role'>

export interface AgentReplySource {
  /** True while an agent turn is in flight. */
  busy: () => boolean
  messages: () => readonly ReplyMessage[]
}

export type AgentReply = { id: string; text: string } | { id: null; reason: 'empty' | 'timeout' }

const POLL_MS = 300
/** A turn that ends this fast with no new message produced nothing to read. */
const EMPTY_GRACE_MS = 2_000

/**
 * Submit a turn and resolve with the reply it produced: the newest visible
 * assistant message that was not there before, once the turn is over — tool
 * narration mid-turn is not the answer.
 */
export async function submitAndAwaitReply(
  source: AgentReplySource,
  submit: () => Promise<void> | void,
  timeoutMs: number
): Promise<AgentReply> {
  const known = new Set(source.messages().map(message => message.id))

  await submit()

  const started = Date.now()

  for (;;) {
    await new Promise(resolve => setTimeout(resolve, POLL_MS))

    if (!source.busy()) {
      const reply = source
        .messages()
        .findLast(message => message.role === 'assistant' && !message.hidden && !known.has(message.id))

      if (reply && !reply.pending) {
        return { id: reply.id, text: chatMessageText(reply as ChatMessage) }
      }

      if (Date.now() - started > EMPTY_GRACE_MS) {
        return { id: null, reason: 'empty' }
      }
    }

    if (Date.now() - started > timeoutMs) {
      return { id: null, reason: 'timeout' }
    }
  }
}
