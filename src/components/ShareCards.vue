<script setup lang="ts">
import { computed } from 'vue'

import { formatNumber, formatPercent } from '@/lib/format'

export interface Share {
  key: string
  label: string
  value: number
  /** A device outline: its screen fills with the share */
  device?: 'phone' | 'tablet' | 'desktop'
}

const props = defineProps<{ items: Share[] }>()

const total = computed(() => props.items.reduce((sum, item) => sum + item.value, 0))
const share = (item: Share) => (total.value ? item.value / total.value : 0)

// Outline sizes of each device drawing, in a 64×52 box
const DEVICES = {
  phone: { x: 22, y: 4, w: 20, h: 40, r: 4 },
  tablet: { x: 12, y: 6, w: 40, h: 34, r: 4 },
  desktop: { x: 4, y: 4, w: 56, h: 36, r: 3 },
}
</script>

<template>
  <div class="shares">
    <div v-for="item in items" :key="item.key" class="card share">
      <svg v-if="item.device" class="device" viewBox="0 0 64 52" aria-hidden="true">
        <template v-for="d in [DEVICES[item.device]]" :key="item.key">
          <clipPath :id="`screen-${item.key}`">
            <rect :x="d.x" :y="d.y" :width="d.w" :height="d.h" :rx="d.r" />
          </clipPath>
          <rect
            :x="d.x"
            :y="d.y + d.h * (1 - share(item))"
            :width="d.w"
            :height="d.h * share(item)"
            class="level"
            :clip-path="`url(#screen-${item.key})`"
          />
          <rect :x="d.x" :y="d.y" :width="d.w" :height="d.h" :rx="d.r" class="outline" />
          <line v-if="item.device === 'desktop'" x1="26" x2="38" y1="48" y2="48" class="outline" />
        </template>
      </svg>
      <span class="label muted">{{ item.label }}</span>
      <strong class="percent">{{ formatPercent(share(item)) }}</strong>
      <span class="count muted">{{ formatNumber(item.value) }} {{ item.value === 1 ? 'visit' : 'visits' }}</span>
    </div>
  </div>
</template>

<style scoped>
.shares {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
  gap: 0.75rem;
}

.share {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.device {
  width: 4rem;
  height: 3.25rem;
  margin-bottom: 0.5rem;
}

.outline {
  fill: none;
  stroke: var(--text-secondary);
  stroke-width: 2;
  stroke-linecap: round;
}

.level {
  fill: var(--accent);
  opacity: 0.35;
}

.label {
  font-size: 0.8rem;
}

.percent {
  font-size: 1.6rem;
  font-weight: 600;
  line-height: 1.2;
}

.count {
  font-size: 0.8rem;
}
</style>
