<script setup lang="ts">
// The NFC reader drawn as it is right now: unplugged, waiting for a card, a card on it, written, failed.
// Decorative: the page says the same in words.
defineProps<{ state: 'off' | 'idle' | 'waiting' | 'card' | 'busy' | 'done' | 'fail' }>()
</script>

<template>
  <svg viewBox="0 0 240 190" class="reader" :data-state="state" aria-hidden="true">
    <!-- waves above the pad -->
    <g class="waves" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="5">
      <path class="w1" d="M100 64a28 28 0 0 1 40 0" />
      <path class="w2" d="M86 50a48 48 0 0 1 68 0" />
      <path class="w3" d="M72 36a68 68 0 0 1 96 0" />
    </g>
    <!-- reader body -->
    <rect class="body" x="40" y="96" width="160" height="80" rx="18" />
    <rect class="pad" x="62" y="106" width="116" height="46" rx="10" />
    <circle class="led" cx="186" cy="164" r="4.5" />
    <!-- card resting on the pad -->
    <g class="card">
      <rect x="66" y="84" width="108" height="66" rx="8" />
      <rect class="chip" x="78" y="96" width="18" height="14" rx="3" />
      <path
        class="mark"
        d="M150 106a8 8 0 0 1 0 12M156 101a15 15 0 0 1 0 22"
        fill="none"
        stroke-width="3"
        stroke-linecap="round"
      />
    </g>
    <!-- result badge -->
    <g class="badge">
      <circle cx="174" cy="82" r="17" />
      <path
        v-if="state === 'done'"
        d="M166 82l6 6 10-11"
        fill="none"
        stroke="#fff"
        stroke-width="4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        v-else
        d="M168 76l12 12M180 76l-12 12"
        fill="none"
        stroke="#fff"
        stroke-width="4"
        stroke-linecap="round"
      />
    </g>
  </svg>
</template>

<style scoped>
.reader {
  width: 100%;
  max-width: 260px;
  height: auto;
  color: var(--color-primary, #2f318b);
}
.body {
  fill: #1f2937;
}
.pad {
  fill: #374151;
}
.led {
  fill: #ef4444;
}
.card {
  opacity: 0;
  transform: translateY(-26px);
  transition:
    opacity 0.25s ease,
    transform 0.3s ease;
}
.card rect:first-child {
  fill: #fff;
  stroke: #d4d4d8;
  stroke-width: 1.5;
}
.chip {
  fill: #e4c46a;
}
.mark {
  stroke: #2f318b;
}
.waves {
  opacity: 0.18;
}
.badge {
  opacity: 0;
  transform-origin: 174px 82px;
  transform: scale(0.6);
  transition:
    opacity 0.2s ease,
    transform 0.25s ease;
}

/* States */
.reader[data-state='off'] {
  color: #a1a1aa;
}
.reader[data-state='off'] .body {
  fill: #d4d4d8;
}
.reader[data-state='off'] .pad {
  fill: #e4e4e7;
}
.reader[data-state='off'] .led {
  fill: #a1a1aa;
}
.reader[data-state='off'] .waves {
  opacity: 0;
}
.reader[data-state='waiting'] .waves {
  opacity: 1;
}
.reader[data-state='card'] .card,
.reader[data-state='busy'] .card,
.reader[data-state='done'] .card,
.reader[data-state='fail'] .card {
  opacity: 1;
  transform: none;
}
.reader[data-state='card'] .led,
.reader[data-state='busy'] .led,
.reader[data-state='done'] .led {
  fill: #22c55e;
}
.reader[data-state='busy'] .waves {
  opacity: 1;
}
.reader[data-state='done'] .badge,
.reader[data-state='fail'] .badge {
  opacity: 1;
  transform: none;
}
.reader[data-state='done'] .badge circle {
  fill: #16a34a;
}
.reader[data-state='fail'] .badge circle {
  fill: #dc2626;
}

@media (prefers-reduced-motion: no-preference) {
  .reader[data-state='waiting'] .w1,
  .reader[data-state='busy'] .w1 {
    animation: pulse 1.4s ease-in-out infinite;
  }
  .reader[data-state='waiting'] .w2,
  .reader[data-state='busy'] .w2 {
    animation: pulse 1.4s ease-in-out 0.2s infinite;
  }
  .reader[data-state='waiting'] .w3,
  .reader[data-state='busy'] .w3 {
    animation: pulse 1.4s ease-in-out 0.4s infinite;
  }
}
@keyframes pulse {
  0%,
  100% {
    opacity: 0.25;
  }
  50% {
    opacity: 1;
  }
}
</style>
