'use client'

import { useState, useRef } from 'react'
import type { SelectedTextProps, SelectedBoxProps, SelectedObjectType } from '../lib/fabric-helpers'

type Props = {
  onGenerate: (model: string, style: string, purpose: string, referenceImageBase64?: string) => void
  generating: boolean
  pendingImages?: string[]
  onApplyPendingImage?: (url: string) => void
  selectedText: SelectedTextProps | null
  selectedBox: SelectedBoxProps | null
  selectedObjectType: SelectedObjectType
  onTextPropChange: (props: Partial<SelectedTextProps>) => void
  onBoxPropChange: (props: Partial<SelectedBoxProps>) => void
  onAddText: () => void
  onAddBox: () => void
  onDeleteSelected: () => void
  onAddContentBlocks: (text: string) => void
  onBrightnessChange: (value: number) => void
  onSetLayer: (dir: 'forward' | 'backward' | 'front' | 'back') => void
  onAlign: (align: 'center-h' | 'center-v' | 'center') => void
  onToggleSafeArea: (show: boolean) => void
  onGroupSelected: () => void
  onUngroupSelected: () => void
  onAutoStyleText: () => void
  stylingText: boolean
  onSaveProject: () => void
  onLoadProject: (json: string) => void
  onDownload: () => void
  onAddQrImage: (dataUrl: string) => void
  onAddImageBlock: (dataUrl: string) => void
}

const MODELS = [
  { value: 'gpt-image-1', label: 'GPT Image 1 — 배경 이미지 생성 · 최고 품질 ($0.17)', group: 'OpenAI' },
  { value: 'dall-e-3', label: 'DALL-E 3 HD — 배경 이미지 생성 ($0.12)', group: 'OpenAI' },
  { value: 'dall-e-2', label: 'DALL-E 2 — 배경 이미지 생성 ($0.018)', group: 'OpenAI' },
  { value: 'claude-haiku-4-5', label: 'Claude Haiku — 문구 자동 생성 (빠름)', group: 'Claude' },
  { value: 'claude-opus-4-7', label: 'Claude Opus — 문구 자동 생성 (고품질)', group: 'Claude' },
]

const STYLES = [
  { value: 'nature', label: '자연형 (청명·녹색)' },
  { value: 'public', label: '공공형 (navy·white)' },
  { value: 'bold', label: '강조형 (red·black)' },
]

export default function BannerForm({
  onGenerate,
  generating,
  pendingImages = [],
  onApplyPendingImage,
  selectedText,
  selectedBox,
  selectedObjectType,
  onTextPropChange,
  onBoxPropChange,
  onAddText,
  onAddBox,
  onDeleteSelected,
  onAddContentBlocks,
  onBrightnessChange,
  onSetLayer,
  onAlign,
  onToggleSafeArea,
  onGroupSelected,
  onUngroupSelected,
  onAutoStyleText,
  stylingText,
  onSaveProject,
  onLoadProject,
  onDownload,
  onAddQrImage,
  onAddImageBlock,
}: Props) {
  const [model, setModel] = useState('gpt-image-1')
  const [style, setStyle] = useState('nature')
  const [purpose, setPurpose] = useState('')
  const [refImageBase64, setRefImageBase64] = useState<string | undefined>()
  const [refImageName, setRefImageName] = useState<string>('')
  const [textContent, setTextContent] = useState('')
  const [brightness, setBrightnessState] = useState(0)
  const [safeArea, setSafeArea] = useState(false)
  const refFileRef = useRef<HTMLInputElement>(null)

  const isClaudeModel = model.startsWith('claude-')

  const fillHex = selectedText?.fill?.startsWith('#') ? selectedText.fill : '#000000'
  const bgHex = selectedText?.backgroundColor?.startsWith('#') ? selectedText.backgroundColor : '#ffffff'
  const hasBg = !!(selectedText?.backgroundColor)
  const boxFillHex = selectedBox?.fill?.startsWith('#') ? selectedBox.fill : '#1a5fb4'
  const boxStrokeHex = selectedBox?.stroke?.startsWith('#') ? selectedBox.stroke : '#000000'

  function handleRefImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setRefImageName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => setRefImageBase64(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  function clearRefImage() {
    setRefImageBase64(undefined)
    setRefImageName('')
    if (refFileRef.current) refFileRef.current.value = ''
  }

  async function handleDocUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (ext === 'txt' || ext === 'md') {
      const reader = new FileReader()
      reader.onload = (ev) => setTextContent((ev.target?.result as string) ?? '')
      reader.readAsText(file)
    } else {
      const fd = new FormData()
      fd.append('file', file)
      try {
        const res = await fetch('/api/banner/extract-text', { method: 'POST', body: fd })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setTextContent(data.text ?? '')
      } catch (err) {
        alert(`텍스트 추출 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`)
      }
    }
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>, isQr: boolean) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      if (dataUrl) isQr ? onAddQrImage(dataUrl) : onAddImageBlock(dataUrl)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // ── Layer + Align controls (shared across text/box/image) ───────────────
  const LayerAlignControls = () => (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-xs text-gray-500 mb-1">레이어 순서</p>
        <div className="flex gap-1">
          {([ ['front', '맨 앞'], ['forward', '앞으로'], ['backward', '뒤로'], ['back', '맨 뒤'] ] as const).map(([dir, label]) => (
            <button key={dir} onClick={() => onSetLayer(dir)}
              className="flex-1 py-1 rounded text-xs border border-gray-300 bg-white hover:border-gray-500 transition-colors">
              {label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-1">정렬</p>
        <div className="flex gap-1">
          <button onClick={() => onAlign('center-h')}
            className="flex-1 py-1 rounded text-xs border border-gray-300 bg-white hover:border-gray-500 transition-colors">
            ↔ 수평중앙
          </button>
          <button onClick={() => onAlign('center-v')}
            className="flex-1 py-1 rounded text-xs border border-gray-300 bg-white hover:border-gray-500 transition-colors">
            ↕ 수직중앙
          </button>
          <button onClick={() => onAlign('center')}
            className="flex-1 py-1 rounded text-xs border border-gray-300 bg-white hover:border-gray-500 transition-colors">
            ⊕ 중앙
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-4 text-sm">

      {/* ── 텍스트 내용 입력 ────────────────────────────────────────── */}
      <section className="bg-green-50 border border-green-200 rounded-xl p-4">
        <h3 className="font-semibold text-green-800 mb-2">텍스트 내용 입력</h3>
        <p className="text-xs text-gray-500 mb-2">
          직접 입력하거나 파일 업로드 → 빈 줄로 구분된 단락이 각각 이동 가능한 블록으로 배치됩니다
        </p>
        <textarea
          value={textContent}
          onChange={(e) => setTextContent(e.target.value)}
          placeholder={`예시:\n상계9단지 재건축\n신속통합자문 추진 중\n\n동의서를 제출해 주세요\n1분이면 참여 가능합니다\n\n추진준비위원회`}
          rows={7}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none font-mono"
        />
        <div className="flex gap-2 mt-2">
          <label className="flex-1 text-center bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-medium py-1.5 rounded-lg cursor-pointer text-xs transition-colors">
            📄 파일 업로드
            <input type="file" accept=".txt,.md,.pdf,.hwpx,.hwp" className="hidden" onChange={handleDocUpload} />
          </label>
          <button
            onClick={() => { if (textContent.trim()) onAddContentBlocks(textContent) }}
            disabled={!textContent.trim()}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold py-1.5 rounded-lg text-xs transition-colors"
          >
            캔버스에 배치
          </button>
        </div>
      </section>

      {/* ── AI 배경 이미지 생성 ─────────────────────────────────────── */}
      <section className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="font-semibold text-blue-800 mb-1">AI 배경 이미지 생성</h3>
        <p className="text-xs text-gray-400 mb-3">캔버스의 텍스트 내용을 자동으로 읽어 배경에 반영합니다</p>
        <div className="flex flex-col gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">모델</label>
            <select value={model} onChange={(e) => setModel(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              {['OpenAI', 'Claude'].map((group) => (
                <optgroup key={group} label={group}>
                  {MODELS.filter((m) => m.group === group).map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">목적 / 추가 키워드 (선택)</label>
            <input value={purpose} onChange={(e) => setPurpose(e.target.value)}
              placeholder="예: 재건축 동의서 수거, 커뮤니티 이벤트..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              참고 이미지 (선택)
              <span className="text-gray-400 ml-1">— GPT-4o mini로 스타일 분석 후 반영</span>
            </label>
            {refImageBase64 ? (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <span className="text-green-700 text-xs flex-1 truncate">{refImageName}</span>
                <button onClick={clearRefImage} className="text-red-500 hover:text-red-700 text-xs">✕ 제거</button>
              </div>
            ) : (
              <label className="flex items-center gap-2 border-2 border-dashed border-gray-300 rounded-lg px-3 py-2 cursor-pointer hover:border-blue-400 transition-colors">
                <span className="text-gray-400 text-xs">📎 참고 이미지 업로드</span>
                <input ref={refFileRef} type="file" accept="image/*" className="hidden" onChange={handleRefImageUpload} />
              </label>
            )}
          </div>
          <button
            onClick={() => onGenerate(model, style, purpose, refImageBase64)}
            disabled={generating}
            className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-300 text-white font-semibold py-2 rounded-lg transition-colors"
          >
            {generating
              ? '생성 중...'
              : isClaudeModel
                ? '✍️ 문구 자동 생성 (Claude)'
                : model === 'gpt-image-1'
                  ? '🎨 배경 이미지 생성 (GPT Image)'
                  : '🎨 배경 이미지 생성 (DALL-E)'}
          </button>
          {isClaudeModel && (
            <p className="text-xs text-gray-400">Claude가 문구를 생성하고 캔버스에 배치합니다. 이후 DALL-E로 배경도 생성합니다.</p>
          )}
        </div>
      </section>

      {/* ── 배경 스타일 선택 (생성된 2개 썸네일) ──────────────────── */}
      {pendingImages.length > 0 && (
        <section className="bg-yellow-50 border border-yellow-300 rounded-xl p-3">
          <h3 className="font-semibold text-yellow-800 mb-2 text-xs">배경 선택 — 마음에 드는 것을 클릭하세요</h3>
          <div className="flex gap-2">
            {pendingImages.map((url, i) => (
              <button
                key={i}
                onClick={() => onApplyPendingImage?.(url)}
                className="flex-1 overflow-hidden rounded-lg border-2 border-transparent hover:border-yellow-500 transition-all"
                title={`스타일 ${i + 1} 적용`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`style ${i + 1}`} className="w-full object-cover" style={{ height: 160 }} />
                <p className="text-xs text-center text-yellow-700 py-1 font-medium">스타일 {i + 1} 적용</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── 요소 추가 ───────────────────────────────────────────────── */}
      <section className="bg-amber-50 border border-amber-200 rounded-xl p-3">
        <h3 className="font-semibold text-amber-800 mb-2 text-xs uppercase tracking-wide">요소 추가</h3>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onAddText}
            className="bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2 rounded-lg transition-colors text-xs">
            T 텍스트 블록
          </button>
          <button onClick={onAddBox}
            className="bg-indigo-500 hover:bg-indigo-600 text-white font-semibold py-2 rounded-lg transition-colors text-xs">
            ▣ 사각형 박스
          </button>
          <label className="bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-medium py-2 rounded-lg cursor-pointer text-xs text-center transition-colors">
            🖼 이미지 추가
            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, false)} />
          </label>
          <label className="bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-medium py-2 rounded-lg cursor-pointer text-xs text-center transition-colors">
            ◻ QR 추가
            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, true)} />
          </label>
        </div>
        <button
          onClick={onAutoStyleText}
          disabled={stylingText}
          className="w-full mt-2 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white font-semibold py-2 rounded-lg transition-colors text-xs"
        >
          {stylingText ? '✨ 스타일 적용 중...' : '✨ 텍스트 자동 꾸미기 (Claude)'}
        </button>
        <p className="text-xs text-gray-400 mt-1 text-center">캔버스의 텍스트 블록을 Claude가 분석해 자동 스타일 적용</p>
      </section>

      {/* ── 배경 밝기 ───────────────────────────────────────────────── */}
      <section className="bg-gray-50 border border-gray-200 rounded-xl p-3">
        <h3 className="font-semibold text-gray-700 mb-2 text-xs uppercase tracking-wide">배경 밝기</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-6 text-right">어둡</span>
          <input type="range" min="-100" max="100" value={brightness}
            onChange={(e) => {
              const v = Number(e.target.value)
              setBrightnessState(v)
              onBrightnessChange(v)
            }}
            className="flex-1 accent-gray-600"
          />
          <span className="text-xs text-gray-400 w-6">밝음</span>
          <span className="text-xs text-gray-500 w-8 text-right font-mono">{brightness > 0 ? `+${brightness}` : brightness}</span>
          {brightness !== 0 && (
            <button onClick={() => { setBrightnessState(0); onBrightnessChange(0) }}
              className="text-xs text-gray-400 hover:text-gray-600">↺</button>
          )}
        </div>
      </section>

      {/* ── 선택된 텍스트 편집 ──────────────────────────────────────── */}
      {selectedObjectType === 'text' && selectedText && (
        <section className="bg-purple-50 border border-purple-300 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-purple-800 text-sm">텍스트 편집</h3>
            <button onClick={onDeleteSelected}
              className="text-red-500 hover:text-red-700 text-xs font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors">
              🗑 삭제
            </button>
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">글자 크기: {selectedText.fontSize}px</label>
              <div className="flex items-center gap-2">
                <input type="range" min="8" max="120" value={selectedText.fontSize}
                  onChange={(e) => onTextPropChange({ fontSize: Number(e.target.value) })}
                  className="flex-1 accent-purple-600" />
                <input type="number" min="8" max="120" value={selectedText.fontSize}
                  onChange={(e) => onTextPropChange({ fontSize: Number(e.target.value) })}
                  className="w-14 border border-gray-300 rounded px-2 py-1 text-xs text-center" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">글자 색상</label>
              <div className="flex items-center gap-2">
                <input type="color" value={fillHex}
                  onChange={(e) => onTextPropChange({ fill: e.target.value })}
                  className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0.5" />
                <span className="text-xs text-gray-500 font-mono">{selectedText.fill}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">배경 색상</label>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="bg-toggle" checked={hasBg}
                  onChange={(e) => onTextPropChange({ backgroundColor: e.target.checked ? '#ffffff' : '' })}
                  className="rounded cursor-pointer" />
                <label htmlFor="bg-toggle" className="text-xs text-gray-500 cursor-pointer">배경 사용</label>
                {hasBg && (
                  <input type="color" value={bgHex}
                    onChange={(e) => onTextPropChange({ backgroundColor: e.target.value })}
                    className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0.5" />
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">스타일</label>
              <div className="flex gap-2">
                <button
                  onClick={() => onTextPropChange({ fontWeight: selectedText.fontWeight === 'bold' ? 'normal' : 'bold' })}
                  className={`px-3 py-1.5 rounded text-sm font-bold border transition-colors ${selectedText.fontWeight === 'bold' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400'}`}>
                  B
                </button>
                <button
                  onClick={() => onTextPropChange({ fontStyle: selectedText.fontStyle === 'italic' ? 'normal' : 'italic' })}
                  className={`px-3 py-1.5 rounded text-sm italic border transition-colors ${selectedText.fontStyle === 'italic' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400'}`}>
                  I
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">정렬</label>
              <div className="flex gap-1">
                {(['left', 'center', 'right'] as const).map((align) => (
                  <button key={align} onClick={() => onTextPropChange({ textAlign: align })}
                    className={`flex-1 py-1.5 rounded text-xs border transition-colors ${selectedText.textAlign === align ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400'}`}>
                    {align === 'left' ? '← 좌' : align === 'center' ? '≡ 중' : '우 →'}
                  </button>
                ))}
              </div>
            </div>
            <LayerAlignControls />
          </div>
        </section>
      )}

      {/* ── 선택된 박스 편집 ────────────────────────────────────────── */}
      {selectedObjectType === 'box' && selectedBox && (
        <section className="bg-indigo-50 border border-indigo-300 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-indigo-800 text-sm">박스 편집</h3>
            <button onClick={onDeleteSelected}
              className="text-red-500 hover:text-red-700 text-xs font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors">
              🗑 삭제
            </button>
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">배경색</label>
              <div className="flex items-center gap-2">
                <input type="color" value={boxFillHex}
                  onChange={(e) => onBoxPropChange({ fill: e.target.value })}
                  className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0.5" />
                <span className="text-xs text-gray-500 font-mono">{selectedBox.fill}</span>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">테두리 색상</label>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="stroke-toggle" checked={!!selectedBox.stroke}
                  onChange={(e) => onBoxPropChange({ stroke: e.target.checked ? '#000000' : '', strokeWidth: e.target.checked ? 2 : 0 })}
                  className="rounded cursor-pointer" />
                <label htmlFor="stroke-toggle" className="text-xs text-gray-500 cursor-pointer">테두리 사용</label>
                {selectedBox.stroke && (
                  <input type="color" value={boxStrokeHex}
                    onChange={(e) => onBoxPropChange({ stroke: e.target.value })}
                    className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0.5" />
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">모서리 둥글기: {selectedBox.rx}px</label>
              <input type="range" min="0" max="60" value={selectedBox.rx}
                onChange={(e) => onBoxPropChange({ rx: Number(e.target.value) })}
                className="w-full accent-indigo-600" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">불투명도: {Math.round(selectedBox.opacity * 100)}%</label>
              <input type="range" min="0" max="1" step="0.05" value={selectedBox.opacity}
                onChange={(e) => onBoxPropChange({ opacity: Number(e.target.value) })}
                className="w-full accent-indigo-600" />
            </div>
            <LayerAlignControls />
          </div>
        </section>
      )}

      {/* ── 이미지/QR 선택 시 ───────────────────────────────────────── */}
      {selectedObjectType === 'image' && (
        <section className="bg-orange-50 border border-orange-200 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-orange-700 font-medium">이미지가 선택되었습니다</span>
            <button onClick={onDeleteSelected}
              className="text-red-600 hover:text-red-800 text-xs font-medium px-3 py-1.5 rounded bg-red-100 hover:bg-red-200 transition-colors">
              🗑 삭제
            </button>
          </div>
          <LayerAlignControls />
        </section>
      )}

      {/* ── 그룹 / 언그룹 ───────────────────────────────────────────── */}
      {(selectedObjectType === 'multi' || selectedObjectType === 'group') && (
        <section className="bg-teal-50 border border-teal-200 rounded-xl p-3">
          <h3 className="font-semibold text-teal-800 mb-2 text-xs uppercase tracking-wide">그룹</h3>
          <div className="flex gap-2">
            {selectedObjectType === 'multi' && (
              <button onClick={onGroupSelected}
                className="flex-1 bg-teal-500 hover:bg-teal-600 text-white font-semibold py-2 rounded-lg transition-colors text-xs">
                ⊞ 그룹으로 묶기
              </button>
            )}
            {selectedObjectType === 'group' && (
              <>
                <button onClick={onUngroupSelected}
                  className="flex-1 bg-white hover:bg-gray-50 border border-teal-300 text-teal-700 font-semibold py-2 rounded-lg transition-colors text-xs">
                  ⊟ 그룹 해제
                </button>
                <button onClick={onDeleteSelected}
                  className="px-3 py-2 rounded-lg text-xs text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors">
                  🗑
                </button>
              </>
            )}
          </div>
          {selectedObjectType === 'group' && (
            <div className="mt-2">
              <LayerAlignControls />
            </div>
          )}
        </section>
      )}

      {/* ── Safe Area 가이드 ────────────────────────────────────────── */}
      <section className="bg-gray-50 border border-gray-200 rounded-xl p-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={safeArea}
            onChange={(e) => {
              setSafeArea(e.target.checked)
              onToggleSafeArea(e.target.checked)
            }}
            className="rounded" />
          <span className="text-xs text-gray-600 font-medium">Safe Area 가이드 표시</span>
          <span className="text-xs text-gray-400">(인쇄 여백 20px)</span>
        </label>
      </section>

      {/* ── 프로젝트 저장 / 불러오기 ────────────────────────────────── */}
      <section className="bg-gray-100 border border-gray-200 rounded-xl p-3">
        <h3 className="font-semibold text-gray-600 mb-2 text-xs uppercase tracking-wide">프로젝트 저장 / 불러오기</h3>
        <div className="flex gap-2">
          <button onClick={onSaveProject}
            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 rounded-lg transition-colors text-sm">
            💾 저장
          </button>
          <label className="flex-1 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-2 rounded-lg transition-colors text-sm border border-gray-300 text-center cursor-pointer">
            📂 불러오기
            <input type="file" accept=".json" className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = (ev) => {
                  const json = ev.target?.result as string
                  if (json) onLoadProject(json)
                }
                reader.readAsText(file)
                e.target.value = ''
              }}
            />
          </label>
        </div>
        <p className="text-xs text-gray-400 mt-1">레이어·텍스트·위치 모두 보존됩니다</p>
      </section>

      <button onClick={onDownload}
        className="w-full bg-gray-800 hover:bg-gray-900 text-white font-semibold py-3 rounded-xl transition-colors">
        📥 PNG 다운로드
      </button>
    </div>
  )
}
