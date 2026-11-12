<script setup lang="ts">
// Drag-and-drop or "choose file" area. Checks type and size before uploading;
// the server checks again from the file's real bytes.
import { CircleCheck, Upload } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { UPLOAD } from '#shared/constants'
import { fmtBytes } from '#shared/utils/format'
import type { UploadedFile } from '~/utils/upload'

const file = defineModel<UploadedFile | null>({ required: true })
defineProps<{ error?: string }>()

const input = ref<HTMLInputElement>()
const over = ref(false)
function onDrop(e: DragEvent) {
  over.value = false
  upload(e.dataTransfer?.files?.[0])
}
const uploading = ref(false)
const localError = ref('')

async function upload(f: File | undefined) {
  localError.value = ''
  if (!f) return
  localError.value = checkUpload(f)
  if (localError.value) return
  uploading.value = true
  try {
    file.value = await uploadFile(f, f.name)
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
    <div
      :class="[
        'flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-7 text-center transition',
        over ? 'border-primary bg-muted' : localError || error ? 'border-destructive bg-red-50' : 'border-zinc-400',
      ]"
      @dragover.prevent="over = true"
      @dragleave="over = false"
      @drop.prevent="onDrop"
    >
      <Upload class="size-8 text-zinc-700" aria-hidden="true" />
      <b class="text-lg font-semibold">Seret file ke sini</b>
      <span class="text-[15px] text-muted-foreground">PNG, JPG, WebP, atau PDF · maksimal 5 MB</span>
      <input
        ref="input"
        type="file"
        class="sr-only"
        :accept="UPLOAD.accept"
        aria-label="Pilih file poster"
        @change="upload(($event.target as HTMLInputElement).files?.[0])"
      />
      <Button type="button" class="mt-1 h-12 px-5 text-base" :disabled="uploading" @click="input?.click()">{{
        uploading ? 'Mengunggah…' : 'Pilih file dari laptop'
      }}</Button>
    </div>
    <p v-if="localError || error" class="text-[15px] font-semibold text-destructive" role="alert">{{ localError || error }}</p>
    <div v-if="file" class="flex items-center gap-3 rounded-xl border p-3 text-[15px]">
      <img :src="file.previewUrl ?? file.url" alt="" class="h-14 w-11 rounded object-cover" />
      <div class="min-w-0 grow">
        <b class="block truncate font-semibold">{{ file.name }}</b>
        <span class="text-green-700"
          ><CircleCheck class="inline size-4" aria-hidden="true" /> {{ fmtBytes(file.size) }} · siap dipakai</span
        >
      </div>
      <Button type="button" variant="outline" class="h-11" @click="input?.click()">Ganti file</Button>
    </div>
  </div>
</template>
