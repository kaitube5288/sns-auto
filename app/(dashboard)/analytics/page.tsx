'use client'

import { useEffect, useState } from 'react'
import { BarChart2, Heart, MessageCircle, Bookmark, Eye, Sparkles, RefreshCw } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import type { PostAnalytics } from '@/lib/types'

interface AnalyticsData {
  analytics: PostAnalytics[]
  aiInsight: string | null
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData>({ analytics: [], aiInsight: null })
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

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

  useEffect(() => { load() }, [])

  const list = data.analytics
  const avgReach = avg(list.map(a => a.reach))
  const avgSaveRate = avg(list.map(a => a.save_rate ?? 0))
  const avgEngagement = avg(list.map(a => a.engagement_rate ?? 0))
  const avgLikes = avg(list.map(a => a.likes))

  const chartData = list.slice(0, 14).reverse().map((a, i) => ({
    name: `${i + 1}`,
    도달: a.reach,
    저장: a.saves,
    좋아요: a.likes,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">성과 분석</h1>
          <p className="text-gray-500 mt-1">Instagram 게시물의 성과를 분석합니다</p>
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

      {/* 지표 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard icon={Eye} label="평균 도달수" value={Math.round(avgReach).toLocaleString()} color="blue" loading={loading} />
        <MetricCard icon={Bookmark} label="평균 저장률" value={`${avgSaveRate.toFixed(1)}%`} color="indigo" loading={loading} />
        <MetricCard icon={BarChart2} label="평균 참여율" value={`${avgEngagement.toFixed(1)}%`} color="purple" loading={loading} />
        <MetricCard icon={Heart} label="평균 좋아요" value={Math.round(avgLikes).toLocaleString()} color="pink" loading={loading} />
      </div>

      {/* 차트 */}
      {!loading && list.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-4">최근 14개 게시물 성과</h2>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="도달" stroke="#6366f1" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="저장" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="좋아요" stroke="#ec4899" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* AI 인사이트 */}
      {data.aiInsight && (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <h2 className="font-semibold text-gray-900 text-sm">AI 성과 인사이트</h2>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{data.aiInsight}</p>
        </div>
      )}

      {/* 게시물 목록 */}
      {!loading && list.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-50">
            <h2 className="font-semibold text-gray-900 text-sm">게시물별 성과</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {list.slice(0, 20).map(a => (
              <div key={a.id} className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{a.post_id}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(a.synced_at).toLocaleDateString('ko-KR')}</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{a.reach.toLocaleString()}</span>
                  <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{a.likes}</span>
                  <span className="flex items-center gap-1"><Bookmark className="w-3 h-3" />{a.saves}</span>
                  <span className="flex items-center gap-1 font-medium text-indigo-600">
                    {a.save_rate?.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && list.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
          <BarChart2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">데이터 동기화 버튼을 눌러 성과를 불러오세요</p>
        </div>
      )}
    </div>
  )
}

function avg(nums: number[]) {
  if (!nums.length) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
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
