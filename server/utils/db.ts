// In-memory dummy database. Resets whenever the dev server restarts.
// Replace these collections with real persistence when the backend is ready;
// the API routes are the only code that touches them.
import type { AuditEntry, Card, DailyRow, Page, Poster, Settings, User } from '#shared/types'
import { TODAY, addDays, nowStamp } from '#shared/utils/format'
import { DEMO_PASSWORD, createCredentialStore, seedPassword } from './passwords'

const users: User[] = [
  { id: 'u1', name: 'Rina Kartika', email: 'rina@rs-bethesda.test', role: 'super', status: 'active', lastLogin: '2026-10-27 08:12' },
  { id: 'u2', name: 'Dimas Pratama', email: 'dimas@rs-bethesda.test', role: 'staff', status: 'active', lastLogin: '2026-10-27 07:55' },
  { id: 'u3', name: 'Sari Wulandari', email: 'sari@rs-bethesda.test', role: 'staff', status: 'locked', lastLogin: '2026-10-24 13:40' },
  { id: 'u4', name: 'Agus Setiawan', email: 'agus.it@rs-bethesda.test', role: 'super', status: 'active', lastLogin: '2026-10-21 10:02' },
  { id: 'u5', name: 'Budi Santoso', email: 'budi@rs-bethesda.test', role: 'staff', status: 'inactive', lastLogin: '2026-08-02 09:15' },
]

const posters: Poster[] = [
  {
    id: 'p1',
    kind: 'gambar',
    name: 'Sleep Lab',
    status: 'published',
    archived: false,
    start: '2026-10-01',
    end: '2026-11-30',
    updatedAt: '2026-10-26 16:10',
    updatedBy: 'u2',
    imageUrl: '/dummy/sleep-lab.svg',
    imageFile: 'Poster Sleep Lab.png',
    imageSize: 700_000,
    buttons: ['wa', 'tel', 'doc'],
    title: 'Sleep Lab',
    category: 'paket',
    price: 'Rp 3.100.000',
    priceUnit: 'pemeriksaan',
    description: 'Pemeriksaan kualitas tidur untuk mendeteksi sleep apnea, insomnia, dan gangguan napas saat tidur.',
    listTitle: 'Manfaat',
    points: ['Deteksi dini gangguan tidur', 'Cegah risiko penyakit jantung & stroke', 'Terapi yang tepat (misal CPAP)'],
    terms: 'Pemeriksaan dengan perjanjian. Pasien asuransi mengikuti prosedur asuransi masing-masing.',
  },
  {
    id: 'p2',
    kind: 'gambar',
    name: 'Promo MCU Basic Oktober',
    status: 'published',
    archived: false,
    start: '2026-10-01',
    end: '2026-10-31',
    updatedAt: '2026-10-02 11:30',
    updatedBy: 'u2',
    imageUrl: '/dummy/promo-mcu.svg',
    imageFile: 'Promo MCU Oktober.png',
    imageSize: 2_400_000,
    buttons: ['wa', 'tel'],
    title: 'MCU Basic Hemat 30%',
    category: 'promo',
    price: 'Rp 315.000',
    priceUnit: 'karyawan',
    description: 'Promo medical check-up dasar untuk karyawan perusahaan mitra selama Oktober 2026.',
    listTitle: 'Ketentuan',
    points: ['Harga normal Rp 450.000', 'Minimal 20 karyawan', 'Hasil dalam 3 hari kerja'],
  },
  {
    id: 'p3',
    kind: 'gambar',
    name: 'Paket TMS Fisioterapi',
    status: 'published',
    archived: false,
    start: '2026-10-15',
    end: '2026-12-31',
    updatedAt: '2026-10-20 09:05',
    updatedBy: 'u1',
    imageUrl: '/dummy/tms-fisioterapi.svg',
    imageFile: 'Paket TMS.png',
    imageSize: 1_900_000,
    buttons: ['wa'],
    title: 'Paket TMS Fisioterapi',
    category: 'paket',
    price: 'Mulai Rp 3.599.999',
    priceUnit: 'program',
    description: 'Program pemulihan pasca stroke dengan Transcranial Magnetic Stimulation dan fisioterapi.',
    listTitle: 'Termasuk',
    points: [
      'Konsultasi dokter saraf & rehabilitasi medik',
      'Transcranial Magnetic Stimulation 5× atau 10×',
      'Fisioterapi / terapi wicara / terapi okupasi',
    ],
  },
  {
    id: 'p4',
    kind: 'gambar',
    name: 'Layanan VIP BEST',
    status: 'published',
    archived: false,
    start: '2026-01-01',
    end: '2026-12-31',
    updatedAt: '2026-09-01 08:00',
    updatedBy: 'u2',
    imageUrl: '/dummy/vip-best.svg',
    imageFile: 'Layanan BEST.png',
    imageSize: 1_200_000,
    buttons: ['wa', 'tel'],
    title: 'Layanan VIP BEST',
    category: 'info',
    description: 'Bethesda Excellence Service and Total Care: layanan khusus untuk pasien rawat inap VVIP dan Suite.',
    listTitle: 'Keuntungan',
    points: [
      'Fast track admisi dan IGD',
      'Kepastian jam visit dokter',
      'Pendampingan Tim BEST',
      'Manajemen kepulangan lebih cepat (kurang dari 1 jam)',
    ],
  },
  {
    id: 'p5',
    kind: 'gambar',
    name: 'Seminar K3 Kesehatan Kerja',
    status: 'published',
    archived: false,
    start: '2026-10-10',
    end: '2026-11-01',
    updatedAt: '2026-10-11 10:30',
    updatedBy: 'u2',
    imageUrl: '/dummy/seminar-k3.svg',
    imageFile: 'Seminar K3.pdf',
    imageSize: 900_000,
    buttons: ['wa', 'doc'],
    title: 'Seminar K3: Ergonomi Kerja',
    category: 'acara',
    description:
      'Seminar ergonomi di lini produksi untuk HRD dan petugas K3 perusahaan mitra. Minggu, 1 November 2026, 09.00–11.30 WIB, daring.',
  },
  {
    id: 'p6',
    kind: 'gambar',
    name: 'Senam Sehat Jumat',
    status: 'published',
    archived: false,
    start: '2026-11-06',
    end: '2026-12-31',
    updatedAt: '2026-10-26 15:00',
    updatedBy: 'u2',
    imageUrl: '/dummy/senam-sehat.svg',
    imageFile: 'Senam Sehat.png',
    imageSize: 1_600_000,
    buttons: ['wa'],
    title: 'Senam Sehat Jumat',
    category: 'acara',
    description: 'Senam sehat bersama setiap Jumat pukul 06.30 di halaman parkir. Gratis untuk karyawan mitra.',
  },
  {
    id: 'p7',
    kind: 'gambar',
    name: 'Donor Darah Bersama',
    status: 'draft',
    archived: false,
    start: '2026-11-21',
    end: '2026-11-21',
    updatedAt: '2026-10-26 16:10',
    updatedBy: 'u2',
    imageUrl: '/dummy/donor-darah.svg',
    imageFile: 'Donor Darah.png',
    imageSize: 1_100_000,
    buttons: ['wa', 'tel'],
    title: 'Donor Darah Bersama',
    category: 'acara',
    description: 'Donor darah bersama, Sabtu 21 November 2026 di Lobi Utama. Setiap pendonor mendapat cek hemoglobin gratis.',
  },
  {
    id: 'p8',
    kind: 'gambar',
    name: 'Promo Ulang Tahun RS',
    status: 'published',
    archived: true,
    start: '2026-06-01',
    end: '2026-06-30',
    updatedAt: '2026-07-01 08:00',
    updatedBy: 'u5',
    imageUrl: '/dummy/promo-mcu.svg',
    imageFile: 'Promo Ultah.png',
    imageSize: 1_300_000,
    buttons: ['wa'],
    title: 'Diskon Ulang Tahun RS',
    category: 'promo',
    description: 'Diskon ulang tahun RS: potongan 25% untuk semua paket MCU.',
  },
  // Real events from the hospital's news page (bethesda.or.id, read Nov 2026), rewritten in short.
  // Images are generated stand-ins (scripts/make-dummy-posters.mjs). Staff phone numbers and the
  // bank account from the originals are left out: the contact buttons use Settings.
  {
    id: 'p9',
    kind: 'gambar',
    name: 'Pelatihan ATLS-11 November',
    status: 'published',
    archived: false,
    start: '2026-10-06',
    end: '2026-11-22',
    updatedAt: '2026-10-06 13:30',
    updatedBy: 'u2',
    imageUrl: '/dummy/atls-11.svg',
    imageFile: 'Poster ATLS-11.png',
    imageSize: 1_300_000,
    buttons: ['wa', 'tel'],
    title: 'Pelatihan ATLS-11 · Advanced Trauma Life Support',
    category: 'acara',
    price: 'Rp 5.800.000',
    priceUnit: 'peserta',
    description:
      'Pelatihan penanganan pasien trauma secara sistematis, cepat, dan tepat oleh Unit Diklat RS Bethesda Yogyakarta bersama IKABI. 20–22 November 2026, luring di RS Bethesda Yogyakarta.',
    listTitle: 'Materi',
    points: [
      'Shock, trauma thoraks, abdomen, dan pelvis',
      'Head trauma dan trauma spinal',
      'Musculoskeletal trauma dan thermal injury',
      'Trauma pada populasi khusus',
      'Triage dan transfer to definitive care',
    ],
    terms:
      'Untuk dokter, dokter spesialis bedah, anestesiologi & terapi intensif, serta emergensi medisin. Peserta wajib memiliki akun SATUSEHAT SDMK / Plataran Sehat. Kuota terbatas.',
  },
  {
    id: 'p10',
    kind: 'gambar',
    name: 'Pelatihan Preceptorship November',
    status: 'published',
    archived: false,
    start: '2026-10-03',
    end: '2026-11-19',
    updatedAt: '2026-10-03 08:10',
    updatedBy: 'u2',
    imageUrl: '/dummy/preceptorship.svg',
    imageFile: 'Poster Preceptorship.jpg',
    imageSize: 900_000,
    buttons: ['wa', 'tel'],
    title: 'Pelatihan Pembimbing Klinik Model Preceptorship',
    category: 'acara',
    price: 'Rp 550.000',
    priceUnit: 'peserta',
    description:
      'Pelatihan daring bagi tenaga kesehatan yang membimbing pembelajaran klinik agar lebih terstruktur, aman, dan efektif. 16–19 November 2026, Senin–Kamis mulai pukul 07.00.',
    listTitle: 'Materi',
    points: [
      'Kurikulum pendidikan klinik',
      'Standar rumah sakit pendidikan',
      'Manajemen pendidikan klinik',
      'Teaching-learning preceptorship model',
      'Perencanaan pembelajaran, asesmen, dan evaluasi',
    ],
    terms:
      'Terbuka untuk dokter, perawat, bidan, farmasi, gizi, dan fisioterapis. Peserta mengikuti seluruh rangkaian dan wajib memiliki akun SATUSEHAT / Plataran Sehat. Kuota terbatas.',
  },
  {
    id: 'p11',
    kind: 'gambar',
    name: 'Paket Vaksinasi Flubio',
    status: 'published',
    archived: false,
    start: '2026-10-12',
    end: '2026-12-31',
    updatedAt: '2026-10-12 10:30',
    updatedBy: 'u2',
    imageUrl: '/dummy/vaksin-flubio.svg',
    imageFile: 'Poster Vaksin Flubio.jpg',
    imageSize: 1_100_000,
    buttons: ['wa', 'tel'],
    title: 'Paket Vaksinasi Influenza Flubio',
    category: 'paket',
    price: 'Rp 299.000',
    priceUnit: 'paket',
    description:
      'Lindungi diri dari influenza, terutama saat kasus flu sedang meningkat. Paket vaksinasi Flubio di RS Bethesda Yogyakarta sudah termasuk konsultasi dokter.',
    listTitle: 'Termasuk',
    points: ['Vaksin Flubio', 'Konsultasi dokter', 'Tindakan vaksinasi', 'Buku vaksin'],
    terms: 'Pendaftaran melalui WhatsApp CS, Aplikasi Mobile RS Bethesda, atau telepon (0274) 521249 / 521250.',
  },
  {
    id: 'p12',
    kind: 'gambar',
    name: 'Pelatihan BTCLS Desember',
    status: 'published',
    archived: false,
    start: '2026-10-30',
    end: '2026-12-09',
    updatedAt: '2026-10-26 14:15',
    updatedBy: 'u2',
    imageUrl: '/dummy/btcls.svg',
    imageFile: 'Poster BTCLS.jpg',
    imageSize: 1_000_000,
    buttons: ['wa', 'tel'],
    title: 'Pelatihan BTCLS · Basic Trauma Cardiac Life Support',
    category: 'acara',
    price: 'Rp 1.400.000',
    priceUnit: 'peserta',
    description:
      'Pelatihan blended learning bagi perawat dan mahasiswa keperawatan semester akhir: teori daring 3–5 Desember, praktik luring 7–9 Desember 2026 di RS Bethesda Yogyakarta.',
    listTitle: 'Materi',
    points: [
      'Bantuan Hidup Dasar (BHD)',
      'Triage dan initial assessment',
      'Manajemen airway & breathing',
      'Pasien trauma dan gangguan sirkulasi',
      'Kegawatdaruratan kardiovaskular',
      'Evakuasi dan transportasi pasien',
    ],
    terms: 'Peserta wajib memiliki akun SATUSEHAT SDMK / Plataran Sehat.',
  },
  {
    id: 'p13',
    kind: 'gambar',
    name: 'Pelatihan ATLS Klasikal Desember',
    status: 'published',
    archived: false,
    start: '2026-11-09',
    end: '2026-12-13',
    updatedAt: '2026-10-26 14:20',
    updatedBy: 'u2',
    imageUrl: '/dummy/atls-klasikal.svg',
    imageFile: 'Poster ATLS Klasikal.jpg',
    imageSize: 1_200_000,
    buttons: ['wa', 'tel'],
    title: 'Pelatihan ATLS Metode Klasikal',
    category: 'acara',
    price: 'Rp 5.800.000',
    priceUnit: 'peserta',
    description:
      'Pelatihan ATLS tatap muka bersama IKABI, berstatus akreditasi Madya Kemenkes. Jumat–Minggu, 11–13 Desember 2026, pukul 07.00–17.00 WIB di RS Bethesda Yogyakarta.',
    listTitle: 'Materi',
    points: [
      'Shock dan thoracic trauma',
      'Abdominal and pelvic trauma',
      'Head, spine, dan spinal cord trauma',
      'Musculoskeletal trauma dan thermal injury',
      'Trauma pada anak, lansia, dan kehamilan',
      'Triage dan transfer to definitive care',
    ],
    terms:
      'Untuk dokter, dokter spesialis bedah, anestesiologi & terapi intensif, serta emergensi medisin. Peserta wajib memiliki akun SATUSEHAT SDMK / Plataran Sehat.',
  },
  {
    id: 'p14',
    kind: 'gambar',
    name: 'World Heart Day 2026',
    status: 'published',
    archived: false,
    start: '2026-09-29',
    end: '2026-10-06',
    updatedAt: '2026-09-29 19:45',
    updatedBy: 'u1',
    imageUrl: '/dummy/world-heart-day.svg',
    imageFile: 'Poster World Heart Day.jpg',
    imageSize: 1_400_000,
    buttons: ['wa', 'tel'],
    title: 'World Heart Day 2026: Don’t Miss a Beat',
    category: 'info',
    description:
      'Penyakit jantung tidak selalu bergejala. Kenali faktor risikonya sejak dini dan periksakan diri ke Klinik Jantung RS Bethesda Yogyakarta bila perlu.',
    listTitle: 'Langkah sederhana',
    points: [
      'Cek tekanan darah secara rutin',
      'Periksa gula darah dan kolesterol',
      'Aktif bergerak dan hindari rokok',
      'Jaga berat badan dan pola makan',
    ],
  },
  {
    id: 'a1',
    kind: 'pengumuman',
    name: 'Lab tutup pemeliharaan',
    status: 'published',
    archived: false,
    start: '2026-10-25',
    end: '2026-11-02',
    updatedAt: '2026-10-25 07:45',
    updatedBy: 'u1',
    text: 'Layanan lab tutup 1–2 Nov 2026 untuk pemeliharaan alat. IGD tetap buka 24 jam.',
    level: 'penting',
  },
]

const pages: Page[] = [
  {
    id: 'pg1',
    name: 'Poster Mitra Pabrik',
    theme: 'ungu',
    status: 'published',
    isDefault: false,
    posterIds: ['p1', 'p2', 'p3', 'p4', 'p5'],
    updatedAt: '2026-10-25 14:22',
  },
  {
    id: 'pg2',
    name: 'Promo MCU Oktober',
    theme: 'merah',
    status: 'published',
    isDefault: false,
    posterIds: ['p2', 'p1'],
    updatedAt: '2026-10-02 11:40',
  },
  {
    id: 'pg3',
    name: 'Info Klinik & Acara',
    theme: 'hijau',
    status: 'published',
    isDefault: false,
    posterIds: ['p4', 'p5', 'p6', 'p7'],
    updatedAt: '2026-10-20 09:10',
  },
  { id: 'pg4', name: 'Halaman Umum', theme: 'ungu', status: 'published', isDefault: true, posterIds: [], updatedAt: '2026-08-01 08:00' },
  {
    id: 'pg5',
    name: 'Diklat & Acara RS Bethesda',
    theme: 'hijau',
    status: 'published',
    isDefault: false,
    // Live ones first; scheduled and ended posters wait or drop off by themselves.
    posterIds: ['p9', 'p11', 'p10', 'p12', 'p13', 'p14'],
    updatedAt: '2026-10-26 14:30',
  },
]

const cards: Card[] = [
  [
    'K7Q2M9XA',
    'Pos satpam gerbang utama',
    'PT Contoh Tekstil · Produksi',
    'pg1',
    'aktif',
    'sudah',
    '2026-08-12 09:00',
    true,
    '2026-10-27 07:41',
  ],
  ['R8WFZ3KD', 'Kantin lantai 1', 'PT Contoh Tekstil · Produksi', 'pg1', 'aktif', 'sudah', '2026-08-12 09:04', true, '2026-10-27 06:58'],
  ['M2XN7HTB', 'Papan info HRD', 'PT Contoh Tekstil · Produksi', 'pg2', 'aktif', 'sudah', '2026-08-14 10:20', false, '2026-10-25 09:44'],
  [
    'H3LPQSTX',
    'Pintu bongkar muat 2',
    'PT Contoh Tekstil · Gudang',
    'pg1',
    'nonaktif',
    'sudah',
    '2026-08-15 08:30',
    true,
    '2026-09-30 10:10',
  ],
  ['9VJ6CEUA', 'Kasir kantin', 'CV Contoh Pangan · Kantin', 'pg3', 'aktif', 'sudah', '2026-09-02 11:00', false, '2026-10-27 12:01'],
  ['T5BYK2WG', 'Meja informasi', 'RS Bethesda · Lobi', 'pg3', 'aktif', 'sudah', '2026-09-03 08:45', false, '2026-10-27 09:20'],
  ['W7KD3MQP', 'Pos satpam gerbang 2', 'PT Contoh Logam · Kantor', 'pg2', 'aktif', 'sudah', '2026-10-27 09:12', true, null],
  ['B2ZT9XRC', 'Ruang laktasi', 'PT Contoh Logam · Kantor', 'pg1', 'aktif', 'gagal', null, false, null],
  ['N4HV8JLA', 'Ruang rapat lantai 2', 'PT Contoh Logam · Kantor', 'pg1', 'aktif', 'belum', null, false, null],
  ['P4NTRY3Q', 'Pantry lantai 3', 'PT Contoh Logam · Kantor', null, 'aktif', 'belum', null, false, null],
  // New card for the events page; not written yet and never tapped, so the seeded analytics stay the same.
  ['E7VNT2KQ', 'Papan acara lobi', 'RS Bethesda · Lobi', 'pg5', 'aktif', 'belum', null, false, null],
].map(
  ([code, label, group, pageId, status, writeStatus, writtenAt, locked, lastTap]) =>
    ({
      code,
      label,
      group,
      pageId,
      status,
      writeStatus,
      writtenAt,
      writtenBy: writtenAt ? 'u4' : null,
      locked,
      lastTap,
    }) as Card,
)

const audit: AuditEntry[] = [
  {
    id: 'l1',
    at: '2026-10-27 09:12',
    userId: 'u4',
    action: 'Menulis',
    entity: 'Kartu',
    target: 'W7KD3MQP · Pos satpam gerbang 2',
    before: 'Belum ditulis',
    after: 'Sudah ditulis · terkunci',
  },
  {
    id: 'l2',
    at: '2026-10-27 08:15',
    userId: 'u1',
    action: 'Masuk',
    entity: 'Sesi',
    target: 'Panel Admin',
    before: '',
    after: 'Login berhasil',
  },
  { id: 'l3', at: '2026-10-26 16:10', userId: 'u2', action: 'Membuat', entity: 'Poster', target: 'Sleep Lab', before: '', after: 'Draft' },
  {
    id: 'l4',
    at: '2026-10-26 15:00',
    userId: 'u2',
    action: 'Menerbitkan',
    entity: 'Poster',
    target: 'Senam Sehat Jumat',
    before: 'Draft',
    after: 'Terbit · 6 Nov–31 Des 2026',
  },
  {
    id: 'l5',
    at: '2026-10-25 07:45',
    userId: 'u1',
    action: 'Menerbitkan',
    entity: 'Pengumuman',
    target: 'Lab tutup pemeliharaan',
    before: 'Draft',
    after: 'Terbit · 25 Okt–2 Nov 2026',
  },
  {
    id: 'l6',
    at: '2026-10-24 13:42',
    userId: 'u3',
    action: 'Gagal masuk',
    entity: 'Sesi',
    target: 'sari@rs-bethesda.test',
    before: '4 percobaan gagal',
    after: 'Akun terkunci',
  },
  {
    id: 'l7',
    at: '2026-10-23 10:05',
    userId: 'u4',
    action: 'Menonaktifkan',
    entity: 'Kartu',
    target: 'H3LPQSTX · Pintu bongkar muat 2',
    before: 'Aktif',
    after: 'Nonaktif (kartu hilang)',
  },
  {
    id: 'l8',
    at: '2026-10-22 09:30',
    userId: 'u1',
    action: 'Memetakan',
    entity: 'Kartu',
    target: '2 kartu · Tekstil · Produksi',
    before: 'Promo MCU Oktober',
    after: 'Poster Mitra Pabrik',
  },
]

const settings: Settings = {
  company: 'RS Bethesda Yogyakarta',
  tagline: 'Tolong Dulu Urusan Belakang',
  logoUrl: '/brand/logo.png',
  address: 'Jl. Jend. Sudirman No. 70, Yogyakarta 55224',
  // Placeholders: replace with the Marketing team's real WhatsApp and phone numbers.
  wa: '628000000001',
  phone: '(0274) 586688',
  email: 'marketing@rs-bethesda.test',
  hours: 'Senin–Jumat, 08.00–16.00 WIB',
  website: 'https://www.bethesda.or.id',
  brochure: 'https://www.bethesda.or.id',
  retentionAudit: 365,
  retentionTap: 730,
  baseUrl: 'https://poster.rs-bethesda.test/k/',
}

// Deterministic fake analytics for the last 90 days (no personal data).
function buildDaily(): DailyRow[] {
  let seed = 20261027
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }
  const rows: DailyRow[] = []
  const clickable = ['p1|wa', 'p1|tel', 'p1|doc', 'p2|wa', 'p2|tel', 'p3|wa', 'p4|wa', 'p5|doc']
  for (let d = 89; d >= 0; d--) {
    const date = addDays(TODAY, -d)
    const dow = new Date(`${date}T00:00:00`).getDay()
    const weekday = dow === 0 ? 0.35 : dow === 6 ? 0.6 : 1
    const trend = 0.7 + ((89 - d) / 89) * 0.6
    cards.forEach((c, ci) => {
      if (!c.lastTap || !c.pageId) return
      if (c.status === 'nonaktif' && d < 28) return
      const base = (ci % 3 === 0 ? 9 : 5) * weekday * trend
      const taps = Math.max(0, Math.round(base + (rnd() - 0.5) * base))
      if (!taps) return
      const clicks: Record<string, number> = {}
      const n = Math.round(taps * (0.18 + rnd() * 0.15))
      for (let k = 0; k < n; k++) {
        const key = clickable[Math.floor(rnd() * clickable.length)]!
        clicks[key] = (clicks[key] || 0) + 1
      }
      rows.push({ date, card: c.code, pageId: c.pageId, taps, bots: rnd() < 0.15 ? 1 : 0, clicks })
    })
  }
  return rows
}
const daily = buildDaily()

let seq = 100
export function nextId(prefix: string) {
  seq += 1
  return `${prefix}${seq}`
}

export function logAudit(userId: string, action: string, entity: string, target: string, before = '', after = '') {
  audit.unshift({ id: nextId('l'), at: nowStamp(), userId, action, entity, target, before, after })
}

// Password hashes, kept apart from `users` so no API response can include them.
// Every seeded account starts with NUXT_SEED_PASSWORD (or the demo password), hashed at startup.
const SEED_PASSWORD = seedPassword(process.env.NUXT_SEED_PASSWORD)
if (SEED_PASSWORD === DEMO_PASSWORD && process.env.NODE_ENV === 'production')
  console.warn('[auth] Seeded accounts use the public demo password. Set NUXT_SEED_PASSWORD on any server others can reach.')
const credentials = createCredentialStore()
for (const u of users) credentials.seed(u.id, SEED_PASSWORD)

export const db = { users, posters, pages, cards, audit, settings, daily, credentials }

/** Files from the dummy upload route, kept only in memory. */
export const uploads = new Map<string, { type: string; data: Uint8Array }>()
