'use client'

import { useState, useRef } from 'react'
import { Sparkles, RefreshCw, Copy, Send, Clock, CheckCircle2, Image, X, Wand2 } from 'lucide-react'
import { hashtagsToString } from '@/lib/utils'
import type { ContentTone, ThreadsDraft } from '@/lib/types'
import LearnSection from '@/components/create/LearnSection'

const TONES: { value: ContentTone; label: string; emoji: string }[] = [
  { value: '스레드감성형', label: '스레드 감성', emoji: '🧵' },
  { value: '공감형',     label: '공감형',     emoji: '🤝' },
  { value: '밈형',       label: '밈형',       emoji: '😂' },
  { value: '사장님형',   label: '사장님형',   emoji: '👨‍🍳' },
  { value: '고객소통형', label: '고객소통형', emoji: '💬' },
]

interface DraftWithId extends ThreadsDraft { id?: string }

export default function ThreadsCreatePage() {
  const [activeTab, setActiveTab] = useState<'generate' | 'learn'>('generate')
  const [mode, setMode] = useState<'solo' | 'combined'>('solo')
  const [contextNote, setContextNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [drafts, setDrafts] = useState<DraftWithId[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [scheduleMode, setScheduleMode] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [toast, setToast] = useState('')
  const [refineInstructions, setRefineInstructions] = useState<Record<number, string>>({})
  const [refiningIdx, setRefiningIdx] = useState<number | null>(null)
  const [regeneratingIdx, setRegeneratingIdx] = useState<number | null>(null)
  const [publishImages, setPublishImages] = useState<File[]>([])
  const [publishPreviews, setPublishPreviews] = useState<string[]>([])
  const publishImageRef = useRef<HTMLInputElement>(null)

  function updateDraft(i: number, caption: string) {
    setDrafts(prev => prev.map((d, idx) => idx === i ? { ...d, caption } : d))
  }

  async function refine(i: number) {
    const instruction = refineInstructions[i]?.trim()
    if (!instruction) return
    setRefiningIdx(i)
    try {
      const res = await fetch('/api/generate/threads/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption: drafts[i].caption, instruction }),
      })
      const data = await res.json()
      if (data.error) { alert(data.error); return }
      updateDraft(i, data.caption)
      setRefineInstructions(prev => ({ ...prev, [i]: '' }))
    } catch {
      alert('수정 중 오류가 발생했습니다.')
    } finally {
      setRefiningIdx(null)
    }
  }

  async function changeTone(idx: number, newTone: ContentTone) {
    if (regeneratingIdx !== null) return
    setRegeneratingIdx(idx)
    try {
      const res = await fetch('/api/generate/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tones: [newTone], context_note: contextNote, mode, count: 1 }),
      })
      const data = await res.json()
      if (data.error) { alert(data.error); return }
      if (data.drafts?.[0]) {
        setDrafts(prev => prev.map((d, i) => i === idx ? { ...data.drafts[0] } : d))
      }
    } catch {
      alert('톤 변경 중 오류가 발생했습니다.')
    } finally {
      setRegeneratingIdx(null)
    }
  }

  function handlePublishImages(files: FileList | null) {
    if (!files) return
    const newFiles = Array.from(files).slice(0, 4 - publishImages.length)
    setPublishImages(prev => [...prev, ...newFiles])
    newFiles.forEach(f => {
      const reader = new FileReader()
      reader.onload = e => setPublishPreviews(prev => [...prev, e.target?.result as string])
      reader.readAsDataURL(f)
    })
  }

  function removePublishImage(i: number) {
    setPublishImages(prev => prev.filter((_, idx) => idx !== i))
    setPublishPreviews(prev => prev.filter((_, idx) => idx !== i))
  }

  async function generate() {
    setLoading(true)
    setDrafts([])
    setSelected(null)
    setRefineInstructions({})
    try {
      const res = await fetch('/api/generate/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context_note: contextNote, mode, count: 8 }),
      })
      const data = await res.json()
      if (data.error) { alert(data.error); return }
      setDrafts(data.drafts)
      setSelected(0)
    } catch {
      alert('생성 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function publish(immediate: boolean) {
    if (selected === null || !drafts[selected]) return
    const draft = drafts[selected]
    setPublishing(true)
    try {
      if (publishImages.length > 0 && draft.id) {
        const formData = new FormData()
        publishImages.forEach(f => formData.append('images', f))
        formData.append('content_id', draft.id)
        await fetch('/api/media/upload', { method: 'POST', body: formData })
      }
      const body: Record<string, unknown> = {
        content_id: draft.id,
        caption: draft.caption,
        hashtags: draft.hashtags,
      }
      if (!immediate && scheduledAt) body.scheduled_at = scheduledAt
      const endpoint = immediate ? '/api/publish/threads' : '/api/publish/schedule'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) { alert(data.error); return }
      showToast(immediate ? '발행되었습니다!' : '예약되었습니다!')
    } finally {
      setPublishing(false)
    }
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function copyText(draft: DraftWithId) {
    navigator.clipboard.writeText(`${draft.caption}\n\n${hashtagsToString(draft.hashtags)}`)
    showToast('복사되었습니다')
  }

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="relative flex items-center">
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1 flex-shrink-0">
          <button onClick={() => setActiveTab('generate')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'generate' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>✨ 생성하기</button>
          <button onClick={() => setActiveTab('learn')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'learn' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>📚 학습하기</button>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 text-center pointer-events-none">
          <h1 className="text-2xl font-bold text-gray-900">Threads 글 생성기</h1>
          <p className="text-gray-500 text-sm mt-0.5">AI가 브랜드에 맞는 Threads 게시물을 작성합니다</p>
        </div>

        <div className="ml-auto flex flex-col items-center gap-1.5 flex-shrink-0">
          <span className="text-xs text-gray-400 font-medium">학습범위</span>
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            <button onClick={() => setMode('solo')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'solo' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>단독</button>
            <button onClick={() => setMode('combined')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'combined' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>통합</button>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed top-4 right-4 flex items-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-xl text-sm shadow-lg z-50">
          <CheckCircle2 className="w-4 h-4 text-green-400" />{toast}
        </div>
      )}

      {activeTab === 'learn' && <LearnSection section="threads" />}

      {activeTab === 'generate' && (
        <div className="space-y-4">
          {/* 특이사항 + 생성 버튼 */}
          <div className="flex gap-3">
            <input
              className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400"
              placeholder="오늘의 특이사항 (선택) — 예: 비 오는 날 쿠키가 잘 나감"
              value={contextNote}
              onChange={e => setContextNote(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !loading && generate()}
            />
            <button
              onClick={generate}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition-colors disabled:opacity-60 whitespace-nowrap"
            >
              {loading
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> 생성 중...</>
                : <><Sparkles className="w-4 h-4" /> 글 생성 (8개)</>
              }
            </button>
          </div>

          {/* 초안 2×4 그리드 */}
          {drafts.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                {drafts.map((draft, idx) => (
                  <DraftCard
                    key={idx}
                    draft={draft}
                    idx={idx}
                    selected={selected === idx}
                    onSelect={() => setSelected(idx)}
                    onCopy={() => copyText(draft)}
                    onUpdate={cap => updateDraft(idx, cap)}
                    refineInstruction={refineInstructions[idx] || ''}
                    onRefineChange={v => setRefineInstructions(prev => ({ ...prev, [idx]: v }))}
                    onRefine={() => refine(idx)}
                    refining={refiningIdx === idx}
                    onChangeTone={t => changeTone(idx, t)}
                    regenerating={regeneratingIdx === idx}
                  />
                ))}
              </div>

              {/* 미리보기 + 사진첨부 + 발행 */}
              {selected !== null && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                    <p className="text-xs font-medium text-gray-400 mb-3">Threads 미리보기 — 초안 {selected + 1}</p>
                    <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-full bg-gray-200" />
                        <div>
                          <p className="text-xs font-semibold">내 계정</p>
                          <p className="text-xs text-gray-400">방금 전</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{drafts[selected].caption}</p>
                      {publishPreviews.length > 0 && (
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          {publishPreviews.map((p, i) => (
                            <img key={i} src={p} alt="" className="w-16 h-16 object-cover rounded-lg" />
                          ))}
                        </div>
                      )}
                      <p className="text-sm text-indigo-500 mt-2">{hashtagsToString(drafts[selected].hashtags)}</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-gray-600 flex items-center gap-1">
                          <Image className="w-3.5 h-3.5" /> 사진 첨부 (최대 4장)
                        </p>
                        {publishImages.length < 4 && (
                          <button onClick={() => publishImageRef.current?.click()} className="text-xs text-indigo-500 hover:text-indigo-600">+ 추가</button>
                        )}
                      </div>
                      {publishPreviews.length > 0 ? (
                        <div className="flex gap-2 flex-wrap mb-1">
                          {publishPreviews.map((p, i) => (
                            <div key={i} className="relative w-14 h-14">
                              <img src={p} alt="" className="w-full h-full object-cover rounded-lg" />
                              <button onClick={() => removePublishImage(i)} className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center">
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <button onClick={() => publishImageRef.current?.click()} className="w-full border border-dashed border-gray-200 rounded-xl py-2.5 text-xs text-gray-400 hover:border-indigo-300 hover:text-indigo-400 transition-colors">
                          + 사진 추가 · Meta 연결 후 함께 발행
                        </button>
                      )}
                      <input ref={publishImageRef} type="file" multiple accept="image/*" className="hidden" onChange={e => handlePublishImages(e.target.files)} />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => publish(true)} disabled={publishing} className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 disabled:opacity-60">
                        <Send className="w-4 h-4" /> 즉시 발행
                      </button>
                      <button onClick={() => setScheduleMode(!scheduleMode)} className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50">
                        <Clock className="w-4 h-4" /> 예약 발행
                      </button>
                    </div>
                    {scheduleMode && (
                      <div className="flex gap-2">
                        <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400" />
                        <button onClick={() => publish(false)} disabled={!scheduledAt || publishing} className="px-4 py-2 rounded-xl bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-60">예약</button>
                      </div>
                    )}

                    <button onClick={generate} disabled={loading} className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-gray-200 text-gray-500 text-sm hover:bg-gray-50 disabled:opacity-60">
                      <RefreshCw className="w-3.5 h-3.5" /> 다시 생성
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

interface DraftCardProps {
  draft: DraftWithId
  idx: number
  selected: boolean
  onSelect: () => void
  onCopy: () => void
  onUpdate: (cap: string) => void
  refineInstruction: string
  onRefineChange: (v: string) => void
  onRefine: () => void
  refining: boolean
  onChangeTone: (t: ContentTone) => void
  regenerating: boolean
}

function DraftCard({ draft, idx, selected, onSelect, onCopy, onUpdate, refineInstruction, onRefineChange, onRefine, refining, onChangeTone, regenerating }: DraftCardProps) {
  return (
    <div
      onClick={onSelect}
      className={`relative bg-white rounded-2xl border p-4 transition-all shadow-sm cursor-pointer ${
        selected ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-gray-100 hover:border-gray-200'
      }`}
    >
      {regenerating && (
        <div className="absolute inset-0 bg-white/80 rounded-2xl flex items-center justify-center z-10">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-gray-400">초안 {idx + 1}</span>
          {draft.tone && (
            <span className="text-xs px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 font-medium">
              {TONES.find(t => t.value === draft.tone)?.emoji} {TONES.find(t => t.value === draft.tone)?.label ?? draft.tone}
            </span>
          )}
        </div>
        <button onClick={e => { e.stopPropagation(); onCopy() }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
          <Copy className="w-3.5 h-3.5" />
        </button>
      </div>

      <textarea
        value={draft.caption}
        onChange={e => { e.stopPropagation(); onUpdate(e.target.value) }}
        onClick={e => { e.stopPropagation(); onSelect() }}
        rows={Math.max(5, draft.caption.split('\n').length + 1)}
        className="w-full text-sm text-gray-800 leading-relaxed resize-none outline-none bg-transparent"
      />
      <div className="flex flex-wrap gap-1 mt-1.5">
        {draft.hashtags.map(tag => (
          <span key={tag} className="text-xs text-indigo-400">#{tag}</span>
        ))}
      </div>
      {draft.engagement_hook && (
        <p className="text-xs text-gray-400 mt-2 border-t border-gray-50 pt-2 leading-relaxed">{draft.engagement_hook}</p>
      )}

      {/* 톤 변경 칩 */}
      <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-gray-100" onClick={e => e.stopPropagation()}>
        {TONES.map(t => (
          <button
            key={t.value}
            onClick={() => onChangeTone(t.value)}
            disabled={regenerating || refining}
            className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors disabled:opacity-40 ${
              draft.tone === t.value
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* AI 수정 */}
      <div className="mt-2 pt-2 border-t border-gray-100 flex gap-1.5" onClick={e => e.stopPropagation()}>
        <input
          value={refineInstruction}
          onChange={e => onRefineChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onRefine()}
          placeholder="수정 지시 (예: 더 짧게)"
          className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-indigo-400"
        />
        <button
          onClick={onRefine}
          disabled={refining || !refineInstruction.trim()}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-500 text-white text-xs font-medium disabled:opacity-50 hover:bg-indigo-600"
        >
          {refining
            ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
            : <Wand2 className="w-3 h-3" />
          }
          AI
        </button>
      </div>
    </div>
  )
}
