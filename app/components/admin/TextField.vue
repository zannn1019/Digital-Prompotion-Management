<script setup lang="ts">
// Label + input/textarea + hint + inline error + optional character counter,
// wired with aria-invalid and aria-describedby. `large` is for the content-maker forms.
import { Input } from '@/components/ui/input'

const model = defineModel<string | number>()
const props = defineProps<{
  id: string
  label: string
  required?: boolean
  hint?: string
  error?: string
  max?: number
  type?: string
  rows?: number
  multiline?: boolean
  large?: boolean
  placeholder?: string
  /** id of a <datalist> with suggestions */
  list?: string
}>()

const length = computed(() => String(model.value ?? '').length)
const counterClass = computed(() => {
  if (!props.max) return ''
  if (length.value > props.max) return 'font-semibold text-destructive'
  if (length.value >= props.max * 0.9) return 'font-semibold text-amber-800'
  return 'text-muted-foreground'
})
const describedBy = computed(
  () => [props.error && `${props.id}-err`, props.hint && `${props.id}-hint`].filter(Boolean).join(' ') || undefined,
)
const invalid = computed(() => !!props.error || (!!props.max && length.value > props.max))
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <div class="flex justify-between gap-2">
      <label :for="id" :class="large ? 'text-[17px] font-semibold' : 'text-sm font-medium'">
        {{ label }} <span v-if="required" class="text-destructive" aria-hidden="true">*</span>
      </label>
      <span v-if="max" :class="['text-sm', counterClass]">{{ length }}/{{ max }}</span>
    </div>
    <textarea
      v-if="multiline"
      :id="id"
      v-model="model"
      :rows="rows ?? 3"
      :placeholder="placeholder"
      :aria-invalid="invalid"
      :aria-describedby="describedBy"
      :aria-required="required"
      :class="[
        'rounded-md border px-3.5 py-3 leading-relaxed outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive',
        large ? 'text-[17px]' : 'text-sm',
      ]"
    />
    <Input
      v-else
      :id="id"
      v-model="model"
      :type="type ?? 'text'"
      :placeholder="placeholder"
      :list="list"
      :aria-invalid="invalid"
      :aria-describedby="describedBy"
      :aria-required="required"
      :class="large ? 'h-13 text-[17px] md:text-[17px]' : 'h-11'"
    />
    <AdminFieldError :id="`${id}-err`" :message="error" />
    <span
      v-if="hint"
      :id="`${id}-hint`"
      :class="large ? 'text-[15px] leading-relaxed text-muted-foreground' : 'text-xs text-muted-foreground'"
      >{{ hint }}</span
    >
  </div>
</template>
