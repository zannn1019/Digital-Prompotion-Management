<script setup lang="ts">
import { Plus } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { fmtDate, fmtDateLong, fmtDateTime, fmtNumber, relDays, daysBetween, TODAY } from '#shared/utils/format'

definePageMeta({ layout: 'admin', middleware: 'auth', title: 'Beranda' })
const { user } = useSession()
const { data, status, refresh } = useFetch('/api/dashboard', { server: false })

const greeting = computed(() => {
  const h = new Date().getHours()
  return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam'
})
type Expiring = NonNullable<typeof data.value>['expiring'][number]
const extending = ref<Expiring | null>(null)

function delta(cur: number, prev: number) {
  if (!prev) return null
  return Math.round(((cur - prev) / prev) * 100)
}
const kpis = computed(() => {
  const d = data.value
  if (!d) return []
  return [
    { label: 'Tap kartu', value: fmtNumber(d.taps), delta: delta(d.taps, d.tapsPrev), sub: 'vs 7 hari sebelumnya' },
    {
      label: 'Klik tombol',
      value: fmtNumber(d.clicks),
      delta: delta(d.clicks, d.clicksPrev),
      sub: `rasio klik ${((d.clicks / Math.max(1, d.taps)) * 100).toFixed(1).replace('.', ',')}%`,
    },
    { label: 'Kartu aktif', value: fmtNumber(d.cardsActive), sub: `dari ${d.cardsTotal} kartu · ${d.cardsUnwritten} belum ditulis` },
    { label: 'Poster tayang', value: fmtNumber(d.postersLive), sub: `${d.postersScheduled} terjadwal · ${d.postersDraft} draft` },
  ]
})
</script>

<template>
  <div>
    <AdminPageHeader
      :title="`${greeting}, ${user?.name.split(' ')[0] ?? ''}`"
      :description="`Ringkasan 7 hari terakhir · ${fmtDateLong(TODAY)}`"
    >
      <Button as-child class="h-11"
        ><NuxtLink to="/admin/posters/new"><Plus class="size-4" />Buat poster</NuxtLink></Button
      >
    </AdminPageHeader>

    <AdminEmptyState
      v-if="status === 'error'"
      error
      title="Data gagal dimuat"
      description="Periksa koneksi internet Anda, lalu coba lagi. Data Anda tidak berubah."
    >
      <Button class="h-11" @click="refresh()">Coba lagi</Button>
    </AdminEmptyState>

    <template v-else>
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <template v-if="status === 'pending'">
          <Card v-for="i in 4" :key="i"
            ><CardContent class="py-6"><AdminTableSkeleton :rows="1" /></CardContent
          ></Card>
        </template>
        <Card v-for="k in kpis" v-else :key="k.label" class="gap-1 py-5">
          <CardContent>
            <div class="text-sm font-medium text-muted-foreground">{{ k.label }}</div>
            <div class="mt-1.5 text-3xl font-bold tracking-tight">{{ k.value }}</div>
            <div class="mt-0.5 text-[13px] text-muted-foreground">
              <span
                v-if="k.delta !== undefined && k.delta !== null"
                :class="k.delta >= 0 ? 'font-semibold text-green-700' : 'font-semibold text-red-700'"
              >
                {{ k.delta >= 0 ? '▲' : '▼' }} {{ Math.abs(k.delta) }}%
              </span>
              {{ k.sub }}
            </div>
          </CardContent>
        </Card>
      </div>

      <div class="mt-6 grid gap-4 lg:grid-cols-[3fr_2fr]">
        <Card class="gap-0 overflow-hidden py-0">
          <CardHeader class="border-b py-5">
            <CardTitle>Poster berakhir dalam 7 hari</CardTitle>
            <CardDescription>Perpanjang jadwal atau siapkan pengganti agar poster tidak kosong.</CardDescription>
          </CardHeader>
          <AdminTableSkeleton v-if="status === 'pending'" :rows="3" />
          <AdminEmptyState
            v-else-if="!data?.expiring.length"
            title="Tidak ada poster yang segera berakhir"
            description="Semua poster tayang masih aman untuk 7 hari ke depan."
          />
          <Table v-else>
            <TableHeader>
              <TableRow
                ><TableHead class="pl-5">Poster</TableHead><TableHead>Berakhir</TableHead
                ><TableHead class="pr-5"><span class="sr-only">Aksi</span></TableHead></TableRow
              >
            </TableHeader>
            <TableBody>
              <TableRow v-for="p in data.expiring" :key="p.id">
                <TableCell class="pl-5">
                  <div class="font-medium">{{ p.name }}</div>
                  <div class="text-xs text-muted-foreground">
                    {{ p.kind === 'pengumuman' ? 'Pengumuman · semua halaman' : `Poster gambar · ${p.pageCount} halaman` }}
                  </div>
                </TableCell>
                <TableCell>
                  <AdminStatusPill :tone="daysBetween(TODAY, p.end) <= 5 ? 'danger' : 'warning'">{{ relDays(p.end) }}</AdminStatusPill>
                  <div class="mt-0.5 text-xs text-muted-foreground">{{ fmtDate(p.end) }}</div>
                </TableCell>
                <TableCell class="pr-5 text-right">
                  <Button variant="outline" size="sm" class="h-9" :aria-label="`Perpanjang ${p.name}`" @click="extending = p"
                    >Perpanjang</Button
                  >
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>

        <Card class="gap-2">
          <CardHeader><CardTitle>Aktivitas terbaru</CardTitle></CardHeader>
          <CardContent>
            <AdminTableSkeleton v-if="status === 'pending'" :rows="4" />
            <ul v-else class="text-[13px]">
              <li v-for="a in data?.activity" :key="a.id" class="border-b py-2.5 last:border-0">
                <b class="font-semibold">{{ a.userName.split(' ')[0] }}</b> {{ a.action.toLowerCase() }} {{ a.entity.toLowerCase() }}
                <b class="font-semibold">{{ a.target }}</b>
                <div class="text-muted-foreground">{{ fmtDateTime(a.at) }}</div>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card class="mt-6 gap-3">
        <CardHeader class="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Tap &amp; klik per hari (14 hari)</CardTitle>
          <div class="flex gap-4 text-[13px] text-muted-foreground">
            <span class="flex items-center gap-1.5"><span class="h-[3px] w-3.5 rounded bg-primary" />Tap</span>
            <span class="flex items-center gap-1.5"><span class="w-3.5 border-t-[3px] border-dashed border-brand-blue" />Klik</span>
          </div>
        </CardHeader>
        <CardContent>
          <AdminTableSkeleton v-if="status === 'pending'" :rows="3" />
          <AdminLineChart v-else-if="data" :days="data.days" label="Tap dan klik per hari, 14 hari terakhir" :height="220" />
        </CardContent>
      </Card>
    </template>

    <AdminExtendDialog v-model:target="extending" @done="refresh()" />
  </div>
</template>
