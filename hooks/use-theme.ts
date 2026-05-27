'use client'

import { useMemo } from 'react'

export type EventTheme = 'wedding' | 'funeral'

export interface ThemeConfig {
  primary: string
  primaryLight: string
  primaryDark: string
  background: string
  accent: string
  accentLight: string
  surface: string
  muted: string
  fontWeight: string
  borderRadius: string
  transitionDuration: number
  transitionType: 'spring' | 'tween'
  // Tailwind class helpers
  primaryClass: string
  primaryBgClass: string
  primaryTextClass: string
  primaryBorderClass: string
  bgClass: string
  accentClass: string
  accentBgClass: string
  surfaceClass: string
  mutedBgClass: string
}

const WEDDING_THEME: ThemeConfig = {
  primary: '#f43f5e',
  primaryLight: '#fda4af',
  primaryDark: '#be123c',
  background: '#fff7ed',
  accent: '#d97706',
  accentLight: '#fcd34d',
  surface: '#fff1f2',
  muted: '#fce7f3',
  fontWeight: 'font-medium',
  borderRadius: 'rounded-2xl',
  transitionDuration: 0.2,
  transitionType: 'spring',
  primaryClass: 'wedding-primary',
  primaryBgClass: 'bg-wedding-primary',
  primaryTextClass: 'text-wedding-primary',
  primaryBorderClass: 'border-wedding-primary',
  bgClass: 'bg-wedding-background',
  accentClass: 'wedding-accent',
  accentBgClass: 'bg-wedding-accent',
  surfaceClass: 'bg-wedding-surface',
  mutedBgClass: 'bg-wedding-muted',
}

const FUNERAL_THEME: ThemeConfig = {
  primary: '#475569',
  primaryLight: '#94a3b8',
  primaryDark: '#1e293b',
  background: '#f8fafc',
  accent: '#1e3a5f',
  accentLight: '#3b82f6',
  surface: '#f1f5f9',
  muted: '#e2e8f0',
  fontWeight: 'font-light',
  borderRadius: 'rounded-lg',
  transitionDuration: 0.4,
  transitionType: 'tween',
  primaryClass: 'funeral-primary',
  primaryBgClass: 'bg-funeral-primary',
  primaryTextClass: 'text-funeral-primary',
  primaryBorderClass: 'border-funeral-primary',
  bgClass: 'bg-funeral-background',
  accentClass: 'funeral-accent',
  accentBgClass: 'bg-funeral-accent',
  surfaceClass: 'bg-funeral-surface',
  mutedBgClass: 'bg-funeral-muted',
}

export function useTheme(theme: EventTheme): ThemeConfig {
  return useMemo(() => (theme === 'wedding' ? WEDDING_THEME : FUNERAL_THEME), [theme])
}

export function getThemeConfig(theme: EventTheme): ThemeConfig {
  return theme === 'wedding' ? WEDDING_THEME : FUNERAL_THEME
}
