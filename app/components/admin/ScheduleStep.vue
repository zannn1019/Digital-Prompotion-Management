<script setup lang="ts">
// Step 2 of the poster form: when it shows, on which pages, and a summary.
import type { Page } from '#shared/types'
import { TODAY, addDays, daysBetween, fmtDate, fmtRange } from '#shared/utils/format'

const start = defineModel<string>('start', { required: true })
const end = defineModel<string>('end', { required: true })
const pageIds = defineModel<string[]>('pageIds', { required: true })
defineProps<{ pages: (Page & { cardCount: number })[]; errors: Record<string, string> }>()

const QUICK = [
  { label: '1 minggu', days: 6 },
  { label: '2 minggu', days: 13 },
  { label: '1 bulan', days: 29 },
  { label: 'Sampai akhir tahun', days: null },
] as const
function quickEnd(days: number | null) {
  return days === null ? `${start.value.slice(0, 4)}-12-31` : addDays(start.value, days)
}
const badRange = computed(() => end.value < start.value)
</script>

<template>
  <div class="flex flex-col gap-6">
    <AdminFormSection id="j1" title="Kapan tampil?">
      <div role="group" aria-label="Pilihan cepat" class="flex flex-wrap gap-2">
        <button
          v-for="q in QUICK"
          :key="q.label"
          type="button"
          :aria-pressed="end === quickEnd(q.days)"
          :class="[
            'min-h-12 rounded-lg px-4 text-base font-semibold',
            end === quickEnd(q.days) ? 'border-2 border-primary bg-secondary text-primary' : 'border',
          ]"
          @click="end = quickEnd(q.days)"
        >
          {{ q.label }}
        </button>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <AdminTextField id="start" v-model="start" large type="date" label="Mulai tampil" :error="errors.start" />
        <AdminTextField
          id="end"
          v-model="end"
          large
          type="date"
          label="Berhenti tampil"
          :error="errors.end || (badRange ? 'Tanggal berhenti harus sama atau setelah tanggal mulai.' : '')"
        />
      </div>
      <p class="text-[15px] leading-relaxed text-muted-foreground">
        Poster muncul dan hilang sendiri sesuai tanggal. Tanggal berhenti tampil di halaman pengunjung sebagai
        <b class="text-foreground">“Berlaku s/d {{ fmtDate(end) }}”</b>.
      </p>
    </AdminFormSection>

    <AdminFormSection id="j2" title="Tampil di halaman mana?">
      <p class="-mt-1 text-[15px] text-muted-foreground">Satu halaman bisa dibuka oleh banyak kartu NFC. Centang satu atau lebih.</p>
      <label
        v-for="pg in pages"
        :key="pg.id"
        :class="[
          'flex min-h-14 cursor-pointer items-center gap-3 rounded-xl px-4 text-[17px]',
          pageIds.includes(pg.id) ? 'border-2 border-primary bg-secondary' : 'border',
        ]"
      >
        <input v-model="pageIds" type="checkbox" :value="pg.id" class="size-5 accent-primary" />
        <span class="grow">{{ pg.name }}</span>
        <span class="text-sm text-muted-foreground">{{ pg.cardCount }} kartu{{ pg.status === 'draft' ? ' · Draft' : '' }}</span>
      </label>
      <p class="text-[15px] text-muted-foreground">
        Poster ditambahkan di urutan paling bawah.
        <NuxtLink to="/admin/halaman" class="font-semibold text-primary underline underline-offset-4">Ubah urutan di menu Halaman</NuxtLink
        >.
      </p>
    </AdminFormSection>

    <section aria-label="Ringkasan" class="rounded-2xl bg-secondary p-5 text-[15px] leading-relaxed">
      <b class="text-base">Ringkasan</b>
      <ul class="mt-2 flex flex-col gap-1">
        <li><b>Tayang:</b> {{ badRange ? '—' : `${fmtRange(start, end)} (${daysBetween(start, end) + 1} hari)` }}</li>
        <li>
          <b>Halaman:</b> {{ pageIds.length }} halaman ·
          {{ pages.filter(p => pageIds.includes(p.id)).reduce((n, p) => n + p.cardCount, 0) }} kartu NFC
        </li>
        <li><b>Setelah diterbitkan:</b> {{ start > TODAY ? `terjadwal, tampil mulai ${fmtDate(start)}` : 'langsung tayang' }}</li>
      </ul>
    </section>
  </div>
</template>
