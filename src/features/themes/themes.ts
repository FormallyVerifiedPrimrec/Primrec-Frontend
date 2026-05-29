export interface ThemeColors {
  text: string
  textH: string
  textMuted: string
  bg: string
  bgSecondary: string
  border: string
  codeBg: string
  socialBg: string
  accent: string
  accent2: string
  accent3: string
  accent4: string
  accent5: string
  accentBg: string
  accentBorder: string
  shadow: string
}

export type ThemeVariant = 'dark' | 'light'

export interface Theme {
  id: string
  name: string
  hue: string
  variant: ThemeVariant
  colors: ThemeColors
}

export const THEME_HUES = ['blue', 'green', 'orange', 'red', 'yellow', 'purple'] as const
export type ThemeHue = (typeof THEME_HUES)[number]

function rgb(r: number, g: number, b: number) {
  return { r, g, b }
}

function color({ r, g, b }: { r: number; g: number; b: number }, alpha = 1) {
  return alpha < 1 ? `rgba(${r},${g},${b},${alpha})` : `rgb(${r},${g},${b})`
}

function darken(c: { r: number; g: number; b: number }, factor: number) {
  return rgb(Math.round(c.r * factor), Math.round(c.g * factor), Math.round(c.b * factor))
}

function lighten(c: { r: number; g: number; b: number }, factor: number) {
  return rgb(
    Math.round(c.r + (255 - c.r) * factor),
    Math.round(c.g + (255 - c.g) * factor),
    Math.round(c.b + (255 - c.b) * factor),
  )
}

const HUE_COLORS: Record<ThemeHue, { r: number; g: number; b: number }> = {
  blue: rgb(53, 178, 196),
  green: rgb(34, 197, 94),
  orange: rgb(249, 115, 22),
  red: rgb(239, 68, 68),
  yellow: rgb(234, 179, 8),
  purple: rgb(168, 85, 247),
}

function buildTheme(
  id: string,
  name: string,
  hue: ThemeHue,
  variant: ThemeVariant,
): Theme {
  const c = HUE_COLORS[hue]
  const isDark = variant === 'dark'

  const accent = color(c)
  const accent2 = color(lighten(c, 0.55))
  const accent3 = color(lighten(c, 0.3))
  const accent4 = color(darken(c, 0.63))
  const accent5 = color(darken(c, 0.47))

  return {
    id,
    name,
    hue,
    variant,
    colors: {
      text: isDark ? '#9ca3af' : '#6b7280',
      textH: isDark ? '#f3f4f6' : '#111827',
      textMuted: isDark ? '#6b7280' : '#9ca3af',
      bg: isDark ? '#16171d' : '#ffffff',
      bgSecondary: isDark ? '#1a1b23' : '#f9fafb',
      border: isDark ? '#2e303a' : '#e5e7eb',
      codeBg: isDark ? '#1f2028' : '#f3f4f6',
      socialBg: isDark ? 'rgba(47,48,58,0.5)' : '#f3f4f6',
      accent,
      accent2,
      accent3,
      accent4,
      accent5,
      accentBg: isDark
        ? `rgba(${c.r},${c.g},${c.b},0.15)`
        : `rgba(${c.r},${c.g},${c.b},0.1)`,
      accentBorder: isDark
        ? `rgba(${c.r},${c.g},${c.b},0.5)`
        : `rgba(${c.r},${c.g},${c.b},0.4)`,
      shadow: isDark
        ? 'rgba(0,0,0,0.4) 0 10px 15px -3px, rgba(0,0,0,0.25) 0 4px 6px -2px'
        : 'rgba(0,0,0,0.1) 0 10px 15px -3px, rgba(0,0,0,0.05) 0 4px 6px -2px',
    },
  }
}

const DEFAULT_THEME_ID = 'blue-dark'

export const THEMES: Theme[] = THEME_HUES.flatMap((hue) => [
  buildTheme(`${hue}-dark`, `${hue[0].toUpperCase()}${hue.slice(1)} Dark`, hue, 'dark'),
  buildTheme(`${hue}-light`, `${hue[0].toUpperCase()}${hue.slice(1)} Light`, hue, 'light'),
])

export const DEFAULT_THEME = THEMES.find((t) => t.id === DEFAULT_THEME_ID)!

export const OLED_BG = '#000000'
export const OLED_CODE_BG = '#0a0a0a'
export const OLED_BORDER = '#1a1a2e'
