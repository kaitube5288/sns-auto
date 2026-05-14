'use client'

import { useEffect, useRef, useState } from 'react'
import { BarChart2, Heart, MessageCircle, Bookmark, Eye, Sparkles, RefreshCw, Share2, Pencil, Check, Brain } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import type { PostAnalytics } from '@/lib/types'

interface AnalyticsData {
  instagram: PostAnalytics[]
  threads: PostAnalytics[]
  igInsight: string | null
  threadsInsight: string | null
}

function avg(nums: number[]) {
  if (!nums.length) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData>({ instagram: [], threads: [], igInsight: null, threadsInsight: null })
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [tab, setTab] = useState<'instagram' | 'threads'>('instagram')
  const [editingViews, setEditingViews] = useState<{ postId: string; value: string } | null>(null)
  const [learnResult, setLearnResult] = useState<string | null>(null)
  const [learning, setLearning] = useState(false)
  const [patternsLearned, setPatternsLearned] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/analytics/data')
      const d = await res.json()
      setData(d)
    } finally {
      setLoading(false)
    }
  }

  async function sync() {
    setSyncing(true)
    try {
      await fetch('/api/analytics/sync', { method: 'POST' })
      await load()
    } finally {
      setSyncing(false)
    }
  }

  async function saveViews(postId: string, value: string) {
    const impressions = parseInt(value, 10)
    if (isNaN(impressions)) { setEditingViews(null); return }
    await fetch('/api/analytics/data', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: postId, impressions }),
    })
    setData(prev => ({
      ...prev,
      threads: prev.threads.map(a =>
        a.post_id === postId
          ? { ...a, reach: impressions, impressions, engagement_rate: impressions > 0 ? parseFloat((((a.likes + a.comments + a.saves) / impressions) * 100).toFixed(1)) : a.engagement_rate }
          : a
      ),
      instagram: prev.instagram.map(a =>
        a.post_id === postId
          ? { ...a, reach: impressions, impressions }
          : a
      ),
    }))
    setEditingViews(null)
  }

  async function analyze() {
    setLearning(true)
    setLearnResult(null)
    try {
      const res = await fetch('/api/analytics/learn', { method: 'POST' })
      const d = await res.json()
      if (d.error) { setLearnResult(`오류: ${d.error}`); return }
      setLearnResult(d.analysis)
      setPatternsLearned(d.patternsLearned)
    } finally {
      setLearning(false)
    }
  }

  useEffect(() => { load() }, [])

  const list = tab === 'instagram' ? data.instagram : data.threads
  const insight = tab === 'instagram' ? data.igInsight : data.threadsInsight
  const isThreads = tab === 'threads'

  const avgReach = avg(list.map(a => a.reach))
  const avgLikes = avg(list.map(a => a.likes))
  const avgComments = avg(list.map(a => a.comments))
  const avgEngagement = avg(list.map(a => a.engagement_rate ?? 0))
  const avgSaveRate = avg(list.map(a => a.save_rate ?? 0))
  const avgSaves = avg(list.map(a => a.saves))

  const chartData = list.slice(0, 14).reverse().map((a, i) => ({
    name: `${i + 1}`,
    [isThreads ? '조회수' : '도달']: a.reach,
    [isThreads ? '공유' : '저장']: a.saves,
    좋아요: a.likes,
    [isThreads ? '답글' : '댓글']: a.comments,
  }))

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">성과 분석</h1>
          <p className="text-gray-500 mt-1">Instagram · Threads 게시물의 성과를 분석합니다</p>
        </div>
        <button
          onClick={sync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 text-indigo-600 text-sm font-medium hover:bg-indigo-100 disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          데이터 동기화
        </button>
      </div>

      {/* 플랫폼 탭 */}
      <div className="flex gap-2 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('instagram')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${tab === 'instagram' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <span className="w-4 h-4 rounded bg-gradient-to-br from-pink-500 to-orange-400 inline-block" />
          Instagram
          {data.instagram.length > 0 && (
            <span className="text-xs bg-pink-100 text-pink-600 px-1.5 py-0.5 rounded-full">{data.instagram.length}</span>
          )}
        </button>
        <button
          onClick={() => setTab('threads')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${tab === 'threads' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <span className="w-4 h-4 rounded bg-gray-900 inline-block" />
          Threads
          {data.threads.length > 0 && (
            <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{data.threads.length}</span>
          )}
        </button>
      </div>

      {/* 지표 카드 */}
      {isThreads ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard icon={Eye}           label="평균 조회수" value={Math.round(avgReach).toLocaleString()}     color="blue"   loading={loading} />
          <MetricCard icon={Heart}         label="평균 좋아요" value={Math.round(avgLikes).toLocaleString()}     color="pink"   loading={loading} />
          <MetricCard icon={MessageCircle} label="평균 답글"   value={Math.round(avgComments).toLocaleString()} color="indigo" loading={loading} />
          <MetricCard icon={Share2}        label="평균 공유"   value={Math.round(avgSaves).toLocaleString()}    color="purple" loading={loading} />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard icon={Eye}       label="평균 도달수" value={Math.round(avgReach).toLocaleString()}   color="blue"   loading={loading} />
          <MetricCard icon={Bookmark}  label="평균 저장률" value={`${avgSaveRate.toFixed(1)}%`}           color="indigo" loading={loading} />
          <MetricCard icon={BarChart2} label="평균 참여율" value={`${avgEngagement.toFixed(1)}%`}         color="purple" loading={loading} />
          <MetricCard icon={Heart}     label="평균 좋아요" value={Math.round(avgLikes).toLocaleString()}   color="pink"   loading={loading} />
        </div>
      )}

      {/* 차트 */}
      {!loading && list.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-4">
            최근 {Math.min(list.length, 14)}개 게시물 성과
          </h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              {isThreads ? (
                <>
                  <Line type="monotone" dataKey="조회수" stroke="#6366f1" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="좋아요" stroke="#ec4899" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="답글"   stroke="#8b5cf6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="공유"   stroke="#06b6d4" strokeWidth={2} dot={false} />
                </>
              ) : (
                <>
                  <Line type="monotone" dataKey="도달"   stroke="#6366f1" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="저장"   stroke="#8b5cf6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="좋아요" stroke="#ec4899" strokeWidth={2} dot={false} />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* AI 인사이트 */}
      {insight && (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <h2 className="font-semibold text-gray-900 text-sm">
              AI 성과 인사이트 — {isThreads ? 'Threads' : 'Instagram'}
            </h2>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{insight}</p>
        </div>
      )}

      {/* 게시물별 성과 목록 */}
      {!loading && list.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-50">
            <h2 className="font-semibold text-gray-900 text-sm">게시물별 성과</h2>
            {isThreads && <p className="text-xs text-gray-400 mt-0.5">조회수 아이콘 클릭 시 직접 입력 가능</p>}
          </div>
          <div className="divide-y divide-gray-50">
            {list.slice(0, 20).map(a => (
              <PostRow
                key={a.id}
                a={a}
                isThreads={isThreads}
                editingViews={editingViews}
                setEditingViews={setEditingViews}
                saveViews={saveViews}
              />
            ))}
          </div>
        </div>
      )}

      {!loading && list.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
          <BarChart2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">
            {isThreads ? 'Threads' : 'Instagram'} 데이터가 없습니다.<br />
            데이터 동기화 버튼을 눌러 성과를 불러오세요
          </p>
        </div>
      )}

      {/* AI 인기 게시물 분석 & 자동 학습 */}
      {!loading && data.threads.length >= 2 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-indigo-500" />
                <h2 className="font-semibold text-gray-900 text-sm">인기 게시물 AI 분석 & 자동 학습</h2>
              </div>
              <p className="text-xs text-gray-400 mt-1">분석 결과가 글 생성에 자동으로 반영됩니다</p>
            </div>
            <button
              onClick={analyze}
              disabled={learning}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 disabled:opacity-60"
            >
              <Sparkles className={`w-4 h-4 ${learning ? 'animate-pulse' : ''}`} />
              {learning ? '분석 중...' : '분석 & 학습'}
            </button>
          </div>

          {patternsLearned !== null && !learnResult?.startsWith('오류') && (
            <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2">
              <Check className="w-3.5 h-3.5" />
              {patternsLearned}개 패턴이 학습됐습니다. 다음 글 생성 시 반영됩니다.
            </div>
          )}

          {learnResult && (
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {learnResult}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PostRow({
  a, isThreads, editingViews, setEditingViews, saveViews
}: {
  a: PostAnalytics
  isThreads: boolean
  editingViews: { postId: string; value: string } | null
  setEditingViews: (v: { postId: string; value: string } | null) => void
  saveViews: (postId: string, value: string) => void
}) {
  const isEditing = editingViews?.postId === a.post_id
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) inputRef.current?.focus()
  }, [isEditing])

  return (
    <div className="relative group flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors">
      {/* 캡션 호버 미리보기 */}
      {a.caption && (
        <div className="pointer-events-none absolute left-4 bottom-full mb-2 z-20 hidden group-hover:block w-72">
          <div className="bg-gray-900 text-white text-xs rounded-xl px-3 py-2.5 shadow-lg leading-relaxed">
            {a.caption.slice(0, 200)}{a.caption.length > 200 ? '...' : ''}
          </div>
          <div className="w-2 h-2 bg-gray-900 rotate-45 ml-4 -mt-1" />
        </div>
      )}

      {/* 날짜 */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 truncate">
          {a.caption ? a.caption.slice(0, 28) + (a.caption.length > 28 ? '…' : '') : a.post_id.slice(-8)}
        </p>
        <p className="text-xs text-gray-300 mt-0.5">{new Date(a.synced_at).toLocaleDateString('ko-KR')}</p>
      </div>

      {/* 지표 */}
      {isThreads ? (
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {/* 조회수 — 클릭해서 수동 입력 */}
          <span className="flex items-center gap-1">
            {isEditing ? (
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3 text-indigo-500" />
                <input
                  ref={inputRef}
                  type="number"
                  value={editingViews!.value}
                  onChange={e => setEditingViews({ postId: a.post_id, value: e.target.value })}
                  onBlur={() => saveViews(a.post_id, editingViews!.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveViews(a.post_id, editingViews!.value) }}
                  className="w-20 border border-indigo-300 rounded px-1.5 py-0.5 text-xs outline-none"
                />
              </span>
            ) : (
              <button
                onClick={() => setEditingViews({ postId: a.post_id, value: String(a.reach) })}
                className="flex items-center gap-1 hover:text-indigo-500 transition-colors"
                title="클릭해서 조회수 직접 입력"
              >
                <Eye className="w-3 h-3" />{a.reach.toLocaleString()}
                <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-50" />
              </button>
            )}
          </span>
          <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{a.likes}</span>
          <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{a.comments}</span>
          <span className="flex items-center gap-1"><Share2 className="w-3 h-3" />{a.saves}</span>
          <span className="font-medium text-gray-700 w-10 text-right">{a.engagement_rate?.toFixed(1)}%</span>
        </div>
      ) : (
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{a.reach.toLocaleString()}</span>
          <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{a.likes}</span>
          <span className="flex items-center gap-1"><Bookmark className="w-3 h-3" />{a.saves}</span>
          <span className="font-medium text-indigo-600">{a.save_rate?.toFixed(1)}%</span>
        </div>
      )}
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, color, loading }: {
  icon: React.ElementType; label: string; value: string; color: string; loading: boolean
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    purple: 'bg-purple-50 text-purple-600',
    pink: 'bg-pink-50 text-pink-600',
  }
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      {loading ? (
        <div className="space-y-2">
          <div className="w-8 h-8 bg-gray-100 rounded-lg animate-pulse" />
          <div className="h-4 bg-gray-100 rounded animate-pulse" />
          <div className="h-6 bg-gray-100 rounded animate-pulse" />
        </div>
      ) : (
        <>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${colors[color]}`}>
            <Icon className="w-4 h-4" />
          </div>
          <p className="text-xs text-gray-400">{label}</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
        </>
      )}
    </div>
  )
}
