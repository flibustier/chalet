<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'

import { createClient, type Connection, type Site } from '@/api/goatcounter'
import { useDashboard, type SectionKey } from '@/lib/dashboard'
import { delta, formatNumber, formatPercent, siteName } from '@/lib/format'
import { PERIODS, periodFor, type PeriodId } from '@/lib/period'
import { applyTheme, loadTheme, type Theme } from '@/lib/storage'

import ChaletLogo from './ChaletLogo.vue'
import RankedList from './RankedList.vue'
import ShareCards from './ShareCards.vue'
import VisitsChart from './VisitsChart.vue'

// The map and its world outline load only when someone opens it
const CountryMap = defineAsyncComponent(() => import('./CountryMap.vue'))

const props = defineProps<{ connection: Connection }>()
const emit = defineEmits<{ disconnect: [] }>()

const client = createClient(props.connection.token)
const { state, load } = useDashboard(client)

const sites = ref<Site[]>([])
const timeZone = ref(Intl.DateTimeFormat().resolvedOptions().timeZone)
const fatal = ref('')

const params = new URLSearchParams(location.search)
const siteId = ref(Number(params.get('site')) || 0)
const periodId = ref<PeriodId>(PERIODS.some((p) => p.id === params.get('period')) ? (params.get('period') as PeriodId) : '7d')
const asTable = ref(false)
const countriesAsMap = ref(false)
// A page (GoatCounter path id) the whole dashboard is narrowed to, 0 for all pages
const pageId = ref(Number(params.get('page')) || 0)

const site = computed(() => sites.value.find((s) => s.id === siteId.value) ?? sites.value[0])
const period = computed(() => periodFor(periodId.value, timeZone.value))
const periodInfo = computed(() => PERIODS.find((p) => p.id === periodId.value)!)

async function start() {
  fatal.value = ''
  try {
    const me = await client.me(props.connection.url)
    // GoatCounter stores zones as "FR.Europe/Paris"
    const zone = me.user.settings?.timezone?.split('.').slice(1).join('.')
    if (zone) timeZone.value = zone
    sites.value = await client.sites(props.connection.url)
    if (!sites.value.some((s) => s.id === siteId.value)) siteId.value = sites.value[0]?.id ?? 0
  } catch (error) {
    fatal.value = error instanceof Error ? error.message : String(error)
  }
}

function refresh() {
  if (!site.value) return
  const query = new URLSearchParams({ site: String(site.value.id), period: periodId.value })
  if (pageId.value) query.set('page', String(pageId.value))
  history.replaceState(null, '', `?${query}`)
  document.title = `${siteName(site.value.name)} · Chalet`
  load(site.value, period.value, timeZone.value, pageId.value || undefined)
}

onMounted(start)
watch([site, periodId, pageId], refresh)

const pageLabel = computed(() => {
  const rows = [...(data.value?.pages ?? []), ...(data.value?.eventsList ?? [])]
  return rows.find((row) => row.key === String(pageId.value))?.label ?? `page #${pageId.value}`
})

function selectPage(key: string) {
  pageId.value = Number(key)
  document.getElementById('summary')?.scrollIntoView({ behavior: 'smooth' })
}

const data = computed(() => state.data)
const busy = (section: SectionKey) => state.loading.has(section)

const theme = ref<Theme>(loadTheme())
const THEMES: Theme[] = ['auto', 'light', 'dark']
const cycleTheme = () => {
  theme.value = THEMES[(THEMES.indexOf(theme.value) + 1) % THEMES.length]!
  applyTheme(theme.value)
}

const visitsDelta = computed(() => (data.value ? delta(data.value.visits, data.value.previousVisits) : null))
const average = computed(() => {
  const points = data.value?.series ?? []
  return points.length ? data.value!.visits / points.length : 0
})
const averageLabel = computed(() => (period.value.bucket === 'hour' ? 'Per hour' : period.value.bucket === 'day' ? 'Per day' : 'Per month'))

const sources = computed(() => {
  const s = data.value?.sources
  if (!s) return []
  return [
    { key: 'direct', label: 'Direct', value: s.direct },
    { key: 'search', label: 'Search', value: s.search },
    { key: 'social', label: 'Social', value: s.social },
    { key: 'website', label: 'Websites', value: s.website },
    ...(s.email ? [{ key: 'email', label: 'Email', value: s.email }] : []),
    ...(s.campaign ? [{ key: 'campaign', label: 'Campaigns', value: s.campaign }] : []),
  ]
})
const topSource = computed(() => [...sources.value].sort((a, b) => b.value - a.value)[0])

const devices = computed(() => {
  const d = data.value?.devices ?? { phone: 0, tablet: 0, desktop: 0 }
  return [
    { key: 'phone', label: 'Phone', value: d.phone, device: 'phone' as const },
    { key: 'tablet', label: 'Tablet', value: d.tablet, device: 'tablet' as const },
    { key: 'desktop', label: 'Desktop', value: d.desktop, device: 'desktop' as const },
  ]
})
const devicesTotal = computed(() => devices.value.reduce((sum, d) => sum + d.value, 0))
const topDevice = computed(() => [...devices.value].sort((a, b) => b.value - a.value)[0])

const SECTIONS = [
  { id: 'summary', label: 'Summary' },
  { id: 'pages', label: 'Pages' },
  { id: 'referrers', label: 'Referrers' },
  { id: 'sources', label: 'Sources' },
  { id: 'countries', label: 'Countries' },
  { id: 'languages', label: 'Languages' },
  { id: 'devices', label: 'Devices' },
  { id: 'browsers', label: 'Browsers' },
  { id: 'systems', label: 'Systems' },
  { id: 'events', label: 'Events' },
  { id: 'campaigns', label: 'Campaigns' },
]
</script>

<template>
  <div class="layout">
    <header class="top">
      <a class="brand" href="./">
        <ChaletLogo :size="26" />
        <span>Chalet</span>
      </a>
      <div class="controls">
        <label v-if="sites.length > 1" class="site-picker">
          <span class="visually-hidden">Site</span>
          <select v-model="siteId" class="input" @change="pageId = 0">
            <option v-for="s in sites" :key="s.id" :value="s.id">{{ siteName(s.name) }}</option>
          </select>
        </label>
        <button class="button ghost" type="button" :title="`Theme: ${theme}`" @click="cycleTheme">
          {{ theme === 'auto' ? '◐' : theme === 'light' ? '☀' : '☾' }}<span class="visually-hidden">Theme: {{ theme }}</span>
        </button>
        <button class="button ghost" type="button" @click="emit('disconnect')">Sign out</button>
      </div>
    </header>

    <div class="body">
      <nav class="side" aria-label="Sections">
        <a v-for="s in SECTIONS" :key="s.id" :href="`#${s.id}`">{{ s.label }}</a>
      </nav>

      <main class="main">
        <p v-if="fatal" class="banner" role="alert">
          {{ fatal }} <button class="button" type="button" @click="start">Try again</button>
        </p>

        <div v-if="site" class="title">
          <div>
            <h1>{{ siteName(site.name) }}</h1>
            <p class="muted">{{ periodInfo.label }}, compared with {{ periodInfo.previous }}</p>
          </div>
          <div class="periods" role="radiogroup" aria-label="Period">
            <button
              v-for="p in PERIODS"
              :key="p.id"
              type="button"
              role="radio"
              :aria-checked="p.id === periodId"
              :class="{ selected: p.id === periodId }"
              @click="periodId = p.id"
            >
              {{ p.label }}
            </button>
          </div>
        </div>

        <div v-if="pageId" class="filter">
          <span>Only <strong>{{ pageLabel }}</strong></span>
          <button class="button" type="button" @click="pageId = 0">Show all pages <span aria-hidden="true">✕</span></button>
        </div>

        <p v-if="state.error" class="banner" role="alert">
          {{ state.error }} <button class="button" type="button" @click="refresh">Try again</button>
        </p>

        <template v-if="data">
          <section id="summary" class="section" :class="{ busy: busy('summary') }">
            <div class="aside">
              <h2>Summary</h2>
              <p class="muted">GoatCounter counts visits: the first view of a page in a session.</p>
            </div>
            <div class="content">
              <div class="tiles">
                <div class="card tile">
                  <span class="muted">Visits</span>
                  <strong>{{ formatNumber(data.visits) }}</strong>
                  <span v-if="visitsDelta" class="delta" :class="visitsDelta.direction">
                    {{ visitsDelta.direction === 'up' ? '↑' : visitsDelta.direction === 'down' ? '↓' : '→' }}
                    {{ visitsDelta.text }} <span class="muted">vs {{ formatNumber(data.previousVisits) }}</span>
                  </span>
                </div>
                <div class="card tile">
                  <span class="muted">{{ averageLabel }}</span>
                  <strong>{{ formatNumber(Math.round(average)) }}</strong>
                  <span class="muted small">on average</span>
                </div>
                <div class="card tile">
                  <span class="muted">Events</span>
                  <strong>{{ formatNumber(data.events) }}</strong>
                  <span class="muted small">custom events</span>
                </div>
              </div>
              <div class="card chart-card">
                <div class="chart-head">
                  <span>Visits</span>
                  <span v-if="average > 0 && !asTable" class="key">
                    <svg width="20" height="6" aria-hidden="true"><line x1="1" x2="19" y1="3" y2="3" /></svg>
                    avg {{ formatNumber(Math.round(average)) }} per {{ period.bucket }}
                  </span>
                  <button class="link" type="button" :aria-pressed="asTable" @click="asTable = !asTable">
                    {{ asTable ? 'Chart' : 'Table' }}
                  </button>
                </div>
                <VisitsChart :points="data.series" :bucket="period.bucket" :as-table="asTable" />
              </div>
            </div>
          </section>

          <section id="pages" class="section" :class="{ busy: busy('pages') }">
            <div class="aside">
              <h2>Pages</h2>
              <p v-if="data.pages[0] && !pageId" class="muted"><strong>{{ data.pages[0].label }}</strong> is your top page.</p>
              <p v-if="!pageId" class="muted hint">Pick a page to see everything for it alone.</p>
            </div>
            <RankedList class="content" :rows="data.pages" heading="Page" show-trend selectable :limit="10" @select="selectPage($event.key)" />
          </section>

          <section id="referrers" class="section" :class="{ busy: busy('referrers') }">
            <div class="aside">
              <h2>Referrers</h2>
              <p v-if="data.referrers[0]" class="muted"><strong>{{ data.referrers[0].label }}</strong> sends you the most visitors.</p>
              <p v-else class="muted">Links on your own site are left out.</p>
            </div>
            <RankedList class="content" :rows="data.referrers" heading="Referrer" />
          </section>

          <section id="sources" class="section" :class="{ busy: busy('referrers') }">
            <div class="aside">
              <h2>Sources</h2>
              <p v-if="topSource?.value" class="muted">
                Most visitors come
                <strong>{{ topSource.key === 'direct' ? 'directly' : topSource.key === 'email' ? 'from emails' : `from ${topSource.label.toLowerCase()}` }}</strong>.
              </p>
            </div>
            <ShareCards class="content" :items="sources" />
          </section>

          <section id="countries" class="section" :class="{ busy: busy('countries') }">
            <div class="aside">
              <h2>Countries</h2>
              <p v-if="data.countries[0]" class="muted">{{ data.countries[0].icon }} <strong>{{ data.countries[0].label }}</strong> leads.</p>
              <div class="views" role="radiogroup" aria-label="Countries view">
                <button type="button" role="radio" :aria-checked="!countriesAsMap" :class="{ selected: !countriesAsMap }" @click="countriesAsMap = false">List</button>
                <button type="button" role="radio" :aria-checked="countriesAsMap" :class="{ selected: countriesAsMap }" @click="countriesAsMap = true">Map</button>
              </div>
            </div>
            <div v-if="countriesAsMap" class="content card map-card">
              <CountryMap :rows="data.countries" />
            </div>
            <RankedList v-else class="content" :rows="data.countries" heading="Country" />
          </section>

          <section id="languages" class="section" :class="{ busy: busy('languages') }">
            <div class="aside">
              <h2>Languages</h2>
              <p class="muted">From the browser's preferred language.</p>
            </div>
            <RankedList
              class="content"
              :rows="data.languages"
              heading="Language"
              empty="No languages: GoatCounter may not collect them for this site (Settings → Data collection)."
            />
          </section>

          <section id="devices" class="section" :class="{ busy: busy('devices') }">
            <div class="aside">
              <h2>Devices</h2>
              <p v-if="devicesTotal" class="muted"><strong>{{ formatPercent((topDevice?.value ?? 0) / devicesTotal) }}</strong> of visits are on {{ topDevice?.label.toLowerCase() }}s.</p>
            </div>
            <ShareCards class="content" :items="devices" />
          </section>

          <section id="browsers" class="section" :class="{ busy: busy('browsers') }">
            <div class="aside"><h2>Browsers</h2></div>
            <RankedList class="content" :rows="data.browsers" heading="Browser" />
          </section>

          <section id="systems" class="section" :class="{ busy: busy('systems') }">
            <div class="aside"><h2>Systems</h2></div>
            <RankedList class="content" :rows="data.systems" heading="System" />
          </section>

          <section id="events" class="section" :class="{ busy: busy('pages') }">
            <div class="aside">
              <h2>Events</h2>
              <p class="muted">Sent with <code>goatcounter.count({ event: true })</code>.</p>
            </div>
            <RankedList
              class="content"
              :rows="data.eventsList"
              heading="Event"
              show-trend
              selectable
              empty="No events for this period"
              @select="selectPage($event.key)"
            />
          </section>

          <section id="campaigns" class="section" :class="{ busy: busy('campaigns') }">
            <div class="aside">
              <h2>Campaigns</h2>
              <p class="muted">From <code>utm_campaign</code> or <code>ref</code> in the address.</p>
            </div>
            <RankedList class="content" :rows="data.campaigns" heading="Campaign" empty="No campaigns for this period" />
          </section>
        </template>
        <p v-else-if="!fatal && !state.error" class="loading muted">Loading…</p>
      </main>
    </div>
  </div>
</template>

<style scoped>
.layout {
  min-height: 100vh;
}

.top {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.6rem 1.25rem;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--hairline);
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--text);
  text-decoration: none;
  font-family: var(--font-serif);
  font-size: 1.25rem;
  font-weight: 600;
}

.controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.site-picker {
  min-width: 0;
}

.site-picker select {
  width: 100%;
  max-width: 14rem;
}

.ghost {
  background: transparent;
  border-color: transparent;
}

.body {
  display: grid;
  grid-template-columns: 11rem minmax(0, 1fr);
  max-width: 76rem;
  margin: 0 auto;
  padding: 0 1.25rem;
  gap: 2rem;
}

.side {
  position: sticky;
  top: 4.5rem;
  align-self: start;
  display: flex;
  flex-direction: column;
  padding-top: 2rem;
}

.side a {
  color: var(--text-secondary);
  text-decoration: none;
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  font-size: 0.9rem;
}

.side a:hover {
  background: var(--surface);
  color: var(--text);
}

.main {
  padding: 2rem 0 4rem;
  min-width: 0;
}

.title {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.title h1 {
  font-size: 2rem;
  overflow-wrap: anywhere;
}

.title p {
  margin: 0.2rem 0 0;
  font-size: 0.9rem;
}

.periods {
  display: inline-flex;
  flex-wrap: wrap;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 2px;
}

.periods button {
  border: none;
  background: transparent;
  padding: 0.3rem 0.7rem;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 0.85rem;
}

.periods button:hover {
  color: var(--text);
}

.periods button.selected {
  background: var(--surface-raised);
  color: var(--text);
  font-weight: 600;
  box-shadow: 0 0 0 1px var(--border);
}

.views {
  display: inline-flex;
  margin-top: 0.75rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 2px;
}

.views button {
  border: none;
  background: transparent;
  padding: 0.2rem 0.65rem;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 0.8rem;
}

.views button.selected {
  background: var(--surface-raised);
  color: var(--text);
  font-weight: 600;
  box-shadow: 0 0 0 1px var(--border);
}

.map-card {
  padding: 1rem 1.25rem;
}

.section {
  display: grid;
  grid-template-columns: 13rem minmax(0, 1fr);
  gap: 2rem;
  padding: 2.25rem 0;
  border-top: 1px solid var(--hairline);
  scroll-margin-top: 4rem;
  transition: opacity 0.2s;
}

.section.busy {
  opacity: 0.55;
}

.aside h2 {
  font-size: 1.35rem;
  padding-bottom: 0.4rem;
  margin-bottom: 0.6rem;
  border-bottom: 2px solid var(--accent);
  display: inline-block;
}

.aside p {
  margin: 0;
  font-size: 0.875rem;
  overflow-wrap: anywhere;
}

.content {
  min-width: 0;
}

.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.tile {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  font-size: 0.85rem;
}

.tile strong {
  font-size: 2rem;
  font-weight: 600;
  line-height: 1.15;
  color: var(--text);
}

.small {
  font-size: 0.8rem;
}

.delta {
  font-size: 0.8rem;
}

.delta.up {
  color: var(--up);
}

.delta.down {
  color: var(--down);
}

.chart-card {
  padding: 1rem 1.25rem;
}

.chart-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  font-weight: 600;
  font-size: 0.9rem;
}

.key {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.75rem;
  font-weight: 400;
  color: var(--text-secondary);
}

.key line {
  stroke: var(--text-secondary);
  stroke-width: 1.5;
  stroke-dasharray: 2 4;
  stroke-linecap: round;
}

.link {
  margin-left: 1rem;
  background: none;
  border: none;
  color: var(--accent-ink);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 0;
}

.filter {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  padding: 0.6rem 0.6rem 0.6rem 1rem;
  border-radius: var(--radius);
  background: var(--accent-wash);
  overflow-wrap: anywhere;
}

.hint {
  margin-top: 0.5rem !important;
}

.banner {
  background: var(--surface-raised);
  border: 1px solid var(--down);
  border-radius: var(--radius);
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.loading {
  padding: 3rem 0;
}

code {
  font-size: 0.8em;
  background: var(--surface);
  border: 1px solid var(--hairline);
  border-radius: 4px;
  padding: 0 0.25em;
}

@media (max-width: 900px) {
  .body {
    grid-template-columns: minmax(0, 1fr);
    padding: 0 16px;
  }

  .side {
    display: none;
  }

  .section {
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
  }
}

@media (max-width: 520px) {
  .top {
    padding: 0.5rem 16px;
  }

  .brand span {
    display: none;
  }

  .controls {
    gap: 0.25rem;
  }

  .ghost {
    padding-inline: 0.5rem;
  }
}
</style>
