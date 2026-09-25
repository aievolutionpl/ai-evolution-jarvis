/**
 * Provider-agnostic Live Voice contracts.
 *
 * A live voice provider (OpenAI Realtime today, Gemini Live next) is only the
 * conversation layer: it listens, speaks and delegates. Hermes stays the one
 * brain — tools, memory, approvals, sub-agents and computer control never
 * reach the provider. Work flows through the backend task registry
 * (`task.*` RPCs), so voice and text share one lifecycle.
 */

export type LiveVoiceStatus = 'connecting' | 'listening' | 'thinking' | 'speaking' | 'disconnected'

/** Mirrors agent/task_registry.py INTERRUPT_INTENTS. */
export type InterruptIntent = 'stop_speech' | 'stop_turn' | 'correct' | 'cancel_task'

export type TaskSource = 'voice' | 'text' | 'pulse' | 'cron'

export type TaskStatus = 'queued' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled'

/** Mirrors agent/task_registry.py JarvisTask (snake_case over the wire). */
export interface JarvisTask {
  task_id: string
  session_id: string
  parent_task_id: string | null
  revision: number
  source: TaskSource
  instruction: string
  owner_agent_id: string
  status: TaskStatus
  required_capabilities: string[]
  child_agent_ids: string[]
  computer_lease: string | null
  created_at: number
  updated_at: number
}

/** Semantic phases from agent/task_progress.py — spoken, never raw logs. */
export type ProgressPhase =
  | 'searching'
  | 'browsing'
  | 'running_command'
  | 'reading_file'
  | 'writing_file'
  | 'using_computer'
  | 'waiting_approval'
  | 'child_working'
  | 'verifying'

export interface TaskProgress {
  taskId: string
  revision: number
  phase: ProgressPhase
  line: string
}

export interface LiveVoiceCapabilities {
  audioIn: boolean
  audioOut: boolean
  imageIn: boolean
  videoIn: boolean
  /** Provider cancels its own speech on user barge-in. */
  serverInterruption: boolean
}

export interface LiveVoiceProviderEvents {
  onStatus: (status: LiveVoiceStatus) => void
  onTranscript: (role: 'assistant' | 'user', text: string) => void
  /** The provider wants Hermes to act; resolves with the text to speak. */
  onDelegation: (request: string) => Promise<string>
  onInterrupt: (intent: InterruptIntent) => void
  onSpeechStart: () => void
  onSpeechEnd: () => void
  onError: (message: string) => void
}

export interface LiveVoiceProvider {
  readonly id: 'openai-live' | 'gemini-live' | 'legacy-realtime'
  readonly capabilities: LiveVoiceCapabilities
  /** Credentials are short-lived and minted by the backend; never a long-lived API key. */
  connect: (events: LiveVoiceProviderEvents) => Promise<void>
  disconnect: () => void
  setMuted: (muted: boolean) => void
  sendTaskProgress: (progress: TaskProgress) => void
  sendTaskResult: (taskId: string, revision: number, text: string) => void
}
