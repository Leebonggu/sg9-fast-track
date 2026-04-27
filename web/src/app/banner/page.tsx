'use client'

import { useState, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import BannerForm from './components/BannerForm'
import type { BannerEditorHandle } from './components/BannerEditor'
import type { SelectedTextProps, SelectedBoxProps, SelectedObjectType } from './lib/fabric-helpers'

const BannerEditor = dynamic(() => import('./components/BannerEditor'), { ssr: false })

export default function BannerPage() {
  const [generating, setGenerating] = useState(false)
  const [hasImage, setHasImage] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingImages, setPendingImages] = useState<string[]>([])
  const [selectedText, setSelectedText] = useState<SelectedTextProps | null>(null)
  const [selectedBox, setSelectedBox] = useState<SelectedBoxProps | null>(null)
  const [selectedObjectType, setSelectedObjectType] = useState<SelectedObjectType>(null)

  const editorRef = useRef<BannerEditorHandle>(null)

  const handleGenerate = useCallback(async (
    model: string,
    style: string,
    purpose: string,
    referenceImageBase64?: string,
  ) => {
    setGenerating(true)
    setError(null)
    try {
      // read current canvas texts to inform the AI background
      const currentTexts = editorRef.current?.getTexts() ?? []

      const res = await fetch('/api/banner/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, templateId: 'custom', style, purpose, referenceImageBase64, currentTexts }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')

      if (data.content) {
        // Claude path: text + optional single background
        const parts: string[] = [
          data.content.title,
          data.content.subtitle,
          data.content.bullets?.join('\n'),
          data.content.ctaText,
          data.content.orgName,
          data.content.contactInfo,
        ].filter(Boolean)
        if (parts.length) await editorRef.current?.addContentBlocks(parts.join('\n\n'))
        if (data.imageUrl) await editorRef.current?.loadBackground(data.imageUrl)
        setHasImage(true)
      } else if (data.imageUrls?.length) {
        // DALL-E path: 2 style variants → show picker
        setPendingImages(data.imageUrls)
      } else if (data.imageUrl) {
        await editorRef.current?.loadBackground(data.imageUrl)
        setHasImage(true)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setGenerating(false)
    }
  }, [])

  const [stylingText, setStylingText] = useState(false)

  const handleAutoStyleText = useCallback(async () => {
    const texts = editorRef.current?.getTexts() ?? []
    if (!texts.length) return
    setStylingText(true)
    try {
      const res = await fetch('/api/banner/style-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (data.suggestions) editorRef.current?.applyTextStyles(data.suggestions)
    } catch (e) {
      setError(e instanceof Error ? e.message : '텍스트 스타일링 실패')
    } finally {
      setStylingText(false)
    }
  }, [])

  const handleApplyPendingImage = useCallback(async (url: string) => {
    await editorRef.current?.loadBackground(url)
    setHasImage(true)
    setPendingImages([])
  }, [])

  const handleAddQrImage = useCallback((dataUrl: string) => {
    editorRef.current?.addQrImage(dataUrl)
    setHasImage(true)
  }, [])

  const handleBrightnessChange = useCallback((value: number) => {
    editorRef.current?.setBrightness(value)
  }, [])

  const handleDownload = useCallback(() => {
    editorRef.current?.download(`banner-${Date.now()}.png`)
  }, [])

  const handleSelectionChange = useCallback((props: SelectedTextProps | null) => {
    setSelectedText(props)
  }, [])

  const handleBoxSelectionChange = useCallback((props: SelectedBoxProps | null) => {
    setSelectedBox(props)
  }, [])

  const handleObjectTypeChange = useCallback((type: SelectedObjectType) => {
    setSelectedObjectType(type)
    if (type !== 'text') setSelectedText(null)
    if (type !== 'box') setSelectedBox(null)
  }, [])

  const handleTextPropChange = useCallback((props: Partial<SelectedTextProps>) => {
    editorRef.current?.updateSelected(props)
  }, [])

  const handleBoxPropChange = useCallback((props: Partial<SelectedBoxProps>) => {
    editorRef.current?.updateSelectedBox(props)
  }, [])

  const handleAddText = useCallback(() => {
    editorRef.current?.addText()
    setHasImage(true)
  }, [])

  const handleAddBox = useCallback(() => {
    editorRef.current?.addBox()
    setHasImage(true)
  }, [])

  const handleDeleteSelected = useCallback(() => {
    editorRef.current?.deleteSelected()
  }, [])

  const handleAddContentBlocks = useCallback((text: string) => {
    editorRef.current?.addContentBlocks(text)
    setHasImage(true)
  }, [])

  const handleSetLayer = useCallback((dir: 'forward' | 'backward' | 'front' | 'back') => {
    editorRef.current?.setLayer(dir)
  }, [])

  const handleAlign = useCallback((align: 'center-h' | 'center-v' | 'center') => {
    editorRef.current?.alignSelected(align)
  }, [])

  const handleToggleSafeArea = useCallback((show: boolean) => {
    editorRef.current?.toggleSafeArea(show)
  }, [])

  const handleGroupSelected = useCallback(() => {
    editorRef.current?.groupSelected()
  }, [])

  const handleUngroupSelected = useCallback(() => {
    editorRef.current?.ungroupSelected()
  }, [])

  const handleAddImageBlock = useCallback((dataUrl: string) => {
    editorRef.current?.addImage(dataUrl)
    setHasImage(true)
  }, [])

  const handleSaveProject = useCallback(() => {
    const json = editorRef.current?.saveState()
    if (!json) return
    const blob = new Blob([json], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `banner-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }, [])

  const handleLoadProject = useCallback(async (json: string) => {
    await editorRef.current?.loadState(json)
    setHasImage(true)
    setSelectedText(null)
    setSelectedBox(null)
    setSelectedObjectType(null)
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">AI 배너 편집기</h1>
          <p className="text-gray-500 text-sm mt-1">
            텍스트 입력 또는 .txt 업로드 → AI가 어울리는 배경 생성 → 자유롭게 편집 → PNG 다운로드
          </p>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            오류: {error}
          </div>
        )}

        <div className="flex gap-6 items-start">
          {/* 좌측: 폼 */}
          <div className="w-80 flex-shrink-0">
            <BannerForm
              onGenerate={handleGenerate}
              generating={generating}
              selectedText={selectedText}
              selectedBox={selectedBox}
              selectedObjectType={selectedObjectType}
              onTextPropChange={handleTextPropChange}
              onBoxPropChange={handleBoxPropChange}
              onAddText={handleAddText}
              onAddBox={handleAddBox}
              onDeleteSelected={handleDeleteSelected}
              onAddContentBlocks={handleAddContentBlocks}
              onBrightnessChange={handleBrightnessChange}
              onSetLayer={handleSetLayer}
              onAlign={handleAlign}
              onToggleSafeArea={handleToggleSafeArea}
              onGroupSelected={handleGroupSelected}
              onUngroupSelected={handleUngroupSelected}
              onSaveProject={handleSaveProject}
              onLoadProject={handleLoadProject}
              onDownload={handleDownload}
              onAddQrImage={handleAddQrImage}
              onAddImageBlock={handleAddImageBlock}
              onAutoStyleText={handleAutoStyleText}
              stylingText={stylingText}
              pendingImages={pendingImages}
              onApplyPendingImage={handleApplyPendingImage}
            />
          </div>

          {/* 우측: 캔버스 */}
          <div className="flex-1 flex justify-center">
            <div className="sticky top-6">
              <BannerEditor
                ref={editorRef}
                placeholder={!hasImage}
                onSelectionChange={handleSelectionChange}
                onBoxSelectionChange={handleBoxSelectionChange}
                onObjectTypeChange={handleObjectTypeChange}
              />
              <p className="text-xs text-center text-gray-400 mt-2">
                텍스트 클릭 → 선택/이동 · 더블클릭 → 직접 편집 · 좌측 패널 → 속성 변경
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
