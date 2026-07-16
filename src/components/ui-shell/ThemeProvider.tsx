import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ThemeContext, useTheme, type Theme } from './theme-context'

const storageKey = 'qc-oms-theme'

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'
  return window.localStorage.getItem(storageKey) === 'light' ? 'light' : 'dark'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readStoredTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    window.localStorage.setItem(storageKey, theme)
  }, [theme])

  const value = useMemo(
    () => ({
      theme,
      toggleTheme: () => setTheme((current) => (current === 'light' ? 'dark' : 'light')),
    }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const nextTheme = theme === 'light' ? 'tối' : 'sáng'

  return (
    <button
      aria-label={`Đổi sang giao diện ${nextTheme}`}
      className="theme-toggle management-icon-button"
      title={`Đổi sang giao diện ${nextTheme}`}
      type="button"
      onClick={toggleTheme}
    >
      <span aria-hidden="true">{theme === 'light' ? '☾' : '☼'}</span>
      <span>{theme === 'light' ? 'Tối' : 'Sáng'}</span>
    </button>
  )
}
