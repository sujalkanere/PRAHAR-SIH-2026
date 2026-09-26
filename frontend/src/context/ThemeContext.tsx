import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export interface ThemeContextValue {
  /** User's explicit preference ('light' | 'dark' | 'system') */
  themeMode: ThemeMode
  /** Computed active theme taking OS setting into account ('light' | 'dark') */
  resolvedTheme: ResolvedTheme
  /** Setter for theme mode with automatic localStorage sync and DOM application */
  setThemeMode: (mode: ThemeMode) => void
  /** Quick cycle helper: light -> dark -> system -> light */
  toggleTheme: () => void
  /** Whether dark mode is currently active */
  isDark: boolean
}

export const THEME_STORAGE_KEY = 'prahar_theme_preference'
const COLOR_SCHEME_MEDIA_QUERY = '(prefers-color-scheme: dark)'

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

/**
 * Returns system-preferred theme ('dark' or 'light')
 */
const getSystemTheme = (): ResolvedTheme => {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia && window.matchMedia(COLOR_SCHEME_MEDIA_QUERY).matches
    ? 'dark'
    : 'light'
}

/**
 * Validates and retrieves stored theme from localStorage
 */
const getStoredTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'system'
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored
    }
  } catch (err) {
    console.warn('[ThemeContext] Failed to read localStorage:', err)
  }
  return 'system'
}

/**
 * Applies theme tokens and attributes to the root HTML document
 */
const applyThemeToDOM = (resolved: ResolvedTheme, mode: ThemeMode) => {
  if (typeof document === 'undefined') return
  const root = document.documentElement

  // Set data-theme attribute for CSS attribute selectors: [data-theme="dark"]
  root.setAttribute('data-theme', resolved)

  // Sync className for utility classes (.dark / .light)
  if (resolved === 'dark') {
    root.classList.add('dark')
    root.classList.remove('light')
  } else {
    root.classList.add('light')
    root.classList.remove('dark')
  }

  // Native browser UI (scrollbars, form controls, viewport canvas)
  root.style.colorScheme = resolved

  // Dispatch custom event for canvas/charts/leaflet listeners
  try {
    window.dispatchEvent(
      new CustomEvent('prahar-theme-change', {
        detail: { resolvedTheme: resolved, themeMode: mode },
      }),
    )
  } catch {
    // Ignore event dispatch errors in legacy runtimes
  }
}

interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: ThemeMode
  storageKey?: string
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = 'system',
  storageKey = THEME_STORAGE_KEY,
}) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return defaultTheme
    try {
      const stored = localStorage.getItem(storageKey) as ThemeMode | null
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored
      }
    } catch {
      // Fallback on read error
    }
    return defaultTheme
  })

  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme)

  // Compute resolved theme
  const resolvedTheme: ResolvedTheme = useMemo(() => {
    return themeMode === 'system' ? systemTheme : themeMode
  }, [themeMode, systemTheme])

  // Reactive listener for OS theme changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return

    const mediaQuery = window.matchMedia(COLOR_SCHEME_MEDIA_QUERY)

    const handleMediaChange = (e: MediaQueryListEvent | MediaQueryList) => {
      const newSysTheme: ResolvedTheme = e.matches ? 'dark' : 'light'
      setSystemTheme(newSysTheme)
    }

    // Set initial
    setSystemTheme(mediaQuery.matches ? 'dark' : 'light')

    // Modern browsers support addEventListener, fallback to addListener for older runtimes
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleMediaChange)
      return () => mediaQuery.removeEventListener('change', handleMediaChange)
    } else {
      mediaQuery.addListener(handleMediaChange)
      return () => mediaQuery.removeListener(handleMediaChange)
    }
  }, [])

  // Sync DOM and persist to localStorage whenever resolvedTheme or themeMode changes
  useEffect(() => {
    applyThemeToDOM(resolvedTheme, themeMode)
    try {
      localStorage.setItem(storageKey, themeMode)
    } catch (err) {
      console.warn('[ThemeContext] Failed to persist theme to localStorage:', err)
    }
  }, [resolvedTheme, themeMode, storageKey])

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeModeState((prev) => {
      if (prev === 'light') return 'dark'
      if (prev === 'dark') return 'system'
      return 'light'
    })
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeMode,
      resolvedTheme,
      setThemeMode,
      toggleTheme,
      isDark: resolvedTheme === 'dark',
    }),
    [themeMode, resolvedTheme, setThemeMode, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

/**
 * Hook to consume theme state and controls anywhere in the application
 */
export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a <ThemeProvider>')
  }
  return context
}
