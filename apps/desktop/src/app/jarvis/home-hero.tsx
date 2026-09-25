import { useStore } from '@nanostores/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'

import { getPulse, type PulseMatter, sendPulseFeedback } from '@/api/pulse'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { Brain, Clock, FolderOpen, Globe, Mic, Monitor, Newspaper, Sparkles, Square, X } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { requestBriefing } from '@/store/composer'
import { $activeGatewayProfile } from '@/store/profile'

import { requestComposerInsert } from '../chat/composer/focus'

import { JarvisCore } from './core'
import { $jarvisOnboardingCompletedAt, readJarvisOnboardingState } from './onboarding-state'
import { type JarvisPlaybookCategory, selectJarvisPlaybook } from './playbook'
import { jarvisDaypart, pulseSuggestions } from './pulse'
import { $jarvisUi } from './store'

type IconComponent = React.ComponentType<{ className?: string }>

const CATEGORY_ICONS: Record<JarvisPlaybookCategory, IconComponent> = {
  automation: Clock,
  computer: Monitor,
  files: FolderOpen,
  memory: Brain,
  voice: Mic,
  web: Globe
}

/** The design caps the idle screen at three shortcuts (§5, "Ekran Jarvis"). */
const HERO_SHORTCUTS = 3
const PULSE_REFRESH_MS = 10 * 60_000

/**
 * The pulse matters for this profile. Taking or dismissing one drops it from
 * the list at once and tells the backend, which decides when it may return.
 */
function useJarvisPulse(connected: boolean) {
  const profile = useStore($activeGatewayProfile)
  const queryClient = useQueryClient()
  const queryKey = ['jarvis-pulse', profile]

  const pulse = useQuery({
    enabled: connected,
    queryFn: getPulse,
    queryKey,
    refetchInterval: PULSE_REFRESH_MS,
    staleTime: PULSE_REFRESH_MS
  })

  const react = (matter: PulseMatter, reaction: 'accept' | 'decline') => {
    // An in-flight refresh must not paint the matter back over the removal.
    void queryClient.cancelQueries({ queryKey })
    queryClient.setQueryData<Awaited<ReturnType<typeof getPulse>>>(queryKey, current =>
      current ? { ...current, matters: current.matters.filter(m => m.id !== matter.id) } : current
    )
    // A lost reaction is not an error to show: the backend's list gets the last word.
    void sendPulseFeedback(matter, reaction).catch(() => queryClient.invalidateQueries({ queryKey }))
  }

  return { matters: pulse.data?.matters ?? [], react }
}

export interface JarvisHomeHeroProps {
  className?: string
  connected: boolean
  listening: boolean
  onStartListening: () => void
  onStopListening?: () => void
  profileDisplayName?: string
}

/**
 * The home screen of a fresh conversation: who Jarvis is talking to, the orb,
 * one clear way to start talking and at most three things it can do right now.
 *
 * Every piece is real: the orb follows the backend's task phase and the live
 * microphone, and the shortcuts come from the capability-gated playbook, so a
 * suggestion never asks for a tool this machine was not given. A shortcut only
 * fills the composer — the person reads the request before Jarvis gets it.
 */
export function JarvisHomeHero({
  className,
  connected,
  listening,
  onStartListening,
  onStopListening,
  profileDisplayName
}: JarvisHomeHeroProps) {
  const { t } = useI18n()
  const copy = t.jarvisShell.home
  const briefingCopy = t.jarvisShell.briefing
  const tips = t.jarvisTips
  const state = useStore($jarvisUi)
  // Setup finishing while this is mounted must widen the deck immediately.
  const completedAt = useStore($jarvisOnboardingCompletedAt)
  // "default" is the machine's unnamed profile, not a person: greet without it.
  const rawName = profileDisplayName?.trim()
  const name = rawName && rawName.toLowerCase() !== 'default' ? rawName : undefined
  const greeting = copy.greetings[jarvisDaypart(new Date())]
  const pulse = useJarvisPulse(connected)
  const suggestions = pulseSuggestions(pulse.matters, t.jarvisShell.pulse).slice(0, HERO_SHORTCUTS)

  const shortcuts = useMemo(() => {
    const computerMode = readJarvisOnboardingState()?.selections?.computerMode ?? null

    return selectJarvisPlaybook({ computerMode, hasHistory: false }, { limit: HERO_SHORTCUTS })
    // `completedAt` is a cache key: a bump means the stored selections changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedAt])

  const fillers = shortcuts.slice(0, Math.max(0, HERO_SHORTCUTS - suggestions.length))

  const hint = !connected ? copy.offline : listening ? copy.listening : copy.idleHint

  return (
    // Laid out by the chat column's width, not the window's: the sidebar, the
    // rail and a split pane all eat into it.
    <div className="@container flex w-full justify-center">
      <section
        aria-labelledby="jarvis-home-title"
        className={cn(
          'jarvis-home relative flex w-full max-w-6xl flex-col items-center gap-4 px-4 py-4 [--jarvis-hero-size:min(280px,28vh,70cqw)] @4xl:gap-6 @4xl:py-6 @4xl:flex-row @4xl:[--jarvis-hero-size:min(380px,42vh,36cqw)] @4xl:items-center @4xl:justify-between @4xl:gap-4',
          className
        )}
        data-testid="jarvis-home-hero"
      >
        <div className="flex w-full max-w-sm min-w-0 flex-col items-center gap-3 text-center @4xl:min-w-[13rem] @4xl:flex-1 @4xl:items-start @4xl:text-left">
          <h1
            className="text-3xl font-light leading-tight tracking-tight text-(--ui-text-primary) @4xl:text-4xl @6xl:text-5xl"
            id="jarvis-home-title"
          >
            {greeting}
            {name ? (
              <>
                {', '}
                <span className="font-normal text-(--ui-accent)">{name}</span>
              </>
            ) : null}
          </h1>
          <p className="text-lg text-(--ui-text-secondary) md:text-xl">{copy.question}</p>
          {/* Decoration: only when the hero has a side column to spare. Stacked,
              the orb and the talk button need that height. */}
          <span aria-hidden="true" className="my-2 hidden h-px w-10 bg-(--ui-accent) @4xl:block" />
          <blockquote className="hidden max-w-xs text-base italic leading-7 text-(--ui-text-secondary) @4xl:block">
            {copy.quote}
          </blockquote>
          <p className="hidden text-[0.68rem] font-medium uppercase tracking-[0.3em] whitespace-nowrap text-(--ui-text-tertiary) @4xl:block">
            {copy.motto}
          </p>
        </div>

        {/* Sized to the orb itself: a shrinking flex item would squeeze the
          sphere into a capsule. */}
        <div className="flex w-(--jarvis-hero-size) max-w-full shrink-0 flex-col items-center gap-4">
          <JarvisCore live taskPhase={state.task.phase} variant="hero" voice={listening ? 'listening' : state.voice} />
          <div
            aria-live="polite"
            className={cn(
              'flex min-h-11 max-w-full items-center gap-2 rounded-full border px-4 text-center text-sm',
              listening
                ? 'border-(--ui-accent)/50 bg-(--ui-accent)/10 text-(--ui-text-primary)'
                : 'border-(--ui-stroke-tertiary) bg-(--ui-bg-secondary)/50 text-(--ui-text-secondary)'
            )}
            data-testid="jarvis-home-status"
          >
            <span
              aria-hidden="true"
              className={cn(
                'size-2 rounded-full',
                !connected ? 'bg-(--ui-text-tertiary)' : listening ? 'animate-pulse bg-(--ui-accent)' : 'bg-emerald-400'
              )}
            />
            {hint}
          </div>
          {/* Talk and the daily briefing are the two ways in; side by side they
              cost one row of the hero's height, not two. */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              aria-pressed={listening}
              className="min-h-12 rounded-full px-6 text-base"
              disabled={!connected}
              onClick={() => (listening ? onStopListening?.() : onStartListening())}
              type="button"
              variant={listening ? 'secondary' : 'default'}
            >
              {listening ? <Square /> : <Mic />}
              {listening ? copy.stopTalking : copy.talk}
            </Button>
            <Button
              className="min-h-11 rounded-full px-5"
              disabled={!connected}
              onClick={() => requestBriefing({ speak: true })}
              title={briefingCopy.buttonHint}
              type="button"
              variant="secondary"
            >
              <Newspaper />
              {briefingCopy.button}
            </Button>
          </div>
        </div>

        <nav aria-label={copy.shortcutsLabel} className="flex w-full max-w-sm flex-col gap-2 @4xl:w-64 @4xl:shrink-0">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-(--ui-text-tertiary)">
            {copy.shortcutsLabel}
          </p>
          {suggestions.map(suggestion => (
            <div
              className="group relative flex min-h-11 items-center rounded-xl border border-(--ui-accent)/45 bg-(--ui-accent)/8 text-sm text-(--ui-text-primary) backdrop-blur transition-colors hover:border-(--ui-accent)/70 hover:bg-(--ui-accent)/12"
              data-pulse-kind={suggestion.matter.kind}
              key={suggestion.matter.id}
            >
              <button
                className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-left outline-none focus-visible:outline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ui-accent)"
                onClick={() => {
                  pulse.react(suggestion.matter, 'accept')
                  requestComposerInsert(suggestion.prompt, { mode: 'block', target: 'main' })
                }}
                title={`${t.jarvisShell.pulse.label}: ${suggestion.title} — ${suggestion.detail}`}
                type="button"
              >
                <span className="relative grid size-8 shrink-0 place-items-center rounded-lg bg-(--ui-accent)/15 text-(--ui-accent)">
                  <Sparkles className="size-4" />
                  <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 size-2 animate-pulse rounded-full bg-(--ui-accent)" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{suggestion.title}</span>
                  <span className="block truncate text-xs text-(--ui-text-secondary)">{suggestion.detail}</span>
                </span>
              </button>
              <button
                aria-label={`${t.jarvisShell.pulse.dismiss}: ${suggestion.title}`}
                className="mr-1.5 grid size-8 shrink-0 place-items-center rounded-lg text-(--ui-text-tertiary) outline-none transition-colors hover:bg-(--ui-bg-secondary) hover:text-(--ui-text-primary) focus-visible:outline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-(--ui-accent)"
                onClick={() => pulse.react(suggestion.matter, 'decline')}
                title={t.jarvisShell.pulse.dismissHint}
                type="button"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          {fillers.map(entry => {
            const Icon = CATEGORY_ICONS[entry.category]
            const entryCopy = tips.entries[entry.id]

            return (
              <button
                className="group flex min-h-11 items-center gap-3 rounded-xl border border-(--ui-stroke-tertiary) bg-(--ui-bg-secondary)/40 px-3 py-2.5 text-left text-sm text-(--ui-text-primary) outline-none backdrop-blur transition-colors hover:border-(--ui-accent)/60 hover:bg-(--ui-accent)/10 focus-visible:outline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ui-accent)"
                key={entry.id}
                onClick={() => requestComposerInsert(entryCopy.prompt, { mode: 'block', target: 'main' })}
                title={`${entryCopy.title} — ${entryCopy.detail}`}
                type="button"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-(--ui-accent)/12 text-(--ui-accent)">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{entryCopy.title}</span>
                  <span className="block truncate text-xs text-(--ui-text-secondary)">{entryCopy.detail}</span>
                </span>
              </button>
            )
          })}
        </nav>
      </section>
    </div>
  )
}
