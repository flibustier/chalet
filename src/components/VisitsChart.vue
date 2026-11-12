<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'

import type { Point } from '@/lib/dashboard'
import { bucketLabel, formatNumber } from '@/lib/format'
import type { Bucket } from '@/lib/period'

const props = defineProps<{ points: Point[]; bucket: Bucket; asTable: boolean }>()

const HEIGHT = 220
const AXIS = 28 // room for the x labels
const LEFT = 36 // room for the y ticks
const BAR_MAX = 24
const GAP = 2

const box = useTemplateRef('box')
const width = ref(640)
const active = ref<number | null>(null)

let observer: ResizeObserver | undefined
onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    if (entry) width.value = Math.max(240, entry.contentRect.width)
  })
  if (box.value) observer.observe(box.value)
})
onBeforeUnmount(() => observer?.disconnect())

// Clean ticks: 0 and up to 3 steps of 1, 2 or 5 × 10^n
const ticks = computed(() => {
  const max = Math.max(1, ...props.points.map((point) => point.value))
  const rough = max / 3
  const power = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 5, 10].map((m) => m * power).find((s) => s >= rough) ?? power * 10
  const top = Math.max(step, Math.ceil(max / step) * step)
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
})

const top = computed(() => ticks.value[ticks.value.length - 1] ?? 1)
const plotWidth = computed(() => width.value - LEFT)
const plotHeight = HEIGHT - AXIS
const band = computed(() => plotWidth.value / Math.max(1, props.points.length))
const barWidth = computed(() => Math.max(1, Math.min(BAR_MAX, band.value - GAP)))

const y = (value: number) => plotHeight - (value / top.value) * plotHeight

// A column with a 4px rounded top and a square foot on the baseline
function barPath(index: number, value: number) {
  const w = barWidth.value
  const x = LEFT + index * band.value + (band.value - w) / 2
  const h = plotHeight - y(value)
  if (h <= 0) return ''
  const r = Math.min(4, w / 2, h)
  const t = plotHeight - h
  return `M${x},${plotHeight}V${t + r}Q${x},${t} ${x + r},${t}H${x + w - r}Q${x + w},${t} ${x + w},${t + r}V${plotHeight}Z`
}

// A few labels along the axis, never crowded
const labelEvery = computed(() => {
  const fits = Math.max(1, Math.floor(plotWidth.value / (props.bucket === 'day' ? 64 : 48)))
  return Math.max(1, Math.ceil(props.points.length / fits))
})

const label = (point: Point, short = false) => bucketLabel(point.key, props.bucket, short)

const tooltip = computed(() => {
  if (active.value === null) return null
  const point = props.points[active.value]
  if (!point) return null
  const center = LEFT + active.value * band.value + band.value / 2
  return { point, left: Math.min(Math.max(center, 70), width.value - 70), top: Math.max(0, y(point.value) - 8) }
})

function onKey(event: KeyboardEvent) {
  const last = props.points.length - 1
  if (last < 0) return
  if (event.key === 'ArrowRight') active.value = Math.min(last, (active.value ?? -1) + 1)
  else if (event.key === 'ArrowLeft') active.value = Math.max(0, (active.value ?? last + 1) - 1)
  else if (event.key === 'Home') active.value = 0
  else if (event.key === 'End') active.value = last
  else return
  event.preventDefault()
}
</script>

<template>
  <div ref="box" class="chart">
    <table v-if="asTable" class="table">
      <thead>
        <tr><th scope="col">{{ bucket === 'hour' ? 'Hour' : bucket === 'day' ? 'Day' : 'Month' }}</th><th scope="col">Visits</th></tr>
      </thead>
      <tbody>
        <tr v-for="point in points" :key="point.key">
          <td>{{ label(point) }}</td>
          <td>{{ formatNumber(point.value) }}</td>
        </tr>
      </tbody>
    </table>
    <template v-else>
      <svg
        :width="width"
        :height="HEIGHT"
        :viewBox="`0 0 ${width} ${HEIGHT}`"
        role="group"
        aria-label="Visits over the period. Use the arrow keys to read each bar."
        tabindex="0"
        @keydown="onKey"
        @blur="active = null"
        @pointerleave="active = null"
      >
        <g class="grid">
          <g v-for="tick in ticks" :key="tick">
            <line :x1="LEFT" :x2="width" :y1="y(tick)" :y2="y(tick)" />
            <text :x="LEFT - 8" :y="y(tick)" dy="0.32em" text-anchor="end">{{ formatNumber(tick) }}</text>
          </g>
        </g>
        <g>
          <path
            v-for="(point, index) in points"
            :key="point.key"
            :d="barPath(index, point.value)"
            class="bar"
            :class="{ active: index === active }"
          />
        </g>
        <g class="axis">
          <template v-for="(point, index) in points" :key="point.key">
            <text
              v-if="index % labelEvery === 0"
              :x="LEFT + index * band + band / 2"
              :y="HEIGHT - 8"
              text-anchor="middle"
            >
              {{ label(point, true) }}
            </text>
          </template>
        </g>
        <!-- Hit targets: the whole column, wider than the bar -->
        <rect
          v-for="(point, index) in points"
          :key="`hit-${point.key}`"
          :x="LEFT + index * band"
          :y="0"
          :width="band"
          :height="plotHeight"
          fill="transparent"
          @pointerenter="active = index"
        />
      </svg>
      <div v-if="tooltip" class="tooltip" :style="{ left: `${tooltip.left}px`, top: `${tooltip.top}px` }" aria-live="polite">
        <strong>{{ formatNumber(tooltip.point.value) }}</strong>
        <span>{{ tooltip.point.value === 1 ? 'visit' : 'visits' }} · {{ label(tooltip.point) }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.chart {
  position: relative;
  width: 100%;
  min-width: 0;
}

svg {
  display: block;
  overflow: visible;
}

.grid line {
  stroke: var(--hairline);
  stroke-width: 1;
}

.grid text,
.axis text {
  fill: var(--text-muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.bar {
  fill: var(--accent);
  transition: fill 0.1s;
}

.bar.active {
  fill: var(--accent-ink);
}

.tooltip {
  position: absolute;
  transform: translate(-50%, -100%);
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

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.table th,
.table td {
  text-align: left;
  padding: 0.35rem 0.25rem;
  border-bottom: 1px solid var(--hairline);
}

.table td:last-child,
.table th:last-child {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
