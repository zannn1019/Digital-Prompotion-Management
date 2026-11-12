<script setup lang="ts">
// Create an empty page (Draft). Posters are added and the page is published afterwards.
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Page } from '#shared/types'

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ created: [page: Page] }>()

const name = ref('')
const saving = ref(false)
const { errors, submit } = useFieldErrors()
watch(open, o => {
  if (o) {
    name.value = ''
    errors.value = {}
  }
})

async function create() {
  saving.value = true
  const page = await submit(() => $fetch<Page>('/api/pages', { method: 'POST', body: { name: name.value } }))
  saving.value = false
  if (!page) return
  toast.success(`Halaman “${page.name}” dibuat sebagai Draft. Tambahkan poster, lalu terbitkan.`)
  open.value = false
  emit('created', page)
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Buat halaman baru</DialogTitle>
        <DialogDescription
          >Halaman adalah kumpulan poster yang dibuka oleh kartu NFC, misalnya satu halaman per perusahaan mitra atau per
          lokasi.</DialogDescription
        >
      </DialogHeader>
      <form class="flex flex-col gap-4" novalidate @submit.prevent="create">
        <AdminTextField
          id="pg-name"
          v-model="name"
          large
          required
          label="Nama halaman"
          :max="80"
          :error="errors.name"
          placeholder="Contoh: Poster PT Contoh Logam"
          hint="Hanya untuk tim, tidak tampil di halaman pengunjung."
        />
        <DialogFooter>
          <Button type="button" variant="outline" class="h-11" @click="open = false">Batal</Button>
          <Button type="submit" class="h-11" :disabled="saving">{{ saving ? 'Membuat…' : 'Buat halaman' }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
