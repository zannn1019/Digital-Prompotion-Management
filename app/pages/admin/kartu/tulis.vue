<script setup lang="ts">
// Desktop overview of card writing + the ways to do it.
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { WRITE_STATUS } from '#shared/constants'
import { fmtDateTime } from '#shared/utils/format'

definePageMeta({ layout: 'admin', middleware: 'auth', title: 'Tulis ke kartu fisik' })
const { cards: data, status } = useCards()
const { copy } = useCopy()
const pending = computed(() => (data.value ?? []).filter(c => c.writeStatus !== 'sudah'))
const recent = computed(() =>
  (data.value ?? [])
    .filter(c => c.writeStatus === 'sudah')
    .sort((a, b) => (b.writtenAt ?? '').localeCompare(a.writtenAt ?? ''))
    .slice(0, 3),
)
const rows = computed(() => [...pending.value, ...recent.value])
</script>

<template>
  <div>
    <AdminPageHeader
      title="Tulis ke kartu fisik"
      :back="{ to: '/admin/kartu', label: 'Kembali ke Kartu NFC' }"
      description="Kartu baru masih kosong. Tulis alamat uniknya sekali saja — setelah itu, isi poster diganti dari Panel Admin tanpa menulis ulang kartu."
    />
    <div class="flex flex-wrap items-start gap-6">
      <div class="flex min-w-0 grow-[999] basis-[560px] flex-col gap-4">
        <div class="grid grid-cols-3 gap-3">
          <Card class="gap-0 px-4 py-3.5">
            <div class="text-[13px] text-muted-foreground">Belum ditulis</div>
            <div class="text-2xl font-bold">{{ pending.filter(c => c.writeStatus === 'belum').length }}</div>
          </Card>
          <Card class="gap-0 px-4 py-3.5">
            <div class="text-[13px] text-muted-foreground">Perlu dicek</div>
            <div class="text-2xl font-bold">{{ pending.filter(c => c.writeStatus === 'gagal').length }}</div>
          </Card>
          <Card class="gap-0 px-4 py-3.5">
            <div class="text-[13px] text-muted-foreground">Sudah ditulis</div>
            <div class="text-2xl font-bold">{{ (data ?? []).filter(c => c.writeStatus === 'sudah').length }}</div>
          </Card>
        </div>
        <Card class="overflow-hidden py-0">
          <AdminTableSkeleton v-if="status === 'pending'" />
          <Table v-else class="min-w-[680px]">
            <TableHeader>
              <TableRow>
                <TableHead class="pl-4">Kartu</TableHead>
                <TableHead>Alamat yang ditulis</TableHead>
                <TableHead>Status tulis</TableHead>
                <TableHead class="pr-4 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="c in rows" :key="c.code">
                <TableCell class="pl-4"
                  ><b class="font-medium">{{ c.label }}</b>
                  <div class="font-mono text-xs text-muted-foreground">{{ c.code }}</div>
                </TableCell>
                <TableCell class="font-mono text-xs text-zinc-700">{{ c.url.replace('https://', '') }}</TableCell>
                <TableCell>
                  <AdminStatusPill :tone="WRITE_STATUS[c.writeStatus].tone">{{ WRITE_STATUS[c.writeStatus].label }} </AdminStatusPill>
                  <div class="mt-0.5 text-xs text-muted-foreground">
                    {{
                      c.writtenAt
                        ? `${fmtDateTime(c.writtenAt)} ·
                    ${c.writtenByName}${c.locked ? ' · terkunci' : ''}`
                        : c.writeStatus === 'gagal'
                          ? 'Kartu bergeser saat ditulis'
                          : 'Masih kosong'
                    }}
                  </div>
                </TableCell>
                <TableCell class="pr-4 text-right"
                  ><Button variant="outline" size="sm" class="h-9" @click="copy(c.url)">Salin alamat</Button></TableCell
                >
              </TableRow>
            </TableBody>
          </Table>
        </Card>
        <p class="text-[13px] text-muted-foreground">
          Status diperbarui otomatis saat kartu selesai ditulis dari HP. Setiap penulisan tercatat di Audit Log.
        </p>
      </div>

      <aside class="flex grow basis-[340px] flex-col gap-3.5">
        <Card class="gap-3 border-2 border-primary p-5">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-semibold">1. Pakai HP Android</h2>
            <span class="rounded-full bg-primary px-2.5 py-0.5 text-xs text-primary-foreground">Disarankan</span>
          </div>
          <div class="flex items-center gap-3.5">
            <AdminQrPlaceholder
              seed="tulis-nfc"
              label="Contoh kode QR untuk membuka halaman Tulis Kartu di HP"
              :size="120"
              class="shrink-0 rounded-lg border"
            />
            <ol class="list-decimal pl-4 text-sm leading-relaxed text-zinc-700">
              <li>Pindai QR dengan HP Android.</li>
              <li>Masuk dengan akun Anda.</li>
              <li>Tempelkan kartu satu per satu.</li>
            </ol>
          </div>
          <Button as-child class="h-11">
            <NuxtLink to="/admin/tulis-nfc">Buka penulis kartu</NuxtLink>
          </Button>
          <p class="text-xs text-muted-foreground">
            Butuh Google Chrome di Android dengan NFC menyala, dan alamat https. Tidak perlu memasang aplikasi.
          </p>
        </Card>
        <Card class="gap-2.5 p-5">
          <h2 class="text-base font-semibold">2. Pakai aplikasi penulis NFC</h2>
          <p class="text-sm leading-relaxed text-zinc-700">
            Untuk iPhone atau HP tanpa Chrome. Salin alamat kartu, lalu tulis sebagai “URL” di aplikasi penulis NFC.
          </p>
          <Button variant="outline" class="h-10" @click="copy(pending.map(c => c.url).join('\n'), `${pending.length} alamat disalin.`)"
            >Salin semua alamat ({{ pending.length }})</Button
          >
        </Card>
        <Card class="gap-2 bg-secondary p-5">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-semibold">3. Alat penulis USB di PC</h2>
            <AdminStatusPill>Nanti</AdminStatusPill>
          </div>
          <p class="text-sm leading-relaxed text-muted-foreground">
            Untuk menulis ratusan kartu sekaligus dari laptop kantor. Direncanakan setelah V1.
          </p>
        </Card>
      </aside>
    </div>
  </div>
</template>
