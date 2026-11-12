// A pretend GoatCounter for the demo. It answers the API calls Chalet makes with figures made up
// in the browser: three imaginary sites, with a daily and weekly rhythm, seasons, a slow rise,
// a new post taking off, and a different audience on each page. Nothing is sent anywhere.
//
// The figures are drawn from the hour itself (a hash of the site, the page and the hour), so
// they are the same on every reload, and a day's bar always adds up to its hours.

interface DemoPage {
  path: string
  /** Share of the site's visits, or for an event, how many per visit */
  weight: number
  event?: boolean
  /** Days ago the page went up: nothing before, then a burst that settles */
  launched?: number
  /** This page's own audience: a referrer, country… that it draws more than the site does */
  tilt?: Record<string, number>
}

type Entry = [id: string, name: string, share: number, scheme?: string]

interface DemoSite {
  id: number
  cname: string
  /** Visits on an ordinary day, these days */
  daily: number
  /** The hour of the day with the most visits, in the account's zone */
  peak: number
  /** Monday to Sunday */
  week: number[]
  season: (dayOfYear: number) => number
  pages: DemoPage[]
  toprefs: Entry[]
  locations: Entry[]
  languages: Entry[]
  sizes: Entry[]
  browsers: Entry[]
  systems: Entry[]
  campaigns: Entry[]
}

const SITES: DemoSite[] = [
  {
    id: 1,
    cname: 'alpine-trails.example',
    daily: 420,
    peak: 20,
    week: [0.9, 0.88, 0.92, 0.97, 1.05, 1.28, 1.25],
    // Hikers in summer, and the first snow brings a second wave
    season: (day) => 1 + 0.15 * Math.cos((2 * Math.PI * (day - 200)) / 365) + 0.2 * Math.exp(-(((day - 330) / 25) ** 2)),
    pages: [
      { path: '/', weight: 0.27 },
      { path: '/blog/goats-on-roofs', weight: 0.15, tilt: { 'news.ycombinator.com': 7, 'lobste.rs': 3, US: 2.5, desktop: 1.6 } },
      { path: '/trails', weight: 0.12 },
      { path: '/blog/first-snow', weight: 0.06, launched: 5, tilt: { 'mastodon.social': 5, CH: 2 } },
      { path: '/blog/winter-hikes', weight: 0.08, tilt: { Google: 1.8 } },
      { path: '/trails/mont-blanc-loop', weight: 0.08, tilt: { FR: 1.6, CH: 1.8, IT: 2.2, phone: 1.3 } },
      { path: '/gear', weight: 0.06, tilt: { Google: 2, 'www.reddit.com': 2 } },
      { path: '/about', weight: 0.04 },
      { path: '/newsletter', weight: 0.03, tilt: { Newsletter: 6 } },
      { path: '/maps/huts', weight: 0.025, tilt: { 'trail-forum.example.net': 5 } },
      { path: '/contact', weight: 0.015 },
      { path: 'newsletter-signup', weight: 0.02, event: true },
      { path: 'download-gpx', weight: 0.035, event: true },
    ],
    toprefs: [
      ['', '', 0.38],
      ['Google', 'Google', 0.2, 'g'],
      ['DuckDuckGo', 'DuckDuckGo', 0.06, 'g'],
      ['news.ycombinator.com', 'news.ycombinator.com', 0.06, 'h'],
      ['mastodon.social', 'mastodon.social', 0.05, 'h'],
      ['Newsletter', 'Newsletter', 0.05, 'g'],
      ['www.reddit.com', 'www.reddit.com', 0.04, 'h'],
      ['Bing', 'Bing', 0.03, 'g'],
      ['lobste.rs', 'lobste.rs', 0.025, 'h'],
      ['trail-forum.example.net', 'trail-forum.example.net', 0.03, 'h'],
      ['trail-club', 'trail-club', 0.02, 'c'],
    ],
    locations: [
      ['FR', 'France', 0.21], ['US', 'United States', 0.15], ['CH', 'Switzerland', 0.11], ['DE', 'Germany', 0.09],
      ['GB', 'United Kingdom', 0.07], ['IT', 'Italy', 0.06], ['CA', 'Canada', 0.05], ['ES', 'Spain', 0.04],
      ['NL', 'Netherlands', 0.03], ['AT', 'Austria', 0.03], ['BE', 'Belgium', 0.025], ['JP', 'Japan', 0.02],
      ['SE', 'Sweden', 0.015], ['NO', 'Norway', 0.015], ['AU', 'Australia', 0.012], ['BR', 'Brazil', 0.01],
      ['PL', 'Poland', 0.008], ['NZ', 'New Zealand', 0.007], ['IN', 'India', 0.006], ['AR', 'Argentina', 0.005],
      ['CL', 'Chile', 0.004], ['MX', 'Mexico', 0.004], ['ZA', 'South Africa', 0.003], ['KR', 'South Korea', 0.003],
    ],
    languages: [['eng', 'English', 0.46], ['fra', 'French', 0.27], ['deu', 'German', 0.13], ['ita', 'Italian', 0.06], ['spa', 'Spanish', 0.05]],
    sizes: [['phone', '', 0.49], ['tablet', '', 0.07], ['desktop', '', 0.37], ['desktophd', '', 0.07]],
    browsers: [['Firefox', 'Firefox', 0.34], ['Chrome', 'Chrome', 0.31], ['Safari', 'Safari', 0.27], ['Edge', 'Edge', 0.08]],
    systems: [['iOS', 'iOS', 0.28], ['Android', 'Android', 0.24], ['macOS', 'macOS', 0.2], ['Windows', 'Windows', 0.18], ['Linux', 'Linux', 0.1]],
    campaigns: [['trail-club', 'trail-club', 0.02]],
  },
  {
    id: 2,
    cname: 'cheese-cellar.example',
    daily: 130,
    peak: 13,
    week: [0.85, 0.9, 0.95, 1, 1.15, 1.3, 0.85],
    // Gift boxes before the holidays
    season: (day) => 1 + 0.6 * Math.exp(-(((day - 352) / 18) ** 2)) + 0.6 * Math.exp(-(((day + 13) / 18) ** 2)),
    pages: [
      { path: '/', weight: 0.3 },
      { path: '/cheeses', weight: 0.18 },
      { path: '/cheeses/tomme-de-chevre', weight: 0.1, tilt: { Google: 2 } },
      { path: '/cheeses/crottin', weight: 0.08 },
      { path: '/gift-boxes', weight: 0.12, tilt: { 'winter-boxes': 6, Email: 3 } },
      { path: '/cheeses/bleu-des-alpes', weight: 0.06 },
      { path: '/visit-the-farm', weight: 0.07, tilt: { 'instagram.com': 4, phone: 1.4 } },
      { path: '/cart', weight: 0.06 },
      { path: '/faq', weight: 0.03 },
      { path: 'add-to-cart', weight: 0.09, event: true },
      { path: 'checkout', weight: 0.025, event: true },
    ],
    toprefs: [
      ['', '', 0.34],
      ['Google', 'Google', 0.24, 'g'],
      ['instagram.com', 'instagram.com', 0.1, 'h'],
      ['www.facebook.com', 'www.facebook.com', 0.06, 'h'],
      ['Email', 'Email', 0.07, 'g'],
      ['Bing', 'Bing', 0.03, 'g'],
      ['Ecosia', 'Ecosia', 0.03, 'g'],
      ['cheese-lovers.example.org', 'cheese-lovers.example.org', 0.04, 'h'],
      ['winter-boxes', 'winter-boxes', 0.05, 'c'],
      ['cheese-club', 'cheese-club', 0.02, 'c'],
    ],
    locations: [
      ['FR', 'France', 0.58], ['CH', 'Switzerland', 0.14], ['BE', 'Belgium', 0.09], ['DE', 'Germany', 0.05],
      ['LU', 'Luxembourg', 0.03], ['GB', 'United Kingdom', 0.03], ['CA', 'Canada', 0.02], ['IT', 'Italy', 0.02],
      ['NL', 'Netherlands', 0.015], ['US', 'United States', 0.015],
    ],
    languages: [['fra', 'French', 0.78], ['eng', 'English', 0.1], ['deu', 'German', 0.07], ['nld', 'Dutch', 0.02]],
    sizes: [['phone', '', 0.62], ['tablet', '', 0.08], ['desktop', '', 0.25], ['desktophd', '', 0.05]],
    browsers: [['Safari', 'Safari', 0.41], ['Chrome', 'Chrome', 0.38], ['Firefox', 'Firefox', 0.12], ['Samsung Internet', 'Samsung Internet', 0.05], ['Edge', 'Edge', 0.04]],
    systems: [['iOS', 'iOS', 0.42], ['Android', 'Android', 0.27], ['Windows', 'Windows', 0.17], ['macOS', 'macOS', 0.13], ['Linux', 'Linux', 0.01]],
    campaigns: [['winter-boxes', 'winter-boxes', 0.05], ['cheese-club', 'cheese-club', 0.02]],
  },
  {
    id: 3,
    cname: 'field-notes.example',
    daily: 38,
    peak: 15,
    week: [1.15, 1.15, 1.1, 1.1, 1, 0.75, 0.75],
    season: () => 1,
    pages: [
      { path: '/', weight: 0.25 },
      { path: '/posts/self-hosting-goatcounter', weight: 0.24, tilt: { 'news.ycombinator.com': 4, 'lobste.rs': 3 } },
      { path: '/posts/a-calm-dashboard', weight: 0.18, launched: 9, tilt: { 'bsky.app': 4 } },
      { path: '/posts/vue-without-a-router', weight: 0.14, tilt: { Google: 2, Kagi: 2 } },
      { path: '/now', weight: 0.1 },
      { path: '/about', weight: 0.09 },
      { path: 'copy-code', weight: 0.05, event: true },
    ],
    toprefs: [
      ['', '', 0.3],
      ['Google', 'Google', 0.18, 'g'],
      ['news.ycombinator.com', 'news.ycombinator.com', 0.13, 'h'],
      ['lobste.rs', 'lobste.rs', 0.09, 'h'],
      ['bsky.app', 'bsky.app', 0.07, 'h'],
      ['DuckDuckGo', 'DuckDuckGo', 0.07, 'g'],
      ['Kagi', 'Kagi', 0.04, 'g'],
      ['github.com', 'github.com', 0.06, 'h'],
    ],
    locations: [
      ['US', 'United States', 0.31], ['DE', 'Germany', 0.12], ['GB', 'United Kingdom', 0.09], ['FR', 'France', 0.08],
      ['NL', 'Netherlands', 0.06], ['CA', 'Canada', 0.05], ['IN', 'India', 0.05], ['SE', 'Sweden', 0.03],
      ['PL', 'Poland', 0.03], ['BR', 'Brazil', 0.03], ['AU', 'Australia', 0.03], ['JP', 'Japan', 0.02],
      ['FI', 'Finland', 0.02], ['CH', 'Switzerland', 0.02],
    ],
    languages: [['eng', 'English', 0.81], ['deu', 'German', 0.08], ['fra', 'French', 0.05], ['nld', 'Dutch', 0.03]],
    sizes: [['phone', '', 0.24], ['tablet', '', 0.03], ['desktop', '', 0.48], ['desktophd', '', 0.25]],
    browsers: [['Firefox', 'Firefox', 0.43], ['Chrome', 'Chrome', 0.33], ['Safari', 'Safari', 0.17], ['Brave', 'Brave', 0.04], ['Edge', 'Edge', 0.03]],
    systems: [['Linux', 'Linux', 0.31], ['macOS', 'macOS', 0.3], ['Windows', 'Windows', 0.19], ['iOS', 'iOS', 0.12], ['Android', 'Android', 0.08]],
    campaigns: [],
  },
]

const HOUR = 3_600_000
const DAY = 86_400_000

/** A number in [0, 1) that depends only on its inputs */
function hash(...values: number[]) {
  let h = 0x811c9dc5
  for (const value of values) {
    h = Math.imul(h ^ (value | 0), 0x01000193)
    h ^= h >>> 13
  }
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h ^= h >>> 13
  return (h >>> 0) / 4_294_967_296
}

const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
const parts = new Intl.DateTimeFormat('en-US', {
  timeZone: zone,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
})

interface LocalHour {
  /** YYYY-MM-DD in the zone */
  day: string
  hour: number
  /** 0 for Monday */
  weekday: number
  dayOfYear: number
}

// The same hours come back from one call to the next: work each one out once
const local = new Map<number, LocalHour>()
function localHour(index: number): LocalHour {
  let found = local.get(index)
  if (!found) {
    const p = Object.fromEntries(parts.formatToParts(new Date(index * HOUR)).map((part) => [part.type, Number(part.value)]))
    const date = Date.UTC(p.year!, p.month! - 1, p.day!)
    found = {
      day: `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`,
      hour: p.hour!,
      weekday: (new Date(date).getUTCDay() + 6) % 7,
      dayOfYear: Math.floor((date - Date.UTC(p.year!, 0, 1)) / DAY),
    }
    local.set(index, found)
  }
  return found
}

/** How many visits the site would get in this hour, all pages together, before rounding */
function siteHour(site: DemoSite, index: number, now: number) {
  const start = index * HOUR
  if (start >= now) return 0
  const { hour, weekday, dayOfYear } = localHour(index)
  const dayIndex = Math.floor(start / DAY)
  // Quiet at night, busiest around the site's peak hour
  const rhythm = 0.12 + 0.88 * (0.5 + 0.5 * Math.cos((2 * Math.PI * (hour - site.peak)) / 24)) ** 1.6
  // About 40% more visitors than a year ago
  const rise = Math.exp((0.33 * (start - now)) / (365 * DAY))
  // Some days are just better, and once in a while a link takes off
  const luck = 0.82 + 0.36 * hash(site.id, dayIndex) + (hash(site.id, dayIndex, 7) < 0.025 ? 1.4 : 0)
  const wobble = 0.75 + 0.5 * hash(site.id, index)
  // Average of the rhythm over a day is about 0.42: scale so a usual day comes near `daily`
  const expected = (site.daily / 24 / 0.42) * rhythm * site.week[weekday]! * site.season(dayOfYear) * rise * luck * wobble
  // The hour that is going on has only counted so far
  return start + HOUR > now ? (expected * (now - start)) / HOUR : expected
}

function pageFactor(site: DemoSite, pageIndex: number, index: number, now: number) {
  const page = site.pages[pageIndex]!
  // Each page has its own course: some gain readers, some lose them, within limits
  const drift = (hash(site.id, pageIndex, 99) - 0.4) * 0.5
  const course = Math.exp(drift * Math.tanh((index * HOUR - now) / (90 * DAY)))
  if (page.launched === undefined) return course
  const age = (index * HOUR - (now - page.launched * DAY)) / DAY
  if (age < 0) return 0
  return course * (1 + 5 * Math.exp(-age / 2.5))
}

/** Visits of one page (or times an event fired) in one hour, as a whole number */
function count(site: DemoSite, pageIndex: number, index: number, now: number) {
  const page = site.pages[pageIndex]!
  const expected = siteHour(site, index, now) * page.weight * pageFactor(site, pageIndex, index, now)
  // Round up or down at random, so small pages still add up right over a day
  return Math.floor(expected + hash(site.id, pageIndex + 1, index))
}

interface Query {
  site: DemoSite
  first: number
  last: number
  /** Indexes of the pages asked for */
  pages: number[]
  now: number
}

function pageTotals({ site, first, last, pages, now }: Query) {
  return pages.map((pageIndex) => {
    let total = 0
    for (let index = first; index < last; index++) total += count(site, pageIndex, index, now)
    return total
  })
}

function days({ site, first, last, pages, now }: Query) {
  const out = new Map<string, number[]>()
  for (let index = first; index < last; index++) {
    const { day, hour } = localHour(index)
    let visits = 0
    for (const pageIndex of pages) visits += count(site, pageIndex, index, now)
    const hourly = out.get(day) ?? Array<number>(24).fill(0)
    hourly[hour]! += visits
    out.set(day, hourly)
  }
  return [...out].map(([day, hourly]) => ({ day, hourly, daily: hourly.reduce((a, b) => a + b, 0) }))
}

/**
 * A breakdown (referrers, countries…): each page brings its own mix, the totals add them up.
 * `whole`: the entries share all the visits between them; otherwise (campaigns) each share
 * is of all visits, and most visits have none.
 */
function breakdown(query: Query, entries: Entry[], whole: boolean) {
  const totals = pageTotals(query)
  const counts = entries.map(() => 0)
  query.pages.forEach((pageIndex, i) => {
    const page = query.site.pages[pageIndex]!
    const weights = entries.map(
      ([id, , share], e) => share * (0.7 + 0.6 * hash(query.site.id, pageIndex, e)) * (page.tilt?.[id] ?? 1),
    )
    const sum = whole ? weights.reduce((a, b) => a + b, 0) : 1
    weights.forEach((weight, e) => (counts[e]! += (totals[i]! * weight) / sum))
  })
  return entries
    .map(([id, name, , scheme], e) => ({ id, name, count: Math.round(counts[e]!), ...(scheme ? { ref_scheme: scheme } : {}) }))
    .sort((a, b) => b.count - a.count)
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** Answers one API call, like GoatCounter would. */
export function answer(url: URL, now = Date.now()): Response {
  const path = url.pathname.replace(/^\/api\/v0/, '')
  if (path === '/me') return json({ user: { email: 'demo@example.com', site: 1, settings: { timezone: `XX.${zone}` } } })
  if (path === '/sites') return json({ sites: SITES.map((s) => ({ id: s.id, cname: s.cname, code: s.cname.split('.')[0], parent: null })) })

  const site = SITES.find((s) => s.cname === url.host)
  if (!site) return json({ error: 'no such site' }, 404)
  const param = (name: string) => url.searchParams.get(name)
  const first = Math.floor(new Date(param('start') ?? now - 7 * DAY).getTime() / HOUR)
  const last = Math.ceil(new Date(param('end') ?? now).getTime() / HOUR)
  const only = param('include_paths')?.split(',').map((id) => Number(id) - 1)
  const all = site.pages.map((_, i) => i)
  const chosen = only ? all.filter((i) => only.includes(i)) : all
  const visits = chosen.filter((i) => !site.pages[i]!.event)
  const events = chosen.filter((i) => site.pages[i]!.event)
  const query = (pages: number[]): Query => ({ site, first, last, pages, now })
  const limit = Number(param('limit')) || 100

  if (path === '/stats/total') {
    const stats = days(query(visits.length || !only ? visits : events))
    const total = stats.reduce((sum, day) => sum + day.daily, 0)
    const totalEvents = pageTotals(query(events)).reduce((a, b) => a + b, 0)
    return json({ total, total_events: totalEvents, total_utc: total, stats })
  }
  if (path === '/stats/hits') {
    const totals = pageTotals(query(chosen))
    const hits = chosen
      .map((i, n) => ({ path_id: i + 1, path: site.pages[i]!.path, title: '', event: !!site.pages[i]!.event, count: totals[n]!, max: 0, stats: [] }))
      .sort((a, b) => b.count - a.count)
    return json({ hits: hits.slice(0, limit), more: hits.length > limit })
  }
  const page = path.replace('/stats/', '')
  const entries = { toprefs: site.toprefs, locations: site.locations, languages: site.languages, sizes: site.sizes, browsers: site.browsers, systems: site.systems, campaigns: site.campaigns }[page]
  if (!entries) return json({ error: 'not found' }, 404)
  // Referrers and campaigns come from visits to pages; an event only shows its own
  const stats = breakdown(query(visits.length || !only ? visits : events), entries, page !== 'campaigns')
  return json({ stats: stats.slice(0, limit), more: stats.length > limit })
}
