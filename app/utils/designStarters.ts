// Starting designs for the canvas editor. Every design carries the locked logo
// and "Informasi" blocks, which take their content from Settings.
import { BACKGROUNDS, BRAND_HEIGHT, DESIGN_SIZE } from '#shared/design'
import type { DesignElement, ImageElement, LabelElement, PosterDesign, RectElement, TextElement } from '#shared/design'

const { width: W, height: H } = DESIGN_SIZE
const M = 48
const PHOTO = '/dummy/foto-contoh.svg'

export const newId = () => Math.random().toString(36).slice(2, 10)

export const makeText = (t: Partial<TextElement> & Pick<TextElement, 'text'>): TextElement => ({
  id: newId(),
  type: 'text',
  x: 60,
  y: 200,
  rotation: 0,
  width: W - 120,
  fontSize: 56,
  bold: false,
  fill: '#ffffff',
  align: 'center',
  ...t,
})
export const makeLabel = (l: Partial<LabelElement> & Pick<LabelElement, 'text'>): LabelElement => ({
  id: newId(),
  type: 'label',
  x: 300,
  y: 600,
  rotation: 0,
  fontSize: 64,
  fill: '#0b3a6e',
  background: '#facc15',
  ...l,
})
export const makeRect = (r: Partial<RectElement> = {}): RectElement => ({
  id: newId(),
  type: 'rect',
  x: 340,
  y: 500,
  rotation: 0,
  width: 400,
  height: 300,
  fill: '#ffffff',
  cornerRadius: 28,
  ...r,
})
export const makePhoto = (p: Partial<ImageElement> = {}): ImageElement => ({
  id: newId(),
  type: 'image',
  x: 240,
  y: 420,
  rotation: 0,
  width: 600,
  height: 600,
  src: PHOTO,
  cornerRadius: 28,
  ...p,
})

function brand(): DesignElement[] {
  return [
    { id: newId(), type: 'logo', x: M, y: M, rotation: 0, width: 520 },
    { id: newId(), type: 'info', x: M, y: H - M - BRAND_HEIGHT.info, rotation: 0, width: W - 2 * M },
  ]
}

function design(bg: number, elements: DesignElement[]): PosterDesign {
  const { top, bottom } = BACKGROUNDS[bg]!
  // Brand blocks go last so they stay on top of everything else.
  return { version: 1, background: { top, bottom }, elements: [...elements, ...brand()] }
}

export const STARTERS: { id: string; name: string; description: string; make: () => PosterDesign }[] = [
  {
    id: 'paket',
    name: 'Paket layanan',
    description: 'Judul, foto, daftar manfaat, harga',
    make: () =>
      design(0, [
        makeText({ text: 'Sleep Lab', y: 190, fontSize: 130, bold: true }),
        makeText({ text: 'Pemeriksaan kualitas tidur', y: 340, fontSize: 50, bold: true }),
        makePhoto({ x: 60, y: 440, width: 470, height: 620 }),
        makeRect({ x: 560, y: 440, width: 460, height: 480 }),
        makeText({
          text: 'Manfaat:\n• Deteksi dini gangguan tidur\n• Cegah risiko jantung & stroke\n• Hidup lebih produktif\n• Terapi yang tepat',
          x: 590,
          y: 470,
          width: 400,
          fontSize: 42,
          fill: '#0b3a6e',
          align: 'left',
        }),
        makeLabel({ text: 'Rp 3.100.000', x: 580, y: 950, rotation: -4 }),
      ]),
  },
  {
    id: 'promo',
    name: 'Promo harga',
    description: 'Harga besar dan masa berlaku',
    make: () =>
      design(2, [
        makeText({ text: 'Hemat 30%', y: 230, fontSize: 140, bold: true }),
        makeText({ text: 'MCU Basic untuk karyawan', y: 420, fontSize: 56, bold: true }),
        makeLabel({ text: 'Rp 315.000', x: 300, y: 560, fontSize: 96 }),
        makeText({ text: 'Normal Rp 450.000 · minimal 20 karyawan\nBerlaku sampai 31 Oktober 2026', y: 780, fontSize: 42 }),
      ]),
  },
  {
    id: 'acara',
    name: 'Acara / jadwal',
    description: 'Tanggal, jam, tempat, foto',
    make: () =>
      design(1, [
        makeText({ text: 'Senam Sehat', y: 190, fontSize: 140, bold: true }),
        makeText({ text: 'Setiap Jumat · 06.30 WIB · Lapangan Utama', y: 360, fontSize: 46, bold: true }),
        makePhoto({ x: 60, y: 450, width: W - 120, height: 440 }),
        makeLabel({ text: 'Gratis untuk karyawan', x: 60, y: 930, fontSize: 52, background: '#ffffff' }),
      ]),
  },
  {
    id: 'kosong',
    name: 'Kosong',
    description: 'Hanya logo dan kotak Informasi',
    make: () => design(0, []),
  },
]
