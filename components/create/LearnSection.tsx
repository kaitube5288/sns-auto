'use client'

import { useState, useEffect, useRef } from 'react'
import { BookOpen, Plus, X, Image as ImageIcon, Trash2 } from 'lucide-react'

interface LearnedExample {
  id: string
  section: string
  content_text: string | null
  image_url: string | null
  created_at: string
}

interface Props {
  section: 'threads' | 'feed' | 'reels'
}

export default function LearnSection({ section }: Props) {
  const [examples, setExamples] = useState<LearnedExample[]>([])
  const [text, setText] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/learn?section=${section}`)
      .then(r => r.json())
      .then(d => setExamples(d.examples ?? []))
      .finally(() => setLoading(false))
  }, [section])

  function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = ev => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function save() {
    if (!text.trim() && !imageFile) return
    setSaving(true)
    try {
      const formData = new FormData()
      formData.append('section', section)
      if (text.trim()) formData.append('content_text', text.trim())
      if (imageFile) formData.append('image', imageFile)

      const res = await fetch('/api/learn', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.example) {
        setExamples(prev => [data.example, ...prev].slice(0, 20))
        setText('')
        setImageFile(null)
        setImagePreview(null)
        if (inputRef.current) inputRef.current.value = ''
      }
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    await fetch(`/api/learn?id=${id}`, { method: 'DELETE' })
    setExamples(prev => prev.filter(e => e.id !== id))
  }

  const sectionLabel = { threads: 'Threads', feed: '인스타 피드', reels: '릴스' }[section]

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-500" />
          <h3 className="font-semibold text-gray-900 text-sm">{sectionLabel} 학습 예시 추가</h3>
        </div>
        <p className="text-xs text-gray-400">AI가 이 스타일을 참고해서 콘텐츠를 생성합니다. 마음에 드는 글이나 이미지를 저장하세요.</p>

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="참고할 글 예시를 입력하세요..."
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 resize-none h-24"
        />

        {imagePreview ? (
          <div className="relative w-24 h-24">
            <img src={imagePreview} alt="" className="w-full h-full object-cover rounded-lg" />
            <button
              onClick={() => { setImageFile(null); setImagePreview(null); if (inputRef.current) inputRef.current.value = '' }}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-indigo-500 transition-colors"
          >
            <ImageIcon className="w-3.5 h-3.5" /> 이미지 추가 (선택)
          </button>
        )}
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />

        <button
          onClick={save}
          disabled={saving || (!text.trim() && !imageFile)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 disabled:opacity-60 transition-colors"
        >
          {saving
            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            : <Plus className="w-4 h-4" />
          }
          학습 예시 저장
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-gray-400 font-medium px-1">저장된 예시 {examples.length} / 20</p>
        {loading ? (
          <div className="text-center py-8 text-gray-300 text-sm">불러오는 중...</div>
        ) : examples.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center shadow-sm">
            <BookOpen className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">저장된 학습 예시가 없습니다</p>
            <p className="text-gray-300 text-xs mt-1">글이나 이미지를 추가하면 AI가 해당 스타일을 학습합니다</p>
          </div>
        ) : (
          examples.map(ex => (
            <div key={ex.id} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm flex gap-3 items-start">
              {ex.image_url && (
                <img src={ex.image_url} alt="" className="w-14 h-14 object-cover rounded-lg flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                {ex.content_text && (
                  <p className="text-xs text-gray-700 leading-relaxed line-clamp-4 whitespace-pre-wrap">{ex.content_text}</p>
                )}
                <p className="text-xs text-gray-300 mt-1.5">{new Date(ex.created_at).toLocaleDateString('ko-KR')}</p>
              </div>
              <button
                onClick={() => remove(ex.id)}
                className="flex-shrink-0 p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
