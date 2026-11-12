// Poster designs made in the canvas editor (Konva). The design is saved with the
// poster so it can be edited again; visitors only ever see the exported image.

/** Phone portrait 4:5, exported at this exact size. */
export const DESIGN_SIZE = { width: 1080, height: 1350 } as const
/** Smallest font the editor allows: about 12 px on a phone screen. */
export const MIN_FONT = 36
/** Below this the readability check warns. */
export const READABLE_FONT = 42
export const MAX_FONT = 220
export const MAX_ELEMENTS = 60
/** Brand blocks: their content comes from Settings and staff cannot edit or delete them. */
export const BRAND_HEIGHT = { logo: 96, info: 170 } as const

export const BRAND_COLORS = [
  { name: 'Putih', value: '#ffffff' },
  { name: 'Kuning', value: '#facc15' },
  { name: 'Biru merek', value: '#1673c4' },
  { name: 'Biru tua', value: '#0b3a6e' },
  { name: 'Biru muda', value: '#bae6fd' },
  { name: 'Merah', value: '#b91c1c' },
  { name: 'Hitam', value: '#18181b' },
] as const

export const BACKGROUNDS = [
  { name: 'Biru', top: '#4fb3ee', bottom: '#0b4f91' },
  { name: 'Biru tua', top: '#1e40af', bottom: '#0b1e4f' },
  { name: 'Oranye', top: '#f97316', bottom: '#991b1b' },
  { name: 'Hijau', top: '#16a34a', bottom: '#14532d' },
  { name: 'Terang', top: '#f0f9ff', bottom: '#7dd3fc' },
] as const

interface ElementBase {
  id: string
  x: number
  y: number
  rotation: number
}

export interface TextElement extends ElementBase {
  type: 'text'
  width: number
  text: string
  fontSize: number
  bold: boolean
  fill: string
  align: 'left' | 'center' | 'right'
}

/** A text on a coloured tag, e.g. a price badge. */
export interface LabelElement extends ElementBase {
  type: 'label'
  text: string
  fontSize: number
  fill: string
  background: string
}

export interface RectElement extends ElementBase {
  type: 'rect'
  width: number
  height: number
  fill: string
  cornerRadius: number
}

export interface ImageElement extends ElementBase {
  type: 'image'
  width: number
  height: number
  src: string
  cornerRadius: number
}

export interface BrandElement extends ElementBase {
  type: 'logo' | 'info'
  width: number
}

export type DesignElement = TextElement | LabelElement | RectElement | ImageElement | BrandElement

export interface PosterDesign {
  version: 1
  background: { top: string; bottom: string }
  elements: DesignElement[]
}

export const ELEMENT_LABEL: Record<DesignElement['type'], string> = {
  text: 'Teks',
  label: 'Label',
  rect: 'Kotak',
  image: 'Foto',
  logo: 'Logo RS',
  info: 'Kotak Informasi',
}

export const isLocked = (el: DesignElement): el is BrandElement => el.type === 'logo' || el.type === 'info'

/** Short name for lists: the element's own text when it has one. */
export function elementName(el: DesignElement): string {
  if (el.type === 'text' || el.type === 'label') return el.text.split('\n')[0]!.slice(0, 28) || ELEMENT_LABEL[el.type]
  return ELEMENT_LABEL[el.type]
}

/** Smallest font in the design, for the readability check. */
export function smallestFont(design: PosterDesign): number | null {
  const sizes = design.elements.flatMap(el => (el.type === 'text' || el.type === 'label' ? [el.fontSize] : []))
  return sizes.length ? Math.min(...sizes) : null
}

/** The design's words in reading order, used to pre-fill "Tulis ulang isi poster". */
export function designText(design: PosterDesign): string {
  return design.elements
    .filter((el): el is TextElement | LabelElement => el.type === 'text' || el.type === 'label')
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map(el => el.text.trim())
    .filter(Boolean)
    .join('\n')
}
