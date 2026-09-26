import { AlertCircle, CheckCircle2, Loader2, Mic, MicOff, Power, Volume2, Wrench } from '@/lib/icons'
import { cn } from '@/lib/utils'

import type { JarvisTaskPhase, JarvisUiState, JarvisVoiceState } from './types'

interface StatusStripProps {
  className?: string
  connected: boolean
  copy: {
    connection: {
      connected: string
      disconnected: string
    }
    label: string
    task: Record<JarvisTaskPhase, string>
    toolIdle: string
    voice: Record<JarvisVoiceState, string>
  }
  state: JarvisUiState
}

type Tone = 'accent' | 'muted' | 'warn'

/** Phases that mean work is genuinely in flight, so the icon may spin. */
const ACTIVE_PHASES = new Set<JarvisTaskPhase>(['cancelling', 'planning', 'running'])

function taskTone(taskPhase: JarvisTaskPhase): Tone {
  if (taskPhase === 'failed') {
    return 'warn'
  }

  if (taskPhase === 'verified' || ACTIVE_PHASES.has(taskPhase)) {
    return 'accent'
  }

  return 'muted'
}

const TONE_CLASS: Record<Tone, string> = {
  accent: 'text-(--ui-accent)',
  muted: 'text-(--ui-text-secondary)',
  warn: 'text-destructive'
}

function Chip({
  children,
  icon: Icon,
  spin = false,
  tone = 'muted'
}: {
  children: React.ReactNode
  icon: React.ComponentType<{ className?: string }>
  spin?: boolean
  tone?: Tone
}) {
  return (
    <span
      className={cn(
        // Read-only status, not a control: a compact pill, so four of them sit
        // on one line instead of pushing the conversation down.
        'inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full border border-(--ui-stroke-tertiary) bg-(--ui-bg-quaternary)/70 px-2.5 text-xs',
        TONE_CLASS[tone]
      )}
    >
      <Icon className={cn('size-3.5 shrink-0', spin && 'animate-spin')} />
      <span className="truncate">{children}</span>
    </span>
  )
}

export function JarvisStatusStrip({ className, connected, copy, state }: StatusStripProps) {
  const phase = state.task.phase
  const tone = taskTone(phase)
  const TaskIcon = phase === 'verified' ? CheckCircle2 : phase === 'failed' ? AlertCircle : Loader2
  const VoiceIcon = state.voice === 'speaking' ? Volume2 : state.voice === 'idle' ? MicOff : Mic
  const toolRunning = state.activeTool !== null

  return (
    <section aria-label={copy.label} className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {/* The status bar already says the gateway is up; only a lost connection
          earns a chip up here. */}
      {connected ? null : (
        <Chip icon={Power} tone="warn">
          {copy.connection.disconnected}
        </Chip>
      )}
      {/* The spinner is reserved for a phase that is actually advancing —
          a static "Loader" next to "Gotowy" reads as a hung app. */}
      <Chip icon={TaskIcon} spin={ACTIVE_PHASES.has(phase)} tone={tone}>
        {copy.task[phase]}
      </Chip>
      {state.activeTool ? (
        <Chip icon={Wrench} tone={toolRunning ? 'accent' : 'muted'}>
          {state.activeTool.label}
        </Chip>
      ) : null}
      <Chip icon={VoiceIcon} tone={state.voice === 'error' ? 'warn' : state.voice === 'idle' ? 'muted' : 'accent'}>
        {copy.voice[state.voice]}
      </Chip>
    </section>
  )
}
