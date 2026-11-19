<script setup lang="ts">
// "Marketing penanggung jawab": who handles a poster, page or card. Lists active Marketing users;
// an owner who has since been deactivated stays selectable on items they already own.
const model = defineModel<string | null>({ default: null })
const props = withDefaults(
  defineProps<{
    id: string
    label?: string
    hint?: string
    error?: string
    /** Name to show for the current owner when they are no longer an active Marketing user. */
    currentName?: string | null
    large?: boolean
  }>(),
  {
    label: 'Marketing penanggung jawab',
    hint: undefined,
    error: undefined,
    currentName: undefined,
    large: false,
  },
)
const { marketers } = useMarketingUsers()
const missingCurrent = computed(
  () => !!model.value && !marketers.value.some(m => m.id === model.value),
)
</script>

<template>
  <div class="flex flex-col gap-1.5">
    <label :for="id" :class="large ? 'text-[17px] font-semibold' : 'text-sm font-medium'">
      {{ label }}
    </label>
    <AdminNativeSelect
      :id="id"
      v-model="model"
      :class="large ? 'h-13 text-[17px]' : ''"
      :aria-invalid="!!error"
      :aria-describedby="error ? `${id}-err` : hint ? `${id}-hint` : undefined"
    >
      <option :value="null">Belum ditentukan</option>
      <option v-if="missingCurrent" :value="model">
        {{ props.currentName ?? 'Pengguna nonaktif' }} (nonaktif)
      </option>
      <option v-for="m in marketers" :key="m.id" :value="m.id">{{ m.name }}</option>
    </AdminNativeSelect>
    <span
      v-if="hint && !error"
      :id="`${id}-hint`"
      :class="large ? 'text-[15px] text-muted-foreground' : 'text-xs text-muted-foreground'"
    >
      {{ hint }}
    </span>
    <p v-if="error" :id="`${id}-err`" class="text-sm font-medium text-destructive">{{ error }}</p>
  </div>
</template>
