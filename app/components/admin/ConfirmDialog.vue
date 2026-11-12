<script setup lang="ts">
// Plain-language confirmation for actions with consequences (archive, deactivate, publish…).
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const open = defineModel<boolean>('open', { required: true })
defineProps<{ title: string; description: string; confirmLabel: string; destructive?: boolean }>()
const emit = defineEmits<{ confirm: [] }>()
function confirm() {
  emit('confirm')
  open.value = false
}
</script>

<template>
  <AlertDialog v-model:open="open">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ title }}</AlertDialogTitle>
        <AlertDialogDescription>{{ description }}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel class="h-11">Batal</AlertDialogCancel>
        <!-- Not AlertDialogAction: it closes before its click handler runs, and callers that clear their
             pending item on close would then confirm nothing. Confirm first, then close. -->
        <Button :class="['h-11', destructive && 'bg-destructive text-white hover:bg-destructive/90']" @click="confirm">{{
          confirmLabel
        }}</Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
