<script setup lang="ts">
import type { Component } from 'vue'
import { TriangleAlert } from '@lucide/vue'

defineProps<{ title: string; description?: string; icon?: Component; error?: boolean }>()
</script>

<template>
  <div class="flex flex-col items-center gap-2 px-6 py-12 text-center">
    <div
      :class="['mb-2 flex size-16 items-center justify-center rounded-full', error ? 'bg-red-50 text-red-600' : 'bg-muted text-zinc-700']"
    >
      <component :is="error ? TriangleAlert : icon" v-if="error || icon" class="size-7" aria-hidden="true" />
    </div>
    <h3 class="text-lg font-semibold">{{ title }}</h3>
    <p v-if="description" class="max-w-[44ch] text-sm text-muted-foreground">{{ description }}</p>
    <div v-if="$slots.default" class="mt-2 flex flex-wrap justify-center gap-2"><slot /></div>
  </div>
</template>
