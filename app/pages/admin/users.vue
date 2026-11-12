<script setup lang="ts">
import { Check, Copy, Plus } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Role, User } from '#shared/types'
import { ROLE_LABEL, USER_STATUS } from '#shared/constants'
import { fmtDateTime } from '#shared/utils/format'

definePageMeta({ layout: 'admin', middleware: 'auth', title: 'Pengguna', superOnly: true })

const { user: me } = useSession()
const { data, status, refresh } = useFetch<User[]>('/api/users', { server: false })
const ROLES = Object.keys(ROLE_LABEL) as Role[]
const ROLE_HELP: Record<Role, string> = {
  staff: 'Mengunggah poster, membuat pengumuman, menyusun halaman, dan memetakan kartu NFC.',
  super: 'Semua menu, ditambah Pengguna, Audit Log, dan Pengaturan.',
}

// ---- Create --------------------------------------------------------------
const showNew = ref(false)
const form = reactive({ name: '', email: '', role: 'staff' as Role })
const { errors, submit } = useFieldErrors()
async function create() {
  const res = await submit(() => $fetch<{ user: User; tempPassword: string }>('/api/users', { method: 'POST', body: form }))
  if (!res) return
  showNew.value = false
  await refresh()
  issued.value = { title: `Akun ${res.user.name} dibuat`, name: res.user.name, password: res.tempPassword }
  Object.assign(form, { name: '', email: '', role: 'staff' })
}

// ---- Temporary password: shown once, in a dialog that stays until closed --
const issued = ref<{ title: string; name: string; password: string } | null>(null)
const noted = ref(false)
const copied = ref(false)
const issuedOpen = computed({
  get: () => !!issued.value,
  set: v => {
    if (!v && noted.value) closeIssued()
  },
})
function closeIssued() {
  issued.value = null
  noted.value = false
  copied.value = false
}
async function copyPassword() {
  try {
    await navigator.clipboard.writeText(issued.value?.password ?? '')
    copied.value = true
    noted.value = true
  } catch {
    toast.error('Browser tidak mengizinkan menyalin. Pilih teksnya lalu tekan Ctrl+C.')
  }
}

// ---- Role / status / reset (all confirmed first) -------------------------
type Pending = { user: User; kind: 'role'; role: Role } | { user: User; kind: 'status' | 'reset' }
const pending = ref<Pending | null>(null)
const pendingOpen = computed({
  get: () => !!pending.value,
  set: v => {
    if (!v) pending.value = null
  },
})

const dialog = computed(() => {
  const p = pending.value
  if (!p) return { title: '', body: '', action: '', destructive: false }
  if (p.kind === 'role')
    return {
      title: `Ubah peran ${p.user.name}?`,
      body: `Peran berubah dari ${ROLE_LABEL[p.user.role]} menjadi ${ROLE_LABEL[p.role]}. Ia perlu masuk ulang, dan menu yang terlihat ikut berubah.`,
      action: 'Ya, ubah peran',
      destructive: false,
    }
  if (p.kind === 'reset')
    return {
      title: `Reset kata sandi ${p.user.name}?`,
      body: 'Kata sandi lama langsung tidak berlaku dan ia keluar dari semua sesi. Akun yang terkunci juga akan dibuka.',
      action: 'Ya, reset',
      destructive: false,
    }
  return p.user.status === 'inactive'
    ? { title: `Aktifkan ${p.user.name}?`, body: 'Ia bisa masuk lagi ke Panel Admin.', action: 'Ya, aktifkan', destructive: false }
    : {
        title: `Nonaktifkan ${p.user.name}?`,
        body: 'Ia langsung keluar dan tidak bisa masuk lagi ke Panel Admin. Konten yang pernah ia buat tetap ada.',
        action: 'Ya, nonaktifkan',
        destructive: true,
      }
})

async function apply() {
  const p = pending.value
  if (!p) return
  const body =
    p.kind === 'role'
      ? { role: p.role }
      : p.kind === 'reset'
        ? { resetPassword: true }
        : { status: p.user.status === 'inactive' ? 'active' : 'inactive' }
  const res = await submit(() => $fetch<{ user: User; tempPassword?: string }>(`/api/users/${p.user.id}`, { method: 'PATCH', body }))
  if (!res) return
  await refresh()
  if (p.kind === 'reset' && res.tempPassword)
    issued.value = { title: `Kata sandi ${p.user.name} direset`, name: p.user.name, password: res.tempPassword }
  else if (p.kind === 'role') toast.success(`Peran ${p.user.name} kini ${ROLE_LABEL[p.role]}.`)
  else toast.success(`${p.user.name} ${res.user.status === 'inactive' ? 'dinonaktifkan' : 'diaktifkan kembali'}.`)
}

function onRoleChange(u: User, e: Event) {
  const select = e.target as HTMLSelectElement
  pending.value = { user: u, kind: 'role', role: select.value as Role }
  select.value = u.role // only changes after confirmation
}
</script>

<template>
  <div>
    <AdminPageHeader title="Pengguna" description="Kelola siapa yang bisa masuk ke Panel Admin dan apa perannya.">
      <Button class="h-11" @click="showNew = true"> <Plus class="size-4" />Tambah pengguna </Button>
    </AdminPageHeader>

    <Card class="overflow-hidden py-0">
      <AdminDataState :status="status" :empty="!data?.length" empty-title="Belum ada pengguna" @retry="refresh()">
        <Table class="min-w-[760px]">
          <TableHeader>
            <TableRow>
              <TableHead class="pl-4">Nama</TableHead>
              <TableHead>Peran</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Terakhir masuk</TableHead>
              <TableHead class="pr-4 text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="u in data" :key="u.id">
              <TableCell class="pl-4">
                <div class="flex items-center gap-2.5">
                  <span aria-hidden="true" class="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">{{
                    initials(u.name)
                  }}</span>
                  <div>
                    <b class="font-medium">{{ u.name }}</b> <span v-if="u.id === me?.id" class="text-xs text-muted-foreground">(Anda)</span>
                    <div class="text-xs text-muted-foreground">{{ u.email }}</div>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <AdminNativeSelect
                  :model-value="u.role"
                  :aria-label="`Peran ${u.name}`"
                  :disabled="u.id === me?.id"
                  class="h-10 text-[13px]"
                  @change="onRoleChange(u, $event)"
                >
                  <option v-for="r in ROLES" :key="r" :value="r">{{ ROLE_LABEL[r] }}</option>
                </AdminNativeSelect>
              </TableCell>
              <TableCell>
                <AdminStatusPill :tone="USER_STATUS[u.status].tone">{{ USER_STATUS[u.status].label }}</AdminStatusPill>
              </TableCell>
              <TableCell class="text-[13px] text-muted-foreground">{{ fmtDateTime(u.lastLogin) }}</TableCell>
              <TableCell class="pr-4 text-right whitespace-nowrap">
                <Button variant="outline" size="sm" class="h-9" :disabled="u.id === me?.id" @click="pending = { user: u, kind: 'reset' }">{{
                  u.status === 'locked' ? 'Buka & reset sandi' : 'Reset sandi'
                }}</Button>
                <Button
                  variant="outline"
                  size="sm"
                  :class="[
                    'ml-1 h-9',
                    u.status === 'inactive' ? 'text-green-700 hover:text-green-700' : 'text-destructive hover:text-destructive',
                  ]"
                  :disabled="u.id === me?.id"
                  @click="pending = { user: u, kind: 'status' }"
                >
                  {{ u.status === 'inactive' ? 'Aktifkan' : 'Nonaktifkan' }}
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </AdminDataState>
    </Card>
    <p class="mt-3 text-[13px] text-muted-foreground">Anda tidak bisa menonaktifkan atau mengubah peran akun Anda sendiri.</p>

    <Dialog v-model:open="showNew">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah pengguna baru</DialogTitle>
          <DialogDescription>Kata sandi sementara dibuat otomatis setelah disimpan.</DialogDescription>
        </DialogHeader>
        <div class="flex flex-col gap-4">
          <AdminTextField id="u-name" v-model="form.name" label="Nama lengkap" placeholder="Contoh: Dewi Lestari" :error="errors.name" />
          <AdminTextField id="u-email" v-model="form.email" type="email" label="Email" :error="errors.email" />
          <fieldset class="flex flex-col gap-2">
            <legend class="mb-2 text-sm font-medium">Peran</legend>
            <label
              v-for="r in ROLES"
              :key="r"
              :class="['flex gap-2.5 rounded-lg p-3 text-[13px] leading-snug', form.role === r ? 'border-2 border-primary' : 'border']"
            >
              <input v-model="form.role" type="radio" :value="r" class="mt-0.5 size-[18px] accent-primary" />
              <span
                ><b class="font-semibold">{{ ROLE_LABEL[r] }}</b
                ><br /><span class="text-muted-foreground">{{ ROLE_HELP[r] }}</span></span
              >
            </label>
          </fieldset>
        </div>
        <DialogFooter
          ><Button variant="outline" class="h-11" @click="showNew = false">Batal</Button
          ><Button class="h-11" @click="create">Buat pengguna</Button></DialogFooter
        >
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="issuedOpen">
      <DialogContent
        :show-close-button="false"
        @escape-key-down="!noted && $event.preventDefault()"
        @pointer-down-outside="$event.preventDefault()"
      >
        <DialogHeader>
          <DialogTitle>{{ issued?.title }}</DialogTitle>
          <DialogDescription
            >Kata sandi sementara ini hanya ditampilkan sekali. Berikan langsung kepada {{ issued?.name }}, jangan lewat grup chat. Ia wajib
            menggantinya saat pertama masuk.</DialogDescription
          >
        </DialogHeader>
        <div class="flex flex-col gap-1.5">
          <label for="temp-pw" class="text-sm font-medium">Kata sandi sementara</label>
          <div class="flex gap-2">
            <input
              id="temp-pw"
              readonly
              :value="issued?.password"
              class="h-12 min-w-0 grow rounded-md border bg-muted px-3.5 font-mono text-[17px] tracking-wider"
              @focus="($event.target as HTMLInputElement).select()"
            />
            <Button variant="outline" :class="['h-12', copied && 'text-green-700 hover:text-green-700']" @click="copyPassword">
              <component :is="copied ? Check : Copy" class="size-4" />{{ copied ? 'Tersalin' : 'Salin' }}
            </Button>
          </div>
          <span role="status" class="text-[13px] text-muted-foreground">{{
            copied ? 'Tersalin ke papan klip.' : 'Dialog ini tetap terbuka sampai Anda menutupnya.'
          }}</span>
        </div>
        <label class="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm">
          <input v-model="noted" type="checkbox" class="size-[18px] accent-primary" />Saya sudah mencatat atau menyalin kata sandi ini
        </label>
        <DialogFooter><Button class="h-11" :disabled="!noted" @click="closeIssued">Selesai</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <AdminConfirmDialog
      v-model:open="pendingOpen"
      :title="dialog.title"
      :description="dialog.body"
      :confirm-label="dialog.action"
      :destructive="dialog.destructive"
      @confirm="apply"
    />
  </div>
</template>
