<script setup lang="ts">
// Phone page for writing card URLs with Web NFC (Chrome on Android, https).
// Where Web NFC is missing, the page explains why and offers a simulation so
// the flow can still be demoed on a laptop.
import { Check, Nfc, TriangleAlert, X } from '@lucide/vue'
import { toast } from 'vue-sonner'
import type { CardRow } from '~/composables/useCards'
import { TODAY } from '#shared/utils/format'

definePageMeta({ middleware: 'auth', layout: false })
useHead({ title: 'Tulis Kartu NFC' })

const { cards: all, refresh } = useCards()
const { supported, secureContext, writeUrl, cancel: cancelNfc } = useWebNfc()
const { copy } = useCopy()

// Cards still to write, plus those written today (to show progress).
const cards = computed(() => (all.value ?? []).filter(c => c.writeStatus !== 'sudah' || c.writtenAt?.startsWith(TODAY)))
const done = computed(() => cards.value.filter(c => c.writeStatus === 'sudah').length)

const simulate = ref(false)
const step = ref<'pick' | 'ready' | 'writing' | 'done' | 'fail'>('pick')
const selCode = ref('')
watch(
  cards,
  list => {
    if (!list.some(c => c.code === selCode.value && c.writeStatus !== 'sudah'))
      selCode.value = list.find(c => c.writeStatus !== 'sudah')?.code ?? ''
  },
  { immediate: true },
)
const sel = computed(() => cards.value.find(c => c.code === selCode.value))
const lock = ref(false)
const failReason = ref('')
function simulateFail() {
  failReason.value = 'Kartu bergeser sebelum selesai.'
  finish(false)
}
const lastWritten = ref<CardRow | null>(null)

async function start() {
  if (!sel.value) return
  step.value = 'ready'
  if (simulate.value || !supported.value) return
  const result = await writeUrl(sel.value.url, lock.value, () => {
    step.value = 'writing'
  })
  if (!result.ok && result.cancelled) return
  // The URL is on the card even when only locking failed: record it as written, not locked.
  if (!result.ok && result.stage === 'lock') {
    await finish(true, false)
    toast.warning(result.reason)
    return
  }
  if (!result.ok) failReason.value = result.reason
  await finish(result.ok)
}
async function finish(ok: boolean, locked = lock.value) {
  const card = sel.value
  if (!card) return
  try {
    await $fetch(`/api/cards/${card.code}/write`, { method: 'POST', body: { ok, locked } })
  } catch {
    failReason.value = 'Kartu sudah mungkin tertulis, tetapi statusnya gagal disimpan. Periksa daftar kartu sebelum mengulang.'
    step.value = 'fail'
    return
  }
  if (ok) {
    lastWritten.value = { ...card, locked: card.locked || locked }
    navigator.vibrate?.(200)
  }
  step.value = ok ? 'done' : 'fail'
  await refresh()
}
function cancel() {
  cancelNfc()
  step.value = 'pick'
}
function next() {
  step.value = 'pick'
}
function copyUrl() {
  copy(sel.value?.url ?? '', 'Alamat kartu disalin.')
}
</script>

<template>
  <div class="mx-auto flex min-h-dvh max-w-[480px] flex-col bg-background font-sans text-foreground">
    <header class="flex items-center gap-2.5 border-b px-4 py-3.5">
      <NuxtLink
        to="/admin/nfc-cards/write"
        aria-label="Kembali"
        class="flex size-9 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground"
        >CM</NuxtLink
      >
      <div class="grow leading-tight">
        <b class="text-[17px] font-bold">Tulis Kartu NFC</b>
        <div class="text-[13px] text-muted-foreground">{{ done }} dari {{ cards.length }} kartu sudah ditulis</div>
      </div>
    </header>

    <!-- Not supported -->
    <main v-if="!supported && !simulate" class="flex grow flex-col gap-4 px-5 py-7">
      <div class="flex size-16 items-center justify-center rounded-full bg-amber-50 text-amber-700"><TriangleAlert class="size-8" /></div>
      <h1 class="text-[26px] leading-tight font-bold">HP ini belum bisa menulis kartu</h1>
      <p class="text-[17px] leading-relaxed text-zinc-700">
        Penulisan kartu dari browser hanya bisa di <b>HP Android</b> dengan <b>Google Chrome</b>, NFC menyala, dan alamat https.
        <span v-if="!secureContext">Alamat halaman ini belum menggunakan https.</span>
      </p>
      <ol class="list-decimal rounded-xl border bg-secondary py-3.5 pr-3.5 pl-9 text-base leading-8">
        <li>Buka Pengaturan HP → nyalakan <b>NFC</b>.</li>
        <li>Buka halaman ini di <b>Chrome</b>.</li>
        <li>Pakai iPhone? Salin alamat kartu ke aplikasi penulis NFC.</li>
      </ol>
      <button type="button" class="min-h-14 rounded-xl border text-[17px] font-semibold" @click="copyUrl">
        Salin alamat kartu {{ sel?.code }}
      </button>
      <button
        type="button"
        class="min-h-14 rounded-xl bg-primary text-[17px] font-semibold text-primary-foreground"
        @click="simulate = true"
      >
        Lanjut dengan simulasi (demo)
      </button>
    </main>

    <!-- Pick -->
    <main v-else-if="step === 'pick'" class="flex grow flex-col gap-3.5 px-4 py-5">
      <h1 class="text-2xl font-bold">Pilih kartu yang mau ditulis</h1>
      <p v-if="simulate" class="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Mode simulasi: tidak ada kartu sungguhan yang ditulis.
      </p>
      <div role="radiogroup" aria-label="Kartu" class="flex flex-col gap-2">
        <button
          v-for="c in cards"
          :key="c.code"
          type="button"
          role="radio"
          :aria-checked="selCode === c.code"
          :disabled="c.writeStatus === 'sudah'"
          :class="[
            'flex min-h-16 items-center gap-3 rounded-xl px-3.5 py-2.5 text-left',
            c.writeStatus === 'sudah'
              ? 'border bg-secondary opacity-70'
              : selCode === c.code
                ? 'border-[3px] border-primary'
                : 'border border-zinc-300',
          ]"
          @click="selCode = c.code"
        >
          <span class="grow"
            ><b class="block text-[17px] font-semibold">{{ c.label }}</b
            ><span class="font-mono text-sm text-muted-foreground">{{ c.code }}</span></span
          >
          <span
            :class="[
              'rounded-full px-2.5 py-0.5 text-[13px] font-semibold',
              c.writeStatus === 'sudah'
                ? 'bg-green-50 text-green-700'
                : c.writeStatus === 'gagal'
                  ? 'bg-red-50 text-red-700'
                  : 'bg-muted text-zinc-700',
            ]"
          >
            {{ c.writeStatus === 'sudah' ? 'Sudah ditulis' : c.writeStatus === 'gagal' ? 'Perlu dicek' : 'Belum ditulis' }}
          </span>
        </button>
      </div>
      <p v-if="!cards.some(c => c.writeStatus !== 'sudah')" class="text-base text-muted-foreground">Semua kartu sudah ditulis.</p>
      <label class="flex items-start gap-3 rounded-xl border px-3.5 py-3 text-[15px] leading-snug">
        <input v-model="lock" type="checkbox" class="mt-0.5 size-[22px] shrink-0 accent-primary" />
        <span
          ><b>Kunci kartu setelah ditulis</b><br /><span class="text-muted-foreground"
            >Kartu tidak bisa ditimpa orang lain. <b class="text-destructive">Tidak bisa dibatalkan</b> — kartu tidak bisa dipakai
            ulang.</span
          ></span
        >
      </label>
      <button
        type="button"
        class="mt-auto min-h-15 rounded-2xl bg-primary text-lg font-bold text-primary-foreground disabled:opacity-50"
        :disabled="!sel || sel.writeStatus === 'sudah'"
        @click="start"
      >
        Tulis ke kartu {{ sel?.code }}
      </button>
    </main>

    <!-- Ready -->
    <main v-else-if="step === 'ready' || step === 'writing'" class="flex grow flex-col items-center gap-4 px-5 py-6 text-center">
      <div aria-hidden="true" class="relative mt-2 size-56">
        <div class="absolute inset-0 animate-[spin_12s_linear_infinite] rounded-full border-2 border-dashed border-zinc-400" />
        <div class="absolute inset-9 rounded-full bg-muted" />
        <div class="absolute top-14 left-16 flex h-28 w-24 items-center justify-center rounded-2xl bg-primary">
          <Nfc class="size-11 text-primary-foreground" />
        </div>
      </div>
      <h1 class="text-[26px] font-bold" role="status">
        {{ step === 'writing' ? 'Mengunci kartu… tahan sebentar lagi' : 'Tempelkan kartu ke belakang HP' }}
      </h1>
      <p class="text-[17px] leading-relaxed text-zinc-700">
        Tahan diam 2–3 detik sampai HP bergetar. Kartu: <b class="font-mono">{{ sel?.code }}</b>
      </p>
      <div class="mt-auto flex w-full flex-col gap-2.5">
        <template v-if="simulate || !supported">
          <button
            type="button"
            class="min-h-14 rounded-xl bg-primary text-[17px] font-semibold text-primary-foreground"
            @click="finish(true)"
          >
            (Simulasi) kartu ditempel
          </button>
          <button type="button" class="min-h-12 rounded-xl border text-[15px]" @click="simulateFail">(Simulasi) kartu bergeser</button>
        </template>
        <button type="button" class="min-h-12 text-base font-semibold text-zinc-700" @click="cancel">Batal</button>
      </div>
    </main>

    <!-- Done -->
    <main v-else-if="step === 'done'" class="flex grow flex-col items-center gap-3.5 px-5 py-7 text-center">
      <div class="flex size-24 items-center justify-center rounded-full bg-green-50 text-green-700">
        <Check class="size-12" stroke-width="2.5" />
      </div>
      <h1 role="status" class="text-[26px] font-bold">Kartu berhasil ditulis</h1>
      <p class="text-base leading-relaxed text-zinc-700">
        Alamat poster sudah tersimpan di kartu.{{ lastWritten?.locked ? ' Kartu sudah dikunci.' : '' }}
      </p>
      <div class="w-full rounded-lg border bg-secondary p-3 font-mono text-[13px] break-all">{{ lastWritten?.url }}</div>
      <p class="text-[15px] text-muted-foreground">Tempel label “{{ lastWritten?.label }}” di kartu, lalu pasang di lokasinya.</p>
      <div class="mt-auto flex w-full flex-col gap-2.5">
        <button type="button" class="min-h-15 rounded-2xl bg-primary text-lg font-bold text-primary-foreground" @click="next">
          {{ cards.some(c => c.writeStatus !== 'sudah') ? 'Tulis kartu berikutnya' : 'Selesai — kembali ke daftar' }}
        </button>
        <a :href="`/k/${lastWritten?.code}`" target="_blank" class="flex min-h-12 items-center justify-center rounded-xl border text-base"
          >Coba buka poster kartu ini</a
        >
      </div>
    </main>

    <!-- Fail -->
    <main v-else class="flex grow flex-col items-center gap-3.5 px-5 py-7 text-center">
      <div class="flex size-24 items-center justify-center rounded-full bg-red-50 text-red-600">
        <X class="size-11" stroke-width="2.5" />
      </div>
      <h1 role="alert" class="text-[26px] font-bold">Kartu belum tertulis</h1>
      <p class="text-[17px] leading-relaxed text-zinc-700">
        {{ failReason }} Tidak ada yang rusak — coba sekali lagi dan tahan lebih lama.
      </p>
      <ul class="w-full list-disc rounded-xl border bg-secondary py-3.5 pr-3.5 pl-8 text-left text-[15px] leading-7 text-zinc-700">
        <li>Lepas casing HP yang tebal atau bermagnet.</li>
        <li>Posisi NFC biasanya di tengah belakang HP.</li>
        <li>Kartu terkunci tidak bisa ditulis ulang.</li>
      </ul>
      <button type="button" class="mt-auto min-h-15 w-full rounded-2xl bg-primary text-lg font-bold text-primary-foreground" @click="start">
        Coba lagi
      </button>
      <button type="button" class="min-h-12 w-full text-base font-semibold text-zinc-700" @click="step = 'pick'">Pilih kartu lain</button>
    </main>
  </div>
</template>
