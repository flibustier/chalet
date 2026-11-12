<script setup lang="ts">
import { computed, ref } from 'vue'

import type { Row } from '@/lib/dashboard'
import { delta, formatNumber, formatPercent } from '@/lib/format'

const props = withDefaults(
  defineProps<{ rows: Row[]; heading: string; showTrend?: boolean; empty?: string; limit?: number }>(),
  { showTrend: false, empty: 'Nothing for this period', limit: 8 },
)

const query = ref('')
const expanded = ref(false)

const total = computed(() => props.rows.reduce((sum, row) => sum + row.count, 0))
const max = computed(() => Math.max(1, ...props.rows.map((row) => row.count)))

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return q ? props.rows.filter((row) => row.label.toLowerCase().includes(q)) : props.rows
})
const shown = computed(() => (expanded.value ? filtered.value : filtered.value.slice(0, props.limit)))
</script>

<template>
  <div class="card list">
    <div v-if="rows.length > limit" class="tools">
      <input v-model="query" class="input search" type="search" :placeholder="`Search ${heading.toLowerCase()}`" :aria-label="`Search ${heading.toLowerCase()}`" />
    </div>
    <div class="head">
      <span>{{ heading }}</span>
      <span>Visits</span>
    </div>
    <p v-if="rows.length === 0" class="empty muted">{{ empty }}</p>
    <p v-else-if="filtered.length === 0" class="empty muted">No match</p>
    <ul v-else>
      <li v-for="row in shown" :key="row.key">
        <div class="line">
          <span class="label" :title="row.label">
            <span v-if="row.icon" class="icon" aria-hidden="true">{{ row.icon }}</span>{{ row.label }}
          </span>
          <span class="value">
            <template v-if="showTrend">
              <span
                v-for="change in [delta(row.count, row.previous ?? 0)]"
                :key="row.key"
                class="trend"
                :class="change?.direction ?? 'new'"
                :title="change ? `${change.text} compared with the previous period` : 'Not seen in the previous period'"
              >
                <template v-if="change">{{ change.direction === 'up' ? '↑' : change.direction === 'down' ? '↓' : '→' }} {{ change.text }}</template>
                <template v-else>new</template>
              </span>
            </template>
            <strong>{{ formatNumber(row.count) }}</strong>
            <span class="share muted">{{ formatPercent(row.count / total) }}</span>
          </span>
        </div>
        <div class="track" aria-hidden="true">
          <div class="fill" :style="{ width: `${(row.count / max) * 100}%` }"></div>
        </div>
      </li>
    </ul>
    <button v-if="filtered.length > limit" class="more" type="button" @click="expanded = !expanded">
      {{ expanded ? 'Show less' : `Show all ${filtered.length}` }}
    </button>
  </div>
</template>

<style scoped>
.list {
  padding: 1rem 1.25rem;
}

.tools {
  margin-bottom: 0.75rem;
}

.search {
  width: min(100%, 16rem);
  font-size: 0.875rem;
}

.head {
  display: flex;
  justify-content: space-between;
  font-size: 0.7rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
  padding-bottom: 0.4rem;
  border-bottom: 1px solid var(--hairline);
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

li {
  padding: 0.55rem 0;
  border-bottom: 1px solid var(--hairline);
}

li:last-child {
  border-bottom: none;
}

.line {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
}

.label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.9rem;
}

.icon {
  margin-right: 0.45rem;
}

.value {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.share {
  font-size: 0.8rem;
  min-width: 2.5rem;
  text-align: right;
}

.trend {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.trend.up {
  color: var(--up);
}

.trend.down {
  color: var(--down);
}

.track {
  margin-top: 0.35rem;
  height: 4px;
  border-radius: 2px;
  background: var(--accent-wash);
  overflow: hidden;
}

.fill {
  height: 100%;
  border-radius: 2px;
  background: var(--accent);
}

.empty {
  margin: 1rem 0 0.25rem;
  font-size: 0.9rem;
}

.more {
  margin-top: 0.5rem;
  background: none;
  border: none;
  padding: 0.25rem 0;
  color: var(--accent-ink);
  cursor: pointer;
  font-size: 0.85rem;
}
</style>
