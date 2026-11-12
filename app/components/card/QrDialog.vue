<script setup lang="ts">
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const open = defineModel<boolean>('open', { required: true })
defineProps<{ code: string; url: string }>()
const { copy } = useCopy()
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent>
      <DialogHeader>
        <DialogTitle>QR cadangan — {{ code }}</DialogTitle>
        <DialogDescription
          >Cetak dan tempel di dekat kartu untuk HP yang tidak mendukung NFC. QR membuka alamat yang sama dengan kartu.</DialogDescription
        >
      </DialogHeader>
      <div class="flex flex-col items-center gap-2 rounded-xl border p-5">
        <AdminQrPlaceholder :seed="code" :label="`Contoh kode QR untuk ${code}`" />
        <span class="text-xs text-muted-foreground">Gambar QR ini contoh visual, belum bisa dipindai.</span>
      </div>
      <div class="flex items-center gap-2 rounded-lg border bg-secondary py-2 pr-2 pl-3 font-mono text-[13px] break-all">
        <span class="grow">{{ url }}</span>
        <Button variant="outline" size="sm" class="h-9 font-sans" @click="copy(url)">Salin</Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
