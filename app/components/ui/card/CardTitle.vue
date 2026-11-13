<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

// Local change to the generated component: card titles sit right under the page's h1, so they are h2
// by default (the generator's h3 skipped a level). Pass `as` for another level.
const props = withDefaults(defineProps<{
  class?: HTMLAttributes["class"]
  as?: "h2" | "h3" | "h4" | "div"
}>(), { class: undefined, as: "h2" })
</script>

<template>
  <component
    :is="props.as"
    data-slot="card-title"
    :class="cn('leading-none font-semibold', props.class)"
  >
    <slot />
  </component>
</template>
