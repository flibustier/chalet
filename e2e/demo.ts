import type { Page, Route } from '@playwright/test'

// Made-up figures for the README screenshots: a small hiking blog, with a weekly rhythm and a
// slow rise, visitors from many countries. Nothing here comes from a real site.
export const DEMO_TOKEN = 'demo-token-0123456789'
const HOST = 'stats.example.com'
const ZONE = 'Europe/Paris'

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'Authorization, Content-Type',
  'access-control-allow-methods': 'GET, OPTIONS',
}

const localDay = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: ZONE }).format(date)
const localHour = (date: Date) =>
  Number(new Intl.DateTimeFormat('en-GB', { timeZone: ZONE, hour: 'numeric', hourCycle: 'h23' }).format(date))

// A deterministic wobble, so screenshots don't change from one run to the next
const noise = (n: number) => (Math.sin(n * 12.9898) * 43758.5453) % 1

function visitsAt(date: Date) {
  const hour = localHour(date)
  const day = Math.floor(date.getTime() / 86400000)
  const daily = 380 + 60 * Math.sin((day / 7) * 2 * Math.PI) + (day % 400) * 0.6 + 70 * Math.abs(noise(day))
  const shape = Math.max(0.15, Math.sin(((hour - 6) / 24) * Math.PI * 2) * 0.9 + 1)
  return Math.round((daily / 24) * shape)
}

function days(start: Date, end: Date, share = 1) {
  const out = new Map<string, number[]>()
  for (let t = start.getTime(); t < end.getTime(); t += 3600000) {
    const date = new Date(t)
    const day = localDay(date)
    const hourly = out.get(day) ?? Array<number>(24).fill(0)
    hourly[localHour(date)]! += Math.round(visitsAt(date) * share)
    out.set(day, hourly)
  }
  return [...out].map(([day, hourly]) => ({ day, hourly, daily: hourly.reduce((a, b) => a + b, 0) }))
}

const PAGES: [string, number][] = [
  ['/', 0.31],
  ['/blog/goats-on-roofs', 0.17],
  ['/trails', 0.12],
  ['/blog/winter-hikes', 0.09],
  ['/trails/mont-blanc-loop', 0.07],
  ['/gear', 0.05],
  ['/about', 0.04],
  ['/newsletter', 0.03],
  ['/blog/first-snow', 0.025],
  ['/contact', 0.015],
]

const list = (entries: [string, string, number][], total: number) =>
  entries.map(([id, name, share]) => ({ id, name, count: Math.round(total * share) }))

export async function mockDemo(page: Page) {
  const handler = async (route: Route) => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    const url = new URL(request.url())
    const path = url.pathname.replace('/api/v0', '')
    const json = (body: unknown) => route.fulfill({ status: 200, headers: cors, json: body })
    const start = new Date(url.searchParams.get('start') ?? Date.now() - 7 * 86400000)
    const end = new Date(url.searchParams.get('end') ?? Date.now())
    // Last year was quieter, so the comparison shows some growth
    const before = end.getTime() < Date.now() - 86400000
    const stats = days(start, end, before ? 0.86 : 1)
    const total = stats.reduce((sum, day) => sum + day.daily, 0)

    switch (path) {
      case '/me':
        return json({ user: { email: 'demo@example.com', site: 1, settings: { timezone: `FR.${ZONE}` } } })
      case '/sites':
        return json({ sites: [{ id: 1, cname: HOST, code: 'demo', parent: null }] })
      case '/stats/total':
        return json({ total, total_events: Math.round(total * 0.04), total_utc: total, stats })
      case '/stats/hits':
        return json({
          hits: [
            ...PAGES.map(([name, share], i) => ({
              path_id: i + 1,
              path: name,
              title: '',
              event: false,
              count: Math.round(total * share * (before ? 1 : 1 + 0.25 * noise(i + 3))),
              max: 0,
              stats: [],
            })),
            { path_id: 50, path: 'newsletter-signup', title: '', event: true, count: Math.round(total * 0.025), max: 0, stats: [] },
            { path_id: 51, path: 'download-gpx', title: '', event: true, count: Math.round(total * 0.015), max: 0, stats: [] },
          ],
          more: false,
        })
      case '/stats/toprefs':
        return json({
          stats: [
            { id: '', name: '', count: Math.round(total * 0.41), ref_scheme: 'o' },
            { id: 'Google', name: 'Google', count: Math.round(total * 0.22), ref_scheme: 'g' },
            { id: 'DuckDuckGo', name: 'DuckDuckGo', count: Math.round(total * 0.07), ref_scheme: 'g' },
            { id: 'news.ycombinator.com', name: 'news.ycombinator.com', count: Math.round(total * 0.08), ref_scheme: 'h' },
            { id: 'mastodon.social', name: 'mastodon.social', count: Math.round(total * 0.05), ref_scheme: 'h' },
            { id: 'Email', name: 'Email', count: Math.round(total * 0.05), ref_scheme: 'g' },
            { id: 'www.reddit.com', name: 'www.reddit.com', count: Math.round(total * 0.04), ref_scheme: 'h' },
            { id: 'lobste.rs', name: 'lobste.rs', count: Math.round(total * 0.03), ref_scheme: 'h' },
            { id: 'trail-forum.example.net', name: 'trail-forum.example.net', count: Math.round(total * 0.03), ref_scheme: 'h' },
            { id: 'spring-hikes', name: 'spring-hikes', count: Math.round(total * 0.02), ref_scheme: 'c' },
          ],
          more: false,
        })
      case '/stats/locations':
        return json({
          stats: list(
            [
              ['FR', 'France', 0.21], ['US', 'United States', 0.17], ['CH', 'Switzerland', 0.11], ['DE', 'Germany', 0.09],
              ['GB', 'United Kingdom', 0.07], ['IT', 'Italy', 0.06], ['CA', 'Canada', 0.05], ['ES', 'Spain', 0.04],
              ['NL', 'Netherlands', 0.03], ['AT', 'Austria', 0.03], ['BE', 'Belgium', 0.025], ['JP', 'Japan', 0.02],
              ['SE', 'Sweden', 0.015], ['NO', 'Norway', 0.015], ['AU', 'Australia', 0.012], ['BR', 'Brazil', 0.01],
              ['PL', 'Poland', 0.008], ['NZ', 'New Zealand', 0.007], ['IN', 'India', 0.006], ['AR', 'Argentina', 0.005],
              ['CL', 'Chile', 0.004], ['MX', 'Mexico', 0.004], ['ZA', 'South Africa', 0.003], ['KR', 'South Korea', 0.003],
            ],
            total,
          ),
          more: false,
        })
      case '/stats/languages':
        return json({
          stats: list(
            [['eng', 'English', 0.46], ['fra', 'French', 0.27], ['deu', 'German', 0.13], ['ita', 'Italian', 0.06], ['spa', 'Spanish', 0.05]],
            total,
          ),
          more: false,
        })
      case '/stats/sizes':
        return json({
          stats: list([['phone', '', 0.49], ['tablet', '', 0.07], ['desktop', '', 0.37], ['desktophd', '', 0.07]], total),
          more: false,
        })
      case '/stats/browsers':
        return json({
          stats: list([['Firefox', 'Firefox', 0.34], ['Chrome', 'Chrome', 0.31], ['Safari', 'Safari', 0.27], ['Edge', 'Edge', 0.08]], total),
          more: false,
        })
      case '/stats/systems':
        return json({
          stats: list(
            [['iOS', 'iOS', 0.28], ['Android', 'Android', 0.24], ['macOS', 'macOS', 0.2], ['Windows', 'Windows', 0.18], ['Linux', 'Linux', 0.1]],
            total,
          ),
          more: false,
        })
      case '/stats/campaigns':
        return json({ stats: list([['spring-hikes', 'spring-hikes', 0.02]], total), more: false })
      default:
        return route.fulfill({ status: 404, headers: cors, json: {} })
    }
  }
  await page.route(`https://${HOST}/**`, handler)
}

export async function connectDemo(page: Page) {
  await page.goto('/')
  await page.getByPlaceholder('stats.example.com').fill(HOST)
  await page.locator('input[type=password]').fill(DEMO_TOKEN)
  await page.getByRole('button', { name: 'Open the dashboard' }).click()
  await page.locator('#campaigns').waitFor()
  await page.waitForFunction(() => !document.querySelector('.section.busy'))
}
