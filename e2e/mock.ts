import type { Page, Route } from '@playwright/test'

// A fake GoatCounter with made-up figures, so the tests never need a real instance or key.
export const TOKEN = 'test-token-0123456789'
const ZONE = 'Europe/Paris'
const HOSTS = ['stats.example.com', 'stats.example.org']

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'Authorization, Content-Type',
  'access-control-allow-methods': 'GET, OPTIONS',
}

const localDay = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: ZONE }).format(date)
const localHour = (date: Date) =>
  Number(new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, hour: 'numeric', hourCycle: 'h23' }).format(date))

// Visits in a given hour: steady, with a daily rhythm, different per site
const visitsAt = (date: Date, site: number) => ((date.getUTCHours() * 7 + date.getUTCDate() * 3 + site) % 5) + site

function days(start: Date, end: Date, site: number) {
  const out = new Map<string, number[]>()
  for (let t = start.getTime(); t < end.getTime(); t += 3600000) {
    const date = new Date(t)
    const day = localDay(date)
    const hourly = out.get(day) ?? Array<number>(24).fill(0)
    hourly[localHour(date)]! += visitsAt(date, site)
    out.set(day, hourly)
  }
  return [...out].map(([day, hourly]) => ({ day, hourly, daily: hourly.reduce((a, b) => a + b, 0) }))
}

export interface MockOptions {
  /** Answer 429 to the first call of this endpoint, like GoatCounter over its rate limit */
  rateLimitOnce?: string
  token?: string
}

export async function mockGoatCounter(page: Page, options: MockOptions = {}) {
  const calls: string[] = []
  let limited = false
  const handler = async (route: Route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    const url = new URL(request.url())
    const site = HOSTS.indexOf(url.host) + 1
    const path = url.pathname.replace('/api/v0', '')
    calls.push(path)
    const json = (body: unknown, status = 200) => route.fulfill({ status, headers: cors, json: body })
    if (request.headers().authorization !== `Bearer ${options.token ?? TOKEN}`) return json({ error: 'no' }, 401)
    if (options.rateLimitOnce === path && !limited) {
      limited = true
      return json({ error: 'rate limited' }, 429)
    }
    const start = new Date(url.searchParams.get('start') ?? Date.now() - 7 * 86400000)
    const end = new Date(url.searchParams.get('end') ?? Date.now())
    const stats = days(start, end, site)

    switch (path) {
      case '/me':
        return json({ user: { email: 'demo@example.com', site: 1, settings: { timezone: `FR.${ZONE}` } } })
      case '/sites':
        return json({ sites: HOSTS.map((cname, i) => ({ id: i + 1, cname, code: `demo${i + 1}`, parent: i ? 1 : null })) })
      case '/stats/total':
        return json({ total: 0, total_events: 3, total_utc: 0, stats })
      case '/stats/hits': {
        const total = stats.reduce((sum, d) => sum + d.daily, 0)
        const page = (path_id: number, name: string, share: number, event = false) => ({
          path_id,
          path: name,
          title: '',
          event,
          count: Math.round(total * share),
          max: 0,
          stats: [],
        })
        return json({
          hits: [page(1, '/', 0.5), page(2, '/pricing', 0.3), page(3, '/blog/hello', 0.2), page(4, 'signup-click', 0.05, true)],
          more: false,
        })
      }
      case '/stats/toprefs':
        return json({
          stats: [
            { id: '', name: '', count: 40, ref_scheme: 'o' },
            { id: 'Google', name: 'Google', count: 30, ref_scheme: 'g' },
            { id: 'www.reddit.com', name: 'www.reddit.com', count: 20, ref_scheme: 'h' },
            { id: 'blog.example.net', name: 'blog.example.net', count: 10, ref_scheme: 'h' },
            { id: 'internal', name: `${url.host.replace('stats.', '')}/pricing`, count: 50, ref_scheme: 'h' },
          ],
          more: false,
        })
      case '/stats/locations':
        return json({ stats: [{ id: 'FR', name: 'France', count: 60 }, { id: 'DE', name: 'Germany', count: 40 }], more: false })
      case '/stats/languages':
        return json({ stats: [], more: false })
      case '/stats/sizes':
        return json({
          stats: [
            { id: 'phone', name: '', count: 50 },
            { id: 'tablet', name: '', count: 10 },
            { id: 'desktop', name: '', count: 30 },
            { id: 'desktophd', name: '', count: 10 },
          ],
          more: false,
        })
      case '/stats/browsers':
        return json({ stats: [{ id: 'Firefox', name: 'Firefox', count: 70 }, { id: 'Chrome', name: 'Chrome', count: 30 }], more: false })
      case '/stats/systems':
        return json({ stats: [{ id: 'Linux', name: 'Linux', count: 100 }], more: false })
      case '/stats/campaigns':
        return json({ stats: [], more: false })
      default:
        return json({ error: 'unknown' }, 404)
    }
  }
  for (const host of HOSTS) await page.route(`https://${host}/**`, handler)
  return calls
}

export async function connect(page: Page) {
  await page.goto('/')
  await page.getByPlaceholder('stats.example.com').fill('stats.example.com')
  await page.locator('input[type=password]').fill(TOKEN)
  await page.getByRole('button', { name: 'Open the dashboard' }).click()
  await page.locator('#campaigns').waitFor()
  await page.waitForFunction(() => !document.querySelector('.section.busy'))
}
