<script setup lang="ts">
// Tick which contact buttons a poster shows. Order is fixed so posters look consistent;
// the first ticked one becomes the big button. The brochure has its own field.
import type { ContactButton } from '#shared/types'
import { CONTACT_BUTTON, CONTACT_BUTTON_ORDER } from '#shared/constants'

const selected = defineModel<ContactButton[]>({ required: true })

function toggle(k: ContactButton) {
  const next = selected.value.includes(k) ? selected.value.filter(b => b !== k) : [...selected.value, k]
  selected.value = CONTACTS.filter(b => next.includes(b))
}
const CONTACTS = CONTACT_BUTTON_ORDER.filter(b => b !== 'doc')
</script>

<template>
  <fieldset class="flex flex-col gap-2">
    <legend class="sr-only">Tombol kontak</legend>
    <span class="text-[15px] text-muted-foreground"
      >Tombol pertama yang dicentang jadi tombol besar di bawah layar HP. Nomor dan alamat diambil dari Pengaturan.</span
    >
    <label
      v-for="k in CONTACTS"
      :key="k"
      :class="[
        'flex min-h-13 cursor-pointer items-center gap-3 rounded-xl px-4 text-[17px]',
        selected.includes(k) ? 'border-2 border-primary bg-secondary' : 'border',
      ]"
    >
      <input type="checkbox" class="size-5 accent-primary" :checked="selected.includes(k)" @change="toggle(k)" />
      {{ CONTACT_BUTTON[k] }}
    </label>
  </fieldset>
</template>
