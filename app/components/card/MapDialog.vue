<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Page } from '#shared/types'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ count: number; pages: Page[]; initialPageId?: string | null }>()
const emit = defineEmits<{ confirm: [pageId: string | null] }>()

const pageId = ref('')
watch(open, o => {
  if (o) pageId.value = props.initialPageId ?? ''
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Petakan {{ count }} kartu ke halaman</DialogTitle>
        <DialogDescription
          >Kartu langsung menampilkan halaman ini saat diketuk berikutnya. Tidak perlu menulis ulang kartu.</DialogDescription
        >
      </DialogHeader>
      <div class="flex flex-col gap-1.5">
        <Label for="map-page">Halaman tujuan</Label>
        <AdminNativeSelect id="map-page" v-model="pageId">
          <option value="">Halaman umum (default)</option>
          <option v-for="p in pages.filter(p => !p.isDefault)" :key="p.id" :value="p.id">{{ p.name }}</option>
        </AdminNativeSelect>
      </div>
      <DialogFooter>
        <Button variant="outline" class="h-11" @click="open = false">Batal</Button>
        <Button class="h-11" @click="emit('confirm', pageId || null)">Petakan</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
