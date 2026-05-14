'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, RefreshCw, Copy, Send, Clock, CheckCircle2, Image, X, Wand2, ChevronDown, ChevronRight, Bookmark, BookmarkCheck } from 'lucide-react'
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

const EMOJI_GROUPS = [
  { label: '감성', emojis: ['✨', '🌸', '🍀', '🌿', '🌙', '☀️', '🌈', '💫', '🌺', '🌻'] },
  { label: '카페·음식', emojis: ['☕', '🍵', '🧋', '🍰', '🧁', '🍩', '🥐', '🍫', '🍪', '🥧'] },
  { label: '표정', emojis: ['😊', '🥰', '😋', '🤗', '😍', '😌', '🫶', '🙏', '😎', '🥹'] },
  { label: '반응', emojis: ['❤️', '💕', '🔥', '💯', '🎉', '✅', '👏', '💪', '🙌', '⭐'] },
]

interface DraftWithId extends ThreadsDraft { id?: string; created_at?: string; status?: string; scheduled_at?: string }
interface SessionGroup { key: string; label: string; drafts: DraftWithId[] }

function groupBySession(drafts: DraftWithId[]): SessionGroup[] {
  if (!drafts.length) return []
  const sorted = [...drafts].sort(
    (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
  )
  const groups: SessionGroup[] = []
  for (const draft of sorted) {
    const t = new Date(draft.created_at ?? 0).getTime()
    const last = groups[groups.length - 1]
    if (last && new Date(last.key).getTime() - t < 5 * 60 * 1000) {
      last.drafts.push(draft)
    } else {
      const key = draft.created_at ?? new Date().toISOString()
      groups.push({ key, label: sessionLabel(key), drafts: [draft] })
    }
  }
  return groups
}

function sessionLabel(dateStr: string): string {
  const kst = new Date(new Date(dateStr).getTime() + 9 * 60 * 60 * 1000)
  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const dateOnly = kst.toISOString().slice(0, 10)
  const todayStr = nowKst.toISOString().slice(0, 10)
  const yestStr = new Date(nowKst.getTime() - 86400000).toISOString().slice(0, 10)
  const hhmm = kst.toISOString().slice(11, 16)
  if (dateOnly === todayStr) return `오늘 ${hhmm}`
  if (dateOnly === yestStr) return `어제 ${hhmm}`
  return `${kst.getMonth() + 1}월 ${kst.getDate()}일 ${hhmm}`
}

export default function ThreadsCreatePage() {
  const [activeTab, setActiveTab] = useState<'generate' | 'learn'>('generate')
  const [mode, setMode] = useState<'solo' | 'combined'>('solo')
  const [contextNote, setContextNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [drafts, setDrafts] = useState<DraftWithId[]>([])
  const [savedDrafts, setSavedDrafts] = useState<DraftWithId[]>([])
  const [savedOpen, setSavedOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())
  const [publishing, setPublishing] = useState(false)
  const [scheduleMode, setScheduleMode] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [toast, setToast] = useState('')
  const [refineInstructions, setRefineInstructions] = useState<Record<string, string>>({})
  const [refiningId, setRefiningId] = useState<string | null>(null)
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)
  const [pendingTones, setPendingTones] = useState<Record<string, ContentTone | null>>({})
  const [publishImages, setPublishImages] = useState<File[]>([])
  const [publishPreviews, setPublishPreviews] = useState<string[]>([])
  const publishImageRef = useRef<HTMLInputElement>(null)
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    fetch('/api/generate/threads')
      .then(r => r.json())
      .then(data => {
        const toItem = (d: { id: string; tone?: string; caption: string; hashtags: string[]; created_at: string; status?: string; scheduled_at?: string }) => ({
          tone: d.tone ?? undefined,
          caption: d.caption ?? '',
          hashtags: d.hashtags ?? [],
          engagement_hook: '',
          id: d.id,
          created_at: d.created_at,
          status: d.status,
          scheduled_at: d.scheduled_at,
        })
        if (data.drafts?.length) {
          const loaded = data.drafts.map(toItem)
          setDrafts(loaded)
          const groups = groupBySession(loaded)
          if (groups[0]) {
            setOpenGroups(new Set([groups[0].key]))
            setSelectedId(loaded[0]?.id ?? null)
          }
        }
        if (data.saved?.length) {
          setSavedDrafts(data.saved.map(toItem))
        }
      })
      .catch(() => {})
  }, [])

  function updateDraft(id: string, caption: string) {
    setDrafts(prev => prev.map(d => d.id === id ? { ...d, caption } : d))
    setSavedDrafts(prev => prev.map(d => d.id === id ? { ...d, caption } : d))
    clearTimeout(saveTimers.current[id])
    saveTimers.current[id] = setTimeout(() => {
      fetch('/api/generate/threads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, caption }),
      }).catch(() => {})
    }, 1000)
  }

  async function refine(id: string) {
    const instruction = refineInstructions[id]?.trim()
    if (!instruction) return
    const draft = drafts.find(d => d.id === id)
    if (!draft) return
    setRefiningId(id)
    try {
      const res = await fetch('/api/generate/threads/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption: draft.caption, instruction }),
      })
      const data = await res.json()
      if (data.error) { alert(data.error); return }
      updateDraft(id, data.caption)
      setRefineInstructions(prev => ({ ...prev, [id]: '' }))
    } catch {
      alert('수정 중 오류가 발생했습니다.')
    } finally {
      setRefiningId(null)
    }
  }

  function selectPendingTone(id: string, tone: ContentTone) {
    setPendingTones(prev => ({ ...prev, [id]: prev[id] === tone ? null : tone }))
  }

  async function generateWithTone(id: string) {
    const newTone = pendingTones[id]
    if (!newTone) return
    const draft = drafts.find(d => d.id === id)
    if (!draft) return
    setRegeneratingId(id)
    try {
      const toneLabel = TONES.find(t => t.value === newTone)?.label ?? newTone
      const res = await fetch('/api/generate/threads/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption: draft.caption,
          instruction: `이 글의 내용과 소재는 그대로 유지하면서 '${toneLabel}' 말투로만 바꿔줘. 구조와 스토리는 변경하지 마.`,
        }),
      })
      const data = await res.json()
      if (data.error) { alert(data.error); return }
      setDrafts(prev => prev.map(d => d.id === id ? { ...d, caption: data.caption, tone: newTone } : d))
      fetch('/api/generate/threads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, caption: data.caption, tone: newTone }),
      }).catch(() => {})
      setPendingTones(prev => ({ ...prev, [id]: null }))
    } catch {
      alert('톤 변경 중 오류가 발생했습니다.')
    } finally {
      setRegeneratingId(null)
    }
  }

  async function generate() {
    setLoading(true)
    try {
      const res = await fetch('/api/generate/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context_note: contextNote, mode, count: 8 }),
      })
      const data = await res.json()
      if (data.error) { alert(data.error); return }
      const newDrafts: DraftWithId[] = data.drafts
      setDrafts(prev => [...newDrafts, ...prev])
      const newKey = newDrafts[0]?.created_at
      if (newKey) setOpenGroups(prev => new Set([newKey, ...prev]))
      setSelectedId(newDrafts[0]?.id ?? null)
    } catch {
      alert('생성 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
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

  async function publish(immediate: boolean) {
    const draft = drafts.find(d => d.id === selectedId)
    if (!draft) return
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
      if (!immediate && scheduledAt) body.scheduled_at = new Date(scheduledAt).toISOString()
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

  function saveDraft(id: string) {
    const draft = drafts.find(d => d.id === id)
    if (!draft) return
    setDrafts(prev => prev.filter(d => d.id !== id))
    setSavedDrafts(prev => [draft, ...prev])
    if (selectedId === id) setSelectedId(null)
    fetch('/api/generate/threads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_bookmarked: true }),
    }).catch(() => {})
  }

  function unsaveDraft(id: string) {
    const draft = savedDrafts.find(d => d.id === id)
    if (!draft) return
    setSavedDrafts(prev => prev.filter(d => d.id !== id))
    setDrafts(prev => [draft, ...prev])
    fetch('/api/generate/threads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_bookmarked: false }),
    }).catch(() => {})
  }

  async function deleteDraft(id: string) {
    setDrafts(prev => prev.filter(d => d.id !== id))
    setSavedDrafts(prev => prev.filter(d => d.id !== id))
    if (selectedId === id) setSelectedId(null)
    fetch('/api/generate/threads', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {})
  }

  function copyText(draft: DraftWithId) {
    navigator.clipboard.writeText(`${draft.caption}\n\n${hashtagsToString(draft.hashtags)}`)
    showToast('복사되었습니다')
  }

  function toggleGroup(key: string) {
    setOpenGroups(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const selectedDraft = drafts.find(d => d.id === selectedId) ?? null
  const groups = groupBySession(drafts)

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

          {/* 세션별 아코디언 */}
          {groups.map(group => {
            const isOpen = openGroups.has(group.key)
            return (
              <div key={group.key} className="space-y-2">
                {/* 세션 헤더 */}
                <button
                  onClick={() => toggleGroup(group.key)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white rounded-2xl border border-gray-100 shadow-sm hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isOpen
                      ? <ChevronDown className="w-4 h-4 text-gray-400" />
                      : <ChevronRight className="w-4 h-4 text-gray-400" />
                    }
                    <span className="text-sm font-semibold text-gray-800">{group.label}</span>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{group.drafts.length}개</span>
                  </div>
                  <span className="text-xs text-gray-300">클릭해서 {isOpen ? '접기' : '펼치기'}</span>
                </button>

                {/* 카드 그리드 */}
                {isOpen && (
                  <div className="grid grid-cols-2 gap-4">
                    {group.drafts.map((draft, displayIdx) => (
                      <DraftCard
                        key={draft.id}
                        draft={draft}
                        displayIdx={displayIdx + 1}
                        selected={selectedId === draft.id}
                        onSelect={() => setSelectedId(draft.id ?? null)}
                        onCopy={() => copyText(draft)}
                        onUpdate={cap => draft.id && updateDraft(draft.id, cap)}
                        refineInstruction={draft.id ? (refineInstructions[draft.id] || '') : ''}
                        onRefineChange={v => draft.id && setRefineInstructions(prev => ({ ...prev, [draft.id!]: v }))}
                        onRefine={() => draft.id && refine(draft.id)}
                        refining={refiningId === draft.id}
                        pendingTone={draft.id ? (pendingTones[draft.id] ?? null) : null}
                        onToneSelect={t => draft.id && selectPendingTone(draft.id, t)}
                        onToneGenerate={() => draft.id && generateWithTone(draft.id)}
                        regenerating={regeneratingId === draft.id}
                        onDelete={() => draft.id && deleteDraft(draft.id)}
                        onSave={() => draft.id && saveDraft(draft.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* 저장된 글 섹션 */}
          {savedDrafts.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => setSavedOpen(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 rounded-2xl border border-amber-100 hover:bg-amber-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {savedOpen ? <ChevronDown className="w-4 h-4 text-amber-500" /> : <ChevronRight className="w-4 h-4 text-amber-500" />}
                  <Bookmark className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-semibold text-amber-800">저장된 글</span>
                  <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">{savedDrafts.length}개</span>
                </div>
                <span className="text-xs text-amber-400">클릭해서 {savedOpen ? '접기' : '펼치기'}</span>
              </button>
              {savedOpen && (
                <div className="grid grid-cols-2 gap-4">
                  {savedDrafts.map((draft, displayIdx) => (
                    <DraftCard
                      key={draft.id}
                      draft={draft}
                      displayIdx={displayIdx + 1}
                      selected={selectedId === draft.id}
                      onSelect={() => setSelectedId(draft.id ?? null)}
                      onCopy={() => copyText(draft)}
                      onUpdate={cap => draft.id && updateDraft(draft.id, cap)}
                      refineInstruction={draft.id ? (refineInstructions[draft.id] || '') : ''}
                      onRefineChange={v => draft.id && setRefineInstructions(prev => ({ ...prev, [draft.id!]: v }))}
                      onRefine={() => draft.id && refine(draft.id)}
                      refining={refiningId === draft.id}
                      pendingTone={draft.id ? (pendingTones[draft.id] ?? null) : null}
                      onToneSelect={t => draft.id && selectPendingTone(draft.id, t)}
                      onToneGenerate={() => draft.id && generateWithTone(draft.id)}
                      regenerating={regeneratingId === draft.id}
                      onDelete={() => draft.id && deleteDraft(draft.id)}
                      onUnsave={() => draft.id && unsaveDraft(draft.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 미리보기 + 발행 */}
          {selectedDraft && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
                  <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{selectedDraft.caption}</p>
                  {publishPreviews.length > 0 && (
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {publishPreviews.map((p, i) => (
                        <img key={i} src={p} alt="" className="w-16 h-16 object-cover rounded-lg" />
                      ))}
                    </div>
                  )}
                  <p className="text-sm text-indigo-500 mt-2">{hashtagsToString(selectedDraft.hashtags)}</p>
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
        </div>
      )}
    </div>
  )
}

interface DraftCardProps {
  draft: DraftWithId
  displayIdx: number
  selected: boolean
  onSelect: () => void
  onCopy: () => void
  onUpdate: (cap: string) => void
  refineInstruction: string
  onRefineChange: (v: string) => void
  onRefine: () => void
  refining: boolean
  pendingTone: ContentTone | null
  onToneSelect: (t: ContentTone) => void
  onToneGenerate: () => void
  regenerating: boolean
  onDelete: () => void
  onSave?: () => void
  onUnsave?: () => void
}

function DraftCard({ draft, displayIdx, selected, onSelect, onCopy, onUpdate, refineInstruction, onRefineChange, onRefine, refining, pendingTone, onToneSelect, onToneGenerate, regenerating, onDelete, onSave, onUnsave }: DraftCardProps) {
  const hasPendingChange = pendingTone !== null && pendingTone !== draft.tone
  const [showEmoji, setShowEmoji] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function insertEmoji(emoji: string) {
    const ta = textareaRef.current
    const start = ta?.selectionStart ?? draft.caption.length
    const end = ta?.selectionEnd ?? draft.caption.length
    const newCaption = draft.caption.slice(0, start) + emoji + draft.caption.slice(end)
    onUpdate(newCaption)
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = start + emoji.length
        textareaRef.current.selectionEnd = start + emoji.length
        textareaRef.current.focus()
      }
    }, 0)
    setShowEmoji(false)
  }

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

      {draft.status === 'scheduled' && draft.scheduled_at && (
        <div className="flex items-center gap-1.5 mb-2 px-2.5 py-1.5 bg-green-50 border border-green-100 rounded-xl">
          <Clock className="w-3 h-3 text-green-500 flex-shrink-0" />
          <span className="text-xs text-green-700 font-medium">
            예약됨 · {new Date(draft.scheduled_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium text-gray-400">#{displayIdx}</span>
          {draft.tone && (
            <span className="text-xs px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 font-medium">
              {TONES.find(t => t.value === draft.tone)?.emoji} {TONES.find(t => t.value === draft.tone)?.label ?? draft.tone}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={e => { e.stopPropagation(); setShowEmoji(v => !v) }}
            className={`p-1.5 rounded-lg text-base leading-none transition-colors ${showEmoji ? 'bg-amber-100' : 'hover:bg-gray-100'}`}
            title="이모티콘"
          >
            😊
          </button>
          <button onClick={e => { e.stopPropagation(); onCopy() }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <Copy className="w-3.5 h-3.5" />
          </button>
          {onSave && (
            <button
              onClick={e => { e.stopPropagation(); onSave() }}
              className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-300 hover:text-amber-500 transition-colors"
              title="저장"
            >
              <Bookmark className="w-3.5 h-3.5" />
            </button>
          )}
          {onUnsave && (
            <button
              onClick={e => { e.stopPropagation(); onUnsave() }}
              className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-400 transition-colors"
              title="저장 취소"
            >
              <BookmarkCheck className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
            title="삭제"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 이모티콘 팔레트 */}
      {showEmoji && (
        <div className="mb-2 p-2 bg-gray-50 rounded-xl border border-gray-100" onClick={e => e.stopPropagation()}>
          {EMOJI_GROUPS.map(group => (
            <div key={group.label} className="mb-1.5 last:mb-0">
              <p className="text-[10px] text-gray-400 mb-1">{group.label}</p>
              <div className="flex flex-wrap gap-0.5">
                {group.emojis.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => insertEmoji(emoji)}
                    className="text-lg w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <textarea
        ref={textareaRef}
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

      {/* 톤 선택 + 변환 버튼 */}
      <div className="mt-2 pt-2 border-t border-gray-100" onClick={e => e.stopPropagation()}>
        <div className="flex flex-wrap gap-1 mb-2">
          {TONES.map(t => {
            const isCurrent = draft.tone === t.value
            const isPending = pendingTone === t.value
            return (
              <button
                key={t.value}
                onClick={() => onToneSelect(t.value)}
                disabled={regenerating || refining}
                className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors disabled:opacity-40 ${
                  isPending && !isCurrent
                    ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300'
                    : isCurrent
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {t.emoji} {t.label}
              </button>
            )
          })}
        </div>
        {hasPendingChange && (
          <button
            onClick={onToneGenerate}
            disabled={regenerating || refining}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
          >
            <Sparkles className="w-3 h-3" />
            {TONES.find(t => t.value === pendingTone)?.label} 말투로 변환
          </button>
        )}
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
