<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{
  class?: HTMLAttributes["class"]
  /**
   * Names the scroll area. A table wider than a phone scrolls sideways inside it, so the area is made a
   * labelled, keyboard-scrollable region (Tab to it, then arrow keys).
   */
  label?: string
}>()
</script>

<template>
  <div
    data-slot="table-container"
    class="relative w-full overflow-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
    :role="label ? 'region' : undefined"
    :aria-label="label"
    :tabindex="label ? 0 : undefined"
  >
    <table data-slot="table" :class="cn('w-full caption-bottom text-sm', props.class)">
      <slot />
    </table>
  </div>
</template>
