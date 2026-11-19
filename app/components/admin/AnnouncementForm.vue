<script setup lang="ts">
// Important announcement: one sentence shown as a coloured bar above every poster.
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import type { AnnouncementLevel, Poster, PublishStatus } from '#shared/types'
import { ANNOUNCEMENT_LEVEL } from '#shared/constants'
import { today, addDays } from '#shared/utils/format'

const props = defineProps<{
  poster?: Poster & { pendingByName?: string | null; rejectedByName?: string | null }
}>()
const { errors, submit } = useFieldErrors()
const { canApprove } = useSession()

// Staff and Marketing keep working on their own submitted version while it waits for approval.
const src =
  props.poster?.pending && !canApprove.value
    ? { ...props.poster, ...props.poster.pending.fields }
    : props.poster
const form = reactive({
  text: src?.text ?? '',
  level: (src?.level ?? 'penting') as AnnouncementLevel,
  start: src?.start ?? today(),
  end: src?.end ?? addDays(today(), 7),
})
const { markSaved } = useDirtyGuard(() => form)
const endBeforeStart = computed(() => form.end < form.start)
// Emergency announcements go live only through a Super Admin (the server enforces it too).
const { isSuper } = useSession()
const editingLiveEmergency = computed(
  () =>
    !isSuper.value &&
    props.poster?.level === 'darurat' &&
    props.poster.status === 'published' &&
    !props.poster.archived,
)
const emergencyNeedsSuper = computed(
  () => !isSuper.value && (form.level === 'darurat' || editingLiveEmergency.value),
)

const saving = ref<PublishStatus | null>(null)
async function save(status: PublishStatus) {
  saving.value = status
  const body = { kind: 'pengumuman' as const, status, ...form }
  const res = await submit(() =>
    props.poster
      ? $fetch<Poster>(`/api/posters/${props.poster.id}`, { method: 'PUT', body })
      : $fetch<Poster>('/api/posters', { method: 'POST', body }),
  )
  saving.value = null
  if (!res) return
  markSaved()
  toast.success(
    res.pending
      ? 'Pengumuman diajukan. Tampil setelah disetujui Approver.'
      : status === 'published'
        ? 'Pengumuman diterbitkan. Tampil di atas semua poster sesuai jadwal.'
        : 'Draft tersimpan.',
  )
  await navigateTo('/admin/posters')
}

const preview = usePosterPreview(() => ({
  posters: [draftPoster({ imageUrl: '/dummy/promo-mcu.svg', description: 'Contoh poster' })],
  announcements: [
    draftPoster({
      id: 'ann',
      kind: 'pengumuman',
      text: form.text || 'Isi pengumuman akan tampil di sini',
      level: form.level,
    }),
  ],
}))
</script>

<template>
  <div class="flex flex-wrap items-start gap-8">
    <form class="flex min-w-0 grow-[999] basis-[480px] flex-col gap-6" novalidate @submit.prevent>
      <AdminApprovalNotice :poster="poster" />
      <section class="flex flex-col gap-5 rounded-2xl border p-6">
        <AdminTextField
          id="text"
          v-model="form.text"
          large
          required
          multiline
          label="Isi pengumuman"
          :max="140"
          :error="errors.text"
          hint="Contoh: Lab tutup 1–2 Nov untuk pemeliharaan. IGD tetap buka 24 jam."
        />
        <fieldset>
          <legend class="mb-2 text-[17px] font-semibold">Warna bar</legend>
          <div class="flex flex-wrap gap-2.5">
            <button
              v-for="(l, key) in ANNOUNCEMENT_LEVEL"
              :key="key"
              type="button"
              :aria-pressed="form.level === key"
              :class="[
                'flex min-h-13 items-center gap-2.5 rounded-xl px-4 text-base font-semibold',
                form.level === key ? 'border-[3px] border-primary bg-secondary' : 'border',
              ]"
              @click="form.level = key"
            >
              <span :class="['size-5 rounded-md border border-black/15', l.swatch]" />
              {{ l.label }}
            </button>
          </div>
        </fieldset>
        <div class="grid gap-4 sm:grid-cols-2">
          <AdminTextField
            id="a-start"
            v-model="form.start"
            large
            type="date"
            label="Mulai tampil"
            :error="errors.start"
          />
          <AdminTextField
            id="a-end"
            v-model="form.end"
            large
            type="date"
            label="Berhenti tampil"
            :error="
              errors.end ||
              (endBeforeStart ? 'Tanggal berhenti harus sama atau setelah tanggal mulai.' : '')
            "
          />
        </div>
        <p class="text-[15px] text-muted-foreground">
          Pengumuman hilang sendiri setelah tanggal berhenti. Pembaca tidak bisa menutupnya.
        </p>
      </section>
      <div class="flex flex-wrap items-center justify-end gap-3 rounded-2xl border p-4">
        <p
          v-if="emergencyNeedsSuper"
          class="mr-auto basis-full text-[15px] text-muted-foreground sm:basis-auto"
        >
          {{
            editingLiveEmergency
              ? 'Pengumuman darurat yang sudah terbit hanya bisa diubah oleh Super Admin.'
              : 'Pengumuman darurat diterbitkan oleh Super Admin. Simpan sebagai draft, lalu minta Super Admin menerbitkannya.'
          }}
        </p>
        <Button
          type="button"
          variant="outline"
          class="h-13 px-5 text-base"
          :disabled="!!saving || editingLiveEmergency"
          @click="save('draft')"
        >
          {{ saving === 'draft' ? 'Menyimpan…' : 'Simpan Draft' }}
        </Button>
        <Button
          type="button"
          class="h-13 px-5 text-base"
          :disabled="!!saving || emergencyNeedsSuper"
          @click="save('published')"
        >
          {{
            canApprove
              ? saving === 'published'
                ? 'Menerbitkan…'
                : 'Terbitkan pengumuman'
              : saving === 'published'
                ? 'Mengajukan…'
                : 'Ajukan untuk disetujui'
          }}
        </Button>
      </div>
    </form>

    <aside aria-label="Pratinjau HP" class="flex grow basis-[340px] flex-col items-center gap-3">
      <b class="self-stretch text-[17px] font-semibold">Begini tampilannya di HP</b>
      <AdminPhoneFrame>
        <PosterView v-if="preview" :view="preview" preview class="min-h-full" />
      </AdminPhoneFrame>
    </aside>
  </div>
</template>
