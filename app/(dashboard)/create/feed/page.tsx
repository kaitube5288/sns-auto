'use client'

import { useState, useRef } from 'react'
import { Upload, X, Sparkles, Send, Clock, Copy, ArrowUpDown, Play, ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react'
import { hashtagsToString } from '@/lib/utils'
import type { ContentTone, FeedDraft } from '@/lib/types'
import LearnSection from '@/components/create/LearnSection'

const TONES: { value: ContentTone; label: string; emoji: string }[] = [
  { value: '인스타감성형', label: '인스타 감성', emoji: '📸' },
  { value: '공감형',     label: '공감형',     emoji: '🤝' },
  { value: '밈형',       label: '밈형',       emoji: '😂' },
  { value: '사장님형',   label: '사장님형',   emoji: '👨‍🍳' },
  { value: '고객소통형', label: '고객소통형', emoji: '💬' },
]

interface FeedDraftWithId extends FeedDraft { id?: string; media_urls?: string[] }

async function extractVideoFrames(file: File, count = 4): Promise<{ thumbnail: string; frames: string[] }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    video.src = url
    video.muted = true
    video.playsInline = true

    video.onloadedmetadata = () => {
      const duration = video.duration
      const frames: string[] = []
      let captured = 0

      video.onseeked = () => {
        const canvas = document.createElement('canvas')
        const ratio = video.videoHeight / (video.videoWidth || 1)
        canvas.width = 320
        canvas.height = Math.round(320 * ratio) || 320
        canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height)
        frames.push(canvas.toDataURL('image/jpeg', 0.7))
        captured++
        if (captured < count) {
          video.currentTime = (duration / count) * captured
        } else {
          URL.revokeObjectURL(url)
          resolve({ thumbnail: frames[0], frames })
        }
      }

      video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('동영상 로드 실패')) }
      video.currentTime = Math.min(0.5, duration * 0.05)
    }

    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('동영상 로드 실패')) }
    video.load()
  })
}

function dataURLToBlob(dataURL: string): Blob {
  const [header, data] = dataURL.split(',')
  const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg'
  const bin = atob(data)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export default function FeedCreatePage() {
  const [activeTab, setActiveTab] = useState<'generate' | 'learn'>('generate')
  const [mode, setMode] = useState<'solo' | 'combined'>('solo')
  const [selectedTones, setSelectedTones] = useState<ContentTone[]>(['인스타감성형'])

  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [video, setVideo] = useState<File | null>(null)
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null)
  const [videoFrames, setVideoFrames] = useState<string[]>([])
  const [videoLoading, setVideoLoading] = useState(false)

  // slideOrder: indices into [...photos, video?]
  const [slideOrder, setSlideOrder] = useState<number[]>([])

  const [loading, setLoading] = useState(false)
  const [drafts, setDrafts] = useState<FeedDraftWithId[]>([])
  const [selectedDraft, setSelectedDraft] = useState(0)
  const [showPreview, setShowPreview] = useState(false)

  const [publishing, setPublishing] = useState(false)
  const [scheduleMode, setScheduleMode] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [toast, setToast] = useState('')

  const photoInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  function toggleTone(t: ContentTone) {
    setSelectedTones(prev => {
      if (prev.includes(t)) return prev.length === 1 ? prev : prev.filter(x => x !== t)
      if (prev.length >= 2) return [prev[1], t]
      return [...prev, t]
    })
  }

  function toneOrder(t: ContentTone) {
    const idx = selectedTones.indexOf(t)
    return idx === -1 ? null : idx + 1
  }

  function buildSlideOrder(photoCount: number, hasVid: boolean) {
    return Array.from({ length: photoCount + (hasVid ? 1 : 0) }, (_, i) => i)
  }

  function handlePhotos(files: FileList | null) {
    if (!files) return
    const available = Math.min(files.length, 10 - photos.length)
    const newFiles = Array.from(files).slice(0, available)
    if (!newFiles.length) return
    const newPreviews = newFiles.map(f => URL.createObjectURL(f))
    const newPhotos = [...photos, ...newFiles]
    setPhotos(newPhotos)
    setPhotoPreviews(prev => [...prev, ...newPreviews])
    setSlideOrder(buildSlideOrder(newPhotos.length, !!video))
  }

  function removePhoto(i: number) {
    const newPhotos = photos.filter((_, idx) => idx !== i)
    setPhotos(newPhotos)
    setPhotoPreviews(prev => prev.filter((_, idx) => idx !== i))
    setSlideOrder(buildSlideOrder(newPhotos.length, !!video))
  }

  async function handleVideo(file: File | null) {
    if (!file) return
    setVideoLoading(true)
    try {
      const { thumbnail, frames } = await extractVideoFrames(file, 4)
      setVideo(file)
      setVideoThumbnail(thumbnail)
      setVideoFrames(frames)
      setSlideOrder(buildSlideOrder(photos.length, true))
    } catch {
      alert('동영상 처리 중 오류가 발생했습니다.')
    } finally {
      setVideoLoading(false)
    }
  }

  function removeVideo() {
    setVideo(null)
    setVideoThumbnail(null)
    setVideoFrames([])
    setSlideOrder(buildSlideOrder(photos.length, false))
    if (videoInputRef.current) videoInputRef.current.value = ''
  }

  const totalMedia = photos.length + (video ? 1 : 0)
  const slideItems = slideOrder.map(origIdx => ({
    type: origIdx < photos.length ? 'image' : 'video' as 'image' | 'video',
    preview: origIdx < photos.length ? photoPreviews[origIdx] : (videoThumbnail ?? ''),
    origIdx,
  }))

  function moveSlide(pos: number, dir: -1 | 1) {
    setSlideOrder(prev => {
      const arr = [...prev]
      const target = pos + dir
      if (target < 0 || target >= arr.length) return arr
      ;[arr[pos], arr[target]] = [arr[target], arr[pos]]
      return arr
    })
  }

  async function generate() {
    if (!photos.length && !video) { alert('사진 또는 동영상을 업로드해주세요.'); return }
    setLoading(true)
    setDrafts([])
    try {
      const fd = new FormData()
      fd.append('tones', JSON.stringify(selectedTones))
      fd.append('mode', mode)
      photos.forEach(f => fd.append('images', f))
      if (video) {
        fd.append('has_video', '1')
        videoFrames.forEach((frame, i) => {
          fd.append('video_frames', new File([dataURLToBlob(frame)], `frame${i}.jpg`, { type: 'image/jpeg' }))
        })
      }
      const res = await fetch('/api/generate/feed', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.error) { alert(data.error); return }
      setDrafts(data.drafts)
      setSelectedDraft(0)
      if (data.drafts[0]?.slide_order?.length) {
        setSlideOrder(data.drafts[0].slide_order)
      }
      // 동영상 파일은 별도로 업로드 (크기 제한 우회)
      if (video && data.drafts) {
        for (const draft of data.drafts) {
          if (draft.id) {
            const vfd = new FormData()
            vfd.append('images', video)
            vfd.append('content_id', draft.id)
            fetch('/api/media/upload', { method: 'POST', body: vfd }).catch(() => {})
          }
        }
      }
    } catch {
      alert('생성 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function publish(immediate: boolean) {
    if (!drafts[selectedDraft]) return
    setPublishing(true)
    try {
      const body: Record<string, unknown> = { content_id: drafts[selectedDraft].id }
      if (!immediate && scheduledAt) body.scheduled_at = scheduledAt
      const res = await fetch(immediate ? '/api/publish/feed' : '/api/publish/schedule', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
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

  const currentDraft = drafts[selectedDraft]

  return (
    <div className="space-y-5">
      {/* 헤더: 탭(왼쪽) + 제목(중앙) + 학습범위(오른쪽) */}
      <div className="relative flex items-center">
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1 flex-shrink-0">
          <button onClick={() => setActiveTab('generate')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'generate' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>✨ 생성하기</button>
          <button onClick={() => setActiveTab('learn')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'learn' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>📚 학습하기</button>
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 text-center pointer-events-none">
          <h1 className="text-2xl font-bold text-gray-900">인스타 피드 생성기</h1>
          <p className="text-gray-500 text-sm mt-0.5">사진·동영상을 올리면 AI가 캡션과 슬라이드 순서를 제안합니다</p>
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
        <div className="fixed top-4 right-4 flex items-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-xl text-sm shadow-lg z-50">{toast}</div>
      )}

      {activeTab === 'learn' && <LearnSection section="feed" />}

      {activeTab === 'generate' && (
        <div className="space-y-4">
          {/* 톤 선택 */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900 text-sm">톤 선택</h2>
              <span className="text-xs text-gray-400">최대 2개 · 캡션 2개 생성</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {TONES.map(t => {
                const order = toneOrder(t.value)
                return (
                  <button
                    key={t.value}
                    onClick={() => toggleTone(t.value)}
                    className={`relative flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                      order !== null ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-gray-100 bg-gray-50 text-gray-700 hover:border-gray-200'
                    }`}
                  >
                    {order !== null && (
                      <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center">{order}</span>
                    )}
                    <span className="text-lg">{t.emoji}</span>
                    <span className="text-sm font-medium">{t.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 2-column: 업로드 | 결과 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 왼쪽: 업로드 + 슬라이드 순서 */}
            <div className="space-y-3">
              {/* 사진 업로드 */}
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 text-sm">📷 사진 (최대 10장)</h3>
                  {photos.length > 0 && photos.length < 10 && (
                    <button onClick={() => photoInputRef.current?.click()} className="text-xs text-indigo-500 hover:text-indigo-600">+ 추가</button>
                  )}
                </div>
                {!photoPreviews.length ? (
                  <div
                    className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-indigo-300 transition-colors"
                    onClick={() => photoInputRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); handlePhotos(e.dataTransfer.files) }}
                  >
                    <Upload className="w-6 h-6 text-gray-300 mx-auto mb-1.5" />
                    <p className="text-xs text-gray-400">클릭 또는 드래그</p>
                    <p className="text-xs text-gray-300 mt-0.5">JPG, PNG, WEBP</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-5 gap-1.5">
                    {photoPreviews.map((p, i) => (
                      <div key={i} className="relative aspect-square">
                        <img src={p} alt="" className="w-full h-full object-cover rounded-lg" />
                        <button onClick={() => removePhoto(i)} className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                    {photos.length < 10 && (
                      <button onClick={() => photoInputRef.current?.click()} className="aspect-square border border-dashed border-gray-200 rounded-lg text-gray-300 hover:border-indigo-300 hover:text-indigo-400 text-xl flex items-center justify-center">+</button>
                    )}
                  </div>
                )}
                <input ref={photoInputRef} type="file" multiple accept="image/*" className="hidden" onChange={e => handlePhotos(e.target.files)} />
              </div>

              {/* 동영상 업로드 */}
              <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <h3 className="font-semibold text-gray-900 text-sm mb-3">🎬 동영상 (1개)</h3>
                {!video ? (
                  <div
                    className={`border-2 border-dashed border-gray-200 rounded-xl p-5 text-center cursor-pointer hover:border-indigo-300 transition-colors ${videoLoading ? 'opacity-60 pointer-events-none' : ''}`}
                    onClick={() => videoInputRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith('video/')) handleVideo(f) }}
                  >
                    {videoLoading ? (
                      <><div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto mb-1.5" /><p className="text-xs text-gray-400">썸네일 추출 중...</p></>
                    ) : (
                      <><Play className="w-6 h-6 text-gray-300 mx-auto mb-1.5" /><p className="text-xs text-gray-400">클릭 또는 드래그</p><p className="text-xs text-gray-300 mt-0.5">MP4, MOV</p></>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="relative w-14 h-14 flex-shrink-0">
                      {videoThumbnail && <img src={videoThumbnail} alt="" className="w-full h-full object-cover rounded-lg" />}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/25 rounded-lg">
                        <Play className="w-4 h-4 text-white fill-white" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 truncate">{video.name}</p>
                      <p className="text-xs text-gray-400">{(video.size / 1024 / 1024).toFixed(1)} MB</p>
                    </div>
                    <button onClick={removeVideo} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={e => handleVideo(e.target.files?.[0] ?? null)} />
              </div>

              {/* 슬라이드 순서 */}
              {totalMedia > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <ArrowUpDown className="w-4 h-4 text-gray-400" />
                    <h3 className="font-semibold text-gray-900 text-sm">슬라이드 순서</h3>
                    <span className="text-xs text-gray-400 ml-auto">←→ 로 순서 변경</span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {slideItems.map((item, pos) => (
                      <div key={pos} className="flex-shrink-0 flex flex-col items-center gap-1">
                        <div className="relative w-14 h-14">
                          {item.preview ? (
                            <img src={item.preview} alt="" className="w-full h-full object-cover rounded-lg" />
                          ) : (
                            <div className="w-full h-full bg-gray-100 rounded-lg" />
                          )}
                          {item.type === 'video' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/25 rounded-lg">
                              <Play className="w-3.5 h-3.5 text-white fill-white" />
                            </div>
                          )}
                          <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-black/50 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{pos + 1}</span>
                        </div>
                        <div className="flex gap-0.5">
                          <button onClick={() => moveSlide(pos, -1)} disabled={pos === 0} className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-gray-600 disabled:opacity-30">
                            <ChevronLeft className="w-3 h-3" />
                          </button>
                          <button onClick={() => moveSlide(pos, 1)} disabled={pos === slideItems.length - 1} className="w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-gray-600 disabled:opacity-30">
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={generate}
                disabled={loading || (!photos.length && !video)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-500 text-white font-medium hover:bg-indigo-600 disabled:opacity-60 transition-colors"
              >
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> AI 분석 중...</>
                  : <><Sparkles className="w-4 h-4" /> 피드 콘텐츠 생성 (캡션 2개)</>
                }
              </button>
            </div>

            {/* 오른쪽: 결과 */}
            <div className="space-y-3">
              {!drafts.length ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center shadow-sm">
                  <Sparkles className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">사진 또는 동영상을 업로드하고<br />AI 분석을 시작하세요</p>
                </div>
              ) : (
                <>
                  {/* 캡션 2개 */}
                  {drafts.map((d, i) => {
                    const toneName = TONES.find(t => t.value === d.tone)?.label ?? d.tone ?? `캡션 ${i + 1}`
                    return (
                      <div
                        key={i}
                        onClick={() => setSelectedDraft(i)}
                        className={`bg-white rounded-2xl border p-4 shadow-sm cursor-pointer transition-all ${selectedDraft === i ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-gray-100 hover:border-gray-200'}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                            <span className="text-xs font-semibold text-gray-700">{toneName}</span>
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(`${d.caption}\n\n${hashtagsToString(d.hashtags)}`); showToast('복사되었습니다') }}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-sm text-gray-800 leading-relaxed">{d.caption}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {d.hashtags.slice(0, 8).map(tag => <span key={tag} className="text-xs text-indigo-400">#{tag}</span>)}
                          {d.hashtags.length > 8 && <span className="text-xs text-gray-300">+{d.hashtags.length - 8}개</span>}
                        </div>
                        {d.slide_tips && (
                          <p className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-50 leading-relaxed">{d.slide_tips}</p>
                        )}
                      </div>
                    )
                  })}

                  {/* 미리보기 + 발행 */}
                  <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
                    <button
                      onClick={() => setShowPreview(v => !v)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-indigo-200 text-indigo-600 text-sm font-medium hover:bg-indigo-50 transition-colors"
                    >
                      {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      {showPreview ? '미리보기 닫기' : '미리보기'}
                    </button>

                    {showPreview && currentDraft && (
                      <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/50 space-y-2">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-7 h-7 rounded-full bg-gray-200" />
                          <p className="text-xs font-semibold">내 계정</p>
                        </div>
                        {slideItems.length > 0 && (
                          <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
                            {slideItems[0].type === 'image' ? (
                              <img src={slideItems[0].preview} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <>
                                <img src={slideItems[0].preview} alt="" className="w-full h-full object-cover opacity-80" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <Play className="w-10 h-10 text-white fill-white drop-shadow" />
                                </div>
                              </>
                            )}
                            {totalMedia > 1 && (
                              <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded-full">
                                1 / {totalMedia}
                              </div>
                            )}
                          </div>
                        )}
                        <p className="text-xs text-gray-800 leading-relaxed">{currentDraft.caption}</p>
                        <p className="text-xs text-indigo-500 leading-relaxed">{hashtagsToString(currentDraft.hashtags)}</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => publish(true)} disabled={publishing} className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 disabled:opacity-60">
                        <Send className="w-4 h-4" /> 즉시 발행
                      </button>
                      <button onClick={() => setScheduleMode(v => !v)} className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm hover:bg-gray-50">
                        <Clock className="w-4 h-4" /> 예약 발행
                      </button>
                    </div>
                    {scheduleMode && (
                      <div className="flex gap-2">
                        <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400" />
                        <button onClick={() => publish(false)} disabled={!scheduledAt || publishing} className="px-4 py-2 rounded-xl bg-green-500 text-white text-sm disabled:opacity-60">예약</button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
