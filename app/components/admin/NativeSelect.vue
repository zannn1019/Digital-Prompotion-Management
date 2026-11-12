<script setup lang="ts">
// Native <select> styled like the shadcn inputs. Native keeps keyboard and
// screen-reader behaviour simple for non-technical users.
import { cn } from '@/lib/utils'

const model = defineModel<string | number | null>()
const props = defineProps<{ class?: string }>()
</script>

<template>
  <select
    v-model="model"
    :class="
      cn(
        'h-11 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60',
        props.class,
      )
    "
  >
    <slot />
  </select>
</template>
