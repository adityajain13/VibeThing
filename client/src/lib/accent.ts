type RGB = [number, number, number]

function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return [h * 60, s, l]
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
}

/**
 * Pick a vivid, readable accent from cover art: bucket pixels by hue,
 * weight by saturation, take the strongest bucket, then normalise lightness
 * so it always reads on a black background.
 */
export function extractAccent(src: string): Promise<RGB | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      try {
        const size = 32
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(null)
        ctx.drawImage(img, 0, 0, size, size)
        const { data } = ctx.getImageData(0, 0, size, size)

        const buckets: { w: number; h: number; s: number; n: number }[] = []
        for (let i = 0; i < 12; i++) buckets.push({ w: 0, h: 0, s: 0, n: 0 })

        for (let i = 0; i < data.length; i += 4) {
          const [h, s, l] = rgbToHsl([data[i], data[i + 1], data[i + 2]])
          if (s < 0.2 || l < 0.12 || l > 0.92) continue
          const weight = s * (1 - Math.abs(l - 0.5))
          const b = buckets[Math.floor(h / 30) % 12]
          b.w += weight
          b.h += h * weight
          b.s += s * weight
          b.n++
        }

        const best = buckets.reduce((a, b) => (b.w > a.w ? b : a))
        // mostly greyscale art: no accent worth using
        if (best.n < size * size * 0.04) return resolve(null)

        const hue = best.h / best.w
        const sat = Math.min(0.85, Math.max(0.45, best.s / best.w))
        resolve(hslToRgb(hue, sat, 0.66))
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}

export function hexToRgb(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export const FALLBACK_ACCENT: RGB = [110, 168, 255]

export function applyAccent(rgb: RGB) {
  const root = document.documentElement
  root.style.setProperty('--accent', `rgb(${rgb.join(',')})`)
  root.style.setProperty('--accent-rgb', rgb.join(', '))
}
