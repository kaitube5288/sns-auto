'use client'

import { useEffect, useState } from 'react'
import { MessageCircle, TrendingUp, RefreshCw, Sparkles, Send, ChevronDown, ChevronUp, Users } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface Reply {
  id: string
  text: string
  username: string
  timestamp: string
  post_id: string
  post_caption: string
}

interface Snapshot {
  followers_count: number
  recorded_at: string
}

export default function ActivityPage() {
  const [tab, setTab] = useState<'replies' | 'followers'>('replies')

  // ── 댓글 탭 상태 ──────────────────────────────────
  const [replies, setReplies] = useState<Reply[]>([])
  const [repliesLoading, setRepliesLoading] = useState(true)
  const [suggestions, setSuggestions] = useState<Record<string, string>>({})
  const [suggesting, setSuggesting] = useState<string | null>(null)
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({})
  const [sending, setSending] = useState<string | null>(null)
  const [sent, setSent] = useState<Set<string>>(new Set())
  const [expandedPost, setExpandedPost] = useState<string | null>(null)

  // ── 팔로워 탭 상태 ────────────────────────────────
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [followersLoading, setFollowersLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [toast, setToast] = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // 댓글 로드
  useEffect(() => {
    fetch('/api/activity/replies')
      .then(r => r.json())
      .then(d => setReplies(d.replies ?? []))
      .catch(() => {})
      .finally(() => setRepliesLoading(false))
  }, [])

  // 팔로워 스냅샷 로드
  useEffect(() => {
    fetch('/api/activity/followers')
      .then(r => r.json())
      .then(d => setSnapshots(d.snapshots ?? []))
      .catch(() => {})
      .finally(() => setFollowersLoading(false))
  }, [])

  async function suggest(reply: Reply) {
    setSuggesting(reply.id)
    try {
      const res = await fetch('/api/activity/replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply_text: reply.text, post_caption: reply.post_caption }),
      })
      const d = await res.json()
      if (d.suggestion) {
        setSuggestions(prev => ({ ...prev, [reply.id]: d.suggestion }))
        setReplyTexts(prev => ({ ...prev, [reply.id]: d.suggestion }))
      }
    } catch {}
    finally { setSuggesting(null) }
  }

  async function sendReply(replyId: string) {
    const text = replyTexts[replyId]?.trim()
    if (!text) return
    setSending(replyId)
    try {
      const res = await fetch('/api/activity/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply_to_id: replyId, text }),
      })
      const d = await res.json()
      if (d.error) { showToast('전송 실패: ' + d.error); return }
      setSent(prev => new Set([...prev, replyId]))
      showToast('답글을 보냈습니다!')
    } catch { showToast('전송 중 오류가 발생했습니다.') }
    finally { setSending(null) }
  }

  async function syncFollowers() {
    setSyncing(true)
    try {
      const res = await fetch('/api/activity/followers', { method: 'POST' })
      const d = await res.json()
      if (d.error) { showToast(d.error); return }
      const newSnap: Snapshot = { followers_count: d.followers_count, recorded_at: new Date().toISOString() }
      setSnapshots(prev => [...prev, newSnap])
      showToast(`현재 팔로워: ${d.followers_count.toLocaleString()}명`)
    } catch { showToast('동기화 실패') }
    finally { setSyncing(false) }
  }

  // 팔로워 통계 계산
  const latest = snapshots[snapshots.length - 1]
  const prev = snapshots[snapshots.length - 2]
  const diff = latest && prev ? latest.followers_count - prev.followers_count : null
  const weekAgo = snapshots.find(s =>
    new Date(s.recorded_at).getTime() > Date.now() - 8 * 24 * 60 * 60 * 1000 &&
    new Date(s.recorded_at).getTime() < Date.now() - 6 * 24 * 60 * 60 * 1000
  )
  const weekDiff = latest && weekAgo ? latest.followers_count - weekAgo.followers_count : null

  const chartData = snapshots.map(s => {
    const d = new Date(s.recorded_at)
    return {
      name: `${d.getMonth() + 1}/${d.getDate()}`,
      팔로워: s.followers_count,
    }
  })

  const visibleReplies = replies.filter(r => !sent.has(r.id))

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 px-4 py-3 bg-gray-900 text-white rounded-xl text-sm shadow-lg z-50">
          {toast}
        </div>
      )}

      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">활동</h1>
        <p className="text-gray-500 mt-1">댓글 관리 · 팔로워 추이</p>
      </div>

      {/* 탭 */}
      <div className="flex gap-2 bg-gray-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('replies')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${tab === 'replies' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <MessageCircle className="w-4 h-4" />
          댓글
          {visibleReplies.length > 0 && (
            <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">{visibleReplies.length}</span>
          )}
        </button>
        <button
          onClick={() => setTab('followers')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${tab === 'followers' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <TrendingUp className="w-4 h-4" />
          팔로워 추이
        </button>
      </div>

      {/* ── 댓글 탭 ──────────────────────────────── */}
      {tab === 'replies' && (
        <div className="space-y-3">
          {repliesLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-2 animate-pulse">
                  <div className="h-4 bg-gray-100 rounded w-1/3" />
                  <div className="h-4 bg-gray-100 rounded w-2/3" />
                  <div className="h-8 bg-gray-100 rounded" />
                </div>
              ))}
            </div>
          ) : visibleReplies.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
              <MessageCircle className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">새 댓글이 없습니다</p>
            </div>
          ) : (
            visibleReplies.map(reply => {
              const isExpanded = expandedPost === reply.id
              const hasSuggestion = !!suggestions[reply.id]
              const isSending = sending === reply.id

              return (
                <div key={reply.id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
                  {/* 댓글 헤더 */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center">
                          <Users className="w-3.5 h-3.5 text-gray-400" />
                        </div>
                        <span className="text-sm font-semibold text-gray-900">@{reply.username}</span>
                        <span className="text-xs text-gray-400">
                          {new Date(reply.timestamp).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed pl-9">{reply.text}</p>
                    </div>
                  </div>

                  {/* 원본 게시물 미리보기 */}
                  <button
                    onClick={() => setExpandedPost(isExpanded ? null : reply.id)}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors pl-1"
                  >
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    원본 게시물 보기
                  </button>
                  {isExpanded && (
                    <div className="bg-gray-50 rounded-xl px-3 py-2 text-xs text-gray-500 leading-relaxed border border-gray-100">
                      {reply.post_caption.slice(0, 200)}{reply.post_caption.length > 200 ? '...' : ''}
                    </div>
                  )}

                  {/* AI 답글 영역 */}
                  <div className="space-y-2 pt-1 border-t border-gray-50">
                    {!hasSuggestion ? (
                      <button
                        onClick={() => suggest(reply)}
                        disabled={suggesting === reply.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 text-xs font-medium hover:bg-indigo-100 transition-colors disabled:opacity-60"
                      >
                        {suggesting === reply.id
                          ? <div className="w-3 h-3 border border-indigo-600 border-t-transparent rounded-full animate-spin" />
                          : <Sparkles className="w-3 h-3" />
                        }
                        AI 답글 생성
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <textarea
                          value={replyTexts[reply.id] ?? ''}
                          onChange={e => setReplyTexts(prev => ({ ...prev, [reply.id]: e.target.value }))}
                          rows={3}
                          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-400 resize-none leading-relaxed"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => suggest(reply)}
                            disabled={suggesting === reply.id}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-xs hover:bg-gray-50 disabled:opacity-60"
                          >
                            <RefreshCw className="w-3 h-3" />
                            재생성
                          </button>
                          <button
                            onClick={() => sendReply(reply.id)}
                            disabled={isSending || !replyTexts[reply.id]?.trim()}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-500 text-white text-xs font-medium hover:bg-indigo-600 disabled:opacity-60 transition-colors"
                          >
                            {isSending
                              ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                              : <Send className="w-3 h-3" />
                            }
                            답글 보내기
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── 팔로워 추이 탭 ───────────────────────── */}
      {tab === 'followers' && (
        <div className="space-y-4">
          {/* 동기화 버튼 */}
          <div className="flex justify-end">
            <button
              onClick={syncFollowers}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 text-indigo-600 text-sm font-medium hover:bg-indigo-100 disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              지금 수집
            </button>
          </div>

          {/* 핵심 지표 카드 */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xs text-gray-400 mb-1">현재 팔로워</p>
              <p className="text-2xl font-bold text-gray-900">
                {followersLoading ? '—' : (latest?.followers_count.toLocaleString() ?? '—')}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xs text-gray-400 mb-1">전일 대비</p>
              <p className={`text-2xl font-bold ${diff === null ? 'text-gray-300' : diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {diff === null ? '—' : `${diff >= 0 ? '+' : ''}${diff}`}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xs text-gray-400 mb-1">7일 대비</p>
              <p className={`text-2xl font-bold ${weekDiff === null ? 'text-gray-300' : weekDiff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {weekDiff === null ? '—' : `${weekDiff >= 0 ? '+' : ''}${weekDiff}`}
              </p>
            </div>
          </div>

          {/* 추이 차트 */}
          {chartData.length >= 2 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-4 text-sm">30일 팔로워 추이</h2>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                  <Tooltip />
                  <Line type="monotone" dataKey="팔로워" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center shadow-sm">
              <TrendingUp className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">
                "지금 수집" 버튼을 눌러 팔로워 수를 기록하세요.<br />
                2회 이상 수집하면 추이 차트가 표시됩니다.
              </p>
            </div>
          )}

          {/* 기록 목록 */}
          {snapshots.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-50">
                <h2 className="font-semibold text-gray-900 text-sm">수집 기록</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {[...snapshots].reverse().slice(0, 20).map((s, i) => {
                  const prevSnap = [...snapshots].reverse()[i + 1]
                  const d = prevSnap ? s.followers_count - prevSnap.followers_count : null
                  return (
                    <div key={s.recorded_at} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span className="text-gray-500">
                        {new Date(s.recorded_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div className="flex items-center gap-3">
                        {d !== null && (
                          <span className={`text-xs font-medium ${d >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {d >= 0 ? '+' : ''}{d}
                          </span>
                        )}
                        <span className="font-semibold text-gray-900">{s.followers_count.toLocaleString()}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
