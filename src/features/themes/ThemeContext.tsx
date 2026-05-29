import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  THEMES,
  DEFAULT_THEME,
  OLED_BG,
  OLED_CODE_BG,
  OLED_BORDER,
  type Theme,
} from './themes'

const OLED_BG_SECONDARY = '#050508'

interface ThemeState {
  theme: Theme
  setThemeId: (id: string) => void
  isOled: boolean
  setOled: (value: boolean) => void
}

const ThemeContext = createContext<ThemeState>({
  theme: DEFAULT_THEME,
  setThemeId: () => {},
  isOled: false,
  setOled: () => {},
})

const STORAGE_THEME_KEY = 'primrec.theme'
const STORAGE_OLED_KEY = 'primrec.oled'

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const storedId = readStored<string>(STORAGE_THEME_KEY, DEFAULT_THEME.id)
    return THEMES.find((t) => t.id === storedId) ?? DEFAULT_THEME
  })

  const [isOled, setOledRaw] = useState<boolean>(() =>
    readStored<boolean>(STORAGE_OLED_KEY, false),
  )

  const setThemeId = useCallback((id: string) => {
    const next = THEMES.find((t) => t.id === id) ?? DEFAULT_THEME
    setTheme(next)
    try {
      localStorage.setItem(STORAGE_THEME_KEY, JSON.stringify(next.id))
    } catch { /* ignore */ }
  }, [])

  const setOled = useCallback((value: boolean) => {
    setOledRaw(value)
    try {
      localStorage.setItem(STORAGE_OLED_KEY, JSON.stringify(value))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    const c = theme.colors
    const isDarkOled = theme.variant === 'dark' && isOled

    root.style.setProperty('--text', c.text)
    root.style.setProperty('--text-h', c.textH)
    root.style.setProperty('--text-muted', c.textMuted)
    root.style.setProperty('--bg', isDarkOled ? OLED_BG : c.bg)
    root.style.setProperty('--bg-secondary', isDarkOled ? OLED_BG_SECONDARY : c.bgSecondary)
    root.style.setProperty('--border', isDarkOled ? OLED_BORDER : c.border)
    root.style.setProperty('--code-bg', isDarkOled ? OLED_CODE_BG : c.codeBg)
    root.style.setProperty('--social-bg', isDarkOled ? OLED_CODE_BG : c.socialBg)
    root.style.setProperty('--accent', c.accent)
    root.style.setProperty('--accent-2', c.accent2)
    root.style.setProperty('--accent-3', c.accent3)
    root.style.setProperty('--accent-4', c.accent4)
    root.style.setProperty('--accent-5', c.accent5)
    root.style.setProperty('--accent-bg', c.accentBg)
    root.style.setProperty('--accent-border', c.accentBorder)
    root.style.setProperty('--shadow', c.shadow)
    root.style.setProperty('color-scheme', theme.variant)
  }, [theme, isOled])

  return (
    <ThemeContext.Provider value={{ theme, setThemeId, isOled, setOled }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
