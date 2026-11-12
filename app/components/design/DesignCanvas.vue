<script setup lang="ts">
// Konva stage that draws a poster design at any scale. In the editor it also
// handles select, drag, resize and rotate; as a thumbnail it is read-only.
import type Konva from 'konva'
import type { VueKonvaRef } from 'vue-konva'
import {
  Group as KGroup,
  Image as KImage,
  Label as KLabel,
  Layer as KLayer,
  Rect as KRect,
  Stage as KStage,
  Tag as KTag,
  Text as KText,
  Transformer as KTransformer,
} from 'vue-konva'
import { BRAND_HEIGHT, DESIGN_SIZE, MAX_FONT, MIN_FONT, isLocked } from '#shared/design'
import type { DesignElement, ImageElement, PosterDesign } from '#shared/design'
import type { Settings } from '#shared/types'

type Brand = Pick<Settings, 'company' | 'tagline' | 'wa' | 'phone' | 'website' | 'hours'>

const props = withDefaults(
  defineProps<{
    design: PosterDesign
    brand: Brand
    scale: number
    selectedId?: string | null
    readonly?: boolean
  }>(),
  { selectedId: null, readonly: false },
)

const emit = defineEmits<{
  select: [id: string | null]
  change: [id: string, patch: Partial<DesignElement>]
}>()

const { width: W, height: H } = DESIGN_SIZE
const FONT = '"Plus Jakarta Sans Variable", "Plus Jakarta Sans", sans-serif'
const INK = '#0b3a6e'
const BLUE = '#1673c4'

const stageRef = ref<VueKonvaRef<Konva.Stage>>()
const trRef = ref<VueKonvaRef<Konva.Transformer>>()

// Text is measured when drawn, so wait for the poster font before the first draw.
const fontsReady = ref(false)
onMounted(async () => {
  await Promise.all(['400', '800'].map(w => document.fonts.load(`${w} 40px "Plus Jakarta Sans Variable"`))).catch(() => {})
  fontsReady.value = true
})

// Images: loaded once per src, shared by every element that uses it.
const images = shallowReactive(new Map<string, HTMLImageElement>())
const loading = new Map<string, Promise<HTMLImageElement>>()
function loadImage(src: string): Promise<HTMLImageElement> {
  let p = loading.get(src)
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new window.Image()
      img.onload = () => {
        images.set(src, img)
        resolve(img)
      }
      img.onerror = reject
      img.src = src
    })
    loading.set(src, p)
  }
  return p
}
watchEffect(() => {
  for (const el of props.design.elements) if (el.type === 'image') loadImage(el.src).catch(() => {})
})

/** Crops the photo to fill its box without stretching (like CSS object-fit: cover). */
function cover(el: ImageElement) {
  const img = images.get(el.src)
  if (!img) return undefined
  const ratio = Math.max(el.width / img.naturalWidth, el.height / img.naturalHeight)
  const w = el.width / ratio
  const h = el.height / ratio
  return { x: (img.naturalWidth - w) / 2, y: (img.naturalHeight - h) / 2, width: w, height: h }
}

const base = (el: DesignElement) => ({
  id: el.id,
  x: el.x,
  y: el.y,
  rotation: el.rotation,
  draggable: !props.readonly && !isLocked(el),
})

/** Logo tile text, e.g. "RS Bethesda Yogyakarta" -> "RB". */
const brandInitials = computed(() => initials(props.brand.company))
const waDisplay = computed(() => (props.brand.wa.startsWith('62') ? `0${props.brand.wa.slice(2)}` : props.brand.wa))
const site = computed(() => props.brand.website.replace(/^https?:\/\//, '').replace(/\/$/, ''))

const selected = computed(() => props.design.elements.find(e => e.id === props.selectedId) ?? null)
const trConfig = computed(() => {
  const el = selected.value
  const common = {
    borderStroke: '#f97316',
    borderStrokeWidth: 2,
    anchorStroke: '#f97316',
    anchorFill: '#ffffff',
    anchorSize: 14,
    anchorCornerRadius: 3,
    rotationSnaps: [0, 90, 180, 270],
    rotateAnchorOffset: 36,
    boundBoxFunc: (old: { width: number; height: number }, box: { width: number; height: number }) =>
      Math.abs(box.width) < 20 || Math.abs(box.height) < 20 ? old : box,
  }
  if (!el || isLocked(el)) return { ...common, resizeEnabled: false, rotateEnabled: false }
  if (el.type === 'text') return { ...common, enabledAnchors: ['middle-left', 'middle-right'] }
  if (el.type === 'label') return { ...common, keepRatio: true, enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'] }
  return common
})

// Keep the transformer on the selected node, including after re-renders and undo.
watch(
  [() => props.selectedId, () => props.design, fontsReady],
  () => {
    const tr = trRef.value?.getNode()
    const stage = stageRef.value?.getStage()
    if (!tr || !stage) return
    const node = props.selectedId ? stage.findOne(`#${props.selectedId}`) : undefined
    tr.nodes(node ? [node] : [])
  },
  { flush: 'post', deep: true },
)

// Events are handled once on the stage and transformer rather than per element:
// Konva events bubble, and each element is found from the node's id.
const byId = (id: string) => props.design.elements.find(e => e.id === id)

/** The design element a clicked node belongs to (clicks can land on a group's child). */
function elementOf(node: Konva.Node | null): DesignElement | undefined {
  for (let n = node; n && n.nodeType !== 'Stage'; n = n.getParent()) {
    const el = n.id() ? byId(n.id()) : undefined
    if (el) return el
  }
  return undefined
}

function onStageDown(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
  if (props.readonly) return
  // Dragging a transformer handle must not change the selection.
  if (e.target.getParent()?.getClassName() === 'Transformer') return
  emit('select', elementOf(e.target)?.id ?? null)
}

function onDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
  const el = byId(e.target.id())
  if (el) emit('change', el.id, { x: Math.round(e.target.x()), y: Math.round(e.target.y()) })
}

/** Text boxes change width, not font size, while being resized. */
function onTransform(n: Konva.Node) {
  if (byId(n.id())?.type !== 'text') return
  n.setAttrs({ width: Math.max(40, n.width() * n.scaleX()), scaleX: 1, scaleY: 1 })
}

function onTransformEnd(n: Konva.Node) {
  const el = byId(n.id())
  if (!el) return
  const sx = n.scaleX()
  const sy = n.scaleY()
  n.scale({ x: 1, y: 1 })
  const patch: Record<string, number> = { x: Math.round(n.x()), y: Math.round(n.y()), rotation: Math.round(n.rotation()) }
  if (el.type === 'text') patch.width = Math.round(n.width())
  else if (el.type === 'label') patch.fontSize = Math.round(Math.min(MAX_FONT, Math.max(MIN_FONT, el.fontSize * sy)))
  else if (el.type === 'rect' || el.type === 'image') {
    patch.width = Math.round(Math.max(10, el.width * sx))
    patch.height = Math.round(Math.max(10, el.height * sy))
  }
  emit('change', el.id, patch as Partial<DesignElement>)
}

// The transformer reports resizes for whichever node it is attached to.
watch(trRef, tr => {
  const node = tr?.getNode()
  if (!node) return
  node.off('.design')
  node.on('transform.design', () => node.nodes().forEach(onTransform))
  node.on('transformend.design', () => node.nodes().forEach(onTransformEnd))
})

/** Exports the design at full size (1080 × 1350) as WebP, or PNG where WebP is unsupported. */
async function exportBlob(): Promise<Blob> {
  await Promise.all(props.design.elements.flatMap(el => (el.type === 'image' ? [loadImage(el.src)] : [])))
  await nextTick()
  const tr = trRef.value?.getNode()
  const stage = stageRef.value?.getStage()
  if (!stage) throw new Error('Kanvas belum siap.')
  const before = tr?.nodes() ?? []
  tr?.nodes([])
  try {
    return (await stage.toBlob({ pixelRatio: 1 / props.scale, mimeType: 'image/webp', quality: 0.92 })) as Blob
  } finally {
    tr?.nodes(before)
  }
}
defineExpose({ exportBlob })
</script>

<template>
  <div :style="{ width: `${W * scale}px`, height: `${H * scale}px` }" class="shrink-0">
    <KStage
      v-if="fontsReady"
      ref="stageRef"
      :config="{ width: W * scale, height: H * scale, scaleX: scale, scaleY: scale, listening: !readonly }"
      @mousedown="onStageDown"
      @touchstart="onStageDown"
      @dragend="onDragEnd"
    >
      <KLayer>
        <KRect
          :config="{
            name: 'background',
            width: W,
            height: H,
            fillLinearGradientStartPoint: { x: 0, y: 0 },
            fillLinearGradientEndPoint: { x: W * 0.25, y: H },
            fillLinearGradientColorStops: [0, design.background.top, 1, design.background.bottom],
          }"
        />

        <template v-for="el in design.elements" :key="el.id">
          <KText
            v-if="el.type === 'text'"
            :config="{
              ...base(el),
              width: el.width,
              text: el.text,
              fontSize: el.fontSize,
              fontFamily: FONT,
              fontStyle: el.bold ? '800' : '400',
              fill: el.fill,
              align: el.align,
              lineHeight: 1.15,
            }"
          />

          <KLabel v-else-if="el.type === 'label'" :config="base(el)">
            <KTag :config="{ fill: el.background, cornerRadius: el.fontSize * 0.25 }" />
            <KText
              :config="{
                text: el.text,
                fontSize: el.fontSize,
                fontFamily: FONT,
                fontStyle: '800',
                fill: el.fill,
                padding: el.fontSize * 0.35,
              }"
            />
          </KLabel>

          <KRect
            v-else-if="el.type === 'rect'"
            :config="{ ...base(el), width: el.width, height: el.height, fill: el.fill, cornerRadius: el.cornerRadius }"
          />

          <KImage
            v-else-if="el.type === 'image'"
            :config="{
              ...base(el),
              width: el.width,
              height: el.height,
              image: images.get(el.src),
              crop: cover(el),
              cornerRadius: el.cornerRadius,
            }"
          />

          <KGroup v-else-if="el.type === 'logo'" :config="base(el)">
            <KRect :config="{ width: el.width, height: BRAND_HEIGHT.logo, fill: '#ffffff', cornerRadius: 20 }" />
            <KRect :config="{ x: 16, y: 16, width: 64, height: 64, fill: BLUE, cornerRadius: 14 }" />
            <KText
              :config="{
                x: 16,
                y: 16,
                width: 64,
                height: 64,
                text: brandInitials,
                fontSize: 28,
                fontFamily: FONT,
                fontStyle: '800',
                fill: '#ffffff',
                align: 'center',
                verticalAlign: 'middle',
              }"
            />
            <KText
              :config="{
                x: 96,
                y: 18,
                width: el.width - 112,
                text: brand.company.toUpperCase(),
                fontSize: 28,
                fontFamily: FONT,
                fontStyle: '800',
                fill: INK,
                wrap: 'none',
                ellipsis: true,
              }"
            />
            <KText
              :config="{
                x: 96,
                y: 54,
                width: el.width - 112,
                text: brand.tagline,
                fontSize: 22,
                fontFamily: FONT,
                fill: '#334155',
                wrap: 'none',
                ellipsis: true,
              }"
            />
          </KGroup>

          <KGroup v-else-if="el.type === 'info'" :config="base(el)">
            <KRect :config="{ width: el.width, height: BRAND_HEIGHT.info, fill: '#ffffff', cornerRadius: 20 }" />
            <KRect :config="{ x: 24, y: 22, width: 190, height: 48, fill: BLUE, cornerRadius: 10 }" />
            <KText
              :config="{
                x: 24,
                y: 22,
                width: 190,
                height: 48,
                text: 'Informasi',
                fontSize: 28,
                fontFamily: FONT,
                fontStyle: '800',
                fill: '#ffffff',
                align: 'center',
                verticalAlign: 'middle',
              }"
            />
            <KText
              :config="{
                x: 234,
                y: 34,
                width: el.width - 258,
                text: brand.hours,
                fontSize: 24,
                fontFamily: FONT,
                fill: '#334155',
                wrap: 'none',
                ellipsis: true,
              }"
            />
            <KText
              :config="{
                x: 24,
                y: 88,
                width: el.width - 48,
                text: `WhatsApp ${waDisplay}   ·   Telepon ${brand.phone}\n${site}`,
                fontSize: 28,
                fontFamily: FONT,
                fontStyle: '800',
                fill: INK,
                lineHeight: 1.35,
              }"
            />
          </KGroup>
        </template>

        <KTransformer v-if="!readonly" ref="trRef" :config="trConfig" />
      </KLayer>
    </KStage>
  </div>
</template>
