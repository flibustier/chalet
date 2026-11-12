<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef } from 'vue'
import { geoEqualEarth, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { GeometryCollection, Topology } from 'topojson-specification'

import { NUMERIC } from '@/lib/countries'
import type { Row } from '@/lib/dashboard'
import { flag, formatNumber } from '@/lib/format'

const props = defineProps<{ rows: Row[] }>()

type Country = Feature<Geometry, { name: string }>

const box = useTemplateRef('box')
const width = ref(640)
const countries = shallowRef<Country[]>([])
const active = ref<{ name: string; code: string; count: number; x: number; y: number } | null>(null)

let observer: ResizeObserver | undefined
onMounted(async () => {
  // Resizing in the next frame: changing the drawing inside the callback would loop
  observer = new ResizeObserver(([entry]) => {
    if (entry) requestAnimationFrame(() => (width.value = Math.max(240, entry.contentRect.width)))
  })
  if (box.value) observer.observe(box.value)
  // The map (Natural Earth, public domain) only loads when someone opens this view
  const topology = (await import('world-atlas/countries-110m.json')).default as unknown as Topology<{
    countries: GeometryCollection<{ name: string }>
  }>
  const all = (feature(topology, topology.objects.countries) as FeatureCollection<Geometry, { name: string }>).features
  countries.value = all.filter((country) => country.properties.name !== 'Antarctica')
})
onBeforeUnmount(() => observer?.disconnect())

// The map takes the full width; its height follows the drawing, so no empty band is left
const layout = computed(() => {
  const collection: FeatureCollection<Geometry, { name: string }> = { type: 'FeatureCollection', features: countries.value }
  if (countries.value.length === 0) return { path: geoPath(), height: Math.round(width.value * 0.45) }
  const path = geoPath(geoEqualEarth().fitWidth(width.value, collection))
  return { path, height: Math.ceil(path.bounds(collection)[1][1]) }
})
const path = computed(() => layout.value.path)
const height = computed(() => layout.value.height)

// Visits by map id. Kosovo has no numeric code, so the map knows it by name only.
const visits = computed(() => {
  const out = new Map<string, { code: string; name: string; count: number }>()
  for (const row of props.rows) {
    const id = row.key === 'XK' ? 'Kosovo' : NUMERIC.get(row.key)
    if (id) out.set(id, { code: row.key, name: row.label, count: row.count })
  }
  return out
})

const max = computed(() => Math.max(1, ...props.rows.map((row) => row.count)))

// Five steps on a log scale: a few big countries don't wash out all the others
const STEPS = 5
const step = (count: number) => Math.min(STEPS, 1 + Math.floor((Math.log1p(count) / Math.log1p(max.value)) * (STEPS - 0.001)))
const thresholds = computed(() =>
  Array.from({ length: STEPS }, (_, i) => Math.max(1, Math.ceil(Math.expm1((i / STEPS) * Math.log1p(max.value))))),
)

const shapes = computed(() =>
  countries.value.map((country) => {
    const key = country.id === undefined ? country.properties.name : String(country.id)
    const data = visits.value.get(key)
    return { key: `${key}-${country.properties.name}`, d: path.value(country) ?? '', data, name: country.properties.name, level: data ? step(data.count) : 0 }
  }),
)

function hover(event: PointerEvent, shape: (typeof shapes.value)[number]) {
  if (!box.value) return
  const rect = box.value.getBoundingClientRect()
  active.value = {
    name: shape.data?.name ?? shape.name,
    code: shape.data?.code ?? '',
    count: shape.data?.count ?? 0,
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  }
}
</script>

<template>
  <div ref="box" class="map">
    <svg :width="width" :height="height" :viewBox="`0 0 ${width} ${height}`" role="img" aria-label="Map of visits by country. The list view has the same figures.">
      <path
        v-for="shape in shapes"
        :key="shape.key"
        :d="shape.d"
        :class="['country', `level-${shape.level}`]"
        @pointermove="hover($event, shape)"
        @pointerleave="active = null"
      />
    </svg>
    <div v-if="active" class="tooltip" :style="{ left: `${active.x}px`, top: `${active.y}px` }">
      <strong>{{ formatNumber(active.count) }}</strong>
      <span>{{ flag(active.code) }} {{ active.name }}</span>
    </div>
    <div class="legend" aria-hidden="true">
      <span class="muted">Fewer</span>
      <span v-for="(threshold, i) in thresholds" :key="i" :class="['swatch', `level-${i + 1}`]" :title="`${formatNumber(threshold)}+ visits`"></span>
      <span class="muted">More</span>
    </div>
  </div>
</template>

<style scoped>
.map {
  position: relative;
  --map-0: #ebe8e1;
  --map-1: #86c0a9;
  --map-2: #68a28c;
  --map-3: #4b8570;
  --map-4: #2e6a55;
  --map-5: #0b4f3b;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) .map {
    --map-0: #2e2f2c;
    --map-1: #3f7262;
    --map-2: #568c7a;
    --map-3: #6ea792;
    --map-4: #86c3ac;
    --map-5: #9fe0c6;
  }
}

:root[data-theme='dark'] .map {
  --map-0: #2e2f2c;
  --map-1: #3f7262;
  --map-2: #568c7a;
  --map-3: #6ea792;
  --map-4: #86c3ac;
  --map-5: #9fe0c6;
}

svg {
  display: block;
}

.country {
  stroke: var(--surface-raised);
  stroke-width: 0.6;
}

.country:hover {
  stroke: var(--text);
  stroke-width: 1;
}

.level-0 {
  fill: var(--map-0);
}
.level-1 {
  fill: var(--map-1);
  background: var(--map-1);
}
.level-2 {
  fill: var(--map-2);
  background: var(--map-2);
}
.level-3 {
  fill: var(--map-3);
  background: var(--map-3);
}
.level-4 {
  fill: var(--map-4);
  background: var(--map-4);
}
.level-5 {
  fill: var(--map-5);
  background: var(--map-5);
}

.legend {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 0.5rem;
  font-size: 0.75rem;
}

.legend .muted {
  margin: 0 0.25rem;
}

.swatch {
  width: 18px;
  height: 8px;
  border-radius: 2px;
}

.tooltip {
  position: absolute;
  transform: translate(-50%, calc(-100% - 12px));
  pointer-events: none;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.35rem 0.6rem;
  box-shadow: 0 4px 16px rgb(0 0 0 / 0.08);
  display: flex;
  flex-direction: column;
  white-space: nowrap;
  font-size: 0.8rem;
}

.tooltip strong {
  font-size: 1rem;
}

.tooltip span {
  color: var(--text-secondary);
}
</style>
