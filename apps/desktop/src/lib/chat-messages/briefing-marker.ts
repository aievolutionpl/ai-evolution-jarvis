/**
 * The daily-briefing turn carries the gathered data for the agent; the
 * transcript should show only what the user said or clicked. The first line
 * marks the turn and names that label, so a reloaded transcript can project it
 * back, the same way a `/skill` turn is projected to its invocation.
 */

const PREFIX = '<!-- jarvis:briefing '
const SUFFIX = ' -->'

export function briefingMarker(displayText: string): string {
  return `${PREFIX}${JSON.stringify(displayText.replace(/\s+/g, ' ').trim())}${SUFFIX}`
}

/** The label a briefing turn should show, or null for any other text. */
export function briefingInvocationText(text: string): null | string {
  if (!text.startsWith(PREFIX)) {
    return null
  }

  const end = text.indexOf(SUFFIX, PREFIX.length)

  if (end < 0) {
    return null
  }

  try {
    const label = JSON.parse(text.slice(PREFIX.length, end)) as unknown

    return typeof label === 'string' && label.trim() ? label.trim() : null
  } catch {
    return null
  }
}
