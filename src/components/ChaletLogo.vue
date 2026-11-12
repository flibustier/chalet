<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 24 })
</script>

<!-- A goat under the roof of a chalet -->
<template>
  <svg class="logo" :width="size" :height="size" viewBox="0 0 32 32" aria-hidden="true">
    <path class="line" d="M5 10 16 2l11 8" />
    <g transform="translate(16 19) scale(0.74)">
      <path class="line" d="M-4.5-6.5C-5.2-9-7-10.6-9.5-10.6M4.5-6.5C5.2-9 7-10.6 9.5-10.6" />
      <path
        class="fill"
        d="M-6.2-4.8c-1.6-.4-3.4-1.6-4.2-3.2-.2-.4.2-.8.6-.6 1.6.8 3.2 1.1 4.6 1h10.4c1.4.1 3-.2 4.6-1 .4-.2.8.2.6.6-.8 1.6-2.6 2.8-4.2 3.2L5 2.6C4.6 5.6 2.6 8 0 8.4-2.6 8-4.6 5.6-5 2.6z"
      />
      <circle class="eye" cx="-2.4" cy="-1.6" r="1.1" />
      <circle class="eye" cx="2.4" cy="-1.6" r="1.1" />
      <path class="fill" d="M-1.4 8h2.8L0 12.2z" />
    </g>
  </svg>
</template>

<style scoped>
.line {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.fill {
  fill: var(--accent);
}

.eye {
  fill: var(--bg);
}
</style>
