<script setup lang="ts">
import { CircleAlert, CircleCheck, Lock, Eye, EyeClosed } from '@lucide/vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { User } from '#shared/types'

definePageMeta({ layout: false })
useHead({ title: 'Masuk · Panel Admin' })

const route = useRoute()
const { refresh } = useSession()
// Demo buttons for the client demo; off with NUXT_PUBLIC_DEMO_LOGIN=false.
const demoLogin = useRuntimeConfig().public.demoLogin
const email = ref('')
const password = ref('')
const showPw = ref(false)
const loading = ref(false)
const fieldErr = ref<{ email?: string; password?: string }>({})
const state = ref<'idle' | 'error' | 'locked'>('idle')
const remaining = ref(0)
const lockedUntil = ref<string | null>(null)
const lockUntil = computed(() => {
  const d = new Date(lockedUntil.value ?? Date.now() + 15 * 60000)
  return `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`
})

async function submit() {
  fieldErr.value = {}
  if (!email.value.trim()) fieldErr.value.email = 'Isian ini wajib diisi.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) fieldErr.value.email = 'Format email belum benar. Contoh: nama@rs-bethesda.test'
  if (!password.value) fieldErr.value.password = 'Isian ini wajib diisi.'
  if (fieldErr.value.email || fieldErr.value.password) return

  loading.value = true
  let signedIn: User
  try {
    signedIn = await $fetch<User>('/api/auth/login', { method: 'POST', body: { email: email.value, password: password.value } })
  } catch (e: any) {
    if (e?.statusCode === 423) {
      state.value = 'locked'
      lockedUntil.value = e?.data?.data?.until ?? null
    } else {
      state.value = 'error'
      remaining.value = e?.data?.data?.remaining ?? 0
    }
    loading.value = false
    return
  }
  // Signed in. A temporary password must be changed first. Otherwise only return to a page inside the
  // admin panel; anything else (another site, a broken link) goes home.
  await refresh()
  await navigateTo(signedIn.mustChangePassword ? '/admin/change-password' : adminReturnPath(route.query.returnTo))
  loading.value = false
}

function demo(addr: string) {
  email.value = addr
  password.value = 'demo123'
  submit()
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-secondary px-4 py-12">
    <main class="w-full max-w-md rounded-xl border bg-background p-8 shadow-sm">
      <div class="mb-6 flex items-center gap-2.5">
        <img src="/brand/logo.png" alt="RS Bethesda Yogyakarta" width="194" height="44" class="block h-11 w-auto" />
        <!-- <span class="text-sm font-semibold text-muted-foreground">Panel Admin</span> -->
      </div>
      <h1 class="text-2xl font-semibold tracking-tight">Masuk</h1>
      <p class="mt-1.5 mb-5 text-sm text-muted-foreground">Kelola poster yang muncul saat kartu NFC diketuk.</p>

      <Alert v-if="route.query.loggedOut && state === 'idle'" class="mb-5">
        <CircleCheck class="size-4" />
        <AlertDescription>Anda sudah keluar. Sampai jumpa!</AlertDescription>
      </Alert>
      <Alert v-if="state === 'error'" variant="destructive" class="mb-5" role="alert">
        <CircleAlert class="size-4" />
        <AlertTitle>Email atau kata sandi salah</AlertTitle>
        <AlertDescription>Periksa kembali, lalu coba lagi. Sisa percobaan: {{ remaining }}.</AlertDescription>
      </Alert>
      <Alert v-if="state === 'locked'" variant="destructive" class="mb-5" role="alert">
        <Lock class="size-4" />
        <AlertTitle>Akun terkunci sementara</AlertTitle>
        <AlertDescription
          >Terlalu banyak percobaan gagal (5 kali). Demi keamanan, akun dikunci 15 menit (sampai pukul {{ lockUntil }}). Hubungi Super Admin
          bila perlu dibuka sekarang.</AlertDescription
        >
      </Alert>

      <form novalidate class="flex flex-col gap-4" @submit.prevent="submit">
        <div class="flex flex-col gap-1.5">
          <Label for="email">Email</Label>
          <Input
            id="email"
            v-model="email"
            type="email"
            autocomplete="username"
            class="h-11"
            :disabled="state === 'locked'"
            :aria-invalid="!!fieldErr.email"
            aria-describedby="email-err"
          />
          <p v-if="fieldErr.email" id="email-err" class="text-sm font-medium text-destructive">{{ fieldErr.email }}</p>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="pw">Kata sandi</Label>
          <div class="relative">
            <Input
              id="pw"
              v-model="password"
              :type="showPw ? 'text' : 'password'"
              autocomplete="current-password"
              class="h-11 pr-28"
              :disabled="state === 'locked'"
              :aria-invalid="!!fieldErr.password"
              aria-describedby="pw-err"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              class="absolute top-1.5 right-1.5"
              :aria-pressed="showPw"
              :disabled="state === 'locked'"
              @click="showPw = !showPw"
            >
              <Eye class="size-5" v-if="!showPw" />
              <EyeClosed class="size-5" v-else />
            </Button>
          </div>
          <p v-if="fieldErr.password" id="pw-err" class="text-sm font-medium text-destructive">{{ fieldErr.password }}</p>
        </div>
        <Button type="submit" class="mt-1 h-11" :disabled="loading || state === 'locked'">{{ loading ? 'Memeriksa…' : 'Masuk' }}</Button>
        <p class="text-center text-xs text-muted-foreground">
          Lupa kata sandi? Hubungi Super Admin. Sesi berakhir setelah 30 menit tidak aktif.
        </p>
      </form>

      <div v-if="demoLogin" class="mt-6 rounded-lg border border-dashed bg-secondary p-4 text-sm">
        <b>Akun demo (data dummy)</b>
        <div class="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" class="h-9" @click="demo('admin@gmail.com')">Super Admin</Button>
        </div>
        <p class="mt-2 text-xs text-muted-foreground">Kata sandi akun demo: demo123.</p>
      </div>
    </main>
  </div>
</template>
