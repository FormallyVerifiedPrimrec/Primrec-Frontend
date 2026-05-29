import { useTheme } from './ThemeContext'
import { THEMES, THEME_HUES } from './themes'
import type { ThemeVariant } from './themes'

export function ThemePicker({ onClose }: { onClose: () => void }) {
  const { theme, setThemeId, isOled, setOled } = useTheme()

  const grouped = THEME_HUES.map((hue) => {
    const themes = THEMES.filter((t) => t.hue === hue)
    return { hue, themes }
  })

  const isDark = theme.variant === 'dark'

  return (
    <div className="themePickerOverlay" onClick={onClose}>
      <div className="themePicker" onClick={(e) => e.stopPropagation()}>
        <div className="themePickerHeader">
          <span className="themePickerTitle">Theme</span>
          <button className="iconBtn" onClick={onClose} aria-label="Close theme picker">
            ✕
          </button>
        </div>

        <div className="themeGrid">
          {grouped.map(({ hue, themes }) => (
            <div key={hue} className="themeRow">
              <div className="themeRowLabel">{hue}</div>
              <div className="themeSwatches">
                {(['dark', 'light'] as ThemeVariant[]).map((variant) => {
                  const t = themes.find((th) => th.variant === variant)!
                  const active = theme.id === t.id
                  const c = t.hue === 'blue' && variant === 'dark'
                    ? '#35b2c4'
                    : THEMES.find((th) => th.hue === t.hue && th.variant === 'dark')!.colors.accent

                  return (
                    <button
                      key={t.id}
                      className={`themeSwatch ${active ? 'active' : ''}`}
                      style={{
                        background: variant === 'dark' ? '#1a1a2e' : '#e5e7eb',
                      }}
                      onClick={() => setThemeId(t.id)}
                      title={t.name}
                      aria-label={t.name}
                      aria-pressed={active}
                    >
                      <span
                        className="themeSwatchColor"
                        style={{
                          background: c,
                        }}
                      />
                      {active && (
                        <span className="themeSwatchCheck">✓</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {isDark && (
          <label className="themeOledToggle">
            <input
              type="checkbox"
              checked={isOled}
              onChange={(e) => setOled(e.target.checked)}
            />
            <span>OLED black background</span>
          </label>
        )}
      </div>
    </div>
  )
}
