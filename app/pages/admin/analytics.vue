<script setup lang="ts">
import { Download, ShieldCheck } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { today, addDays, fmtNumber } from '#shared/utils/format'

definePageMeta({ layout: 'admin', middleware: 'auth', title: 'Analitik' })

const range = ref<7 | 30 | 90 | 0>(30)
const from = ref(addDays(today(), -29))
const to = ref(today())
watch(range, r => {
  if (r) {
    to.value = today()
    from.value = addDays(today(), -(r - 1))
  }
})
const { data, status, error, refresh } = useFetch('/api/analytics', { query: { from, to }, server: false })
/** A refused range (422) gets the server's reason instead of the connection message. */
const rangeError = computed(() => {
  const body =
    error.value?.statusCode === 422 ? (error.value.data as { data?: { errors?: Record<string, string> } } | undefined) : undefined
  const errors = body?.data?.errors
  return errors ? Object.values(errors)[0] : undefined
})

const kpis = computed(() =>
  data.value
    ? [
        { label: 'Tap', value: fmtNumber(data.value.taps) },
        { label: 'Klik tombol', value: fmtNumber(data.value.clicks) },
        { label: 'Rasio klik', value: `${((data.value.clicks / Math.max(1, data.value.taps)) * 100).toFixed(1).replace('.', ',')}%` },
        { label: 'Kartu diketuk', value: `${data.value.cardsTapped} / ${data.value.cardsActive}` },
        { label: 'Tap bot disaring', value: fmtNumber(data.value.bots) },
      ]
    : [],
)

function exportCsv() {
  if (!data.value) return
  downloadCsv(`analitik-${from.value}-${to.value}.csv`, [
    ['tanggal', 'tap', 'klik'],
    ...data.value.days.map(d => [d.date, d.taps, d.clicks]),
  ])
  toast.success('File CSV analitik diunduh.')
}
</script>

<template>
  <div>
    <AdminPageHeader
      title="Analitik"
      description="Jumlah tap dan klik tanpa data pribadi. Bot dan tap berulang dalam 30 detik sudah disaring."
    >
      <Button variant="outline" class="h-11" :disabled="!data" @click="exportCsv"><Download class="size-4" />Ekspor CSV</Button>
    </AdminPageHeader>

    <div class="mb-5 flex flex-wrap items-end gap-3">
      <div role="radiogroup" aria-label="Rentang tanggal" class="flex gap-1 rounded-xl bg-muted p-1">
        <button
          v-for="r in [7, 30, 90] as const"
          :key="r"
          type="button"
          role="radio"
          :aria-checked="range === r"
          :class="['h-9 rounded-lg px-3.5 text-sm font-medium', range === r ? 'bg-background shadow-sm' : 'text-zinc-600']"
          @click="range = r"
        >
          {{ r }} hari
        </button>
      </div>
      <div class="flex flex-col gap-1">
        <Label for="from" class="text-xs text-muted-foreground">Dari</Label
        ><Input id="from" v-model="from" type="date" :max="to" class="h-11" @change="range = 0" />
      </div>
      <div class="flex flex-col gap-1">
        <Label for="to" class="text-xs text-muted-foreground">Sampai</Label
        ><Input id="to" v-model="to" type="date" :min="from" class="h-11" @change="range = 0" />
      </div>
    </div>

    <AdminEmptyState v-if="status === 'error' && rangeError" error title="Rentang tanggal belum benar" :description="rangeError" />
    <AdminEmptyState
      v-else-if="status === 'error'"
      error
      title="Data gagal dimuat"
      description="Periksa koneksi internet Anda, lalu coba lagi."
    >
      <Button class="h-11" @click="refresh()">Coba lagi</Button>
    </AdminEmptyState>
    <AdminTableSkeleton v-else-if="status === 'pending' && !data" :rows="6" />
    <AdminEmptyState
      v-else-if="data && !data.taps"
      title="Belum ada tap pada rentang ini"
      description="Coba pilih rentang tanggal yang lebih panjang."
    />
    <template v-else-if="data">
      <div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Card v-for="k in kpis" :key="k.label" class="gap-0 px-4 py-4"
          ><div class="text-[13px] font-medium text-muted-foreground">{{ k.label }}</div>
          <div class="mt-1 text-2xl font-bold tracking-tight">{{ k.value }}</div></Card
        >
      </div>

      <Card class="mt-5 gap-3">
        <CardHeader class="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Tap &amp; klik per hari</CardTitle>
          <div class="flex gap-4 text-[13px] text-muted-foreground">
            <span class="flex items-center gap-1.5"><span class="h-[3px] w-3.5 rounded bg-primary" />Tap</span>
            <span class="flex items-center gap-1.5"><span class="w-3.5 border-t-[3px] border-dashed border-brand-blue" />Klik</span>
          </div>
        </CardHeader>
        <CardContent><AdminLineChart :days="data.days" label="Tap dan klik per hari" /></CardContent>
      </Card>

      <div class="mt-5 grid gap-4 lg:grid-cols-3">
        <Card class="gap-3"
          ><CardHeader><CardTitle class="text-base">Tap per kelompok</CardTitle></CardHeader
          ><CardContent><AdminBarList :items="data.byGroup" title="Tap per kelompok" /></CardContent
        ></Card>
        <Card class="gap-3"
          ><CardHeader><CardTitle class="text-base">Tap per halaman</CardTitle></CardHeader
          ><CardContent><AdminBarList :items="data.byPage" title="Tap per halaman" /></CardContent
        ></Card>
        <Card class="gap-3"
          ><CardHeader><CardTitle class="text-base">Klik per poster &amp; tombol</CardTitle></CardHeader
          ><CardContent><AdminBarList :items="data.byButton" title="Klik per poster dan tombol" color="#2494D2" /></CardContent
        ></Card>
      </div>

      <Card class="mt-5 overflow-hidden py-0">
        <h2 class="border-b px-5 py-4 text-base font-semibold">Tap per kartu · 10 teratas</h2>
        <Table>
          <TableHeader
            ><TableRow
              ><TableHead class="pl-5">Kartu</TableHead><TableHead>Kelompok</TableHead><TableHead>Halaman</TableHead
              ><TableHead class="text-right">Tap</TableHead><TableHead class="pr-5 text-right">Klik</TableHead></TableRow
            ></TableHeader
          >
          <TableBody>
            <TableRow v-for="c in data.byCard" :key="c.code">
              <TableCell class="pl-5"
                ><span class="font-mono text-[13px]">{{ c.code }}</span> · {{ c.label }}</TableCell
              >
              <TableCell>{{ c.group }}</TableCell
              ><TableCell>{{ c.page }}</TableCell>
              <TableCell class="text-right font-semibold tabular-nums">{{ fmtNumber(c.taps) }}</TableCell>
              <TableCell class="pr-5 text-right tabular-nums">{{ fmtNumber(c.clicks) }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>

      <p class="mt-5 flex gap-2.5 rounded-lg border bg-secondary px-4 py-3 text-[13px] leading-relaxed text-zinc-700">
        <ShieldCheck class="mt-0.5 size-4 shrink-0" />Yang dicatat: waktu, kode kartu, halaman, dan tombol yang diklik. Tidak dicatat: nama,
        nomor HP, lokasi GPS, alamat IP lengkap, atau cookie pelacak.
      </p>
    </template>
  </div>
</template>
