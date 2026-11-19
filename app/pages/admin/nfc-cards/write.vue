<script setup lang="ts">
// Card writing station: the USB NFC reader (ACR122U) on this Windows PC or Mac, through the Penulis NFC helper.
// Left: the reader as it is now and the one action that matters. Right: the queue and this session.
import { Download, Lock, Nfc, RotateCw, ScanLine, X } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { fmtDateTime } from '#shared/utils/format'
import {
  HELPER_DOWNLOADS,
  cardForUrl,
  countsAsFailedWrite,
  helperPlatform,
  setupSteps,
  trayPlace,
  writerErrorMessage,
  type HelperPlatform,
  type ReadSuccess,
  type WriteSuccess,
} from '~/utils/nfcWriter'

definePageMeta({ layout: 'admin', middleware: 'auth', title: 'Tulis ke kartu' })
const { cards: data, refresh: refreshCards } = useCards()
const { copy } = useCopy()
const nfc = useNfcWriter()
const helper = nfc.state
const ready = computed(() => helper.value === 'ready')
const cardOnReader = computed(() => !!nfc.status.value?.card)

// Windows or Mac: which helper to offer and how to describe it. Known only in the browser.
const platform = ref<HelperPlatform>('windows')
onMounted(() => {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } }
  platform.value = helperPlatform(navigator.userAgent, nav.userAgentData?.platform)
})
const download = computed(() => HELPER_DOWNLOADS[platform.value])
const steps = computed(() => setupSteps(platform.value))

const all = computed(() => data.value ?? [])
const pending = computed(() => all.value.filter(c => c.writeStatus !== 'sudah'))
const writtenCards = computed(() =>
  all.value
    .filter(c => c.writeStatus === 'sudah')
    .sort((a, b) => (b.writtenAt ?? '').localeCompare(a.writtenAt ?? '')),
)
const doneCount = computed(() => writtenCards.value.length)
const progress = computed(() => (all.value.length ? doneCount.value / all.value.length : 0))

// The card to write: the chosen one, else the next one waiting. A card already written can be chosen
// on purpose (Tulis ulang).
const selCode = ref('')
const rewrite = ref(false)
watch(
  pending,
  list => {
    if (rewrite.value) return
    if (!list.some(c => c.code === selCode.value)) selCode.value = list[0]?.code ?? ''
  },
  { immediate: true },
)
const sel = computed(() => all.value.find(c => c.code === selCode.value))
function choose(code: string, again = false) {
  if (step.value === 'writing') return
  selCode.value = code
  rewrite.value = again
  step.value = 'idle'
}
const lock = ref(false)

// ---- Writing ------------------------------------------------------------------------------------
const step = ref<'idle' | 'writing' | 'done' | 'fail'>('idle')
const last = ref<(WriteSuccess & { code: string; label: string }) | null>(null)
const failMessage = ref('')
/** The card just written, maybe still on the reader: the next write waits for a different card. */
const lastUid = ref<string | null>(null)
const session = ref<
  { code: string; label: string; uid: string; type: string; locked: boolean; at: Date }[]
>([])

async function record(code: string, body: { ok: boolean; locked?: boolean; reason?: string }) {
  try {
    await $fetch(`/api/cards/${code}/write`, { method: 'POST', body })
    return true
  } catch {
    return false
  }
}

async function write() {
  const card = sel.value
  if (!card || !ready.value || nfc.working.value) return
  checked.value = null
  step.value = 'writing'
  const r = await nfc.write(card.url, lock.value, lastUid.value)
  if (r.ok) {
    lastUid.value = r.uid
    last.value = { ...r, code: card.code, label: card.label }
    session.value.unshift({
      code: card.code,
      label: card.label,
      uid: r.uid,
      type: r.type,
      locked: r.locked,
      at: new Date(),
    })
    if (r.lockSkipped) toast.warning(r.lockSkipped)
    rewrite.value = false
    if (!(await record(card.code, { ok: true, locked: r.locked }))) {
      failMessage.value =
        'Kartu sudah tertulis, tetapi statusnya gagal disimpan. Muat ulang halaman sebelum menulis kartu ini lagi.'
      step.value = 'fail'
      return
    }
    step.value = 'done'
    await refreshCards()
    return
  }
  if (r.error === 'cancelled') {
    step.value = 'idle'
    return
  }
  failMessage.value = writerErrorMessage(r)
  if (countsAsFailedWrite(r.error)) {
    await record(card.code, { ok: false, reason: r.message.slice(0, 200) })
    await refreshCards()
  }
  step.value = 'fail'
}

// ---- Checking a card ----------------------------------------------------------------------------
const checked = ref<(ReadSuccess & { match?: { code: string; label: string } }) | null>(null)
const checkError = ref('')
async function check() {
  if (!ready.value || nfc.working.value) return
  checked.value = null
  checkError.value = ''
  const r = await nfc.read()
  if (!r.ok) {
    checkError.value = writerErrorMessage(r)
    return
  }
  const match = cardForUrl(all.value, r.url)
  checked.value = { ...r, match: match && { code: match.code, label: match.label } }
}

// ---- What the reader panel shows ------------------------------------------------------------------
const art = computed(() => {
  if (!ready.value) return 'off'
  if (step.value === 'done') return 'done'
  if (step.value === 'fail') return 'fail'
  if (nfc.working.value) return cardOnReader.value ? 'busy' : 'waiting'
  return cardOnReader.value ? 'card' : 'idle'
})
const headline = computed(() => {
  if (helper.value === 'checking') return 'Mencari Penulis NFC…'
  if (helper.value === 'offline') return 'Pasang Penulis NFC di komputer ini'
  if (helper.value === 'asking') return 'Izinkan situs ini di Penulis NFC'
  if (helper.value === 'denied') return 'Situs ini ditolak Penulis NFC'
  if (helper.value === 'no-reader') return 'Colokkan pembaca NFC'
  if (nfc.working.value === 'read') return 'Tempelkan kartu yang mau dicek'
  if (step.value === 'writing')
    return nfc.status.value?.waiting === 'remove_previous'
      ? 'Ganti dengan kartu berikutnya'
      : cardOnReader.value
        ? 'Menulis… tahan kartunya'
        : 'Tempelkan kartu ke pembaca'
  if (step.value === 'done' && last.value) return `Kartu ${last.value.code} selesai`
  if (step.value === 'fail') return 'Kartu belum tertulis'
  if (!sel.value) return 'Semua kartu sudah ditulis'
  return 'Siap menulis'
})
const subline = computed(() => {
  if (helper.value === 'checking') return ''
  if (helper.value === 'offline')
    return `Halaman ini belum tersambung ke Penulis NFC. Bila programnya sudah berjalan (ikonnya di ${trayPlace(platform.value)}), izinkan akses perangkat lokal di Chrome lalu muat ulang halaman.`
  if (helper.value === 'asking')
    return 'Klik Izinkan di jendela “Penulis NFC · Izinkan situs?” di layar komputer ini.'
  if (helper.value === 'denied')
    return `Klik ikon Penulis NFC di ${trayPlace(platform.value)} → Situs yang diizinkan → Tanya lagi situs yang ditolak, lalu muat ulang halaman ini.`
  if (helper.value === 'no-reader')
    return 'Penulis NFC sudah aktif. Colokkan ACR122U ke port USB komputer ini.'
  if (nfc.working.value === 'read') return 'Isinya ditampilkan di bawah tanpa mengubah kartu.'
  if (step.value === 'writing')
    return nfc.status.value?.waiting === 'remove_previous'
      ? `Angkat kartu yang tadi, lalu tempelkan kartu kosong untuk ${sel.value?.code}.`
      : 'Letakkan kartu kosong di tengah pembaca dan jangan diangkat sampai selesai.'
  if (step.value === 'done' && last.value)
    return `${last.value.label} · ${last.value.type}${last.value.locked ? ' · terkunci' : ''}`
  if (step.value === 'fail') return failMessage.value
  if (!sel.value)
    return 'Kartu baru didaftarkan dari menu Kartu NFC. Anda tetap bisa mengecek atau menulis ulang kartu.'
  return cardOnReader.value ? 'Kartu sudah di pembaca.' : 'Pilih kartu, lalu tekan Tulis.'
})

/** One live region for screen readers. */
const live = computed(() => `${headline.value}. ${step.value === 'idle' ? '' : subline.value}`)

const lights = computed(() => [
  {
    label: 'Penulis NFC',
    value:
      helper.value === 'offline'
        ? 'Belum berjalan'
        : helper.value === 'checking'
          ? 'Memeriksa…'
          : helper.value === 'asking' || helper.value === 'denied'
            ? 'Perlu izin'
            : `Aktif · v${nfc.status.value?.version ?? ''}`,
    tone:
      helper.value === 'offline'
        ? 'off'
        : helper.value === 'asking' || helper.value === 'denied'
          ? 'warn'
          : helper.value === 'checking'
            ? 'off'
            : 'ok',
  },
  {
    label: 'Pembaca',
    value: nfc.status.value?.reader?.replace(/ PICC Interface \d+$/, '') ?? 'Belum terdeteksi',
    tone: ready.value ? 'ok' : helper.value === 'no-reader' ? 'warn' : 'off',
  },
  {
    label: 'Kartu',
    value: !ready.value ? '—' : cardOnReader.value ? 'Ada di pembaca' : 'Belum ada',
    tone: ready.value && cardOnReader.value ? 'ok' : 'off',
  },
])
</script>

<template>
  <div>
    <AdminPageHeader
      title="Tulis ke kartu"
      :back="{ to: '/admin/nfc-cards', label: 'Kembali ke Kartu NFC' }"
      description="Tulis alamat unik kartu sekali saja dengan pembaca NFC USB. Setelah itu, isi poster diganti dari Panel Admin tanpa menulis ulang kartu."
    />
    <p class="sr-only" role="status" aria-live="polite">{{ live }}</p>

    <!-- Connection lights -->
    <ul class="mb-5 grid gap-2 sm:grid-cols-3" aria-label="Status alat">
      <li
        v-for="l in lights"
        :key="l.label"
        class="flex items-center gap-3 rounded-xl border bg-card px-4 py-3"
      >
        <span
          :class="[
            'size-2.5 shrink-0 rounded-full',
            l.tone === 'ok'
              ? 'bg-emerald-500 shadow-[0_0_0_4px] shadow-emerald-500/15'
              : l.tone === 'warn'
                ? 'bg-amber-500'
                : 'bg-zinc-300',
          ]"
        />
        <span class="min-w-0">
          <span class="block text-xs text-muted-foreground">{{ l.label }}</span>
          <span class="block truncate text-sm font-semibold">{{ l.value }}</span>
        </span>
      </li>
    </ul>

    <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <!-- Station -->
      <Card class="gap-0 overflow-hidden py-0">
        <div class="grid gap-6 p-6 md:grid-cols-[240px_minmax(0,1fr)] md:items-center md:p-8">
          <div class="flex justify-center rounded-2xl bg-secondary px-4 py-6">
            <CardReaderArt :state="art" />
          </div>

          <div class="flex min-w-0 flex-col gap-4">
            <div>
              <h2 class="text-2xl leading-tight font-bold tracking-tight md:text-[28px]">
                {{ headline }}
              </h2>
              <p
                :class="[
                  'mt-1.5 text-[15px] leading-relaxed',
                  step === 'fail' ? 'font-medium text-red-700' : 'text-zinc-600',
                ]"
              >
                {{ subline }}
              </p>
            </div>

            <!-- Not set up: how to get the helper -->
            <div v-if="helper === 'offline'" class="flex flex-col gap-3">
              <ol class="flex flex-col gap-2 text-sm text-zinc-700">
                <li v-for="(s, i) in steps" :key="i" class="flex gap-3">
                  <span
                    class="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
                  >
                    {{ i + 1 }}
                  </span>
                  <span class="pt-0.5">{{ s }}</span>
                </li>
              </ol>
              <Button as-child class="h-11 self-start">
                <a :href="download.href" download>
                  <Download class="size-4" />
                  Unduh {{ download.file }}
                </a>
              </Button>
              <p class="text-xs text-muted-foreground">
                Sekali per komputer ({{
                  platform === 'mac' ? 'macOS 11 atau lebih baru' : 'Windows 10/11'
                }}); programnya ikut berjalan saat komputer mulai. Bila Chrome menanyakan izin
                mengakses perangkat di jaringan lokal, pilih Izinkan.
                <a
                  class="underline underline-offset-2"
                  :href="HELPER_DOWNLOADS[platform === 'mac' ? 'windows' : 'mac'].href"
                  download
                >
                  Unduh versi {{ platform === 'mac' ? 'Windows' : 'Mac' }}
                </a>
              </p>
            </div>

            <!-- The card being written -->
            <div v-else-if="sel && step !== 'done'" class="rounded-xl border px-4 py-3">
              <div class="flex items-baseline justify-between gap-3">
                <b class="font-mono text-lg tracking-wide">{{ sel.code }}</b>
                <span v-if="sel.writeStatus === 'sudah'" class="text-xs font-medium text-amber-800">
                  Tulis ulang
                </span>
                <span
                  v-else-if="sel.writeStatus === 'gagal'"
                  class="text-xs font-medium text-red-700"
                >
                  Gagal sebelumnya
                </span>
              </div>
              <div class="truncate text-sm">{{ sel.label }} · {{ sel.group }}</div>
              <div class="mt-1 truncate font-mono text-xs text-muted-foreground">{{ sel.url }}</div>
            </div>

            <!-- Actions -->
            <div v-if="helper !== 'offline'" class="flex flex-wrap items-center gap-2">
              <template v-if="step === 'writing' || nfc.working.value === 'read'">
                <Button variant="outline" class="h-12 px-5" @click="nfc.cancel()">
                  <X class="size-4" />
                  Batal
                </Button>
              </template>
              <template v-else-if="step === 'done'">
                <Button v-if="sel" class="h-12 px-5 text-base" :disabled="!ready" @click="write">
                  <Nfc class="size-5" />
                  Tulis berikutnya · {{ sel.code }}
                </Button>
              </template>
              <template v-else>
                <Button class="h-12 px-5 text-base" :disabled="!ready || !sel" @click="write">
                  <component :is="step === 'fail' ? RotateCw : Nfc" class="size-5" />
                  {{ step === 'fail' ? 'Coba lagi' : 'Tulis kartu' }}
                </Button>
              </template>
              <Button
                v-if="step !== 'writing' && !nfc.working.value"
                variant="ghost"
                class="h-12"
                :disabled="!ready"
                @click="check"
              >
                <ScanLine class="size-4" />
                Cek isi kartu
              </Button>
            </div>

            <label
              v-if="ready && sel && step !== 'writing' && step !== 'done'"
              class="flex items-start gap-2.5 text-sm"
            >
              <input v-model="lock" type="checkbox" class="mt-0.5 size-[18px] accent-primary" />
              <span>
                <span class="inline-flex items-center gap-1 font-medium">
                  <Lock class="size-3.5" />
                  Kunci setelah ditulis
                </span>
                <span class="block text-muted-foreground">
                  Permanen: kartu tidak bisa ditulis ulang oleh siapa pun.
                </span>
              </span>
            </label>
            <p v-if="step === 'done' && sel" class="text-[13px] text-muted-foreground">
              Kartu yang tadi boleh tetap di pembaca; penulis menunggu kartu lain agar kartu itu
              tidak tertimpa.
            </p>
          </div>
        </div>

        <!-- Card check result -->
        <div v-if="checked || checkError" class="border-t bg-secondary/60 px-6 py-4 md:px-8">
          <div class="flex items-start justify-between gap-3">
            <h3 class="text-sm font-semibold">Isi kartu</h3>
            <button
              type="button"
              class="-mt-1 -mr-2 flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-white focus-visible:outline-2 focus-visible:outline-ring"
              aria-label="Tutup isi kartu"
              @click="((checked = null), (checkError = ''))"
            >
              <X class="size-4" />
            </button>
          </div>
          <p v-if="checkError" class="text-sm font-medium text-destructive">{{ checkError }}</p>
          <dl
            v-else-if="checked"
            class="mt-1 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[auto_1fr]"
          >
            <dt class="text-muted-foreground">Kartu</dt>
            <dd>
              <template v-if="checked.match">
                <b class="font-mono">{{ checked.match.code }}</b>
                · {{ checked.match.label }}
              </template>
              <template v-else>
                {{ checked.url ? 'Alamatnya tidak ada di daftar kartu' : 'Masih kosong' }}
              </template>
            </dd>
            <dt class="text-muted-foreground">Alamat</dt>
            <dd class="font-mono text-xs break-all">{{ checked.url ?? '—' }}</dd>
            <dt class="text-muted-foreground">Jenis</dt>
            <dd>
              {{ checked.type }} · {{ checked.dataBytes }} byte ·
              {{ checked.readOnly ? 'terkunci' : 'bisa ditulis' }}
            </dd>
            <dt class="text-muted-foreground">UID</dt>
            <dd class="font-mono text-xs">{{ checked.uid }}</dd>
          </dl>
        </div>
      </Card>

      <!-- Queue -->
      <aside class="flex flex-col gap-4" aria-label="Antrian kartu">
        <Card class="gap-4 p-5">
          <div>
            <div class="flex items-baseline justify-between">
              <h2 class="text-base font-semibold">Antrian</h2>
              <span class="text-sm text-muted-foreground">
                {{ doneCount }} dari {{ all.length }} ditulis
              </span>
            </div>
            <div
              class="mt-2 h-2 overflow-hidden rounded-full bg-secondary"
              role="progressbar"
              :aria-valuenow="doneCount"
              :aria-valuemax="all.length"
              aria-label="Kartu sudah ditulis"
            >
              <div
                class="h-full rounded-full bg-primary transition-[width]"
                :style="{ width: `${progress * 100}%` }"
              />
            </div>
          </div>

          <div v-if="pending.length" class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Belum ditulis · {{ pending.length }}
            </span>
            <ul class="flex max-h-80 flex-col gap-1 overflow-y-auto">
              <li v-for="c in pending" :key="c.code">
                <button
                  type="button"
                  :aria-pressed="c.code === selCode"
                  :disabled="step === 'writing'"
                  :class="[
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60',
                    c.code === selCode
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-secondary',
                  ]"
                  @click="choose(c.code)"
                >
                  <span class="min-w-0 grow">
                    <span class="block truncate font-medium">{{ c.label }}</span>
                    <span
                      :class="[
                        'font-mono text-xs',
                        c.code === selCode ? 'text-primary-foreground/80' : 'text-muted-foreground',
                      ]"
                    >
                      {{ c.code }}
                    </span>
                  </span>
                  <span
                    v-if="c.writeStatus === 'gagal'"
                    :class="[
                      'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                      c.code === selCode ? 'bg-white/20' : 'bg-red-50 text-red-700',
                    ]"
                  >
                    Gagal
                  </span>
                </button>
              </li>
            </ul>
          </div>
          <p v-else class="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Semua kartu sudah ditulis.
          </p>
        </Card>

        <Card v-if="session.length" class="gap-2 p-5">
          <h2 class="text-base font-semibold">Ditulis barusan</h2>
          <ul class="flex flex-col divide-y text-sm">
            <li
              v-for="s in session"
              :key="`${s.code}-${s.at.getTime()}`"
              class="flex items-center justify-between gap-3 py-2"
            >
              <span class="min-w-0">
                <b class="font-mono">{{ s.code }}</b>
                <span class="block truncate text-xs text-muted-foreground">
                  {{ s.type }} · UID {{ s.uid }}{{ s.locked ? ' · terkunci' : '' }}
                </span>
              </span>
              <span class="shrink-0 text-xs text-muted-foreground">
                {{ s.at.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }}
              </span>
            </li>
          </ul>
        </Card>

        <Card v-if="writtenCards.length" class="gap-2 p-5">
          <h2 class="text-base font-semibold">Sudah ditulis</h2>
          <ul class="flex max-h-72 flex-col divide-y overflow-y-auto text-sm">
            <li v-for="c in writtenCards" :key="c.code" class="flex items-center gap-3 py-2">
              <span class="min-w-0 grow">
                <span class="block truncate font-medium">{{ c.label }}</span>
                <span class="block truncate text-xs text-muted-foreground">
                  <span class="font-mono">{{ c.code }}</span>
                  · {{ c.writtenAt ? fmtDateTime(c.writtenAt) : ''
                  }}{{ c.locked ? ' · terkunci' : '' }}
                </span>
              </span>
              <Button
                v-if="!c.locked"
                variant="ghost"
                size="sm"
                class="h-9 shrink-0"
                :disabled="step === 'writing'"
                :aria-label="`Tulis ulang kartu ${c.code}`"
                @click="choose(c.code, true)"
              >
                Tulis ulang
              </Button>
              <Button
                v-else
                variant="ghost"
                size="sm"
                class="h-9 shrink-0"
                :aria-label="`Salin alamat kartu ${c.code}`"
                @click="copy(c.url)"
              >
                Salin
              </Button>
            </li>
          </ul>
        </Card>
        <p class="px-1 text-[13px] text-muted-foreground">
          Setiap penulisan tercatat di Audit Log, termasuk yang gagal beserta alasannya.
        </p>
      </aside>
    </div>
  </div>
</template>
