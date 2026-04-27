'use client'

import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import type { Canvas } from 'fabric'
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  initCanvas,
  loadBgImage,
  addTextLayers,
  addQrLayer,
  addQrImageLayer,
  exportPng,
  clearNonBg,
  addFreeTextBlock,
  getSelectedTextProps,
  updateSelectedTextProps,
  deleteSelectedObject,
  saveCanvasState,
  loadCanvasState,
  getCanvasTexts,
  addTextBlocksFromContent,
  setBackgroundOverlay,
  applyTextStyles,
  addBoxBlock,
  getSelectedObjectType,
  getSelectedBoxProps,
  updateSelectedBoxProps,
  setLayerOrder,
  alignObject,
  toggleSafeArea,
  groupSelected,
  ungroupSelected,
  addImageBlock,
} from '../lib/fabric-helpers'
import type { SelectedTextProps, SelectedBoxProps, SelectedObjectType, TextStyleSuggestion } from '../lib/fabric-helpers'
import type { BannerContent } from '../lib/templates'

export type BannerEditorHandle = {
  loadBackground: (imageUrl: string) => Promise<void>
  applyTextAndQr: (content: BannerContent, qrImageDataUrl?: string) => Promise<void>
  download: (filename?: string) => void
  addText: (text?: string) => Promise<void>
  addContentBlocks: (text: string) => Promise<void>
  addQrImage: (dataUrl: string) => Promise<void>
  addImage: (dataUrl: string) => Promise<void>
  addBox: () => Promise<void>
  getTexts: () => string[]
  updateSelected: (props: Partial<SelectedTextProps>) => void
  updateSelectedBox: (props: Partial<SelectedBoxProps>) => void
  deleteSelected: () => void
  setBrightness: (value: number) => Promise<void>
  setLayer: (direction: 'forward' | 'backward' | 'front' | 'back') => void
  alignSelected: (align: 'center-h' | 'center-v' | 'center') => Promise<void>
  toggleSafeArea: (show: boolean) => Promise<void>
  groupSelected: () => Promise<void>
  ungroupSelected: () => Promise<void>
  applyTextStyles: (suggestions: TextStyleSuggestion[]) => void
  saveState: () => string | null
  loadState: (json: string) => Promise<void>
}

type Props = {
  placeholder?: boolean
  onSelectionChange?: (props: SelectedTextProps | null) => void
  onBoxSelectionChange?: (props: SelectedBoxProps | null) => void
  onObjectTypeChange?: (type: SelectedObjectType) => void
}

const BannerEditor = forwardRef<BannerEditorHandle, Props>(function BannerEditor(
  { placeholder, onSelectionChange, onBoxSelectionChange, onObjectTypeChange },
  ref,
) {
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<Canvas | null>(null)
  const onSelectionChangeRef = useRef(onSelectionChange)
  onSelectionChangeRef.current = onSelectionChange
  const onBoxSelectionChangeRef = useRef(onBoxSelectionChange)
  onBoxSelectionChangeRef.current = onBoxSelectionChange
  const onObjectTypeChangeRef = useRef(onObjectTypeChange)
  onObjectTypeChangeRef.current = onObjectTypeChange

  useEffect(() => {
    const el = canvasElRef.current
    if (!el) return
    let active = true

    initCanvas(el).then((canvas) => {
      if (!active) {
        try { canvas.dispose() } catch { /* aborted — safe */ }
        return
      }
      fabricRef.current = canvas

      const notifySelection = () => {
        const type = getSelectedObjectType(canvas)
        onObjectTypeChangeRef.current?.(type)
        onSelectionChangeRef.current?.(type === 'text' ? getSelectedTextProps(canvas) : null)
        onBoxSelectionChangeRef.current?.(type === 'box' ? getSelectedBoxProps(canvas) : null)
      }
      const notifyClear = () => {
        onObjectTypeChangeRef.current?.(null)
        onSelectionChangeRef.current?.(null)
        onBoxSelectionChangeRef.current?.(null)
      }

      canvas.on('selection:created', notifySelection)
      canvas.on('selection:updated', notifySelection)
      canvas.on('selection:cleared', notifyClear)
      canvas.on('text:changed', notifySelection)
    })

    return () => {
      active = false
      if (fabricRef.current) {
        try { fabricRef.current.dispose().catch(() => {}) } catch { /* aborted — safe */ }
        fabricRef.current = null
      }
    }
  }, [])

  useImperativeHandle(ref, () => ({
    async loadBackground(imageUrl: string) {
      const canvas = fabricRef.current
      if (!canvas) return
      canvas.clear()
      canvas.set('backgroundColor', '#e8f4fd')
      await loadBgImage(canvas, imageUrl)
    },

    async applyTextAndQr(content: BannerContent, qrImageDataUrl?: string) {
      const canvas = fabricRef.current
      if (!canvas) return
      await clearNonBg(canvas)
      await addTextLayers(canvas, content)
      if (qrImageDataUrl) {
        await addQrImageLayer(canvas, qrImageDataUrl)
      } else if (content.qrUrl) {
        await addQrLayer(canvas, content.qrUrl)
      }
    },

    download(filename = 'banner.png') {
      const canvas = fabricRef.current
      if (!canvas) return
      const dataUrl = exportPng(canvas)
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = filename
      a.click()
    },

    async addText(text = '텍스트 입력') {
      const canvas = fabricRef.current
      if (!canvas) return
      await addFreeTextBlock(canvas, text)
      onSelectionChangeRef.current?.(getSelectedTextProps(canvas))
      onObjectTypeChangeRef.current?.('text')
    },

    async addContentBlocks(text: string) {
      const canvas = fabricRef.current
      if (!canvas) return
      await addTextBlocksFromContent(canvas, text)
    },

    async addQrImage(dataUrl: string) {
      const canvas = fabricRef.current
      if (!canvas) return
      await addQrImageLayer(canvas, dataUrl)
    },

    async addImage(dataUrl: string) {
      const canvas = fabricRef.current
      if (!canvas) return
      await addImageBlock(canvas, dataUrl)
      onObjectTypeChangeRef.current?.('image')
    },

    async addBox() {
      const canvas = fabricRef.current
      if (!canvas) return
      await addBoxBlock(canvas)
      onBoxSelectionChangeRef.current?.(getSelectedBoxProps(canvas))
      onObjectTypeChangeRef.current?.('box')
    },

    getTexts(): string[] {
      const canvas = fabricRef.current
      if (!canvas) return []
      return getCanvasTexts(canvas)
    },

    updateSelected(props: Partial<SelectedTextProps>) {
      const canvas = fabricRef.current
      if (!canvas) return
      updateSelectedTextProps(canvas, props)
      onSelectionChangeRef.current?.(getSelectedTextProps(canvas))
    },

    updateSelectedBox(props: Partial<SelectedBoxProps>) {
      const canvas = fabricRef.current
      if (!canvas) return
      updateSelectedBoxProps(canvas, props)
      onBoxSelectionChangeRef.current?.(getSelectedBoxProps(canvas))
    },

    deleteSelected() {
      const canvas = fabricRef.current
      if (!canvas) return
      deleteSelectedObject(canvas)
      onObjectTypeChangeRef.current?.(null)
      onSelectionChangeRef.current?.(null)
      onBoxSelectionChangeRef.current?.(null)
    },

    async setBrightness(value: number) {
      const canvas = fabricRef.current
      if (!canvas) return
      await setBackgroundOverlay(canvas, value)
    },

    setLayer(direction: 'forward' | 'backward' | 'front' | 'back') {
      const canvas = fabricRef.current
      if (!canvas) return
      setLayerOrder(canvas, direction)
    },

    async alignSelected(align: 'center-h' | 'center-v' | 'center') {
      const canvas = fabricRef.current
      if (!canvas) return
      await alignObject(canvas, align)
    },

    async toggleSafeArea(show: boolean) {
      const canvas = fabricRef.current
      if (!canvas) return
      await toggleSafeArea(canvas, show)
    },

    async groupSelected() {
      const canvas = fabricRef.current
      if (!canvas) return
      await groupSelected(canvas)
      onObjectTypeChangeRef.current?.('group')
      onSelectionChangeRef.current?.(null)
      onBoxSelectionChangeRef.current?.(null)
    },

    async ungroupSelected() {
      const canvas = fabricRef.current
      if (!canvas) return
      await ungroupSelected(canvas)
      onObjectTypeChangeRef.current?.('multi')
      onSelectionChangeRef.current?.(null)
      onBoxSelectionChangeRef.current?.(null)
    },

    applyTextStyles(suggestions: TextStyleSuggestion[]) {
      const canvas = fabricRef.current
      if (!canvas) return
      applyTextStyles(canvas, suggestions)
    },

    saveState(): string | null {
      const canvas = fabricRef.current
      if (!canvas) return null
      return saveCanvasState(canvas)
    },

    async loadState(json: string) {
      const canvas = fabricRef.current
      if (!canvas) return
      await loadCanvasState(canvas, json)
      onObjectTypeChangeRef.current?.(null)
      onSelectionChangeRef.current?.(null)
      onBoxSelectionChangeRef.current?.(null)
    },
  }))

  return (
    <div
      className="relative border border-gray-300 rounded-xl overflow-hidden shadow-lg bg-sky-100"
      style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, flexShrink: 0 }}
    >
      <canvas ref={canvasElRef} />
      {placeholder && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 pointer-events-none">
          <div className="text-4xl mb-3">🎨</div>
          <p className="text-sm text-center px-6">좌측에서 스타일을 선택하고<br />배너 이미지를 생성하세요</p>
        </div>
      )}
    </div>
  )
})

export default BannerEditor
