/** Set CSS-pixel drawing coordinates while capping expensive high-DPR fills. */
export function sizePlasmaCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D
): { width: number; height: number } {
  const rect = canvas.getBoundingClientRect()
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  const width = Math.max(1, rect.width)
  const height = Math.max(1, rect.height)
  canvas.width = Math.round(width * ratio)
  canvas.height = Math.round(height * ratio)
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)

  return { width, height }
}
