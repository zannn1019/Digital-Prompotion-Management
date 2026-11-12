<script setup lang="ts">
// The public poster page ("promo detail" layout). Used by /k/[code] and by admin phone previews.
// One poster is shown in full; the page's other posters become "Info lainnya" cards that open
// their own detail (?p=id). Server-rendered and readable without JavaScript.
// Layout follows the component's own width (container queries): phone layout in the admin
// preview frame, two columns when the page is opened on a laptop.
import { Clock, Hospital, ImageOff, Link2, MapPin, Megaphone, ShieldCheck } from '@lucide/vue'
import type { ContactButton, PublicPoster, PublicView } from '#shared/types'
import { ANNOUNCEMENT_LEVEL, POSTER_CATEGORY } from '#shared/constants'

const props = defineProps<{
  view: PublicView
  /** Card code, appended to click links for analytics. */
  code?: string
  /** Admin preview: links do nothing. */
  preview?: boolean
  /** This page's own address, for the "continue on your phone" QR code on wide screens. */
  pageUrl?: string
  /** Poster to show in full; defaults to the first one on the page. */
  posterId?: string
}>()

const GENERAL_BUTTONS: ContactButton[] = ['wa', 'tel']
const failed = ref<Record<string, boolean>>({})
const showGeneric = computed(() => props.view.kind !== 'page' || !props.view.posters.length)
const featured = computed(() => props.view.posters.find(p => p.id === props.posterId) ?? props.view.posters[0])
const others = computed(() => props.view.posters.filter(p => p !== featured.value))
/** Contact buttons for the bottom bar; the brochure sits inside the content instead. */
const contactButtons = computed<ContactButton[]>(() =>
  showGeneric.value ? GENERAL_BUTTONS : (featured.value?.buttons ?? []).filter(b => b !== 'doc'),
)
const barId = computed(() => (showGeneric.value ? 'umum' : featured.value!.id))
const mapsHref = computed(() => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(props.view.settings.address)}`)

function clickHref(posterId: string, button: ContactButton) {
  if (props.preview) return undefined
  return `/go/${posterId}/${button}${props.code ? `?c=${encodeURIComponent(props.code)}` : ''}`
}
function otherHref(p: PublicPoster) {
  return props.preview ? undefined : `?p=${encodeURIComponent(p.id)}`
}
</script>

<template>
  <div class="@container flex min-h-full flex-col bg-brand-bg font-[family-name:var(--font-poster)] text-slate-900">
    <header class="sticky top-0 z-20 border-b-[3px] border-brand-cyan bg-white">
      <div class="mx-auto flex w-full max-w-[480px] items-center gap-3 px-4 py-3 @3xl:max-w-[1120px] @3xl:px-6">
        <img :src="view.settings.logoUrl" :alt="view.settings.company" width="177" height="40" class="block h-10 w-auto @3xl:h-12" />
        <span class="grow" />
        <!-- Quick contact on wide screens, where the bottom bar is hidden. -->
        <nav aria-label="Kontak cepat" class="hidden gap-2 @3xl:flex">
          <PosterContactLink v-for="b in contactButtons" :key="b" :type="b" :href="clickHref(barId, b)" variant="outline" />
        </nav>
        <span class="inline-flex items-center gap-1 rounded-full bg-brand-tint px-2.5 py-1 text-xs font-bold text-brand-navy">
          <ShieldCheck class="size-3.5" aria-hidden="true" />Resmi
        </span>
      </div>
    </header>

    <div v-if="view.announcements.length" class="mx-auto flex w-full max-w-[480px] flex-col gap-2 px-4 pt-3 @3xl:max-w-[1120px] @3xl:px-6">
      <div
        v-for="a in view.announcements"
        :key="a.id"
        role="region"
        aria-label="Pengumuman penting"
        :class="[
          'flex gap-2 rounded-xl px-3 py-2.5 text-sm leading-snug font-bold @3xl:text-[15px]',
          ANNOUNCEMENT_LEVEL[a.level ?? 'penting'].bar,
        ]"
      >
        <Megaphone class="mt-0.5 size-[18px] shrink-0" aria-hidden="true" />
        <p>{{ a.text }}</p>
      </div>
    </div>

    <main
      class="mx-auto flex w-full max-w-[480px] grow flex-col gap-5 px-4 pt-3 pb-6 @3xl:max-w-[1120px] @3xl:gap-10 @3xl:px-6 @3xl:pt-6 @3xl:pb-14"
    >
      <!-- General page and 404 look alike on purpose and never say why. -->
      <template v-if="showGeneric">
        <section
          class="flex flex-col items-center gap-3 rounded-3xl border bg-white px-5 py-7 text-center @3xl:mx-auto @3xl:max-w-xl @3xl:px-10 @3xl:py-12"
        >
          <span class="flex size-[72px] items-center justify-center rounded-[22px] bg-brand-tint text-brand-link">
            <component :is="view.kind === 'notfound' ? Link2 : Hospital" class="size-9" aria-hidden="true" />
          </span>
          <h1 class="mt-1 text-[28px] font-black tracking-tight @3xl:text-4xl">
            {{ view.kind === 'notfound' ? 'Halaman tidak tersedia' : 'Selamat datang' }}
          </h1>
          <p class="max-w-[40ch] text-[15px] leading-relaxed text-slate-700 @3xl:text-base">
            {{
              view.kind === 'notfound'
                ? 'Tautan ini tidak dapat dibuka. Silakan hubungi tim Marketing kami untuk informasi terbaru.'
                : 'Terima kasih telah mengetuk kartu kami. Untuk informasi layanan kesehatan karyawan, silakan hubungi tim Marketing.'
            }}
          </p>
        </section>
        <section
          aria-label="Info layanan"
          class="rounded-3xl border bg-white px-4 py-1.5 text-[15px] @3xl:mx-auto @3xl:w-full @3xl:max-w-xl"
        >
          <div v-if="view.settings.hours" class="flex min-h-14 items-center gap-3 border-b border-slate-100">
            <Clock class="size-5 shrink-0 text-brand-link" aria-hidden="true" />{{ view.settings.hours }}
          </div>
          <a
            :href="preview ? undefined : mapsHref"
            target="_blank"
            rel="noopener"
            class="flex min-h-14 items-center gap-3 text-slate-900 no-underline"
          >
            <MapPin class="size-5 shrink-0 text-brand-link" aria-hidden="true" />
            <span class="grow">{{ view.settings.address }}</span>
            <span class="text-[13px] font-bold text-brand-link">Peta</span>
          </a>
        </section>
      </template>

      <template v-else-if="featured">
        <article class="flex flex-col @3xl:flex-row @3xl:items-start @3xl:gap-10">
          <figure class="m-0 @3xl:w-[min(460px,42%)] @3xl:shrink-0">
            <a
              v-if="!failed[featured.id]"
              :href="preview ? undefined : featured.imageUrl"
              target="_blank"
              rel="noopener"
              class="block"
              :aria-label="preview ? undefined : 'Buka gambar poster ukuran penuh'"
            >
              <img
                :src="featured.imageUrl"
                :alt="`Poster ${featured.title || featured.name}: ${featured.description}`"
                width="800"
                height="1000"
                decoding="async"
                class="block h-auto w-full rounded-2xl bg-slate-200 shadow-[0_8px_24px_rgba(15,23,42,.12)]"
                @error="failed[featured.id] = true"
              />
            </a>
            <!-- Image failed: say so briefly; everything else is still below. -->
            <div
              v-else
              class="flex items-center gap-3 rounded-2xl border border-dashed border-slate-400 bg-white p-4 text-sm leading-snug text-slate-700"
            >
              <span class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                <ImageOff class="size-5" aria-hidden="true" />
              </span>
              <span><b class="text-slate-900">Gambar poster tidak dapat dimuat.</b><br />Semua informasinya tetap ada di bawah ini.</span>
            </div>
            <figcaption v-if="!preview && !failed[featured.id]" class="mt-2.5 hidden text-[13px] text-slate-600 @3xl:block">
              Klik gambar untuk memperbesar
            </figcaption>
          </figure>

          <section
            :class="[
              'relative flex min-w-0 grow flex-col gap-4 bg-white p-5 @3xl:mx-0 @3xl:mt-0 @3xl:rounded-3xl @3xl:border @3xl:p-7',
              failed[featured.id] ? 'mt-4 rounded-3xl' : '-mx-4 -mt-5 rounded-t-3xl',
            ]"
          >
            <PosterDetail :poster="featured" :doc-href="clickHref(featured.id, 'doc')" large />
            <div v-if="contactButtons.length" class="hidden flex-wrap gap-2.5 border-t pt-4 @3xl:flex">
              <PosterContactLink
                v-for="(b, i) in contactButtons"
                :key="b"
                :type="b"
                :href="clickHref(featured.id, b)"
                :variant="i === 0 ? 'primary' : 'outline'"
                :class="i === 0 ? 'basis-60' : 'min-h-14 grow basis-48'"
              />
            </div>
            <div v-if="pageUrl && !preview" class="hidden items-center gap-4 rounded-2xl border bg-slate-50 p-3.5 @3xl:flex">
              <PosterQr :value="pageUrl" label="Kode QR halaman ini" :size="88" class="shrink-0 rounded-lg" />
              <p class="text-sm leading-relaxed text-slate-700">
                <b class="text-slate-900">Lanjutkan di HP?</b><br />Pindai dengan kamera HP untuk membuka halaman ini dan langsung chat
                WhatsApp.
              </p>
            </div>
          </section>
        </article>

        <section
          v-if="others.length"
          aria-labelledby="info-lain"
          :class="[
            '-mx-4 border-t-8 border-brand-bg bg-white px-4 py-5 @3xl:mx-0 @3xl:mt-0 @3xl:border-0 @3xl:bg-transparent @3xl:p-0',
            failed[featured.id] ? '' : '-mt-5',
          ]"
        >
          <h2 id="info-lain" class="mb-3 text-base font-black @3xl:text-xl">Info lainnya dari {{ view.settings.company }}</h2>
          <div
            class="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 @3xl:mx-0 @3xl:grid @3xl:grid-cols-[repeat(auto-fill,minmax(200px,1fr))] @3xl:gap-5 @3xl:overflow-visible @3xl:px-0"
          >
            <a
              v-for="p in others"
              :key="p.id"
              :href="otherHref(p)"
              class="flex w-40 shrink-0 flex-col gap-1.5 text-slate-900 no-underline @3xl:w-auto"
            >
              <img
                :src="p.imageUrl"
                alt=""
                width="160"
                height="200"
                loading="lazy"
                class="aspect-[4/5] w-full rounded-xl bg-slate-200 object-cover"
              />
              <b class="text-sm leading-snug @3xl:text-base">{{ p.title || p.name }}</b>
              <span class="text-xs text-slate-600 @3xl:text-sm">{{
                p.price
                  ? p.priceUnit
                    ? `${p.price} /
                ${p.priceUnit}`
                    : p.price
                  : p.category
                    ? POSTER_CATEGORY[p.category]
                    : ''
              }}</span>
            </a>
          </div>
        </section>
      </template>
    </main>

    <footer class="border-t bg-white text-[13px] text-slate-600">
      <div class="mx-auto max-w-[480px] px-4 pt-5 pb-6 @3xl:max-w-[1120px] @3xl:px-6">
        <b class="text-slate-900">{{ view.settings.company }}</b> · {{ view.settings.address }}
        <div class="mt-1 flex flex-wrap gap-x-5">
          <a
            :href="preview ? undefined : `tel:${view.settings.phone.replace(/[^\d+]/g, '')}`"
            class="flex min-h-11 items-center text-brand-link"
            >{{ view.settings.phone }}</a
          >
          <a :href="preview ? undefined : `mailto:${view.settings.email}`" class="flex min-h-11 items-center text-brand-link">{{
            view.settings.email
          }}</a>
        </div>
        <p class="mt-1 flex gap-2 text-xs">
          <ShieldCheck class="size-4 shrink-0" aria-hidden="true" />Halaman ini tidak memakai cookie pelacak dan tidak menyimpan data
          pribadi Anda.
        </p>
      </div>
    </footer>

    <!-- Always-visible contact bar on phones: first button big, the rest as icons. -->
    <div v-if="contactButtons.length" class="sticky bottom-0 z-20 border-t bg-white shadow-[0_-6px_20px_rgba(15,23,42,.08)] @3xl:hidden">
      <div class="mx-auto flex max-w-[480px] gap-2.5 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <PosterContactLink v-for="b in contactButtons.slice(1)" :key="b" :type="b" :href="clickHref(barId, b)" variant="icon" />
        <PosterContactLink :type="contactButtons[0]!" :href="clickHref(barId, contactButtons[0]!)" variant="primary" />
      </div>
    </div>
  </div>
</template>
