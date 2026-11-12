<script setup lang="ts">
// Optional brochure button: on/off, plus an optional poster-specific PDF.
// Without a PDF here, the button opens the default brochure from Pengaturan.
import { FileText } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { fmtBytes } from '#shared/utils/format'
import type { UploadedFile } from '~/utils/upload'

const show = defineModel<boolean>('show', { required: true })
const file = defineModel<UploadedFile | null>('file', { required: true })
defineProps<{ error?: string }>()

const input = ref<HTMLInputElement>()
const uploading = ref(false)
const localError = ref('')

async function upload(f: File | undefined) {
  localError.value = f ? checkUpload(f, ['application/pdf']) : ''
  if (!f || localError.value) return
  uploading.value = true
  try {
    file.value = await uploadFile(f, f.name)
    show.value = true
  } catch (e) {
    localError.value = (e as Error).message
  } finally {
    uploading.value = false
    if (input.value) input.value.value = ''
  }
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <label class="flex min-h-12 cursor-pointer items-center gap-3 text-[17px]">
      <input v-model="show" type="checkbox" class="size-5 accent-primary" />Tampilkan tombol “Unduh brosur (PDF)”
    </label>
    <template v-if="show">
      <div v-if="file" class="flex flex-wrap items-center gap-3 rounded-xl border p-3 text-[15px]">
        <span class="flex h-12 w-10 items-center justify-center rounded-md bg-red-50 text-destructive"
          ><FileText class="size-5" aria-hidden="true"
        /></span>
        <div class="min-w-0 grow">
          <b class="block truncate font-semibold">{{ file.name }}</b
          ><span class="text-muted-foreground">{{ fmtBytes(file.size) }} · brosur khusus poster ini</span>
        </div>
        <Button type="button" variant="outline" class="h-11 text-destructive" @click="file = null">Hapus</Button>
      </div>
      <div v-else class="flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-3 text-[15px] text-muted-foreground">
        <span class="grow">Memakai brosur default dari Pengaturan. Unggah PDF bila poster ini punya brosur sendiri.</span>
        <input
          ref="input"
          type="file"
          class="sr-only"
          accept="application/pdf"
          aria-label="Pilih file brosur PDF"
          @change="upload(($event.target as HTMLInputElement).files?.[0])"
        />
        <Button type="button" variant="outline" class="h-11" :disabled="uploading" @click="input?.click()">{{
          uploading ? 'Mengunggah…' : 'Pilih file PDF'
        }}</Button>
      </div>
      <p v-if="localError || error" class="text-[15px] font-semibold text-destructive" role="alert">{{ localError || error }}</p>
    </template>
  </div>
</template>
