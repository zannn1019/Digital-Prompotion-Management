<script setup lang="ts">
// Numbered form section for the content-maker forms. The number matches the
// order of the parts on the visitor page, so staff can see what goes where.
defineProps<{ id: string; n?: number; title: string; optional?: boolean }>()
</script>

<template>
  <section :aria-labelledby="id" class="flex flex-col gap-4 rounded-2xl border p-6">
    <h2 :id="id" class="flex items-center gap-2.5 text-xl font-black">
      <span
        v-if="n"
        aria-hidden="true"
        class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-[15px] text-primary-foreground"
        >{{ n }}</span
      >
      {{ title }}
      <span v-if="optional" class="text-[15px] font-normal text-muted-foreground">· opsional</span>
    </h2>
    <slot />
  </section>
</template>
