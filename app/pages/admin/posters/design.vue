<script setup lang="ts">
// Canvas editor page: pick a starting design, edit it, then return to the poster
// form with the exported image (see useDesignDraft for the hand-off).
import { toast } from 'vue-sonner'
import { History } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import type { PosterDesign } from '#shared/design'
import type { Settings } from '#shared/types'
import { fmtDateTime } from '#shared/utils/format'

definePageMeta({ layout: 'admin', middleware: ['auth', 'canvas-editor'], title: 'Desain poster' })

const { isSuper } = useSession()
const { data: settings, status } = useFetch<Settings>('/api/settings', { key: 'settings', server: false })
const draft = useDesignDraft()
const backTo = computed(() => (draft.value?.form ? draftReturnPath(draft.value) : '/admin/posters/new'))

const design = ref<PosterDesign | null>(draft.value?.design ? structuredClone(toRaw(draft.value.design)) : null)
const autosaved = import.meta.client ? designAutosave.read() : null

// Built once so the thumbnails keep stable element ids.
const starters = STARTERS.map(s => ({ ...s, preview: s.make() }))

function start(d: PosterDesign) {
  design.value = d
}

const editor = ref<{ changed: boolean }>()
const finishing = ref(false)
let done = false

onBeforeRouteLeave(() => {
  if (
    !done &&
    editor.value?.changed &&
    !window.confirm('Tinggalkan editor? Desain tetap tersimpan di browser ini dan bisa dilanjutkan nanti.')
  )
    return false
})

async function onFinish(d: PosterDesign, image: Blob) {
  finishing.value = true
  try {
    const file = await uploadFile(image, `Desain poster.${image.type === 'image/webp' ? 'webp' : 'png'}`)
    draft.value = { ...draft.value, design: d, file }
    designAutosave.clear()
    done = true
    await navigateTo(draftReturnPath(draft.value))
  } catch (e) {
    toast.error((e as Error).message)
  } finally {
    finishing.value = false
  }
}
</script>

<template>
  <div>
    <AdminPageHeader
      :title="design ? 'Desain poster' : 'Mulai dari mana?'"
      :description="
        design ? undefined : 'Pilih contoh yang paling mirip, lalu ganti teks dan fotonya. Logo dan kotak Informasi RS sudah terpasang.'
      "
      :back="{ to: backTo, label: draft?.form ? 'Kembali ke formulir poster' : 'Kembali ke pilihan' }"
    />

    <AdminTableSkeleton v-if="status === 'pending' || !settings" :rows="6" />

    <DesignEditor
      v-else-if="design"
      ref="editor"
      :initial="design"
      :brand="settings"
      :can-open-settings="isSuper"
      :finishing="finishing"
      @finish="onFinish"
    />

    <div v-else class="flex flex-col gap-6">
      <button
        v-if="autosaved"
        type="button"
        class="flex flex-wrap items-center gap-4 rounded-2xl border-2 border-zinc-900 bg-background p-5 text-left hover:shadow-lg"
        @click="start(autosaved.design)"
      >
        <History class="size-7 shrink-0" aria-hidden="true" />
        <span class="grow">
          <b class="block text-lg font-semibold">Lanjutkan desain terakhir</b>
          <span class="text-[15px] text-muted-foreground">Belum selesai · disimpan {{ fmtDateTime(autosaved.savedAt) }}</span>
        </span>
        <span class="inline-flex min-h-12 items-center rounded-xl bg-zinc-900 px-5 text-base font-semibold text-white">Lanjutkan</span>
      </button>

      <section aria-labelledby="starters" class="flex flex-col gap-4">
        <h2 id="starters" class="text-lg font-semibold">Contoh desain</h2>
        <div class="grid grid-cols-[repeat(auto-fill,minmax(236px,1fr))] gap-5">
          <button
            v-for="s in starters"
            :key="s.id"
            type="button"
            class="flex flex-col gap-3 rounded-2xl border bg-background p-3 text-left transition hover:border-zinc-900 hover:shadow-lg"
            @click="start(s.make())"
          >
            <DesignCanvas :design="s.preview" :brand="settings" :scale="0.2" readonly class="overflow-hidden rounded-lg" />
            <span>
              <b class="block text-base font-semibold">{{ s.name }}</b>
              <span class="text-sm text-muted-foreground">{{ s.description }}</span>
            </span>
          </button>
        </div>
        <p class="text-[15px] text-muted-foreground">
          Ukuran poster: HP tegak 4:5 (1080 × 1350). Ukuran Story 9:16 dan persegi menyusul di V2.
        </p>
      </section>
      <div>
        <Button as-child variant="outline" class="h-12 text-base"
          ><NuxtLink to="/admin/posters/upload">Saya punya file poster jadi</NuxtLink></Button
        >
      </div>
    </div>
  </div>
</template>
