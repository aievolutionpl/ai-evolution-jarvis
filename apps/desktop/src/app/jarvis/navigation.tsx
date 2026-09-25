import type { KeyboardEvent, RefObject } from 'react'
import { createRef, useMemo } from 'react'

import { type Locale, useI18n } from '@/i18n'
import { Brain, CheckCircle2, FolderOpen, Globe, KeyRound, MessageCircle, Settings2, Wrench, Zap } from '@/lib/icons'
import { cn } from '@/lib/utils'

import {
  JARVIS_AUXILIARY_VIEWS,
  JARVIS_MAIN_VIEWS,
  type JarvisShellCopy,
  type JarvisShellView
} from './i18n'

type IconComponent = React.ComponentType<{ className?: string }>

const VIEW_ICONS: Record<JarvisShellView, IconComponent> = {
  jarvis: Zap,
  tasks: CheckCircle2,
  messaging: MessageCircle,
  artifacts: FolderOpen,
  memory: Brain,
  tools: Wrench,
  settings: Settings2,
  profile: KeyRound
}

interface JarvisNavigationProps {
  activeView: JarvisShellView
  copy: JarvisShellCopy
  onSelect: (view: JarvisShellView) => void
}

interface NavButtonProps {
  active: boolean
  buttonRef: RefObject<HTMLButtonElement | null>
  icon: IconComponent
  label: string
  onClick: () => void
  onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void
}

function NavButton({ active, buttonRef, icon: Icon, label, onClick, onKeyDown }: NavButtonProps) {
  return (
    <button
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex min-h-11 min-w-32 items-center gap-3 rounded-md px-3 text-left text-sm font-medium outline-none transition-colors md:min-w-0',
        'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-(--ui-accent)',
        active
          ? 'bg-linear-to-r from-(--ui-accent)/18 to-transparent text-(--ui-text-primary) shadow-[inset_2px_0_0_var(--ui-accent)]'
          : 'text-(--ui-text-secondary) hover:bg-(--chrome-action-hover) hover:text-(--ui-text-primary)'
      )}
      onClick={onClick}
      onKeyDown={onKeyDown}
      ref={buttonRef}
      type="button"
    >
      <Icon className={cn('size-4 shrink-0', active ? 'text-(--ui-accent)' : 'text-(--ui-text-tertiary)')} />
      <span className="truncate">{label}</span>
    </button>
  )
}

export function JarvisNavigation({ activeView, copy, onSelect }: JarvisNavigationProps) {
  const mainRefs = useMemo(() => JARVIS_MAIN_VIEWS.map(() => createRef<HTMLButtonElement>()), [])
  const auxiliaryRefs = useMemo(() => JARVIS_AUXILIARY_VIEWS.map(() => createRef<HTMLButtonElement>()), [])

  const focusMain = (index: number) => {
    mainRefs[index]?.current?.focus()
  }

  const handleMainKeyDown = (index: number) => (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault()
      focusMain((index + 1) % JARVIS_MAIN_VIEWS.length)

      return
    }

    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault()
      focusMain((index - 1 + JARVIS_MAIN_VIEWS.length) % JARVIS_MAIN_VIEWS.length)

      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      focusMain(0)

      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      focusMain(JARVIS_MAIN_VIEWS.length - 1)
    }
  }

  return (
    <aside className="flex w-full shrink-0 flex-col gap-3 border-b border-(--ui-stroke-tertiary) bg-(--ui-bg-chrome) p-3 md:h-full md:w-56 md:border-b-0 md:border-r" data-jarvis-nav-rail="">
      <div className="flex min-w-0 items-center gap-3 px-1 py-1 md:py-2">
        {/* Static brand mark: the live orb belongs to the dashboard, not the chrome. */}
        <span
          aria-hidden="true"
          className="size-8 shrink-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,#dff6ff_0%,#00b7ff_38%,#7c5cff_72%,#0b0d10_100%)] shadow-[0_0_18px_rgb(0_183_255/0.45)]"
        />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-(--ui-text-primary)">{copy.productName}</div>
          <div className="hidden truncate text-[0.65rem] uppercase tracking-[0.08em] text-(--ui-text-tertiary) md:block">
            {copy.home.nav.tagline}
          </div>
        </div>
      </div>

      <nav aria-label={copy.navigationLabel} className="min-w-0" data-jarvis-nav="">
        <div className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
          {JARVIS_MAIN_VIEWS.map((view, index) => (
            <NavButton
              active={activeView === view}
              buttonRef={mainRefs[index]}
              icon={VIEW_ICONS[view]}
              key={view}
              label={copy.views[view]}
              onClick={() => onSelect(view)}
              onKeyDown={handleMainKeyDown(index)}
            />
          ))}
        </div>
      </nav>

      <div className="mt-auto flex gap-2 overflow-x-auto border-t border-(--ui-stroke-tertiary) pt-3 md:flex-col md:overflow-visible">
        {JARVIS_AUXILIARY_VIEWS.map((view, index) => (
          <NavButton
            active={activeView === view}
            buttonRef={auxiliaryRefs[index]}
            icon={VIEW_ICONS[view]}
            key={view}
            label={copy.views[view]}
            onClick={() => onSelect(view)}
          />
        ))}
        <LanguageToggle label={copy.home.nav.language} />
      </div>
    </aside>
  )
}

const LANGUAGE_CHOICES: readonly { id: Locale; label: string }[] = [
  { id: 'pl', label: 'PL' },
  { id: 'en', label: 'EN' }
]

/** Polish first: the product speaks Polish by default, English is one tap away. */
function LanguageToggle({ label }: { label: string }) {
  const { isSavingLocale, locale, setLocale } = useI18n()

  return (
    <div className="flex min-h-11 shrink-0 items-center gap-2 px-3 text-sm text-(--ui-text-secondary)">
      <Globe className="size-4 shrink-0 text-(--ui-text-tertiary)" />
      <span className="hidden md:inline">{label}</span>
      <div aria-label={label} className="ml-auto flex gap-1 rounded-md bg-(--ui-bg-quaternary)/60 p-0.5" role="radiogroup">
        {LANGUAGE_CHOICES.map(choice => (
          <button
            aria-checked={locale === choice.id}
            className={cn(
              'min-h-11 min-w-11 rounded px-2 text-xs font-semibold outline-none focus-visible:outline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-(--ui-accent)',
              locale === choice.id ? 'bg-(--ui-accent)/20 text-(--ui-text-primary)' : 'hover:text-(--ui-text-primary)'
            )}
            disabled={isSavingLocale}
            key={choice.id}
            onClick={() => void setLocale(choice.id)}
            role="radio"
            type="button"
          >
            {choice.label}
          </button>
        ))}
      </div>
    </div>
  )
}
