<script setup lang="ts">
// Contact button on the public poster (at least 48px), with a pressed/"Membuka…" state.
// primary: big filled button (WhatsApp green, others navy); outline: secondary; icon: square icon-only.
import { FileDown, Mail, MessageCircle, Phone } from '@lucide/vue'
import type { ContactButton } from '#shared/types'
import { CONTACT_BUTTON, CONTACT_CTA } from '#shared/constants'

const props = withDefaults(
  defineProps<{ type: ContactButton; href?: string; variant?: 'primary' | 'outline' | 'icon'; label?: string }>(),
  { href: undefined, variant: 'outline', label: undefined },
)
const ICON = { wa: MessageCircle, tel: Phone, email: Mail, doc: FileDown }
const opening = ref(false)
function onClick() {
  if (!props.href) return
  opening.value = true
  setTimeout(() => {
    opening.value = false
  }, 2500)
}
const text = computed(() => props.label ?? (props.variant === 'primary' ? CONTACT_CTA[props.type] : CONTACT_BUTTON[props.type]))
</script>

<template>
  <a
    :href="href"
    :aria-busy="opening"
    :aria-label="variant === 'icon' ? CONTACT_BUTTON[type] : undefined"
    rel="noopener"
    :class="[
      'flex items-center justify-center gap-2.5 font-bold no-underline transition active:scale-[.97] active:brightness-90 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-brand-navy',
      variant === 'icon'
        ? 'size-14 shrink-0 rounded-[14px] border-2 border-slate-300 bg-white text-brand-navy'
        : variant === 'primary'
          ? ['min-h-14 grow rounded-[14px] px-5 text-[17px] text-white', type === 'wa' ? 'bg-wa' : 'bg-brand-navy']
          : 'min-h-12 rounded-xl border-2 border-slate-300 bg-white px-4 text-[15px] text-brand-navy',
    ]"
    @click="onClick"
  >
    <component :is="ICON[type]" class="size-[22px] shrink-0" aria-hidden="true" />
    <template v-if="variant !== 'icon'">{{ opening ? 'Membuka…' : text }}</template>
  </a>
</template>
