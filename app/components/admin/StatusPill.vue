<script setup lang="ts">
// Small coloured status pill used in tables.
const props = defineProps<{ tone?: 'success' | 'info' | 'warning' | 'danger' | 'muted' }>()
const cls = computed(
  () =>
    ({
      success: 'bg-green-50 text-green-700',
      info: 'bg-blue-50 text-blue-700',
      warning: 'bg-amber-50 text-amber-800',
      danger: 'bg-red-50 text-red-700',
      muted: 'bg-muted text-zinc-600',
    })[props.tone ?? 'muted'],
)
</script>

<template>
  <span :class="['inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium', cls]"><slot /></span>
</template>
