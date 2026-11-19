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
        'h-11 rounded-md border bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60 md:text-sm',
        props.class,
      )
    "
  >
    <slot />
  </select>
</template>
