import type { Connection } from '@/api/goatcounter'

// Everything Chalet remembers stays in this browser. Storage can be unavailable (private
// windows, blocked site data): the app then works for the session and forgets on reload.
const CONNECTION = 'chalet:connection'
const THEME = 'chalet:theme'

function read(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Nothing to do: the value lives for this session only
  }
}

export function loadConnection(): Connection | null {
  try {
    const value = JSON.parse(read(CONNECTION) ?? 'null')
    return value && typeof value.url === 'string' && typeof value.token === 'string' ? value : null
  } catch {
    return null
  }
}

export const saveConnection = (connection: Connection | null) =>
  write(CONNECTION, connection ? JSON.stringify(connection) : null)

export type Theme = 'auto' | 'light' | 'dark'

export const loadTheme = (): Theme => {
  const theme = read(THEME)
  return theme === 'light' || theme === 'dark' ? theme : 'auto'
}

export function applyTheme(theme: Theme) {
  if (theme === 'auto') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
  write(THEME, theme === 'auto' ? null : theme)
}
