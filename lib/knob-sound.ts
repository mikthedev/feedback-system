/** Real detent sample; pitch tracks score in musical semitone steps. */

const SAMPLE_URL = '/sounds/knob-tick.wav?v=4'

/** Map 0–10 → playback rate via semitones (clear steps, still natural). */
function rateForScore(value: number): number {
  // 0 → −3 st, 5 → 0 st, 10 → +4 st  (≈ 0.84 … 1.26)
  const semitones = -3 + (value / 10) * 7
  return Math.pow(2, semitones / 12)
}

let sharedCtx: AudioContext | null = null
let sampleBuffer: AudioBuffer | null = null
let loadPromise: Promise<AudioBuffer | null> | null = null
let lastTickAt = 0
let lastValue: number | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  if (!sharedCtx) sharedCtx = new AC()
  if (sharedCtx.state === 'suspended') void sharedCtx.resume()
  return sharedCtx
}

async function loadSample(ctx: AudioContext): Promise<AudioBuffer | null> {
  if (sampleBuffer) return sampleBuffer
  if (loadPromise) return loadPromise
  loadPromise = (async () => {
    try {
      const res = await fetch(SAMPLE_URL)
      if (!res.ok) return null
      const arr = await res.arrayBuffer()
      sampleBuffer = await ctx.decodeAudioData(arr.slice(0))
      return sampleBuffer
    } catch {
      return null
    } finally {
      loadPromise = null
    }
  })()
  return loadPromise
}

/** Warm the AudioContext + decode the sample on first user gesture. */
export function preloadKnobSound(): void {
  const ctx = getCtx()
  if (!ctx) return
  void loadSample(ctx)
}

/**
 * Play the recorded knob detent. Pitch rises gently with `value` (0–10).
 * Only fires when the rounded value changes; lightly throttled while dragging.
 */
export function playKnobTick(value: number): void {
  const now = performance.now()
  if (now - lastTickAt < 42) return

  const clamped = Math.max(0, Math.min(10, value))
  if (lastValue != null && clamped === lastValue) return
  lastValue = clamped
  lastTickAt = now

  const ctx = getCtx()
  if (!ctx) return

  const play = (buffer: AudioBuffer) => {
    try {
      const src = ctx.createBufferSource()
      src.buffer = buffer
      src.playbackRate.value = rateForScore(clamped)

      const gain = ctx.createGain()
      // Slightly quieter at higher pitches so they don't pierce
      gain.gain.value = 0.58 - (clamped / 10) * 0.12

      src.connect(gain)
      gain.connect(ctx.destination)
      src.start(0)
    } catch {
      /* ignore */
    }
  }

  if (sampleBuffer) {
    play(sampleBuffer)
    return
  }

  void loadSample(ctx).then((buf) => {
    if (buf) play(buf)
  })
}
