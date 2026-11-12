<script setup lang="ts">
// The readable part of a poster: category and validity chips, title, short text,
// price, list of points, brochure and terms. Optional parts are skipped when empty.
import { Check, FileDown } from '@lucide/vue'
import type { PublicPoster } from '#shared/types'
import { POSTER_CATEGORY } from '#shared/constants'
import { fmtDate } from '#shared/utils/format'

const props = defineProps<{ poster: PublicPoster; docHref?: string; large?: boolean }>()
const points = computed(() => (props.poster.points ?? []).map(p => p.trim()).filter(Boolean))
const hasBrochure = computed(() => props.poster.buttons?.includes('doc'))
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap gap-1.5">
      <span v-if="poster.category" class="rounded-full bg-brand-tint px-2.5 py-1 text-xs font-bold text-brand-navy">{{
        POSTER_CATEGORY[poster.category]
      }}</span>
      <span v-if="poster.end" class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700"
        >Berlaku s/d {{ fmtDate(poster.end) }}</span
      >
    </div>
    <component
      :is="large ? 'h1' : 'h2'"
      :class="['leading-tight font-black tracking-tight', large ? 'text-[28px] @3xl:text-4xl' : 'text-2xl']"
      >{{ poster.title || poster.name }}</component
    >
    <p class="text-[15px] leading-relaxed whitespace-pre-line text-slate-700 @3xl:text-base">{{ poster.description }}</p>

    <div v-if="poster.price" class="flex flex-wrap items-baseline gap-2 rounded-2xl border bg-slate-50 p-3.5">
      <span class="text-[13px] text-slate-600">Harga</span>
      <b class="text-2xl font-black text-brand-navy">{{ poster.price }}</b>
      <span v-if="poster.priceUnit" class="text-[13px] text-slate-600">/ {{ poster.priceUnit }}</span>
    </div>

    <div v-if="points.length">
      <h3 class="mb-2 text-base font-black">{{ poster.listTitle || 'Poin penting' }}</h3>
      <ul class="flex flex-col gap-2 text-[15px] leading-snug text-slate-800">
        <li v-for="(p, i) in points" :key="i" class="flex gap-2.5">
          <span aria-hidden="true" class="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-green-100 text-wa"
            ><Check class="size-3.5" stroke-width="3" /></span
          >{{ p }}
        </li>
      </ul>
    </div>

    <a
      v-if="hasBrochure"
      :href="docHref"
      rel="noopener"
      class="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white text-[15px] font-bold text-brand-navy no-underline"
    >
      <FileDown class="size-5" aria-hidden="true" />Unduh brosur (PDF)
    </a>

    <details v-if="poster.terms" class="border-t pt-3">
      <summary class="flex min-h-11 cursor-pointer items-center text-[15px] font-bold">Syarat &amp; ketentuan</summary>
      <p class="mt-1 text-sm leading-relaxed whitespace-pre-line text-slate-600">{{ poster.terms }}</p>
    </details>
  </div>
</template>
