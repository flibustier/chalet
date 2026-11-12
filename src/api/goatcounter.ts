// A small client for the GoatCounter API (v0), read-only.
// https://www.goatcounter.com/help/api

export interface Connection {
  /** Base URL of the GoatCounter instance the key was created on, e.g. https://stats.example.com */
  url: string
  token: string
}

export interface Site {
  id: number
  /** Where the site's API lives: its custom domain, or its goatcounter.com subdomain */
  url: string
  name: string
}

export interface DayStat {
  day: string
  hourly: number[]
  daily: number
}

export interface TotalResponse {
  total: number
  total_events: number
  stats: DayStat[]
}

export interface PathHits {
  count: number
  path_id: number
  path: string
  event: boolean
  title: string
  stats: DayStat[]
}

export interface HitsResponse {
  hits: PathHits[]
  more: boolean
}

export interface StatEntry {
  id: string
  name: string
  count: number
  ref_scheme?: string | null
}

export interface StatsResponse {
  stats: StatEntry[]
  more: boolean
}

export type StatPage = 'toprefs' | 'browsers' | 'systems' | 'sizes' | 'locations' | 'languages' | 'campaigns'

export interface Range {
  start: Date
  end: Date
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

// GoatCounter allows 4 requests per second per key, and from a browser each call costs two:
// the key travels in a header, so a CORS preflight goes first, and it counts too. Calls to a
// host go one after the other, spaced out, and a 429 waits for the next window instead of
// failing. That 429 has no CORS headers, so the browser reports it as a network error: once
// a host has answered, a network error from it is retried the same way.
const SPACING_MS = 550
const CACHE_MS = 60_000
const queues = new Map<string, Promise<unknown>>()
const reachable = new Set<string>()
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function enqueue<T>(host: string, task: () => Promise<T>): Promise<T> {
  const previous = queues.get(host) ?? Promise.resolve()
  const run = previous.catch(() => undefined).then(async () => {
    try {
      return await task()
    } finally {
      await sleep(SPACING_MS)
    }
  })
  queues.set(host, run)
  return run
}

export const normalizeUrl = (url: string) => {
  const trimmed = url.trim().replace(/\/+$/, '')
  return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`
}

// The API wants times rounded to the hour.
const hour = (date: Date) => {
  const rounded = new Date(date)
  rounded.setUTCMinutes(0, 0, 0)
  return rounded.toISOString().replace('.000Z', 'Z')
}

export function createClient(token: string) {
  // Going back to a period or a site seen a moment ago doesn't ask GoatCounter again
  const cache = new Map<string, { at: number; value: Promise<unknown> }>()

  function get<T>(base: string, path: string, params: Record<string, string | number | boolean> = {}): Promise<T> {
    const url = new URL(`${normalizeUrl(base)}/api/v0${path}`)
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value))
    const hit = cache.get(url.href)
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.value as Promise<T>
    const value = fetchJson<T>(url)
    cache.set(url.href, { at: Date.now(), value })
    value.catch(() => cache.delete(url.href))
    return value
  }

  async function fetchJson<T>(url: URL): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      let response: Response
      try {
        response = await enqueue(url.host, () =>
          fetch(url, { headers: { Authorization: `Bearer ${token}` }, referrerPolicy: 'no-referrer' }),
        )
      } catch (error) {
        if (reachable.has(url.host) && attempt < 4) {
          await sleep(1000 * (attempt + 1))
          continue
        }
        throw error
      }
      reachable.add(url.host)
      if (response.status === 429 && attempt < 4) {
        await sleep(1000 * (attempt + 1))
        continue
      }
      if (!response.ok) {
        const message =
          response.status === 401
            ? 'This API key is not valid.'
            : response.status === 403
              ? 'This API key cannot read statistics.'
              : `GoatCounter answered ${response.status}.`
        throw new ApiError(response.status, message)
      }
      return (await response.json()) as T
    }
  }

  const range = (r: Range) => ({ start: hour(r.start), end: hour(r.end) })

  return {
    me: (base: string) => get<{ user: { email: string; site: number; settings?: { timezone?: string } } }>(base, '/me'),

    async sites(base: string): Promise<Site[]> {
      const { sites } = await get<{ sites: { id: number; cname: string | null; code: string }[] }>(base, '/sites')
      const { protocol, host } = new URL(normalizeUrl(base))
      return sites.map((site) => {
        // A self-hosted site lives on its cname; on goatcounter.com, on its code's subdomain
        const domain = site.cname || (host.endsWith('goatcounter.com') ? `${site.code}.goatcounter.com` : host)
        return { id: site.id, url: `${protocol}//${domain}`, name: site.cname || site.code }
      })
    },

    total: (site: Site, r: Range) => get<TotalResponse>(site.url, '/stats/total', range(r)),

    hits: (site: Site, r: Range, limit = 100) =>
      get<HitsResponse>(site.url, '/stats/hits', { ...range(r), limit, daily: true }),

    stats: (site: Site, page: StatPage, r: Range, limit = 100) =>
      get<StatsResponse>(site.url, `/stats/${page}`, { ...range(r), limit }),
  }
}

export type Client = ReturnType<typeof createClient>
