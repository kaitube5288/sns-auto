'use client'

import { useState, useRef } from 'react'
import { Upload, X, Sparkles, Send, Clock, Copy, ArrowUpDown } from 'lucide-react'
import { hashtagsToString } from '@/lib/utils'
import type { ContentTone, FeedDraft } from '@/lib/types'

const TONES: { value: ContentTone; emoji: string }[] = [
  { value: '공감형', emoji: '🤝' },
  { value: '밈형', emoji: '😂' },
  { value: '사장님형', emoji: '👨‍🍳' },
  { value: '감성형', emoji: '🌿' },
  { value: '고객소통형', emoji: '💬' },
]

interface DraftResult extends FeedDraft { id?: string; media_urls: string[] }

export default function FeedCreatePage() {
  const [tone, setTone] = useState<ContentTone>('감성형')
  const [images, setImages] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState<DraftResult | null>(null)
  const [caption, setCaption] = useState('')
  const [scheduleMode, setScheduleMode] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [toast, setToast] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFiles(files: FileList | null) {
    if (!files) return
    const newFiles = Array.from(files).slice(0, 10 - images.length)
    setImages(prev => [...prev, ...newFiles])
    newFiles.forEach(f => {
      const reader = new FileReader()
      reader.onload = e => setPreviews(prev => [...prev, e.target?.result as string])
      reader.readAsDataURL(f)
    })
  }

  function removeImage(i: number) {
    setImages(prev => prev.filter((_, idx) => idx !== i))
    setPreviews(prev => prev.filter((_, idx) => idx !== i))
  }

  async function generate() {
    if (images.length === 0) { alert('이미지를 먼저 업로드해주세요.'); return }
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('tone', tone)
      images.forEach(f => formData.append('images', f))
      const res = await fetch('/api/generate/feed', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.error) { alert(data.error); return }
      setDraft(data.draft)
      setCaption(data.draft.caption)
    } catch {
      alert('생성 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function publish(immediate: boolean) {
    if (!draft) return
    const body: Record<string, unknown> = { content_id: draft.id }
    if (!immediate && scheduledAt) body.scheduled_at = scheduledAt
    const res = await fetch(immediate ? '/api/publish/feed' : '/api/publish/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (data.error) { alert(data.error); return }
    showToast(immediate ? '발행되었습니다!' : '예약되었습니다!')
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">인스타 피드 생성기</h1>
        <p className="text-gray-500 mt-1">사진을 올리면 AI가 캡션, 해시태그, 슬라이드 순서를 제안합니다</p>
      </div>

      {toast && (
        <div className="fixed top-4 right-4 flex items-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-xl text-sm shadow-lg z-50">
          {toast}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 업로드 + 설정 */}
        <div className="space-y-4">
          {/* 이미지 업로드 */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-3">사진 업로드 (최대 10장)</h2>
            <div
              className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-indigo-300 transition-colors"
              onClick={() => inputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
            >
              <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">클릭하거나 드래그하여 업로드</p>
              <p className="text-xs text-gray-300 mt-1">JPG, PNG, WEBP • 최대 10장</p>
            </div>
            <input ref={inputRef} type="file" multiple accept="image/*" className="hidden" onChange={e => handleFiles(e.target.files)} />

            {previews.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-3">
                {previews.map((p, i) => (
                  <div key={i} className="relative aspect-square">
                    <img src={p} alt="" className="w-full h-full object-cover rounded-lg" />
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 톤 선택 */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-3">톤 선택</h2>
            <div className="flex flex-wrap gap-2">
              {TONES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setTone(t.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
                    tone === t.value ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t.emoji} {t.value}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={generate}
            disabled={loading || images.length === 0}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-500 text-white font-medium hover:bg-indigo-600 disabled:opacity-60"
          >
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> AI 분석 중...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> 피드 콘텐츠 생성</>
            )}
          </button>
        </div>

        {/* 결과 */}
        <div className="space-y-4">
          {draft ? (
            <>
              {/* 슬라이드 순서 */}
              {draft.slide_order && (
                <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <ArrowUpDown className="w-4 h-4 text-gray-400" />
                    <h3 className="font-semibold text-gray-900 text-sm">추천 슬라이드 순서</h3>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {draft.slide_order.map((idx, rank) => (
                      <div key={rank} className="flex-shrink-0 text-center">
                        {previews[idx] && (
                          <img src={previews[idx]} alt="" className="w-14 h-14 object-cover rounded-lg" />
                        )}
                        <p className="text-xs text-gray-400 mt-1">{rank + 1}번째</p>
                      </div>
                    ))}
                  </div>
                  {draft.slide_descriptions && (
                    <ul className="mt-3 space-y-1">
                      {draft.slide_order.map((idx, rank) => (
                        <li key={rank} className="text-xs text-gray-500">
                          <span className="font-medium text-gray-700">{rank + 1}.</span> {draft.slide_descriptions[idx]}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* 캡션 편집 */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 text-sm">캡션</h3>
                  <button
                    onClick={() => navigator.clipboard.writeText(`${caption}\n\n${hashtagsToString(draft.hashtags)}`)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
                  >
                    <Copy className="w-3.5 h-3.5" /> 복사
                  </button>
                </div>
                <textarea
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 resize-none h-28"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {draft.hashtags.map(tag => (
                    <span key={tag} className="text-xs text-indigo-500">#{tag}</span>
                  ))}
                </div>
              </div>

              {/* 발행 */}
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => publish(true)}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-medium"
                  >
                    <Send className="w-4 h-4" /> 즉시 발행
                  </button>
                  <button
                    onClick={() => setScheduleMode(!scheduleMode)}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm"
                  >
                    <Clock className="w-4 h-4" /> 예약
                  </button>
                </div>
                {scheduleMode && (
                  <div className="flex gap-2">
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={e => setScheduledAt(e.target.value)}
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
                    />
                    <button
                      onClick={() => publish(false)}
                      disabled={!scheduledAt}
                      className="px-4 py-2 rounded-xl bg-green-500 text-white text-sm disabled:opacity-60"
                    >
                      예약
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center shadow-sm">
              <Sparkles className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">사진을 업로드하고 AI 분석을 시작하세요</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
