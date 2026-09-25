import { useEffect, useRef, useState } from 'react'

import { useI18n } from '@/i18n'
import { resetBrowseState } from '@/store/composer-input-history'

import { pickPlaceholder } from '../composer-utils'

interface UseComposerPlaceholderOptions {
  disabled: boolean
  reconnecting: boolean
  sessionId: null | string | undefined
}

/**
 * The composer's placeholder text. A resting starter (new session) / continuation
 * (existing session) is picked once and only re-rolled when we genuinely move to
 * a *different* conversation — the null→id persist of a freshly-started session
 * keeps its starter so the text doesn't flip mid-stream. What is kept is the
 * pick (pool + slot), not the string, so a language switch (first-run Polish
 * lands after the composer mounted) shows the same starter in the new language. While the transport is
 * down, it swaps to a reconnecting / starting message instead.
 */
export function useComposerPlaceholder({ disabled, reconnecting, sessionId }: UseComposerPlaceholderOptions): string {
  const { t } = useI18n()
  const newSessionPlaceholders = t.composer.newSessionPlaceholders
  const followUpPlaceholders = t.composer.followUpPlaceholders

  const [pick, setPick] = useState(() => ({ followUp: Boolean(sessionId), roll: Math.random() }))
  const restingPlaceholder = pickPlaceholder(pick.followUp ? followUpPlaceholders : newSessionPlaceholders, pick.roll)

  const prevSessionIdRef = useRef(sessionId)

  // eslint-disable-next-line no-restricted-syntax -- legitimate non-atom ref write (see eslint rule comment)
  useEffect(() => {
    const prev = prevSessionIdRef.current
    prevSessionIdRef.current = sessionId

    if (prev === sessionId) {
      return
    }

    // null → id: the new session we're already in just got persisted. Keep the
    // starter we showed instead of swapping to a follow-up under the user.
    if (prev == null && sessionId) {
      return
    }

    resetBrowseState(prev)
    setPick({ followUp: Boolean(sessionId), roll: Math.random() })
  }, [sessionId])

  // When the transport is disabled it's because the gateway isn't open.
  // Distinguish a cold start ("Starting Hermes...") from a dropped connection
  // we're trying to restore. During reconnect, keep the textbox editable so a
  // flaky network doesn't block drafting; only submit/backend actions stay
  // disabled until the gateway is open again.
  return disabled
    ? reconnecting
      ? t.composer.placeholderReconnecting
      : t.composer.placeholderStarting
    : restingPlaceholder
}
