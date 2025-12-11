import { useState, useEffect, useCallback } from 'react'

type ThemeMode = 'light' | 'dark' | 'auto'

interface UseThemeReturn {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
  isDark: boolean
}

export function useTheme(initialTheme: ThemeMode = 'auto'): UseThemeReturn {
  const [theme, setThemeState] = useState<ThemeMode>(initialTheme)
  const [isDark, setIsDark] = useState(false)

  const updateIsDark = useCallback((themeValue: ThemeMode) => {
    if (themeValue === 'auto') {
      setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches)
    } else {
      setIsDark(themeValue === 'dark')
    }
  }, [])

  const setTheme = useCallback((newTheme: ThemeMode) => {
    setThemeState(newTheme)
    updateIsDark(newTheme)
  }, [updateIsDark])

  useEffect(() => {
    updateIsDark(theme)
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (theme === 'auto') {
        setIsDark(mediaQuery.matches)
      }
    }
    
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme, updateIsDark])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
  }, [isDark])

  return { theme, setTheme, isDark }
}
