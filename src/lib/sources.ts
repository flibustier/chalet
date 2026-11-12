import type { StatEntry } from '@/api/goatcounter'

export type Source = 'direct' | 'search' | 'social' | 'campaign' | 'website'

// GoatCounter gives each referrer a scheme: h (a web page), g (a name it generated, like
// "Google"), o (an app or other origin), c (a campaign). An empty name means no referrer.
const SEARCH = /google|bing|duckduckgo|yahoo|ecosia|qwant|yandex|baidu|startpage|brave|kagi|naver|seznam|search/i
const SOCIAL =
  /facebook|instagram|twitter|(^|\.)t\.co$|(^|\.)x\.com|reddit|linkedin|youtube|tiktok|pinterest|discord|telegram|whatsapp|mastodon|bsky|bluesky|threads|snapchat|hacker ?news|ycombinator|lemmy|tumblr|vk\.com|weibo/i

export function sourceOf(entry: Pick<StatEntry, 'name' | 'ref_scheme'>): Source {
  if (!entry.name) return 'direct'
  if (entry.ref_scheme === 'c') return 'campaign'
  if (SEARCH.test(entry.name)) return 'search'
  if (SOCIAL.test(entry.name)) return 'social'
  return 'website'
}

/** A referrer on the site itself: a visitor moving between its pages, not arriving. */
export function isInternal(entry: Pick<StatEntry, 'name'>, domain: string) {
  const host = entry.name.toLowerCase().replace(/^https?:\/\//, '').split('/')[0] ?? ''
  return host === domain || host === `www.${domain}`
}

export function sourceTotals(entries: StatEntry[], domain: string) {
  const totals: Record<Source, number> = { direct: 0, search: 0, social: 0, campaign: 0, website: 0 }
  for (const entry of entries) if (!isInternal(entry, domain)) totals[sourceOf(entry)] += entry.count
  return totals
}
