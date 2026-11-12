<script setup lang="ts">
// Change your own password. Shown right after signing in with a temporary password,
// and the only admin page open until it is changed.
import { KeyRound } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import type { User } from '#shared/types'

definePageMeta({ layout: false, middleware: 'auth' })
useHead({ title: 'Ganti kata sandi · Panel Admin' })

const MIN = 10
const { user, refresh, logout } = useSession()
const form = reactive({ currentPassword: '', newPassword: '', repeat: '' })
const { errors, submit } = useFieldErrors()
const saving = ref(false)

async function save() {
  // Checked here first so a typo in the repeat field doesn't cost a request.
  if (form.newPassword.length >= MIN && form.repeat !== form.newPassword) {
    errors.value = { repeat: 'Belum sama dengan kata sandi baru.' }
    return
  }
  saving.value = true
  const res = await submit(() =>
    $fetch<User>('/api/auth/password', {
      method: 'POST',
      body: { currentPassword: form.currentPassword, newPassword: form.newPassword },
    }),
  )
  saving.value = false
  if (!res) return
  await refresh()
  toast.success('Kata sandi sudah diganti.')
  await navigateTo('/admin')
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-secondary px-4 py-12">
    <main class="w-full max-w-md rounded-xl border bg-background p-8 shadow-sm">
      <div class="mb-6 flex items-center gap-2.5">
        <img src="/brand/logo.png" alt="RS Bethesda Yogyakarta" width="194" height="44" class="block h-11 w-auto" />
      </div>
      <h1 class="flex items-center gap-2 text-2xl font-semibold tracking-tight">
        <KeyRound class="size-6" aria-hidden="true" />Ganti kata sandi
      </h1>
      <p class="mt-1.5 mb-5 text-sm text-muted-foreground">
        <template v-if="user?.mustChangePassword"
          >Anda masuk dengan kata sandi sementara. Buat kata sandi baru sebelum melanjutkan.</template
        >
        <template v-else>Buat kata sandi baru untuk akun Anda.</template>
      </p>

      <form novalidate class="flex flex-col gap-4" @submit.prevent="save">
        <AdminTextField
          id="currentPassword"
          v-model="form.currentPassword"
          type="password"
          label="Kata sandi saat ini"
          required
          :error="errors.currentPassword"
        />
        <AdminTextField
          id="newPassword"
          v-model="form.newPassword"
          type="password"
          label="Kata sandi baru"
          required
          :hint="`Minimal ${MIN} karakter. Jangan pakai kata sandi sementara.`"
          :error="errors.newPassword"
        />
        <AdminTextField id="repeat" v-model="form.repeat" type="password" label="Ulangi kata sandi baru" required :error="errors.repeat" />
        <Button type="submit" class="mt-1 h-11" :disabled="saving">{{ saving ? 'Menyimpan…' : 'Simpan kata sandi' }}</Button>
        <Button type="button" variant="ghost" class="h-11" @click="logout">Keluar</Button>
      </form>
    </main>
  </div>
</template>
