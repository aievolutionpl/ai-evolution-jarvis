import { useStore } from '@nanostores/react'

import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { ImageIcon, LayoutDashboard, Mic, Newspaper, Search, Sparkles, Square } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { requestBriefing } from '@/store/composer'

import { requestComposerInsert } from '../chat/composer/focus'

import { JarvisCore } from './core'
import { $jarvisRailVisible } from './focus-mode'
import { jarvisDaypart } from './pulse'
import { JarvisQuickAccess } from './quick-access'
import { $jarvisUi } from './store'

type IconComponent = React.ComponentType<{ className?: string }>

type HomeAction = 'analyze' | 'automate' | 'generate' | 'plan'

/** The four ways in under the orb; each one starts a request in the composer. */
const HOME_ACTIONS: readonly { icon: IconComponent; id: HomeAction }[] = [
  { icon: Sparkles, id: 'plan' },
  { icon: Search, id: 'analyze' },
  { icon: ImageIcon, id: 'generate' },
  { icon: LayoutDashboard, id: 'automate' }
]

/** Inline, the quick-access list keeps to the design's three entries. */
const INLINE_QUICK_ACCESS = 3

const FOCUS_RING =
  'outline-none focus-visible:outline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--ui-accent)'

export interface JarvisHomeHeroProps {
  className?: string
  connected: boolean
  listening: boolean
  onStartListening: () => void
  onStopListening?: () => void
  profileDisplayName?: string
}

/**
 * The home screen of a fresh conversation: a greeting that knows the time of
 * day, the orb in the middle, one clear way to start talking, and four
 * one-click starts for a request.
 *
 * Every piece is real: the orb follows the backend's task phase and the live
 * microphone; an action chip only starts the request in the composer, so the
 * person finishes and reads it before Jarvis gets it. Quick access (pulse +
 * playbook) sits in the dashboard rail, or here when there is no rail.
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
  const state = useStore($jarvisUi)
  const railVisible = useStore($jarvisRailVisible)
  // "default" is the machine's unnamed profile, not a person: greet without it.
  const rawName = profileDisplayName?.trim()
  const name = rawName && rawName.toLowerCase() !== 'default' ? rawName : undefined
  const greeting = copy.greetings[jarvisDaypart(new Date())]
  const hint = !connected ? copy.offline : listening ? copy.listening : copy.idleHint

  return (
    // Laid out by the chat column's width, not the window's: the sidebar, the
    // rail and a split pane all eat into it.
    <div className="@container flex w-full justify-center">
      <section
        aria-labelledby="jarvis-home-title"
        className={cn(
          'jarvis-home relative flex w-full max-w-3xl flex-col items-center gap-4 px-4 py-6 text-center [--jarvis-hero-size:min(300px,34vh,72cqw)] @2xl:[--jarvis-hero-size:min(340px,38vh,48cqw)]',
          className
        )}
        data-testid="jarvis-home-hero"
      >
        <div className="flex flex-col items-center gap-2">
          <h1
            className="text-4xl font-semibold leading-tight tracking-tight text-(--ui-text-primary) @2xl:text-5xl"
            id="jarvis-home-title"
          >
            {greeting}
            {name ? `, ${name}` : ''}.
          </h1>
          <p className="text-lg text-(--ui-text-tertiary) @2xl:text-2xl">{copy.subtitle}</p>
        </div>

        {/* Sized to the orb itself: a shrinking flex item would squeeze the
            sphere into a capsule. The orbit ring is decoration around it. */}
        <div className="jarvis-home__orb relative my-2 grid w-(--jarvis-hero-size) max-w-full shrink-0 place-items-center">
          <span aria-hidden="true" className="jarvis-home__orbit" />
          <JarvisCore live taskPhase={state.task.phase} variant="hero" voice={listening ? 'listening' : state.voice} />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            aria-pressed={listening}
            className="min-h-12 rounded-full px-6 text-base shadow-[0_0_24px_color-mix(in_srgb,var(--ui-accent)_35%,transparent)]"
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

        <div
          aria-live="polite"
          className="flex items-center gap-2 text-sm text-(--ui-text-tertiary)"
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

        <div aria-label={copy.actionsLabel} className="flex flex-wrap justify-center gap-2" role="group">
          {HOME_ACTIONS.map(({ icon: Icon, id }) => (
            <button
              className={cn(
                'flex min-h-11 items-center gap-2 rounded-full border border-(--ui-stroke-tertiary) bg-(--ui-bg-secondary)/55 px-4 text-sm font-medium text-(--ui-text-primary) backdrop-blur transition-colors hover:border-(--ui-accent)/55 hover:bg-(--ui-accent)/10',
                FOCUS_RING
              )}
              key={id}
              onClick={() => requestComposerInsert(copy.actions[id].prompt, { mode: 'prefix', target: 'main' })}
              type="button"
            >
              <Icon className="size-4 text-(--ui-accent)" />
              {copy.actions[id].label}
            </button>
          ))}
        </div>

        {railVisible ? null : (
          <div className="flex w-full max-w-sm flex-col gap-2 pt-2 text-left">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-(--ui-text-tertiary)">
              {copy.shortcutsLabel}
            </p>
            <JarvisQuickAccess connected={connected} label={copy.shortcutsLabel} limit={INLINE_QUICK_ACCESS} />
          </div>
        )}
      </section>
    </div>
  )
}
