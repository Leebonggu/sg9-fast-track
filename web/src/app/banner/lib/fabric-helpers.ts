import type { Canvas, IText, FabricImage as FabricImageType, FabricObject } from 'fabric'
import type { BannerContent } from './templates'

export const CANVAS_WIDTH = 340
export const CANVAS_HEIGHT = 1020
export const EXPORT_SCALE = 3

type FabricModule = typeof import('fabric')

// Tracks canvas instances per element to handle React StrictMode double-mount
const managedCanvases = new WeakMap<HTMLCanvasElement, Canvas>()

export async function initCanvas(el: HTMLCanvasElement): Promise<Canvas> {
  const { Canvas } = (await import('fabric')) as FabricModule

  // Dispose any existing canvas on this element before creating a new one.
  // This handles React StrictMode's double-mount in development.
  const existing = managedCanvases.get(el)
  if (existing) {
    try { existing.dispose().catch(() => {}) } catch { /* aborted — safe */ }
    managedCanvases.delete(el)
  }

  const canvas = new Canvas(el, {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    selection: true,
  })
  // fabric v7: backgroundColor must be set after construction
  canvas.set('backgroundColor', '#e8f4fd')
  canvas.requestRenderAll()
  managedCanvases.set(el, canvas)
  return canvas
}

export async function loadBgImage(canvas: Canvas, imageUrl: string): Promise<void> {
  const { FabricImage } = (await import('fabric')) as FabricModule
  const isDataUrl = imageUrl.startsWith('data:')
  const img = (await FabricImage.fromURL(
    imageUrl,
    isDataUrl ? undefined : { crossOrigin: 'anonymous' },
  )) as FabricImageType

  const imgW = img.width || CANVAS_WIDTH
  const imgH = img.height || CANVAS_HEIGHT
  // cover: fill canvas without empty edges, centered (Fabric v7 default origin is 'center')
  const scale = Math.max(CANVAS_WIDTH / imgW, CANVAS_HEIGHT / imgH)
  const left = (CANVAS_WIDTH - imgW * scale) / 2
  const top = (CANVAS_HEIGHT - imgH * scale) / 2

  img.set({ left, top, scaleX: scale, scaleY: scale, originX: 'left', originY: 'top', selectable: false, evented: false })
  canvas.insertAt(0, img)
  canvas.requestRenderAll()
}

type LayerDef = {
  text: string
  left: number
  top: number
  fontSize: number
  fill: string
  fontWeight?: string
  fontFamily?: string
  width?: number
  textAlign?: string
  backgroundColor?: string
  padding?: number
}

function buildLayers(content: BannerContent): LayerDef[] {
  const W = CANVAS_WIDTH
  return [
    {
      text: content.title,
      left: W / 2,
      top: 200,
      fontSize: 26,
      fill: '#1a3a6b',
      fontWeight: 'bold',
      fontFamily: 'Noto Sans KR, sans-serif',
      width: W - 40,
      textAlign: 'center',
    },
    {
      text: content.subtitle,
      left: W / 2,
      top: 255,
      fontSize: 15,
      fill: '#ffffff',
      fontWeight: 'bold',
      fontFamily: 'Noto Sans KR, sans-serif',
      width: W - 60,
      textAlign: 'center',
      backgroundColor: '#1a5fb4',
      padding: 6,
    },
    {
      text: content.bullets.map((b) => `✓ ${b}`).join('\n'),
      left: 30,
      top: 310,
      fontSize: 13,
      fill: '#1a3a6b',
      fontFamily: 'Noto Sans KR, sans-serif',
      width: W - 50,
    },
    {
      text: content.ctaText,
      left: 30,
      top: 440,
      fontSize: 16,
      fill: '#ffffff',
      fontWeight: 'bold',
      fontFamily: 'Noto Sans KR, sans-serif',
      width: 160,
      backgroundColor: '#2d8a4e',
      padding: 8,
    },
    {
      text: content.orgName,
      left: W / 2,
      top: 900,
      fontSize: 11,
      fill: '#ffffff',
      fontFamily: 'Noto Sans KR, sans-serif',
      width: W - 30,
      textAlign: 'center',
    },
    {
      text: content.contactInfo,
      left: W / 2,
      top: 930,
      fontSize: 10,
      fill: '#cce0ff',
      fontFamily: 'Noto Sans KR, sans-serif',
      width: W - 30,
      textAlign: 'center',
    },
  ]
}

export async function addTextLayers(canvas: Canvas, content: BannerContent): Promise<void> {
  const { IText } = (await import('fabric')) as FabricModule
  const layers = buildLayers(content)

  for (const def of layers) {
    const obj = new IText(def.text, {
      left: def.left,
      top: def.top,
      fontSize: def.fontSize,
      fill: def.fill,
      fontWeight: def.fontWeight ?? 'normal',
      fontFamily: def.fontFamily ?? 'sans-serif',
      width: def.width,
      textAlign: (def.textAlign as 'left' | 'center' | 'right') ?? 'left',
      backgroundColor: def.backgroundColor,
      padding: def.padding ?? 0,
      originX: def.textAlign === 'center' ? 'center' : 'left',
      editable: true,
      splitByGrapheme: false,
    } as ConstructorParameters<typeof IText>[1])
    canvas.add(obj)
  }
  canvas.requestRenderAll()
}

// QR from URL (auto-generate via API)
export async function addQrLayer(canvas: Canvas, qrUrl: string): Promise<void> {
  if (!qrUrl) return
  const { FabricImage } = (await import('fabric')) as FabricModule
  const apiUrl = `/api/banner/qr?url=${encodeURIComponent(qrUrl)}`
  const img = (await FabricImage.fromURL(apiUrl, { crossOrigin: 'anonymous' })) as FabricImageType
  img.set({ left: 210, top: 430, scaleX: 0.36, scaleY: 0.36, selectable: true })
  canvas.add(img)
  canvas.requestRenderAll()
}

// QR from uploaded image (data URL)
export async function addQrImageLayer(canvas: Canvas, dataUrl: string): Promise<void> {
  const { FabricImage } = (await import('fabric')) as FabricModule
  const img = (await FabricImage.fromURL(dataUrl)) as FabricImageType
  const size = 110
  img.set({
    left: 210,
    top: 430,
    scaleX: size / (img.width ?? size),
    scaleY: size / (img.height ?? size),
    selectable: true,
  })
  canvas.add(img)
  canvas.requestRenderAll()
}

export function exportPng(canvas: Canvas): string {
  return canvas.toDataURL({ format: 'png', multiplier: EXPORT_SCALE })
}

export async function clearNonBg(canvas: Canvas): Promise<void> {
  const objects = canvas.getObjects()
  const toRemove = objects.filter((o) => o.selectable !== false)
  canvas.remove(...toRemove)
  canvas.requestRenderAll()
}

export type SelectedTextProps = {
  fontSize: number
  fill: string
  fontWeight: string
  fontStyle: string
  textAlign: 'left' | 'center' | 'right'
  backgroundColor: string
}

export async function addFreeTextBlock(canvas: Canvas, text = '텍스트 입력'): Promise<void> {
  const { IText } = (await import('fabric')) as FabricModule
  const obj = new IText(text, {
    left: CANVAS_WIDTH / 2,
    top: CANVAS_HEIGHT / 2,
    originX: 'center',
    originY: 'center',
    fontSize: 20,
    fill: '#1a3a6b',
    fontWeight: 'normal',
    fontStyle: 'normal',
    fontFamily: 'Noto Sans KR, sans-serif',
    backgroundColor: '',
    textAlign: 'left',
    editable: true,
    selectable: true,
  } as ConstructorParameters<typeof IText>[1])
  canvas.add(obj)
  canvas.setActiveObject(obj)
  canvas.requestRenderAll()
}

export function getSelectedTextProps(canvas: Canvas): SelectedTextProps | null {
  const obj = canvas.getActiveObject()
  if (!obj || obj.type !== 'i-text') return null
  const t = obj as unknown as IText
  return {
    fontSize: (t.fontSize as number) ?? 16,
    fill: String(t.fill ?? '#000000'),
    fontWeight: String(t.fontWeight ?? 'normal'),
    fontStyle: String(t.fontStyle ?? 'normal'),
    textAlign: (t.textAlign as 'left' | 'center' | 'right') ?? 'left',
    backgroundColor: String(t.backgroundColor ?? ''),
  }
}

export function updateSelectedTextProps(canvas: Canvas, props: Partial<SelectedTextProps>): void {
  const obj = canvas.getActiveObject()
  if (!obj || obj.type !== 'i-text') return
  obj.set(props as Partial<typeof obj>)
  canvas.requestRenderAll()
}

export function getCanvasTexts(canvas: Canvas): string[] {
  return canvas
    .getObjects()
    .filter((o) => o.type === 'i-text')
    .map((o) => (o as unknown as IText).text)
    .filter(Boolean)
}

export async function addTextBlocksFromContent(canvas: Canvas, text: string): Promise<void> {
  const { IText } = (await import('fabric')) as FabricModule
  // split by blank lines into sections; each section = one movable block
  const sections = text.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean)

  let topOffset = 120
  for (const section of sections) {
    const lineCount = section.split('\n').length
    const obj = new IText(section, {
      left: CANVAS_WIDTH / 2,
      top: topOffset,
      originX: 'center',
      originY: 'top',
      fontSize: 18,
      fill: '#1a3a6b',
      fontWeight: 'normal',
      fontFamily: 'Noto Sans KR, sans-serif',
      backgroundColor: '',
      textAlign: 'center',
      editable: true,
      selectable: true,
    } as ConstructorParameters<typeof IText>[1])
    canvas.add(obj)
    topOffset += lineCount * 26 + 32
  }
  canvas.requestRenderAll()
}

export function deleteSelectedObject(canvas: Canvas): void {
  const obj = canvas.getActiveObject()
  if (!obj || obj.selectable === false) return
  canvas.remove(obj)
  canvas.discardActiveObject()
  canvas.requestRenderAll()
}

const BRIGHTNESS_OVERLAY_TAG = '__brightnessOverlay'

export async function setBackgroundOverlay(canvas: Canvas, value: number): Promise<void> {
  const { Rect } = (await import('fabric')) as FabricModule

  // remove existing overlay
  const existing = canvas.getObjects().find((o) => (o as unknown as Record<string, unknown>)[BRIGHTNESS_OVERLAY_TAG])
  if (existing) canvas.remove(existing)

  if (value === 0) {
    canvas.requestRenderAll()
    return
  }

  const alpha = Math.abs(value) / 100
  const fill = value < 0 ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha})`

  const rect = new Rect({
    left: 0,
    top: 0,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    fill,
    selectable: false,
    evented: false,
    originX: 'left',
    originY: 'top',
  })
  ;(rect as unknown as Record<string, unknown>)[BRIGHTNESS_OVERLAY_TAG] = true

  // insert just above the background image
  const bgIdx = canvas.getObjects().findIndex((o) => o.selectable === false && o.type === 'image')
  canvas.insertAt(bgIdx >= 0 ? bgIdx + 1 : 0, rect)
  canvas.requestRenderAll()
}

export function saveCanvasState(canvas: Canvas): string {
  return JSON.stringify(canvas.toJSON())
}

export async function loadCanvasState(canvas: Canvas, json: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (canvas as any).loadFromJSON(JSON.parse(json))
  canvas.requestRenderAll()
}

// ─── Auto-style text blocks ──────────────────────────────────────────────────

export type TextStyleSuggestion = {
  index: number
  fontSize: number
  fill: string
  fontWeight: 'bold' | 'normal'
  fontStyle: 'normal' | 'italic'
  textAlign: 'left' | 'center' | 'right'
  backgroundColor: string
  left?: number
  top?: number
  width?: number
}

export function applyTextStyles(canvas: Canvas, suggestions: TextStyleSuggestion[]): void {
  const textObjs = canvas.getObjects().filter((o) => o.type === 'i-text') as unknown as IText[]
  for (const s of suggestions) {
    const obj = textObjs[s.index]
    if (!obj) continue
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, unknown> = {
      fontSize: s.fontSize,
      fill: s.fill,
      fontWeight: s.fontWeight,
      fontStyle: s.fontStyle,
      textAlign: s.textAlign,
      backgroundColor: s.backgroundColor,
    }
    // position: left = center-X, top = top-Y, both use origin center/top
    if (s.left !== undefined) { update.left = s.left; update.originX = 'center' }
    if (s.top !== undefined)  { update.top = s.top;   update.originY = 'top' }
    if (s.width !== undefined) update.width = s.width
    obj.set(update as Parameters<typeof obj.set>[0])
  }
  canvas.requestRenderAll()
}

// ─── BoxBlock ────────────────────────────────────────────────────────────────

const BOX_BLOCK_TAG = '__boxBlock'
const SAFE_AREA_TAG = '__safeArea'

export async function addBoxBlock(canvas: Canvas): Promise<void> {
  const { Rect } = (await import('fabric')) as FabricModule
  const rect = new Rect({
    left: CANVAS_WIDTH / 2,
    top: CANVAS_HEIGHT / 2,
    originX: 'center',
    originY: 'center',
    width: 200,
    height: 80,
    fill: '#1a5fb4',
    stroke: '',
    strokeWidth: 0,
    rx: 8,
    ry: 8,
    opacity: 1,
    selectable: true,
    evented: true,
  })
  ;(rect as unknown as Record<string, unknown>)[BOX_BLOCK_TAG] = true
  canvas.add(rect)
  canvas.setActiveObject(rect)
  canvas.requestRenderAll()
}

export type SelectedObjectType = 'text' | 'box' | 'image' | 'group' | 'multi' | null

export function getSelectedObjectType(canvas: Canvas): SelectedObjectType {
  const obj = canvas.getActiveObject()
  if (!obj || obj.selectable === false) return null
  const t = obj.type
  if (t === 'i-text') return 'text'
  if (t === 'activeselection') return 'multi'
  if (t === 'group') return 'group'
  if (t === 'image') return 'image'
  if (t === 'rect' && (obj as unknown as Record<string, unknown>)[BOX_BLOCK_TAG]) return 'box'
  return null
}

export type SelectedBoxProps = {
  fill: string
  stroke: string
  strokeWidth: number
  rx: number
  opacity: number
}

export function getSelectedBoxProps(canvas: Canvas): SelectedBoxProps | null {
  const obj = canvas.getActiveObject()
  if (!obj || obj.type !== 'rect') return null
  if (!(obj as unknown as Record<string, unknown>)[BOX_BLOCK_TAG]) return null
  return {
    fill: String(obj.fill ?? '#1a5fb4'),
    stroke: String(obj.stroke ?? ''),
    strokeWidth: Number(obj.strokeWidth ?? 0),
    rx: Number((obj as unknown as { rx?: number }).rx ?? 0),
    opacity: Number(obj.opacity ?? 1),
  }
}

export function updateSelectedBoxProps(canvas: Canvas, props: Partial<SelectedBoxProps>): void {
  const obj = canvas.getActiveObject()
  if (!obj || obj.type !== 'rect') return
  obj.set(props as Partial<typeof obj>)
  canvas.requestRenderAll()
}

// ─── Layer order ─────────────────────────────────────────────────────────────

export function setLayerOrder(
  canvas: Canvas,
  direction: 'forward' | 'backward' | 'front' | 'back',
): void {
  const obj = canvas.getActiveObject()
  if (!obj || obj.selectable === false) return
  switch (direction) {
    case 'forward': canvas.bringObjectForward(obj); break
    case 'backward': canvas.sendObjectBackwards(obj); break
    case 'front': canvas.bringObjectToFront(obj); break
    case 'back': canvas.sendObjectToBack(obj); break
  }
  canvas.requestRenderAll()
}

// ─── Canvas alignment ────────────────────────────────────────────────────────

export async function alignObject(
  canvas: Canvas,
  align: 'center-h' | 'center-v' | 'center',
): Promise<void> {
  const { Point } = (await import('fabric')) as FabricModule
  const obj = canvas.getActiveObject()
  if (!obj || obj.selectable === false) return
  const cp = obj.getCenterPoint()
  const newX = align !== 'center-v' ? CANVAS_WIDTH / 2 : cp.x
  const newY = align !== 'center-h' ? CANVAS_HEIGHT / 2 : cp.y
  obj.setXY(new Point(newX, newY), 'center', 'center')
  canvas.requestRenderAll()
}

// ─── Safe Area guide ─────────────────────────────────────────────────────────

export async function toggleSafeArea(canvas: Canvas, show: boolean): Promise<void> {
  const existing = canvas
    .getObjects()
    .find((o) => (o as unknown as Record<string, unknown>)[SAFE_AREA_TAG])
  if (existing) canvas.remove(existing)

  if (!show) {
    canvas.requestRenderAll()
    return
  }

  const { Rect } = (await import('fabric')) as FabricModule
  const margin = 20
  const guide = new Rect({
    left: margin,
    top: margin,
    width: CANVAS_WIDTH - margin * 2,
    height: CANVAS_HEIGHT - margin * 2,
    fill: 'transparent',
    stroke: 'rgba(255,80,80,0.65)',
    strokeWidth: 1,
    strokeDashArray: [6, 4],
    selectable: false,
    evented: false,
    originX: 'left',
    originY: 'top',
  })
  ;(guide as unknown as Record<string, unknown>)[SAFE_AREA_TAG] = true
  canvas.add(guide)
  canvas.bringObjectToFront(guide)
  canvas.requestRenderAll()
}

// ─── Group / Ungroup ─────────────────────────────────────────────────────────

export async function groupSelected(canvas: Canvas): Promise<void> {
  const { Group } = (await import('fabric')) as FabricModule
  const activeObj = canvas.getActiveObject()
  if (!activeObj || activeObj.type !== 'activeselection') return

  const objects = (activeObj as unknown as { getObjects: () => FabricObject[] }).getObjects().slice()
  canvas.discardActiveObject()
  canvas.remove(...objects)

  const group = new Group(objects)
  canvas.add(group)
  canvas.setActiveObject(group)
  canvas.requestRenderAll()
}

export async function ungroupSelected(canvas: Canvas): Promise<void> {
  const { ActiveSelection } = (await import('fabric')) as FabricModule
  const activeObj = canvas.getActiveObject()
  if (!activeObj || activeObj.type !== 'group') return

  // removeAll removes all objects from the group (exitGroup restores canvas-space transforms)
  const grp = activeObj as unknown as { removeAll: () => FabricObject[] }
  const objects = grp.removeAll()
  canvas.remove(activeObj)
  canvas.add(...objects)

  const sel = new ActiveSelection(objects, { canvas } as ConstructorParameters<typeof ActiveSelection>[1])
  canvas.setActiveObject(sel)
  canvas.requestRenderAll()
}

// ─── General image block ─────────────────────────────────────────────────────

export async function addImageBlock(canvas: Canvas, dataUrl: string): Promise<void> {
  const { FabricImage } = (await import('fabric')) as FabricModule
  const img = (await FabricImage.fromURL(dataUrl)) as FabricImageType
  const maxSize = 200
  const scale = Math.min(maxSize / (img.width ?? maxSize), maxSize / (img.height ?? maxSize))
  img.set({
    left: CANVAS_WIDTH / 2,
    top: CANVAS_HEIGHT / 2,
    originX: 'center',
    originY: 'center',
    scaleX: scale,
    scaleY: scale,
    selectable: true,
  })
  canvas.add(img)
  canvas.setActiveObject(img)
  canvas.requestRenderAll()
}
