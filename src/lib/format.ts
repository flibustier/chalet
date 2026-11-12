import type { Bucket } from './period'

const whole = new Intl.NumberFormat('en')
const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

/** 1,284 in full under 10,000, then 12.9K */
export const formatNumber = (n: number) => (Math.abs(n) < 10000 ? whole.format(n) : compact.format(n))

export const formatPercent = (share: number) => {
  const percent = share * 100
  if (percent > 0 && percent < 1) return '<1%'
  return `${Math.round(percent)}%`
}

export type Direction = 'up' | 'down' | 'flat'

/** Change against the previous period; nothing when there was nothing to compare with. */
export function delta(current: number, previous: number): { text: string; direction: Direction } | null {
  if (!previous) return null
  const change = (current - previous) / previous
  const rounded = Math.round(change * 100)
  if (rounded === 0) return { text: '0%', direction: 'flat' }
  return { text: `${rounded > 0 ? '+' : '−'}${Math.abs(rounded)}%`, direction: rounded > 0 ? 'up' : 'down' }
}

/** analytics.example.com → example.com: the prefix says nothing about the site. */
export const siteName = (name: string) => name.replace(/^(analytics|stats|goatcounter|count|www)\./, '')

/** Country code → flag emoji (regional indicator letters). */
export const flag = (code: string) =>
  /^[A-Z]{2}$/.test(code)
    ? String.fromCodePoint(...[...code].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65))
    : ''

const dayFormat = new Intl.DateTimeFormat('en', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' })
const shortDayFormat = new Intl.DateTimeFormat('en', { timeZone: 'UTC', day: 'numeric', month: 'short' })
const monthFormat = new Intl.DateTimeFormat('en', { timeZone: 'UTC', month: 'short', year: 'numeric' })

const asDate = (key: string) => new Date(`${key.length === 7 ? `${key}-01` : key}T00:00:00Z`)

/** Label of a bar: an hour ("14:00"), a day ("Mon 3 Nov") or a month ("Nov 2026"). */
export function bucketLabel(key: string, bucket: Bucket, short = false) {
  if (bucket === 'hour') return `${key.padStart(2, '0')}:00`
  const date = asDate(key)
  if (Number.isNaN(date.getTime())) return key // never break a render over a label
  if (bucket === 'month') return monthFormat.format(date)
  return (short ? shortDayFormat : dayFormat).format(date)
}

const longDayFormat = new Intl.DateTimeFormat('en', {
  timeZone: 'UTC',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/** "Monday, November 9, 2026" for a YYYY-MM-DD day */
export const longDay = (key: string) => longDayFormat.format(asDate(key))

const shortDayYearFormat = new Intl.DateTimeFormat('en', {
  timeZone: 'UTC',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})
const shortDayNoYearFormat = new Intl.DateTimeFormat('en', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' })

/** "Mon, Nov 9" this year, "Sun, Nov 9, 2025" before: short enough to sit beside the periods */
export const dayLabel = (key: string, today: string) =>
  (key.slice(0, 4) === today.slice(0, 4) ? shortDayNoYearFormat : shortDayYearFormat).format(asDate(key))
