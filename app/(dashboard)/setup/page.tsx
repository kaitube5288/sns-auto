'use client'

import { useState, useEffect } from 'react'
import { Plus, X, Sparkles, CheckCircle2 } from 'lucide-react'
import type { BusinessProfile, BusinessAnalysis } from '@/lib/types'

const BUSINESS_TYPES = ['카페', '식당', '베이커리', '디저트 카페', '술집', '분식', '치킨', '피자', '편의점', '미용실', '네일샵', '기타']

export default function SetupPage() {
  const [form, setForm] = useState({
    brand_name: '',
    business_type: '카페',
    location: '',
    sub_category: '',
    target_audience: '',
    brand_tone: '',
  })
  const [hashtags, setHashtags] = useState<string[]>([])
  const [hashtagInput, setHashtagInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState<BusinessAnalysis | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/account/profile')
      .then(r => r.json())
      .then(() => {
        // 기존 프로필 로드
        fetch('/api/setup/profile')
          .then(r => r.json())
          .then(d => {
            if (d.profile) {
              const p: BusinessProfile = d.profile
              setForm({
                brand_name: p.brand_name || '',
                business_type: p.business_type || '카페',
                location: p.location || '',
                sub_category: p.sub_category || '',
                target_audience: p.target_audience || '',
                brand_tone: p.brand_tone || '',
              })
              setHashtags(p.competitor_hashtags || [])
              if (p.analysis_result) setAnalysis(p.analysis_result)
            }
          })
      })
  }, [])

  function addHashtag() {
    const tag = hashtagInput.trim().replace(/^#/, '')
    if (tag && !hashtags.includes(tag)) {
      setHashtags(prev => [...prev, tag])
    }
    setHashtagInput('')
  }

  async function handleAnalyze() {
    if (!form.brand_name || !form.location) {
      alert('브랜드명과 지역을 입력해주세요.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/setup/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, competitor_hashtags: hashtags }),
      })
      const data = await res.json()
      setAnalysis(data.analysis)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      alert('분석 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">업종 분석 설정</h1>
        <p className="text-gray-500 mt-1">브랜드 정보를 입력하면 AI가 맞춤 마케팅 전략을 분석합니다</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 입력 폼 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
          <h2 className="font-semibold text-gray-900">브랜드 정보</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">브랜드명 *</label>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
              placeholder="예: 카페 봄봄"
              value={form.brand_name}
              onChange={e => setForm(f => ({ ...f, brand_name: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">업종 *</label>
              <select
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 bg-white"
                value={form.business_type}
                onChange={e => setForm(f => ({ ...f, business_type: e.target.value }))}
              >
                {BUSINESS_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">세부 분류</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
                placeholder="예: 스페셜티 커피"
                value={form.sub_category}
                onChange={e => setForm(f => ({ ...f, sub_category: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">지역 *</label>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
              placeholder="예: 부산 해운대구"
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">주요 고객층</label>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
              placeholder="예: 20~30대 여성, 커플"
              value={form.target_audience}
              onChange={e => setForm(f => ({ ...f, target_audience: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">브랜드 톤</label>
            <input
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
              placeholder="예: 따뜻하고 감성적인"
              value={form.brand_tone}
              onChange={e => setForm(f => ({ ...f, brand_tone: e.target.value }))}
            />
          </div>

          {/* 경쟁 해시태그 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">경쟁 해시태그</label>
            <div className="flex gap-2">
              <input
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
                placeholder="#부산카페 입력 후 Enter"
                value={hashtagInput}
                onChange={e => setHashtagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addHashtag())}
              />
              <button
                onClick={addHashtag}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {hashtags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {hashtags.map(tag => (
                  <span key={tag} className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs rounded-full">
                    #{tag}
                    <button onClick={() => setHashtags(h => h.filter(t => t !== tag))}>
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-500 text-white font-medium hover:bg-indigo-600 transition-colors disabled:opacity-60"
          >
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> AI 분석 중...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> AI 분석 시작</>
            )}
          </button>

          {saved && (
            <div className="flex items-center gap-2 text-green-600 text-sm justify-center">
              <CheckCircle2 className="w-4 h-4" />
              저장되었습니다
            </div>
          )}
        </div>

        {/* 분석 결과 */}
        <div className="space-y-4">
          {analysis ? (
            <>
              <AnalysisCard title="포지셔닝 전략" content={analysis.positioning} color="indigo" />
              <AnalysisCard title="타겟 고객 분석" content={analysis.target_summary} color="purple" />

              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-3 text-sm">추천 해시태그</h3>
                <div className="flex flex-wrap gap-2">
                  {analysis.recommended_hashtags.map(tag => (
                    <span key={tag} className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-3 text-sm">콘텐츠 전략 팁</h3>
                <ul className="space-y-2">
                  {analysis.content_tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm text-center">
              <Sparkles className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">브랜드 정보를 입력하고 AI 분석을 시작하세요</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AnalysisCard({ title, content, color }: { title: string; content: string; color: string }) {
  const colors: Record<string, string> = {
    indigo: 'border-indigo-100 bg-indigo-50/40',
    purple: 'border-purple-100 bg-purple-50/40',
  }
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${colors[color]}`}>
      <h3 className="font-semibold text-gray-900 mb-2 text-sm">{title}</h3>
      <p className="text-gray-700 text-sm leading-relaxed">{content}</p>
    </div>
  )
}
