import { reactive } from 'vue'

import type { Client, DayStat, PathHits, Range, Site, StatEntry, StatPage } from '@/api/goatcounter'
import { daysOf, type Bucket, type Period } from './period'
import { flag, siteName } from './format'
import { isInternal, sourceTotals, type Source } from './sources'

export interface Point {
  key: string
  value: number
}

export interface Row {
  key: string
  label: string
  count: number
  previous?: number
  icon?: string
}

export interface DashboardData {
  visits: number
  previousVisits: number
  events: number
  series: Point[]
  /** The bucket the series was computed for: it changes with the period, not before the data */
  bucket: Bucket
  pages: Row[]
  eventsList: Row[]
  referrers: Row[]
  sources: Record<Source, number>
  countries: Row[]
  languages: Row[]
  devices: { phone: number; tablet: number; desktop: number }
  browsers: Row[]
  systems: Row[]
  campaigns: Row[]
}

export type SectionKey = 'summary' | 'pages' | 'referrers' | 'countries' | 'languages' | 'devices' | 'browsers' | 'systems' | 'campaigns'

const sum = (days: DayStat[]) => days.reduce((total, day) => total + day.daily, 0)

function series(days: DayStat[], period: Period, timeZone: string): Point[] {
  if (period.bucket === 'hour') {
    const hourly = days[0]?.hourly ?? []
    // Today: stop at the current hour, the rest of the day hasn't happened
    const hours = period.id === 'today' ? Math.ceil((period.range.end.getTime() - period.range.start.getTime()) / 3600000) : 24
    return Array.from({ length: Math.min(24, Math.max(1, hours)) }, (_, hour) => ({ key: String(hour), value: hourly[hour] ?? 0 }))
  }
  const byDay = new Map(days.map((day) => [day.day, day.daily]))
  const all = daysOf(period.range, timeZone).map((day) => ({ key: day, value: byDay.get(day) ?? 0 }))
  if (period.bucket === 'day') return all
  const byMonth = new Map<string, number>()
  for (const { key, value } of all) byMonth.set(key.slice(0, 7), (byMonth.get(key.slice(0, 7)) ?? 0) + value)
  return [...byMonth].map(([key, value]) => ({ key, value }))
}

const rows = (entries: StatEntry[], decorate?: (entry: StatEntry) => Partial<Row>): Row[] =>
  entries
    .filter((entry) => entry.count > 0)
    .map((entry) => ({ key: entry.id || entry.name, label: entry.name || entry.id, count: entry.count, ...decorate?.(entry) }))

const pathRows = (hits: PathHits[], previous: Map<number, number>): Row[] =>
  hits
    .filter((hit) => hit.count > 0)
    .map((hit) => ({ key: String(hit.path_id), label: hit.path, count: hit.count, previous: previous.get(hit.path_id) ?? 0 }))

/**
 * The dashboard of one site over one period. Sections load one after the other, in the
 * order they appear, because GoatCounter allows 4 requests per second. While a new period
 * loads, the previous figures stay on screen (dimmed), so nothing jumps.
 */
export function useDashboard(client: Client) {
  const state = reactive({
    data: null as DashboardData | null,
    loading: new Set<SectionKey>(),
    error: '',
  })
  let generation = 0

  /** `path`: a GoatCounter path id, to see the whole dashboard for that page only */
  async function load(site: Site, period: Period, timeZone: string, path?: number) {
    const paths = path ? [path] : undefined
    const current = ++generation
    const stale = () => current !== generation
    state.error = ''
    state.loading = new Set(['summary', 'pages', 'referrers', 'countries', 'languages', 'devices', 'browsers', 'systems', 'campaigns'])
    const next: DashboardData = state.data
      ? { ...state.data }
      : {
          visits: 0,
          previousVisits: 0,
          events: 0,
          series: [],
          bucket: 'day',
          pages: [],
          eventsList: [],
          referrers: [],
          sources: { direct: 0, search: 0, social: 0, email: 0, campaign: 0, website: 0 },
          countries: [],
          languages: [],
          devices: { phone: 0, tablet: 0, desktop: 0 },
          browsers: [],
          systems: [],
          campaigns: [],
        }
    const publish = (section: SectionKey, patch: Partial<DashboardData>) => {
      if (stale()) return
      Object.assign(next, patch)
      state.data = { ...next }
      state.loading.delete(section)
    }
    const stat = (page: StatPage, range: Range = period.range) => client.stats(site, page, range, paths)

    try {
      const [total, previousTotal] = [
        await client.total(site, period.range, paths),
        await client.total(site, period.previous, paths),
      ]
      publish('summary', {
        visits: sum(total.stats),
        previousVisits: sum(previousTotal.stats),
        events: total.total_events,
        series: series(total.stats, period, timeZone),
        bucket: period.bucket,
      })

      const [hits, previousHits] = [
        await client.hits(site, period.range, paths),
        await client.hits(site, period.previous, paths),
      ]
      const before = new Map(previousHits.hits.map((hit) => [hit.path_id, hit.count]))
      publish('pages', {
        pages: pathRows(hits.hits.filter((hit) => !hit.event), before),
        eventsList: pathRows(hits.hits.filter((hit) => hit.event), before),
      })

      const refs = await stat('toprefs')
      const domain = siteName(site.name).toLowerCase()
      publish('referrers', {
        referrers: rows(refs.stats.filter((entry) => entry.name && !isInternal(entry, domain))),
        sources: sourceTotals(refs.stats, domain),
      })

      publish('countries', { countries: rows((await stat('locations')).stats, (entry) => ({ icon: flag(entry.id) })) })
      publish('languages', { languages: rows((await stat('languages')).stats).filter((row) => row.key !== '(unknown)') })

      const sizes = new Map((await stat('sizes')).stats.map((entry) => [entry.id, entry.count]))
      publish('devices', {
        devices: {
          phone: sizes.get('phone') ?? 0,
          tablet: sizes.get('tablet') ?? 0,
          desktop: (sizes.get('desktop') ?? 0) + (sizes.get('desktophd') ?? 0),
        },
      })

      publish('browsers', { browsers: rows((await stat('browsers')).stats) })
      publish('systems', { systems: rows((await stat('systems')).stats) })
      publish('campaigns', { campaigns: rows((await stat('campaigns')).stats) })
    } catch (error) {
      if (stale()) return
      state.error = error instanceof Error ? error.message : String(error)
      state.loading = new Set()
    }
  }

  return { state, load }
}
