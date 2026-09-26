import React, { useRef, useCallback } from 'react'
import { Tooltip } from 'antd'
import { Sun, Moon, Laptop } from 'lucide-react'
import { useTheme, ThemeMode } from '../context/ThemeContext'

interface ThemeToggleProps {
  /** Optional layout variant */
  variant?: 'segmented' | 'compact'
  /** Optional custom class name */
  className?: string
  /** Optional inline styles */
  style?: React.CSSProperties
  /** Match dark bar background (e.g. for landing page accessibility bar in light mode) */
  matchDarkBg?: boolean
}

interface ThemeOption {
  value: ThemeMode
  label: string
  icon: React.ReactNode
  tooltip: string
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    value: 'light',
    label: 'Light',
    icon: <Sun size={15} strokeWidth={2.2} />,
    tooltip: 'Light Mode (Ivory Public Sector)',
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: <Moon size={15} strokeWidth={2.2} />,
    tooltip: 'Dark Mode (Tactical Obsidian)',
  },
  {
    value: 'system',
    label: 'System',
    icon: <Laptop size={15} strokeWidth={2.2} />,
    tooltip: 'System Preference (Sync with OS)',
  },
]

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  variant = 'segmented',
  className = '',
  style,
  matchDarkBg = false,
}) => {
  const { themeMode, resolvedTheme, setThemeMode, toggleTheme } = useTheme()
  const groupRef = useRef<HTMLDivElement>(null)
  const isDark = resolvedTheme === 'dark'
  const isLightOnDark = matchDarkBg && !isDark

  // Accessible keyboard navigation (ArrowLeft / ArrowRight)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, currentIndex: number) => {
      let nextIndex = currentIndex

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        nextIndex = (currentIndex + 1) % THEME_OPTIONS.length
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        nextIndex = (currentIndex - 1 + THEME_OPTIONS.length) % THEME_OPTIONS.length
      }

      if (nextIndex !== currentIndex) {
        const nextMode = THEME_OPTIONS[nextIndex].value
        setThemeMode(nextMode)
        const buttons = groupRef.current?.querySelectorAll<HTMLButtonElement>('button[role="radio"]')
        buttons?.[nextIndex]?.focus()
      }
    },
    [setThemeMode],
  )

  // Compact circular button variant
  if (variant === 'compact') {
    return (
      <Tooltip
        title={`Current: ${themeMode.toUpperCase()} (${resolvedTheme} active). Click to cycle.`}
        placement="bottom"
      >
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Toggle theme (currently ${themeMode})`}
          className={`prahar-theme-compact-toggle ${className}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: 18,
            border: isLightOnDark ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid var(--border-primary)',
            background: isLightOnDark ? '#0b2545' : 'var(--bg-surface)',
            color: isLightOnDark ? '#ffffff' : 'var(--text-primary)',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: isLightOnDark ? 'none' : 'var(--shadow-sm)',
            ...style,
          }}
        >
          {themeMode === 'system' ? (
            <Laptop size={16} strokeWidth={2} style={{ color: isLightOnDark ? '#00d2ff' : 'var(--color-primary)' }} />
          ) : isDark ? (
            <Moon size={16} strokeWidth={2} style={{ color: '#38bdf8' }} />
          ) : (
            <Sun size={16} strokeWidth={2} style={{ color: '#f59e0b' }} />
          )}
        </button>
      </Tooltip>
    )
  }

  // Standard Segmented 3-Pill Switch
  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label="Theme mode selection"
      className={`prahar-theme-segmented-group ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: isLightOnDark ? '#0b2545' : 'var(--bg-secondary)',
        border: isLightOnDark ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid var(--border-primary)',
        borderRadius: 24,
        padding: '3px',
        gap: '2px',
        position: 'relative',
        userSelect: 'none',
        transition: 'background-color 0.25s ease, border-color 0.25s ease',
        ...style,
      }}
    >
      {THEME_OPTIONS.map((opt, index) => {
        const isSelected = themeMode === opt.value
        return (
          <Tooltip key={opt.value} title={opt.tooltip} placement="bottom">
            <button
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => setThemeMode(opt.value)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '5px 10px',
                borderRadius: 20,
                border: 'none',
                background: isSelected
                  ? isLightOnDark
                    ? 'rgba(255, 255, 255, 0.16)'
                    : 'var(--bg-surface)'
                  : 'transparent',
                color: isSelected
                  ? isLightOnDark
                    ? '#ffffff'
                    : 'var(--text-primary)'
                  : isLightOnDark
                    ? 'rgba(255, 255, 255, 0.75)'
                    : 'var(--text-muted)',
                fontWeight: isSelected ? 600 : 500,
                fontSize: '12px',
                cursor: 'pointer',
                outline: 'none',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: isSelected
                  ? isLightOnDark
                    ? '0 1px 4px rgba(0, 0, 0, 0.25)'
                    : '0 1px 3px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04)'
                  : 'none',
              }}
            >
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  color: isSelected
                    ? opt.value === 'dark'
                      ? '#38bdf8'
                      : opt.value === 'light'
                        ? '#f59e0b'
                        : isLightOnDark
                          ? '#00d2ff'
                          : 'var(--color-primary)'
                    : 'inherit',
                  transition: 'color 0.2s ease',
                }}
              >
                {opt.icon}
              </span>
              <span className="theme-toggle-label">{opt.label}</span>
            </button>
          </Tooltip>
        )
      })}
    </div>
  )
}

export default ThemeToggle
