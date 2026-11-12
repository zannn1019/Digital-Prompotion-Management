<script setup lang="ts">
import { Skeleton } from '@/components/ui/skeleton'

withDefaults(defineProps<{ rows?: number }>(), { rows: 5 })
</script>

<template>
  <div class="flex flex-col gap-4 p-5" aria-busy="true">
    <span class="sr-only">Memuat…</span>
    <div v-for="i in rows" :key="i" class="flex items-center gap-3">
      <Skeleton class="size-9 rounded-md" />
      <div class="flex grow flex-col gap-2">
        <Skeleton class="h-3" :style="{ width: `${40 + ((i * 17) % 45)}%` }" />
        <Skeleton class="h-2.5 w-1/4" />
      </div>
    </div>
  </div>
</template>
