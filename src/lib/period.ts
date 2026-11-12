import type { Range } from '@/api/goatcounter'

export type PeriodId = 'today' | 'yesterday' | 'day' | '7d' | '30d' | '90d' | '12m'
export type Bucket = 'hour' | 'day' | 'month'

export const PERIODS: { id: PeriodId; label: string; previous: string }[] = [
  { id: 'today', label: 'Today', previous: 'yesterday' },
  { id: 'yesterday', label: 'Yesterday', previous: 'the day before' },
  { id: '7d', label: '7 days', previous: 'the previous 7 days' },
  { id: '30d', label: '30 days', previous: 'the previous 30 days' },
  { id: '90d', label: '90 days', previous: 'the previous 90 days' },
  { id: '12m', label: '12 months', previous: 'the previous 12 months' },
]

export interface Period {
  id: PeriodId
  range: Range
  previous: Range
  bucket: Bucket
  /** The day shown, YYYY-MM-DD in the zone, for the views of a single day */
  date?: string
}

// GoatCounter returns days and hours in the account's time zone, so periods start at that
// zone's midnights. These helpers work on calendar dates in the zone.
interface ZonedDate {
  year: number
  month: number // 1-12
  day: number
}

function offsetMinutes(instant: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    })
      .formatToParts(instant)
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>
  const asUtc = Date.UTC(parts.year!, parts.month! - 1, parts.day!, parts.hour!, parts.minute!)
  return Math.round((asUtc - instant.getTime()) / 60000)
}

export function zonedToday(timeZone: string, now = new Date()): ZonedDate {
  const local = new Date(now.getTime() + offsetMinutes(now, timeZone) * 60000)
  return { year: local.getUTCFullYear(), month: local.getUTCMonth() + 1, day: local.getUTCDate() }
}

/** The instant of midnight on a calendar date in the zone (dates may overflow: day 0, month 13). */
export function zonedMidnight({ year, month, day }: ZonedDate, timeZone: string) {
  const guess = new Date(Date.UTC(year, month - 1, day))
  let instant = new Date(guess.getTime() - offsetMinutes(guess, timeZone) * 60000)
  // Around a DST change the offset at midnight differs from the guess's: correct once.
  instant = new Date(guess.getTime() - offsetMinutes(instant, timeZone) * 60000)
  return instant
}

const shift = (date: ZonedDate, days = 0, months = 0): ZonedDate => {
  const d = new Date(Date.UTC(date.year, date.month - 1 + months, date.day + days))
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

export const dateKey = ({ year, month, day }: ZonedDate) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

export const isDateKey = (key: string | null): key is string => !!key && /^\d{4}-\d{2}-\d{2}$/.test(key)

const parseKey = (key: string): ZonedDate => {
  const [year, month, day] = key.split('-').map(Number)
  return { year: year!, month: month!, day: day! }
}

/** The day before or after, as YYYY-MM-DD */
export const shiftKey = (key: string, days: number) => dateKey(shift(parseKey(key), days))

export const todayKey = (timeZone: string, now = new Date()) => dateKey(zonedToday(timeZone, now))

/** One day, hour by hour. Today and yesterday keep their own names. */
export function periodForDay(key: string, timeZone: string, now = new Date()): Period {
  const today = todayKey(timeZone, now)
  if (key >= today) return periodFor('today', timeZone, now)
  if (key === shiftKey(today, -1)) return periodFor('yesterday', timeZone, now)
  const date = parseKey(key)
  const at = (d: ZonedDate) => zonedMidnight(d, timeZone)
  return {
    id: 'day',
    bucket: 'hour',
    date: key,
    range: { start: at(date), end: at(shift(date, 1)) },
    previous: { start: at(shift(date, -1)), end: at(date) },
  }
}

export function periodFor(id: PeriodId, timeZone: string, now = new Date()): Period {
  const today = zonedToday(timeZone, now)
  const at = (date: ZonedDate) => zonedMidnight(date, timeZone)
  // The current hour is still filling up: include it.
  const endOfHour = new Date(Math.ceil(now.getTime() / 3600000) * 3600000)
  const span = (from: ZonedDate, to: ZonedDate): Range => ({ start: at(from), end: at(to) })

  switch (id) {
    case 'day':
    case 'today':
      return {
        id: 'today',
        bucket: 'hour',
        date: dateKey(today),
        range: { start: at(today), end: endOfHour },
        previous: { start: at(shift(today, -1)), end: new Date(endOfHour.getTime() - 86400000) },
      }
    case 'yesterday':
      return {
        id,
        bucket: 'hour',
        date: dateKey(shift(today, -1)),
        range: span(shift(today, -1), today),
        previous: span(shift(today, -2), shift(today, -1)),
      }
    case '12m': {
      const first = { ...today, day: 1 }
      const start = shift(first, 0, -11)
      return {
        id,
        bucket: 'month',
        range: { start: at(start), end: endOfHour },
        previous: span(shift(start, 0, -12), start),
      }
    }
    default: {
      const days = id === '7d' ? 7 : id === '30d' ? 30 : 90
      const start = shift(today, -(days - 1))
      return {
        id,
        bucket: 'day',
        range: { start: at(start), end: endOfHour },
        previous: span(shift(start, -days), start),
      }
    }
  }
}

/** Every day (YYYY-MM-DD, in the zone) a range covers, so days without visits still get a bar. */
export function daysOf(range: Range, timeZone: string): string[] {
  const out: string[] = []
  let date = zonedToday(timeZone, range.start)
  for (;;) {
    const start = zonedMidnight(date, timeZone)
    if (start >= range.end) break
    out.push(dateKey(date))
    date = shift(date, 1)
  }
  return out
}
