import { expect, it, vi } from 'vitest'

import { isJarvisMusicPhrase, startJarvisIntroMusic, stopJarvisIntroMusic } from './jarvis-intro-music'

it('plays the supplied intro quietly during conversation and restarts for the Polish phrase', () => {
  const play = vi.fn().mockResolvedValue(undefined)
  const pause = vi.fn()
  const players: Array<{ currentTime: number; loop: boolean; volume: number }> = []

  vi.stubGlobal('Audio', class {
    currentTime = 0
    loop = false
    volume = 1
    play = play
    pause = pause

    constructor(public src: string) {
      players.push(this)
    }
  })

  startJarvisIntroMusic()
  expect(players[0]).toMatchObject({ loop: false, volume: 0.4 })
  expect(play).toHaveBeenCalledOnce()
  expect(isJarvisMusicPhrase('Tatuś w domu!')).toBe(true)
  expect(isJarvisMusicPhrase('tatus w domu')).toBe(true)
  expect(isJarvisMusicPhrase('Tatuś wrócił!')).toBe(true)
  expect(isJarvisMusicPhrase('Witaj, Cześku')).toBe(false)

  players[0].currentTime = 8
  startJarvisIntroMusic(true)
  expect(players[0].currentTime).toBe(0)
  stopJarvisIntroMusic()
  expect(pause).toHaveBeenCalledOnce()
  vi.unstubAllGlobals()
})
