<script setup lang="ts">
// Important announcement: one sentence shown as a coloured bar above every poster.
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import type { AnnouncementLevel, Poster, PublishStatus } from '#shared/types'
import { ANNOUNCEMENT_LEVEL } from '#shared/constants'
import { today, addDays } from '#shared/utils/format'

const props = defineProps<{ poster?: Poster }>()
const { errors, submit } = useFieldErrors()

const form = reactive({
  text: props.poster?.text ?? '',
  level: (props.poster?.level ?? 'penting') as AnnouncementLevel,
  start: props.poster?.start ?? today(),
  end: props.poster?.end ?? addDays(today(), 7),
})
const { markSaved } = useDirtyGuard(() => form)
const endBeforeStart = computed(() => form.end < form.start)

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
  toast.success(status === 'published' ? 'Pengumuman diterbitkan. Tampil di atas semua poster sesuai jadwal.' : 'Draft tersimpan.')
  await navigateTo('/admin/posters')
}

const preview = usePosterPreview(() => ({
  posters: [draftPoster({ imageUrl: '/dummy/promo-mcu.svg', description: 'Contoh poster' })],
  announcements: [
    draftPoster({ id: 'ann', kind: 'pengumuman', text: form.text || 'Isi pengumuman akan tampil di sini', level: form.level }),
  ],
}))
</script>

<template>
  <div class="flex flex-wrap items-start gap-8">
    <form class="flex min-w-0 grow-[999] basis-[480px] flex-col gap-6" novalidate @submit.prevent>
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
              <span :class="['size-5 rounded-md border border-black/15', l.swatch]" />{{ l.label }}
            </button>
          </div>
        </fieldset>
        <div class="grid gap-4 sm:grid-cols-2">
          <AdminTextField id="a-start" v-model="form.start" large type="date" label="Mulai tampil" :error="errors.start" />
          <AdminTextField
            id="a-end"
            v-model="form.end"
            large
            type="date"
            label="Berhenti tampil"
            :error="errors.end || (endBeforeStart ? 'Tanggal berhenti harus sama atau setelah tanggal mulai.' : '')"
          />
        </div>
        <p class="text-[15px] text-muted-foreground">Pengumuman hilang sendiri setelah tanggal berhenti. Pembaca tidak bisa menutupnya.</p>
      </section>
      <div class="flex flex-wrap justify-end gap-3 rounded-2xl border p-4">
        <Button type="button" variant="outline" class="h-13 px-5 text-base" :disabled="!!saving" @click="save('draft')">{{
          saving === 'draft' ? 'Menyimpan…' : 'Simpan Draft'
        }}</Button>
        <Button type="button" class="h-13 px-5 text-base" :disabled="!!saving" @click="save('published')">{{
          saving === 'published' ? 'Menerbitkan…' : 'Terbitkan pengumuman'
        }}</Button>
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
