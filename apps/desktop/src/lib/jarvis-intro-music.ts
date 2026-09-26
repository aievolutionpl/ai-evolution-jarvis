const INTRO_MUSIC_URL = '/audio/jarvis-intro.mp3'
const INTRO_MUSIC_VOLUME = 0.4

let player: HTMLAudioElement | null = null

function introPlayer(): HTMLAudioElement {
  if (!player) {
    player = new Audio(INTRO_MUSIC_URL)
    player.loop = true
    player.volume = INTRO_MUSIC_VOLUME
  }

  return player
}

export function startJarvisIntroMusic(restart = false): void {
  const audio = introPlayer()
  if (restart) {
    audio.currentTime = 0
  }
  void audio.play().catch(() => undefined)
}

export function stopJarvisIntroMusic(): void {
  if (player) {
    player.pause()
    player.currentTime = 0
  }
}

export function isJarvisMusicPhrase(text: string): boolean {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pl')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .includes('tatus w domu')
}
