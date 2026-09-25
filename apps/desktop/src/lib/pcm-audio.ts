/**
 * 16-bit PCM helpers shared by every raw-audio stream the desktop speaks:
 * the client-side wake word feed (16 kHz up) and Gemini Live (16 kHz up,
 * 24 kHz down). Pure functions; no audio graph here.
 */

/** Box-filter downsample from `inputRate` to `targetRate` (mono). */
export function downsample(input: Float32Array, inputRate: number, targetRate: number): Float32Array {
  if (inputRate === targetRate) {
    return input
  }

  if (inputRate <= 0 || targetRate <= 0) {
    return new Float32Array(0)
  }

  const ratio = inputRate / targetRate
  const outLen = Math.max(1, Math.floor(input.length / ratio))
  const out = new Float32Array(outLen)

  for (let i = 0; i < outLen; i++) {
    const start = Math.floor(i * ratio)
    const end = Math.min(input.length, Math.floor((i + 1) * ratio))
    let sum = 0
    let count = 0

    for (let j = start; j < end; j++) {
      sum += input[j] ?? 0
      count++
    }

    out[i] = count > 0 ? sum / count : 0
  }

  return out
}

export function floatToInt16LE(input: Float32Array): ArrayBuffer {
  const buf = new ArrayBuffer(input.length * 2)
  const view = new DataView(buf)

  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i] ?? 0))
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }

  return buf
}

export function bytesToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000

  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }

  return btoa(binary)
}

/** Base64 of little-endian int16 PCM → float samples in [-1, 1). */
export function pcm16Base64ToFloat32(data: string): Float32Array<ArrayBuffer> {
  const binary = atob(data)
  const samples = new Float32Array(Math.floor(binary.length / 2))

  for (let i = 0; i < samples.length; i++) {
    const lo = binary.charCodeAt(i * 2)
    const hi = binary.charCodeAt(i * 2 + 1)
    const value = (hi << 8) | lo

    samples[i] = (value >= 0x8000 ? value - 0x10000 : value) / 0x8000
  }

  return samples
}

/** Sample rate from a mime type like `audio/pcm;rate=24000`; `fallback` when absent. */
export function pcmRate(mimeType: string, fallback: number): number {
  const match = /rate=(\d+)/.exec(mimeType)
  const rate = match ? Number(match[1]) : NaN

  return Number.isFinite(rate) && rate > 0 ? rate : fallback
}
