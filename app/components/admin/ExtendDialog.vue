<script setup lang="ts">
// Quick "Perpanjang": pushes a poster's end date without opening the full form.
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Poster } from '#shared/types'
import { addDays, fmtDate, fmtRange } from '#shared/utils/format'

type Target = { id: string; name: string; kind: string; start: string; end: string; pageCount?: number }
const target = defineModel<Target | null>('target', { required: true })
const emit = defineEmits<{ done: [] }>()

const open = computed({
  get: () => !!target.value,
  set: v => {
    if (!v) target.value = null
  },
})
const end = ref('')
const { errors, submit } = useFieldErrors()
const saving = ref(false)

const options = computed(() => {
  const t = target.value
  if (!t) return []
  return [
    { label: '+1 minggu', date: addDays(t.end, 7) },
    { label: '+2 minggu', date: addDays(t.end, 14) },
    { label: '+1 bulan', date: addDays(t.end, 30) },
    { label: 'Sampai akhir tahun', date: `${t.end.slice(0, 4)}-12-31` },
  ].filter((o, i, all) => o.date > t.end && all.findIndex(x => x.date === o.date) === i)
})
watch(target, t => {
  errors.value = {}
  if (t) end.value = options.value[2]?.date ?? options.value[0]?.date ?? addDays(t.end, 30)
})

async function confirm() {
  const t = target.value
  if (!t) return
  saving.value = true
  // A plain string URL keeps Nitro's route-type inference from recursing too deep.
  const url: string = `/api/posters/${t.id}/extend`
  const res = await submit(() => $fetch<Poster>(url, { method: 'POST', body: { end: end.value } }))
  saving.value = false
  if (!res) return
  toast.success(`“${t.name}” diperpanjang sampai ${fmtDate(end.value)}.`)
  target.value = null
  emit('done')
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>Perpanjang “{{ target?.name }}”</DialogTitle>
        <DialogDescription v-if="target"
          >Sekarang tayang {{ fmtRange(target.start, target.end)
          }}{{ target.kind === 'pengumuman' ? ' di semua halaman' : target.pageCount ? ` di ${target.pageCount} halaman` : '' }}. Isi poster
          tidak berubah.</DialogDescription
        >
      </DialogHeader>

      <fieldset class="flex flex-col gap-2.5">
        <legend class="mb-2.5 text-sm font-semibold">Tayang sampai</legend>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="o in options"
            :key="o.date"
            type="button"
            :aria-pressed="end === o.date"
            :class="[
              'min-h-14 rounded-lg px-3 py-2 text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
              end === o.date ? 'border-2 border-primary bg-secondary' : 'border hover:bg-muted',
            ]"
            @click="end = o.date"
          >
            <b class="block text-[15px] font-semibold">{{ o.label }}</b>
            <span class="text-[13px] text-muted-foreground">s/d {{ fmtDate(o.date) }}</span>
          </button>
        </div>
        <AdminTextField id="extend-end" v-model="end" type="date" label="Atau pilih tanggal" :error="errors.end" class="max-w-56" />
      </fieldset>

      <p role="status" class="rounded-lg bg-secondary px-3.5 py-3 text-sm leading-relaxed text-secondary-foreground">
        Tetap tayang tanpa jeda sampai <b>{{ fmtDate(end) }}</b
        >. Di halaman pengunjung tertulis “Berlaku s/d {{ fmtDate(end) }}”.
      </p>

      <DialogFooter class="items-center gap-2 sm:justify-between">
        <NuxtLink
          v-if="target"
          :to="`/admin/poster/${target.id}`"
          class="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >Ubah isi poster juga</NuxtLink
        >
        <div class="flex gap-2">
          <Button variant="outline" class="h-11" @click="target = null">Batal</Button>
          <Button class="h-11" :disabled="saving" @click="confirm">{{ saving ? 'Menyimpan…' : 'Perpanjang' }}</Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
