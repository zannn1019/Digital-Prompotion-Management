// Generates stand-in poster images (SVG, 4:5) for the dummy data.
// Run: node scripts/make-dummy-posters.mjs
import { mkdirSync, writeFileSync } from 'node:fs'

const posters = [
  ['sleep-lab', 'PAKET LAYANAN', 'Sleep Lab', 'Cek Tidur', 'Rp 3.100.000 / pemeriksaan', '#1e3a8a', '#2494D2', '#00A2E9'],
  ['tms-fisioterapi', 'REHABILITASI', 'Paket TMS', 'Fisioterapi', 'Pasca stroke · mulai Rp 3.599.999', '#312e81', '#4f46e5', '#a5b4fc'],
  ['vip-best', 'RAWAT INAP', 'Layanan', 'VIP BEST', '9 keuntungan pasien VVIP & Suite', '#0b3a6e', '#2F318B', '#2494D2'],
  ['promo-mcu', 'PROMO OKTOBER', 'MCU Basic', 'Hemat 30%', 'Rp 315.000 / karyawan · min. 20 orang', '#7f1d1d', '#dc2626', '#ea580c'],
  ['vaksin-flu', 'ACARA', 'Vaksin Flu', 'Gratis', 'Kamis, 12 Nov · Aula Gedung B', '#1e1b4b', '#5b21b6', '#a855f7'],
  [
    'jadwal-klinik',
    'INFO KLINIK',
    'Klinik Mitra',
    'Buka Tiap Hari',
    'Sen–Jum 07–20 · Sab 07–14 · IGD 24 jam',
    '#052e16',
    '#15803d',
    '#65a30d',
  ],
  ['seminar-k3', 'SEMINAR', 'Seminar K3', 'Ergonomi Kerja', 'Minggu, 1 Nov · 09.00 · Daring', '#0c4a6e', '#0369a1', '#0891b2'],
  ['senam-sehat', 'PROGRAM', 'Senam Sehat', 'Setiap Jumat', '06.30 · Halaman parkir', '#14532d', '#16a34a', '#84cc16'],
  ['donor-darah', 'DONOR', 'Donor Darah', 'Bersama', 'Sabtu, 21 Nov · Lobi Utama', '#450a0a', '#991b1b', '#e11d48'],
  // Events from the hospital's own news page (bethesda.or.id, Nov 2026); stand-ins for their posters.
  ['atls-11', 'PELATIHAN', 'ATLS-11', '20–22 Nov 2026', 'Luring · RS Bethesda · bersama IKABI', '#3f0d12', '#b91c1c', '#f97316'],
  ['preceptorship', 'PELATIHAN DARING', 'Pembimbing', 'Klinik', 'Preceptorship · 16–19 Nov 2026', '#042f2e', '#0f766e', '#2dd4bf'],
  ['vaksin-flubio', 'PAKET VAKSIN', 'Vaksin', 'Flubio', 'Rp 299.000 · termasuk konsultasi', '#2e1065', '#6d28d9', '#c084fc'],
  ['btcls', 'PELATIHAN', 'BTCLS', '3–9 Des 2026', 'Daring + luring · perawat', '#431407', '#c2410c', '#fbbf24'],
  ['atls-klasikal', 'PELATIHAN', 'ATLS', 'Metode Klasikal', '11–13 Des 2026 · 07.00–17.00', '#0b1f4d', '#1d4ed8', '#38bdf8'],
  ['world-heart-day', 'HARI JANTUNG SEDUNIA', 'World Heart', 'Day 2026', "29 Sep · Don't miss a beat", '#4c0519', '#be123c', '#fb7185'],
]

mkdirSync('public/dummy', { recursive: true })
for (const [file, kicker, title, title2, sub, c1, c2, c3] of posters) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset=".55" stop-color="${c2}"/><stop offset="1" stop-color="${c3}"/></linearGradient></defs>
<rect width="800" height="1000" fill="url(#g)"/>
<circle cx="640" cy="380" r="200" fill="#fff" opacity=".14"/>
<circle cx="120" cy="900" r="160" fill="#000" opacity=".12"/>
<g font-family="Arial, Helvetica, sans-serif" fill="#fff">
<text x="60" y="100" font-size="30" font-weight="700" letter-spacing="4">${kicker}</text>
<text x="740" y="100" font-size="24" font-weight="700" text-anchor="end" opacity=".9">RS BETHESDA</text>
<text x="60" y="700" font-size="96" font-weight="800">${title}</text>
<text x="60" y="800" font-size="72" font-weight="800">${title2}</text>
<text x="60" y="880" font-size="32" font-weight="600" opacity=".95">${sub}</text>
</g></svg>`
  writeFileSync(`public/dummy/${file}.svg`, svg)
}
writeFileSync(
  'public/dummy/pdf-placeholder.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000"><rect width="800" height="1000" fill="#27272a"/><g font-family="Arial, sans-serif" fill="#fff" text-anchor="middle"><text x="400" y="480" font-size="64" font-weight="800">PDF</text><text x="400" y="550" font-size="28" opacity=".8">Halaman pertama ditampilkan setelah diproses</text></g></svg>`,
)
console.log('dummy posters written')
