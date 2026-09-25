import { useStore } from '@nanostores/react'
import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'

import { getPushStatus, sendPushNotification } from '@/api/notify'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useI18n } from '@/i18n'
import { COMPLETION_SOUND_VARIANTS, previewCompletionSound } from '@/lib/completion-sound'
import { triggerHaptic } from '@/lib/haptics'
import { Bell, ExternalLink, Play, Send } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { $completionSoundVariantId, setCompletionSoundVariantId } from '@/store/completion-sound'
import {
  $nativeNotifyPrefs,
  NATIVE_NOTIFICATION_KINDS,
  sendTestNativeNotification,
  setNativeNotifyEnabled,
  setNativeNotifyKind,
  setPushToPhone
} from '@/store/native-notifications'
import { notify, notifyError } from '@/store/notifications'
import { $activeGatewayProfile } from '@/store/profile'

import { MESSAGING_ROUTE } from '../routes'

import { CONTROL_TEXT } from './constants'
import { ListRow, SectionHeading, SettingsContent, ToggleRow } from './primitives'

const CAPTION = 'text-[length:var(--conversation-caption-font-size)] text-(--ui-text-tertiary)'

function Caption({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn(CAPTION, className)}>{children}</p>
}

/**
 * "Also send to my phone": the same alerts, mirrored to ntfy. Delivery and the
 * topic belong to the ntfy platform (Messaging); this only switches the mirror
 * and shows where it goes.
 */
function PhonePushSettings() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const prefs = useStore($nativeNotifyPrefs)
  const profile = useStore($activeGatewayProfile)
  const copy = t.settings.notifications.push
  const status = useQuery({ queryFn: getPushStatus, queryKey: ['notify-push-status', profile], staleTime: 30_000 })
  const available = status.data?.available === true

  const runTest = async () => {
    triggerHaptic('open')

    try {
      await sendPushNotification({ body: copy.testBody, kind: 'test', title: copy.testTitle })
      notify({ kind: 'info', message: copy.testSent })
    } catch (error) {
      notifyError(error, copy.testFailed)
    }
  }

  return (
    <>
      <ToggleRow
        checked={prefs.pushToPhone && available}
        description={copy.description}
        disabled={!available || !prefs.enabled}
        label={copy.title}
        onChange={setPushToPhone}
      />
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Caption className="min-w-0 flex-1">
          {available && status.data?.target ? copy.target(status.data.target) : copy.notConfigured}
        </Caption>
        {available ? (
          <Button className="gap-1.5" onClick={() => void runTest()} size="sm" type="button" variant="outline">
            <Send className="size-3.5" />
            {copy.test}
          </Button>
        ) : (
          <Button
            className="gap-1.5"
            onClick={() => navigate(MESSAGING_ROUTE)}
            size="sm"
            type="button"
            variant="outline"
          >
            <ExternalLink className="size-3.5" />
            {copy.setup}
          </Button>
        )}
      </div>
    </>
  )
}

export function NotificationsSettings() {
  const { t } = useI18n()
  const prefs = useStore($nativeNotifyPrefs)
  const completionSoundVariantId = useStore($completionSoundVariantId)
  const copy = t.settings.notifications

  const runTest = async () => {
    triggerHaptic('open')
    const ok = await sendTestNativeNotification(copy.testTitle, copy.testBody)
    notify({ kind: ok ? 'info' : 'error', message: ok ? copy.testSent : copy.testUnsupported })
  }

  return (
    <SettingsContent>
      <SectionHeading icon={Bell} title={copy.title} />
      <Caption className="mb-2 leading-(--conversation-caption-line-height)">{copy.intro}</Caption>

      <ToggleRow
        checked={prefs.enabled}
        description={copy.enableAllDesc}
        label={copy.enableAll}
        onChange={setNativeNotifyEnabled}
      />

      {NATIVE_NOTIFICATION_KINDS.map(kind => (
        <ToggleRow
          checked={prefs.enabled && prefs.kinds[kind]}
          description={copy.kinds[kind].description}
          disabled={!prefs.enabled}
          key={kind}
          label={copy.kinds[kind].label}
          onChange={on => setNativeNotifyKind(kind, on)}
        />
      ))}

      <PhonePushSettings />

      <ListRow
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Select
              onValueChange={value => {
                const variantId = Number.parseInt(value, 10)

                setCompletionSoundVariantId(variantId)
                previewCompletionSound(variantId)
                triggerHaptic('selection')
              }}
              value={String(completionSoundVariantId)}
            >
              <SelectTrigger className={cn('min-w-56', CONTROL_TEXT)}>
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                {COMPLETION_SOUND_VARIANTS.map(variant => (
                  <SelectItem key={variant.id} value={String(variant.id)}>
                    {variant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              className="gap-1.5"
              onClick={() => {
                previewCompletionSound()
                triggerHaptic('crisp')
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              <Play className="size-3.5" />
              {copy.completionSoundPreview}
            </Button>
          </div>
        }
        description={copy.completionSoundDesc}
        title={copy.completionSoundTitle}
      />

      <div className="mt-4 flex flex-col gap-2">
        <Button className="self-start" onClick={() => void runTest()} size="sm" type="button" variant="outline">
          <Bell />
          {copy.test}
        </Button>
        <Caption>{copy.focusedHint}</Caption>
      </div>
    </SettingsContent>
  )
}
