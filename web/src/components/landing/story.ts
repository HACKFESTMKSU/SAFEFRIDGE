/** Deterministic noise in [0, 1) so renders stay stable. */
function noise(n: number) {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

/** A plausible produce-storehouse reading for a moment in time (hero sample feed). Tomato band ~10–15°C. */
export function sampleFridge(t: number) {
  const s = t / 1000
  return 12.1 + Math.sin(s / 14) * 0.55 + Math.sin(s / 3.7) * 0.12 + (noise(Math.floor(s / 2)) - 0.5) * 0.12
}
