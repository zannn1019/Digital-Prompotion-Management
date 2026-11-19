<script setup lang="ts">
import {
  Check,
  CheckCheck,
  Copy,
  FileText,
  Megaphone,
  Minus,
  Plus,
  ShieldCheck,
  TriangleAlert,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Component } from 'vue'
import type { Role, User } from '#shared/types'
import { ROLE_LABEL, USER_STATUS } from '#shared/constants'
import { fmtDateTime } from '#shared/utils/format'

definePageMeta({ layout: 'admin', middleware: 'auth', title: 'Pengguna', superOnly: true })

const { user: me } = useSession()
const { data, status, refresh } = useFetch<User[]>('/api/users', { server: false })
const ROLES = Object.keys(ROLE_LABEL) as Role[]
// New-user form: roles from least to most access, so the safest choice comes first.
const ROLE_PICK: { role: Role; icon: Component; summary: string }[] = [
  { role: 'staff', icon: FileText, summary: 'Membuat dan menyusun konten' },
  { role: 'marketing', icon: Megaphone, summary: 'Konten + penanggung jawab poster' },
  { role: 'approver', icon: CheckCheck, summary: 'Konten + menyetujui pengajuan' },
  { role: 'super', icon: ShieldCheck, summary: 'Akses penuh, termasuk pengguna' },
]
// The same list for every role, so the differences show at a glance. `no` explains a missing right.
const ROLE_CAPS: { text: string; roles: Role[]; no?: string }[] = [
  {
    text: 'Unggah poster, buat pengumuman, susun halaman, petakan kartu',
    roles: ['staff', 'marketing', 'approver', 'super'],
  },
  {
    text: 'Konten tayang tanpa menunggu persetujuan',
    roles: ['approver', 'super'],
    no: 'Perlu disetujui Approver',
  },
  { text: 'Menyetujui atau menolak pengajuan orang lain', roles: ['approver', 'super'] },
  {
    text: 'Jadi penanggung jawab poster; klik dan tap tampil per orang di Analitik',
    roles: ['marketing'],
  },
  { text: 'Kelola Pengguna, Audit Log, dan Pengaturan', roles: ['super'] },
]

// ---- Create --------------------------------------------------------------
const showNew = ref(false)
const form = reactive({ name: '', email: '', role: 'staff' as Role, wa: '', phone: '' })
const { errors, submit } = useFieldErrors()
// A second tap while saving would create the account twice (the second one fails on the email).
const creating = ref(false)
async function create() {
  if (creating.value) return
  creating.value = true
  const res = await submit(() =>
    $fetch<{ user: User; tempPassword: string }>('/api/users', {
      method: 'POST',
      // Only Marketing users have a contact on their posters.
      body: form.role === 'marketing' ? form : { ...form, wa: '', phone: '' },
    }),
  )
  creating.value = false
  if (!res) return
  showNew.value = false
  await refresh()
  await refreshNuxtData('marketing-users')
  issued.value = {
    title: `Akun ${res.user.name} dibuat`,
    name: res.user.name,
    password: res.tempPassword,
  }
  Object.assign(form, { name: '', email: '', role: 'staff', wa: '', phone: '' })
}

// ---- Marketing contact (WhatsApp and phone on the posters they own) -------
const contactFor = ref<User | null>(null)
const contactOpen = computed({
  get: () => !!contactFor.value,
  set: v => {
    if (!v) contactFor.value = null
  },
})
const contact = reactive({ wa: '', phone: '' })
const { errors: contactErrors, submit: submitContact } = useFieldErrors()
function editContact(u: User) {
  contactErrors.value = {}
  Object.assign(contact, { wa: u.wa ?? '', phone: u.phone ?? '' })
  contactFor.value = u
}
const savingContact = ref(false)
async function saveContact() {
  const u = contactFor.value
  if (!u || savingContact.value) return
  savingContact.value = true
  const res = await submitContact(() =>
    $fetch<{ user: User }>(`/api/users/${u.id}`, {
      method: 'PATCH',
      body: { wa: contact.wa.trim(), phone: contact.phone.trim() },
    }),
  )
  savingContact.value = false
  if (!res) return
  contactFor.value = null
  await refresh()
  await refreshNuxtData('marketing-users')
  toast.success(`Kontak ${u.name} disimpan. Poster miliknya langsung memakai nomor ini.`)
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
    ? {
        title: `Aktifkan ${p.user.name}?`,
        body: 'Ia bisa masuk lagi ke Panel Admin.',
        action: 'Ya, aktifkan',
        destructive: false,
      }
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
  const res = await submit(() =>
    $fetch<{ user: User; tempPassword?: string }>(`/api/users/${p.user.id}`, {
      method: 'PATCH',
      body,
    }),
  )
  if (!res) return
  await refresh()
  if (p.kind === 'reset' && res.tempPassword)
    issued.value = {
      title: `Kata sandi ${p.user.name} direset`,
      name: p.user.name,
      password: res.tempPassword,
    }
  else if (p.kind === 'role') toast.success(`Peran ${p.user.name} kini ${ROLE_LABEL[p.role]}.`)
  else
    toast.success(
      `${p.user.name} ${res.user.status === 'inactive' ? 'dinonaktifkan' : 'diaktifkan kembali'}.`,
    )
}

function onRoleChange(u: User, e: Event) {
  const select = e.target as HTMLSelectElement
  pending.value = { user: u, kind: 'role', role: select.value as Role }
  select.value = u.role // only changes after confirmation
}
</script>

<template>
  <div>
    <AdminPageHeader
      title="Pengguna"
      description="Kelola siapa yang bisa masuk ke Panel Admin dan apa perannya."
    >
      <Button class="h-11" @click="showNew = true">
        <Plus class="size-4" />
        Tambah pengguna
      </Button>
    </AdminPageHeader>

    <Card class="overflow-hidden py-0">
      <AdminDataState
        :status="status"
        :empty="!data?.length"
        empty-title="Belum ada pengguna"
        @retry="refresh()"
      >
        <!-- Phone: one card per user, so role, status and actions stay on screen. -->
        <ul class="divide-y md:hidden" aria-label="Daftar pengguna">
          <li v-for="u in data" :key="u.id" class="flex flex-col gap-3 p-4">
            <div class="flex items-start gap-3">
              <span
                aria-hidden="true"
                class="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold"
              >
                {{ initials(u.name) }}
              </span>
              <div class="min-w-0 grow">
                <div class="flex items-start gap-2">
                  <b class="min-w-0 grow leading-snug font-medium">
                    {{ u.name }}
                    <span v-if="u.id === me?.id" class="text-xs font-normal text-muted-foreground">
                      (Anda)
                    </span>
                  </b>
                  <AdminStatusPill :tone="USER_STATUS[u.status].tone" class="shrink-0">
                    {{ USER_STATUS[u.status].label }}
                  </AdminStatusPill>
                </div>
                <div class="truncate text-[13px] text-muted-foreground">{{ u.email }}</div>
                <div v-if="u.role === 'marketing'" class="text-[13px] text-muted-foreground">
                  <template v-if="u.wa || u.phone">
                    {{
                      [u.wa && `WA ${u.wa}`, u.phone && `Telp ${u.phone}`]
                        .filter(Boolean)
                        .join(' · ')
                    }}
                  </template>
                  <span v-else class="font-medium text-amber-800">
                    Kontak belum diisi · poster memakai nomor Pengaturan
                  </span>
                </div>
                <div class="text-[13px] text-muted-foreground">
                  Terakhir masuk: {{ fmtDateTime(u.lastLogin) }}
                </div>
              </div>
            </div>
            <AdminNativeSelect
              :model-value="u.role"
              :aria-label="`Peran ${u.name}`"
              :disabled="u.id === me?.id"
              class="w-full"
              @change="onRoleChange(u, $event)"
            >
              <option v-for="r in ROLES" :key="r" :value="r">{{ ROLE_LABEL[r] }}</option>
            </AdminNativeSelect>
            <div class="flex flex-wrap gap-2">
              <Button
                v-if="u.role === 'marketing'"
                variant="outline"
                class="h-11 grow"
                @click="editContact(u)"
              >
                Ubah kontak
              </Button>
              <Button
                variant="outline"
                class="h-11 grow"
                :disabled="u.id === me?.id"
                @click="pending = { user: u, kind: 'reset' }"
              >
                {{ u.status === 'locked' ? 'Buka & reset sandi' : 'Reset sandi' }}
              </Button>
              <Button
                variant="outline"
                :class="[
                  'h-11 grow',
                  u.status === 'inactive'
                    ? 'text-green-700 hover:text-green-700'
                    : 'text-destructive hover:text-destructive',
                ]"
                :disabled="u.id === me?.id"
                @click="pending = { user: u, kind: 'status' }"
              >
                {{ u.status === 'inactive' ? 'Aktifkan' : 'Nonaktifkan' }}
              </Button>
            </div>
          </li>
        </ul>
        <div class="max-md:hidden">
          <Table class="min-w-[760px]" label="Daftar pengguna">
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
                    <span
                      aria-hidden="true"
                      class="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold"
                    >
                      {{ initials(u.name) }}
                    </span>
                    <div>
                      <b class="font-medium">{{ u.name }}</b>
                      <span v-if="u.id === me?.id" class="text-xs text-muted-foreground">
                        (Anda)
                      </span>
                      <div class="text-xs text-muted-foreground">{{ u.email }}</div>
                      <div v-if="u.role === 'marketing'" class="text-xs text-muted-foreground">
                        <template v-if="u.wa || u.phone">
                          {{
                            [u.wa && `WA ${u.wa}`, u.phone && `Telp ${u.phone}`]
                              .filter(Boolean)
                              .join(' · ')
                          }}
                        </template>
                        <span v-else class="font-medium text-amber-800">
                          Kontak belum diisi · poster memakai nomor Pengaturan
                        </span>
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <AdminNativeSelect
                    :model-value="u.role"
                    :aria-label="`Peran ${u.name}`"
                    :disabled="u.id === me?.id"
                    class="h-10 md:text-[13px]"
                    @change="onRoleChange(u, $event)"
                  >
                    <option v-for="r in ROLES" :key="r" :value="r">{{ ROLE_LABEL[r] }}</option>
                  </AdminNativeSelect>
                </TableCell>
                <TableCell>
                  <AdminStatusPill :tone="USER_STATUS[u.status].tone">
                    {{ USER_STATUS[u.status].label }}
                  </AdminStatusPill>
                </TableCell>
                <TableCell class="text-[13px] text-muted-foreground">
                  {{ fmtDateTime(u.lastLogin) }}
                </TableCell>
                <TableCell class="pr-4 text-right whitespace-nowrap">
                  <Button
                    v-if="u.role === 'marketing'"
                    variant="outline"
                    size="sm"
                    class="mr-1 h-9"
                    @click="editContact(u)"
                  >
                    Ubah kontak
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    class="h-9"
                    :disabled="u.id === me?.id"
                    @click="pending = { user: u, kind: 'reset' }"
                  >
                    {{ u.status === 'locked' ? 'Buka & reset sandi' : 'Reset sandi' }}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    :class="[
                      'ml-1 h-9',
                      u.status === 'inactive'
                        ? 'text-green-700 hover:text-green-700'
                        : 'text-destructive hover:text-destructive',
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
        </div>
      </AdminDataState>
    </Card>
    <p class="mt-3 text-[13px] text-muted-foreground">
      Anda tidak bisa menonaktifkan atau mengubah peran akun Anda sendiri.
    </p>

    <Dialog v-model:open="showNew">
      <!-- Header and footer stay put; only the fields scroll on short screens. -->
      <DialogContent
        class="grid max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 p-0 sm:max-w-[600px]"
      >
        <DialogHeader class="px-6 pt-6 pr-14 pb-2 text-left">
          <DialogTitle>Tambah pengguna</DialogTitle>
          <DialogDescription>
            Akun langsung aktif. Kata sandi sementara muncul setelah disimpan.
          </DialogDescription>
        </DialogHeader>
        <form
          id="new-user-form"
          novalidate
          class="flex flex-col gap-5 overflow-y-auto px-6 pt-3 pb-6"
          @submit.prevent="create"
        >
          <div class="grid gap-4 sm:grid-cols-2">
            <AdminTextField
              id="u-name"
              v-model="form.name"
              label="Nama lengkap"
              autocomplete="off"
              hint="Tampil di Audit Log dan poster."
              :error="errors.name"
            />
            <AdminTextField
              id="u-email"
              v-model="form.email"
              type="email"
              inputmode="email"
              autocomplete="off"
              label="Email kantor"
              placeholder="nama@rs-bethesda.test"
              hint="Dipakai untuk masuk."
              :error="errors.email"
            />
          </div>

          <fieldset class="flex flex-col gap-2">
            <legend class="mb-2 text-sm font-medium">
              Peran
              <span class="font-normal text-muted-foreground">
                · pilih akses paling kecil yang cukup
              </span>
            </legend>
            <div class="grid gap-2 sm:grid-cols-2">
              <label
                v-for="r in ROLE_PICK"
                :key="r.role"
                :class="[
                  'flex cursor-pointer items-start gap-3 rounded-md has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring',
                  form.role === r.role
                    ? 'border-2 border-primary bg-accent p-[11px]'
                    : 'border p-3 hover:bg-muted/60',
                ]"
              >
                <input
                  v-model="form.role"
                  type="radio"
                  name="u-role"
                  :value="r.role"
                  class="sr-only"
                />
                <component
                  :is="r.icon"
                  :class="[
                    'mt-0.5 size-5 shrink-0',
                    form.role === r.role ? 'text-primary' : 'text-muted-foreground',
                  ]"
                  aria-hidden="true"
                />
                <span class="flex flex-col">
                  <b class="text-sm font-semibold">{{ ROLE_LABEL[r.role] }}</b>
                  <span class="text-[13px] leading-snug text-muted-foreground">
                    {{ r.summary }}
                  </span>
                </span>
              </label>
            </div>
            <AdminFieldError id="u-role-err" :message="errors.role" />
          </fieldset>

          <section class="rounded-md bg-muted/60 px-4 py-3" aria-labelledby="u-caps-title">
            <h3 id="u-caps-title" class="mb-1.5 text-sm font-semibold">
              Yang bisa dilakukan {{ ROLE_LABEL[form.role] }}
            </h3>
            <ul class="flex flex-col gap-1">
              <li
                v-for="c in ROLE_CAPS"
                :key="c.text"
                :class="[
                  'flex items-start gap-2 text-[13px] leading-snug',
                  c.roles.includes(form.role) ? 'text-foreground' : 'text-muted-foreground',
                ]"
              >
                <Check
                  v-if="c.roles.includes(form.role)"
                  class="mt-px size-4 shrink-0 text-green-700"
                  aria-hidden="true"
                />
                <Minus v-else class="mt-px size-4 shrink-0" aria-hidden="true" />
                <span>
                  <span class="sr-only">
                    {{ c.roles.includes(form.role) ? 'Bisa:' : 'Tidak bisa:' }}
                  </span>
                  {{ c.text }}
                  <template v-if="!c.roles.includes(form.role) && c.no">· {{ c.no }}</template>
                </span>
              </li>
            </ul>
          </section>

          <p
            v-if="form.role === 'super'"
            class="flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2.5 text-[13px] leading-snug text-amber-900"
          >
            <TriangleAlert class="mt-px size-4 shrink-0" aria-hidden="true" />
            Super Admin bisa menambah dan menonaktifkan pengguna serta mengubah Pengaturan. Berikan
            hanya untuk tim IT atau pimpinan.
          </p>

          <fieldset v-if="form.role === 'marketing'" class="flex flex-col gap-3">
            <legend class="mb-1 text-sm font-medium">
              Kontak di poster miliknya
              <span class="font-normal text-muted-foreground">· opsional</span>
            </legend>
            <p class="text-[13px] leading-snug text-muted-foreground">
              Tombol WhatsApp dan telepon di poster Marketing ini memakai nomor berikut. Bila
              kosong, memakai kontak di Pengaturan.
            </p>
            <div class="grid gap-4 sm:grid-cols-2">
              <AdminTextField
                id="u-wa"
                v-model="form.wa"
                type="tel"
                inputmode="tel"
                label="Nomor WhatsApp"
                placeholder="6281234567890"
                hint="Diawali 62, tanpa + atau spasi."
                :error="errors.wa"
              />
              <AdminTextField
                id="u-phone"
                v-model="form.phone"
                type="tel"
                inputmode="tel"
                label="Nomor telepon"
                placeholder="0274 586688"
                :error="errors.phone"
              />
            </div>
          </fieldset>
        </form>
        <DialogFooter class="border-t px-6 py-4">
          <Button type="button" variant="outline" class="h-11" @click="showNew = false">
            Batal
          </Button>
          <Button type="submit" form="new-user-form" class="h-11" :disabled="creating">
            {{ creating ? 'Membuat…' : 'Buat pengguna' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="contactOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kontak marketing {{ contactFor?.name }}</DialogTitle>
          <DialogDescription>
            Tombol WhatsApp dan telepon di semua poster milik {{ contactFor?.name }} langsung
            memakai nomor ini. Kosongkan untuk memakai nomor dari Pengaturan.
          </DialogDescription>
        </DialogHeader>
        <form
          id="contact-form"
          novalidate
          class="flex flex-col gap-4"
          @submit.prevent="saveContact"
        >
          <AdminTextField
            id="c-wa"
            v-model="contact.wa"
            type="tel"
            label="Nomor WhatsApp"
            placeholder="628…"
            :error="contactErrors.wa"
            hint="Format 62… tanpa + atau spasi."
          />
          <AdminTextField
            id="c-phone"
            v-model="contact.phone"
            type="tel"
            label="Nomor telepon"
            placeholder="Contoh: 0274 586688"
            :error="contactErrors.phone"
          />
          <p class="text-[13px] text-muted-foreground">
            Tombol email memakai email akunnya: {{ contactFor?.email }}.
          </p>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" class="h-11" @click="contactFor = null">
            Batal
          </Button>
          <Button type="submit" form="contact-form" class="h-11" :disabled="savingContact">
            {{ savingContact ? 'Menyimpan…' : 'Simpan kontak' }}
          </Button>
        </DialogFooter>
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
          <DialogDescription>
            Kata sandi sementara ini hanya ditampilkan sekali. Berikan langsung kepada
            {{ issued?.name }}, jangan lewat grup chat. Ia wajib menggantinya saat pertama masuk.
          </DialogDescription>
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
            <Button
              variant="outline"
              :class="['h-12', copied && 'text-green-700 hover:text-green-700']"
              @click="copyPassword"
            >
              <component :is="copied ? Check : Copy" class="size-4" />
              {{ copied ? 'Tersalin' : 'Salin' }}
            </Button>
          </div>
          <span role="status" class="text-[13px] text-muted-foreground">
            {{
              copied
                ? 'Tersalin ke papan klip.'
                : 'Dialog ini tetap terbuka sampai Anda menutupnya.'
            }}
          </span>
        </div>
        <label class="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm">
          <input v-model="noted" type="checkbox" class="size-[18px] accent-primary" />
          Saya sudah mencatat atau menyalin kata sandi ini
        </label>
        <DialogFooter>
          <Button class="h-11" :disabled="!noted" @click="closeIssued">Selesai</Button>
        </DialogFooter>
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
