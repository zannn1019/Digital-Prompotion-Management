<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue'

defineProps<{ title: string; description?: string; back?: { to: string; label: string } }>()
</script>

<template>
  <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div>
      <NuxtLink
        v-if="back"
        :to="back.to"
        class="mb-1 inline-flex min-h-8 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft class="size-4" />{{ back.label }}
      </NuxtLink>
      <h1 class="text-2xl font-semibold tracking-tight md:text-[28px]">{{ title }}</h1>
      <p v-if="description" class="mt-1 max-w-[70ch] text-sm text-muted-foreground">{{ description }}</p>
    </div>
    <div v-if="$slots.default" class="flex flex-wrap gap-2">
      <slot />
    </div>
  </div>
</template>
