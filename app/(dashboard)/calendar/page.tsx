'use client'

import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Share2, Clock, X, CheckCircle2, AlertCircle } from 'lucide-react'
import { formatKST } from '@/lib/utils'
import type { Content } from '@/lib/types'

const DAYS = ['일', '월', '화', '수', '목', '금', '토']
const STATUS_STYLE: Record<string, string> = {
  scheduled: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  published: 'bg-green-100 text-green-700 border-green-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
  publishing: 'bg-yellow-100 text-yellow-700 border-yellow-200',
}
const STATUS_LABEL: Record<string, string> = {
  scheduled: '예약',
  published: '발행됨',
  failed: '실패',
  publishing: '발행 중',
}

export default function CalendarPage() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [contents, setContents] = useState<Content[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Content | null>(null)

  const weekStart = getWeekStart(weekOffset)
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })

  useEffect(() => {
    setLoading(true)
    const start = weekStart.toISOString()
    const end = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
    fetch(`/api/contents?start=${start}&end=${end}&status=scheduled,published,failed`)
      .then(r => r.json())
      .then(d => setContents(d.contents ?? []))
      .finally(() => setLoading(false))
  }, [weekOffset])

  async function cancelSchedule(contentId: string) {
    await fetch('/api/publish/schedule', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_id: contentId }),
    })
    setContents(prev => prev.filter(c => c.id !== contentId))
    setSelected(null)
  }

  function contentsByDay(date: Date): Content[] {
    return contents.filter(c => {
      const d = new Date(c.scheduled_at ?? c.published_at ?? '')
      return d.toDateString() === date.toDateString()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">예약 캘린더</h1>
          <p className="text-gray-500 mt-1">예약된 게시물을 확인하고 관리하세요</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset(w => w - 1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-gray-700 min-w-[140px] text-center">
            {weekDates[0].toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} ~{' '}
            {weekDates[6].toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
          </span>
          <button
            onClick={() => setWeekOffset(w => w + 1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium hover:bg-gray-50"
          >
            이번 주
          </button>
        </div>
      </div>

      {/* 캘린더 그리드 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* 헤더 */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {weekDates.map((d, i) => {
            const isToday = d.toDateString() === new Date().toDateString()
            return (
              <div key={i} className={`p-3 text-center border-r border-gray-50 last:border-r-0 ${isToday ? 'bg-indigo-50' : ''}`}>
                <p className={`text-xs font-medium ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'}`}>
                  {DAYS[i]}
                </p>
                <p className={`text-lg font-bold mt-0.5 ${isToday ? 'text-indigo-600' : 'text-gray-900'}`}>
                  {d.getDate()}
                </p>
              </div>
            )
          })}
        </div>

        {/* 콘텐츠 슬롯 */}
        <div className="grid grid-cols-7 min-h-[300px]">
          {weekDates.map((d, i) => (
            <div key={i} className="p-2 border-r border-gray-50 last:border-r-0 space-y-1.5 min-h-[200px]">
              {loading ? (
                <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
              ) : (
                contentsByDay(d).map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelected(c)}
                    className={`w-full text-left p-2 rounded-lg border text-xs transition-all hover:opacity-80 ${STATUS_STYLE[c.status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}
                  >
                    <div className="flex items-center gap-1 mb-0.5">
                      <Share2 className="w-3 h-3" />
                      <span className="font-medium">{STATUS_LABEL[c.status]}</span>
                    </div>
                    <p className="truncate text-xs opacity-80">{c.caption?.slice(0, 20)}...</p>
                    {(c.scheduled_at || c.published_at) && (
                      <p className="text-xs opacity-60 mt-0.5">
                        {new Date(c.scheduled_at ?? c.published_at!).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </button>
                ))
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 상세 모달 */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_STYLE[selected.status]}`}>
                  {selected.status === 'published' && <CheckCircle2 className="w-3 h-3" />}
                  {selected.status === 'failed' && <AlertCircle className="w-3 h-3" />}
                  {selected.status === 'scheduled' && <Clock className="w-3 h-3" />}
                  {STATUS_LABEL[selected.status]}
                </span>
              </div>
              <button onClick={() => setSelected(null)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <p className="text-sm text-gray-800 whitespace-pre-wrap mb-3">{selected.caption}</p>
            {selected.hashtags?.length ? (
              <p className="text-xs text-indigo-500">{selected.hashtags.map(t => `#${t}`).join(' ')}</p>
            ) : null}

            {selected.scheduled_at && (
              <p className="text-xs text-gray-400 mt-3">
                예약: {formatKST(selected.scheduled_at)}
              </p>
            )}
            {selected.published_at && (
              <p className="text-xs text-gray-400 mt-1">
                발행: {formatKST(selected.published_at)}
              </p>
            )}
            {selected.publish_error && (
              <p className="text-xs text-red-500 mt-2">오류: {selected.publish_error}</p>
            )}

            {selected.status === 'scheduled' && (
              <button
                onClick={() => cancelSchedule(selected.id)}
                className="w-full mt-4 py-2 rounded-xl border border-red-200 text-red-600 text-sm hover:bg-red-50"
              >
                예약 취소
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function getWeekStart(offset: number): Date {
  const now = new Date()
  const day = now.getDay()
  const start = new Date(now)
  start.setDate(now.getDate() - day + offset * 7)
  start.setHours(0, 0, 0, 0)
  return start
}
