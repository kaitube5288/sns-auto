'use client'

import { useState, useRef } from 'react'
import { Sparkles, RefreshCw, Copy, Send, Clock, CheckCircle2, Image, X, Wand2 } from 'lucide-react'
import { hashtagsToString } from '@/lib/utils'
import type { ContentTone, ThreadsDraft } from '@/lib/types'
import LearnSection from '@/components/create/LearnSection'

const TONES: { value: ContentTone; label: string; desc: string; emoji: string }[] = [
  { value: '스레드감성형', label: '스레드 감성', desc: 'Threads 트렌드 그대로', emoji: '🧵' },
  { value: '공감형', label: '공감형', desc: '손님 감정에 공감', emoji: '🤝' },
  { value: '밈형', label: '밈형', desc: 'MZ 트렌드 반영', emoji: '😂' },
  { value: '사장님형', label: '사장님형', desc: '진정성 있는 목소리', emoji: '👨‍🍳' },
  { value: '감성형', label: '감성형', desc: '계절·분위기 묘사', emoji: '🌿' },
  { value: '고객소통형', label: '고객소통형', desc: '댓글 유도형', emoji: '💬' },
]

interface DraftWithId extends ThreadsDraft { id?: string }

export default function ThreadsCreatePage() {
  const [activeTab, setActiveTab] = useState<'generate' | 'learn'>('generate')
  const [mode, setMode] = useState<'solo' | 'combined'>('solo')
  const [tone, setTone] = useState<ContentTone>('공감형')
  const [contextNote, setContextNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [drafts, setDrafts] = useState<DraftWithId[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [scheduleMode, setScheduleMode] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [toast, setToast] = useState('')

  // AI 수정
  const [refineInstructions, setRefineInstructions] = useState<Record<number, string>>({})
  const [refiningIdx, setRefiningIdx] = useState<number | null>(null)

  // 사진 첨부
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
        body: JSON.stringify({ tone, context_note: contextNote, mode }),
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
      // 사진 첨부 시 먼저 업로드
      if (publishImages.length > 0 && draft.id) {
        const formData = new FormData()
        publishImages.forEach(f => formData.append('images', f))
        formData.append('content_id', draft.id)
        await fetch('/api/media/upload', { method: 'POST', body: formData })
      }

      const body: Record<string, unknown> = { content_id: draft.id }
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
    const text = `${draft.caption}\n\n${hashtagsToString(draft.hashtags)}`
    navigator.clipboard.writeText(text)
    showToast('복사되었습니다')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Threads 글 생성기</h1>
          <p className="text-gray-500 mt-1">AI가 브랜드에 맞는 Threads 게시물을 작성합니다</p>
        </div>
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          <button
            onClick={() => setActiveTab('generate')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'generate' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >✨ 생성하기</button>
          <button
            onClick={() => setActiveTab('learn')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'learn' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >📚 학습하기</button>
        </div>
      </div>

      {toast && (
        <div className="fixed top-4 right-4 flex items-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-xl text-sm shadow-lg z-50">
          <CheckCircle2 className="w-4 h-4 text-green-400" />
          {toast}
        </div>
      )}

      {activeTab === 'learn' && <LearnSection section="threads" />}

      {activeTab === 'generate' && <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 설정 패널 */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-2 text-sm">학습 데이터 범위</h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setMode('solo')}
                className={`py-2 rounded-xl text-sm font-medium border transition-colors ${mode === 'solo' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
              >단독 (Threads만)</button>
              <button
                onClick={() => setMode('combined')}
                className={`py-2 rounded-xl text-sm font-medium border transition-colors ${mode === 'combined' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
              >통합 (전체 학습)</button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-3">톤 선택</h2>
            <div className="space-y-2">
              {TONES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setTone(t.value)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                    tone === t.value
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                      : 'border-gray-100 bg-gray-50 text-gray-700 hover:border-gray-200'
                  }`}
                >
                  <span className="text-xl">{t.emoji}</span>
                  <div>
                    <p className="font-medium text-sm">{t.label}</p>
                    <p className="text-xs text-gray-400">{t.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <label className="block font-semibold text-gray-900 mb-2">오늘의 특이사항 (선택)</label>
            <textarea
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 resize-none h-20"
              placeholder="예: 비 오는 날 쿠키가 잘 나감, 신메뉴 출시"
              value={contextNote}
              onChange={e => setContextNote(e.target.value)}
            />
          </div>

          <button
            onClick={generate}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition-colors disabled:opacity-60"
          >
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> AI 생성 중...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> 글 생성하기 (3개)</>
            )}
          </button>
        </div>

        {/* 결과 패널 */}
        <div className="space-y-4">
          {drafts.length > 0 ? (
            <>
              <div className="space-y-3">
                {drafts.map((d, i) => (
                  <div
                    key={i}
                    onClick={() => setSelected(i)}
                    className={`bg-white rounded-2xl border p-4 transition-all shadow-sm ${
                      selected === i ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-medium text-gray-400">초안 {i + 1} <span className="text-indigo-400">· 직접 수정 가능</span></span>
                      <button
                        onClick={e => { e.stopPropagation(); copyText(d) }}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <textarea
                      value={d.caption}
                      onChange={e => { e.stopPropagation(); updateDraft(i, e.target.value) }}
                      onClick={e => { e.stopPropagation(); setSelected(i) }}
                      rows={Math.max(4, d.caption.split('\n').length + 1)}
                      className="w-full text-sm text-gray-800 leading-relaxed resize-none outline-none bg-transparent"
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {d.hashtags.map(tag => (
                        <span key={tag} className="text-xs text-indigo-500">#{tag}</span>
                      ))}
                    </div>
                    {d.engagement_hook && (
                      <p className="text-xs text-gray-400 mt-2 border-t border-gray-50 pt-2">{d.engagement_hook}</p>
                    )}

                    {/* AI 수정 */}
                    <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2" onClick={e => e.stopPropagation()}>
                      <input
                        value={refineInstructions[i] || ''}
                        onChange={e => setRefineInstructions(prev => ({ ...prev, [i]: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && refine(i)}
                        placeholder="수정 지시 (예: 더 짧게, 마지막 문장 바꿔줘)"
                        className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-2 outline-none focus:border-indigo-400"
                      />
                      <button
                        onClick={() => refine(i)}
                        disabled={refiningIdx === i || !refineInstructions[i]?.trim()}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-500 text-white text-xs font-medium disabled:opacity-50 hover:bg-indigo-600 whitespace-nowrap"
                      >
                        {refiningIdx === i
                          ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                          : <Wand2 className="w-3 h-3" />
                        }
                        AI 수정
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Threads 미리보기 */}
              {selected !== null && (
                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <p className="text-xs font-medium text-gray-400 mb-3">Threads 미리보기</p>
                  <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200" />
                      <div>
                        <p className="text-xs font-semibold">내 계정</p>
                        <p className="text-xs text-gray-400">방금 전</p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{drafts[selected].caption}</p>
                    {publishPreviews.length > 0 && (
                      <div className="flex gap-1.5 mt-2">
                        {publishPreviews.map((p, i) => (
                          <img key={i} src={p} alt="" className="w-16 h-16 object-cover rounded-lg" />
                        ))}
                      </div>
                    )}
                    <p className="text-sm text-indigo-500 mt-1.5">{hashtagsToString(drafts[selected].hashtags)}</p>
                  </div>
                </div>
              )}

              {/* 발행 액션 */}
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
                {/* 사진 첨부 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-gray-600 flex items-center gap-1">
                      <Image className="w-3.5 h-3.5" /> 사진 첨부 (선택, 최대 4장)
                    </p>
                    {publishImages.length < 4 && (
                      <button onClick={() => publishImageRef.current?.click()} className="text-xs text-indigo-500 hover:text-indigo-600">+ 추가</button>
                    )}
                  </div>
                  {publishPreviews.length > 0 ? (
                    <div className="flex gap-2 mb-1">
                      {publishPreviews.map((p, i) => (
                        <div key={i} className="relative w-14 h-14">
                          <img src={p} alt="" className="w-full h-full object-cover rounded-lg" />
                          <button
                            onClick={() => removePublishImage(i)}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <button
                      onClick={() => publishImageRef.current?.click()}
                      className="w-full border border-dashed border-gray-200 rounded-xl py-2.5 text-xs text-gray-400 hover:border-indigo-300 hover:text-indigo-400 transition-colors"
                    >
                      + 사진 추가 · Meta 연결 후 텍스트와 함께 발행
                    </button>
                  )}
                  <input
                    ref={publishImageRef}
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={e => handlePublishImages(e.target.files)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => publish(true)}
                    disabled={publishing || selected === null}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 disabled:opacity-60"
                  >
                    <Send className="w-4 h-4" />
                    즉시 발행
                  </button>
                  <button
                    onClick={() => setScheduleMode(!scheduleMode)}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50"
                  >
                    <Clock className="w-4 h-4" />
                    예약 발행
                  </button>
                </div>

                {scheduleMode && (
                  <div className="flex gap-2">
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={e => setScheduledAt(e.target.value)}
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400"
                    />
                    <button
                      onClick={() => publish(false)}
                      disabled={!scheduledAt || publishing}
                      className="px-4 py-2 rounded-xl bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-60"
                    >
                      예약
                    </button>
                  </div>
                )}
              </div>

              <button
                onClick={generate}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 disabled:opacity-60"
              >
                <RefreshCw className="w-4 h-4" />
                다시 생성
              </button>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 shadow-sm text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-6 h-6 text-gray-300" />
              </div>
              <p className="text-gray-400 text-sm">톤을 선택하고 생성 버튼을 누르세요</p>
            </div>
          )}
        </div>
      </div>}
    </div>
  )
}
