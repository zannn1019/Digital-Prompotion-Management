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
    :aria-label="variant === 'icon' ? CONTACT_BUTTON[type] : text"
    rel="noopener"
    :class="[
      'flex items-center justify-center gap-2.5 font-bold no-underline transition active:scale-[.97] active:brightness-90 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-brand-navy',
      variant === 'icon'
        ? 'size-14 shrink-0 rounded-[14px] border-2 border-slate-300 bg-white text-brand-navy'
        : variant === 'primary'
          ? [
              'contact-primary min-h-14 grow rounded-[14px] px-5 text-[clamp(0.9375rem,3.8vw,1.0625rem)] text-white',
              type === 'wa' ? 'bg-wa' : 'bg-brand-navy',
            ]
          : 'min-h-12 rounded-xl border-2 border-slate-300 bg-white px-4 text-[clamp(0.8125rem,3.4vw,0.9375rem)] text-brand-navy',
    ]"
    @click="onClick"
  >
    <component :is="ICON[type]" class="size-[22px] shrink-0" aria-hidden="true" />
    <template v-if="variant !== 'icon'">
      <span v-if="opening">Membuka…</span>
      <template v-else>
        <span class="contact-label-full">{{ text }}</span>
        <span class="contact-label-short">{{ type === 'wa' ? 'WhatsApp' : text }}</span>
      </template>
    </template>
  </a>
</template>

<style scoped>
.contact-label-short {
  display: none;
}

@container (max-width: 360px) {
  .contact-primary .contact-label-full {
    display: none;
  }

  .contact-primary .contact-label-short {
    display: inline;
  }
}
</style>
