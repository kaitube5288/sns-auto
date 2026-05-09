'use client'

import { useState, useRef } from 'react'
import { Video, Sparkles, Music, Zap } from 'lucide-react'
import type { ReelsPlan } from '@/lib/types'
import LearnSection from '@/components/create/LearnSection'

interface PlanResult extends ReelsPlan { id?: string }

export default function ReelsCreatePage() {
  const [activeTab, setActiveTab] = useState<'generate' | 'learn'>('generate')
  const [mode, setMode] = useState<'solo' | 'combined'>('solo')
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoPreview, setVideoPreview] = useState<string | null>(null)
  const [intent, setIntent] = useState('')
  const [duration, setDuration] = useState(30)
  const [loading, setLoading] = useState(false)
  const [plan, setPlan] = useState<PlanResult | null>(null)
  const [capturedFrames, setCapturedFrames] = useState<string[]>([])
  const videoRef = useRef<HTMLVideoElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  function handleVideoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setVideoFile(file)
    const url = URL.createObjectURL(file)
    setVideoPreview(url)
  }

  async function captureFrames(): Promise<File[]> {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return []

    const frames: File[] = []
    const times = [0, duration / 5, duration / 2, duration * 0.75]

    for (const t of times) {
      video.currentTime = Math.min(t, video.duration || t)
      await new Promise(res => setTimeout(res, 300))
      canvas.width = 320
      canvas.height = 180
      const ctx = canvas.getContext('2d')
      if (!ctx) continue
      ctx.drawImage(video, 0, 0, 320, 180)
      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.8))
      if (blob) frames.push(new File([blob], `frame-${t}.jpg`, { type: 'image/jpeg' }))
    }
    return frames
  }

  async function generate() {
    if (!videoFile) { alert('영상을 먼저 업로드해주세요.'); return }
    setLoading(true)
    try {
      const frames = await captureFrames()
      const captured = frames.map(f => URL.createObjectURL(f))
      setCapturedFrames(captured)

      const formData = new FormData()
      formData.append('intent', intent || '제품 소개')
      formData.append('duration', String(duration))
      formData.append('mode', mode)
      frames.forEach(f => formData.append('frames', f))

      const res = await fetch('/api/generate/reels', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.error) { alert(data.error); return }
      setPlan(data.plan)

      // 영상 파일은 별도 업로드 (크기 제한 우회)
      if (data.plan?.id) {
        const vfd = new FormData()
        vfd.append('images', videoFile)
        vfd.append('content_id', data.plan.id)
        fetch('/api/media/upload', { method: 'POST', body: vfd }).catch(() => {})
      }
    } catch {
      alert('생성 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">릴스 기획 생성기</h1>
          <p className="text-gray-500 mt-1">영상을 업로드하면 AI가 컷 구성, 자막, BGM을 기획합니다</p>
        </div>
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          <button onClick={() => setActiveTab('generate')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'generate' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>✨ 생성하기</button>
          <button onClick={() => setActiveTab('learn')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'learn' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>📚 학습하기</button>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {activeTab === 'learn' && <LearnSection section="reels" />}

      {activeTab === 'generate' && <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 업로드 패널 */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-2 text-sm">학습 데이터 범위</h2>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setMode('solo')} className={`py-2 rounded-xl text-sm font-medium border transition-colors ${mode === 'solo' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-gray-200 text-gray-500'}`}>단독 (릴스만)</button>
              <button onClick={() => setMode('combined')} className={`py-2 rounded-xl text-sm font-medium border transition-colors ${mode === 'combined' ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-gray-200 text-gray-500'}`}>통합 (전체 학습)</button>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-3">영상 업로드</h2>
            {videoPreview ? (
              <div className="space-y-2">
                <video
                  ref={videoRef}
                  src={videoPreview}
                  controls
                  className="w-full rounded-xl max-h-48 bg-black"
                />
                <button
                  onClick={() => { setVideoFile(null); setVideoPreview(null); setPlan(null) }}
                  className="text-xs text-red-500 hover:text-red-600"
                >
                  영상 제거
                </button>
              </div>
            ) : (
              <div
                className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-300 transition-colors"
                onClick={() => inputRef.current?.click()}
              >
                <Video className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">클릭하여 영상 업로드</p>
                <p className="text-xs text-gray-300 mt-1">MP4, MOV • 최대 100MB</p>
              </div>
            )}
            <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoSelect} />
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">기획 의도</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
                placeholder="예: 쿠키 굽는 과정 소개, 신메뉴 리뷰"
                value={intent}
                onChange={e => setIntent(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">예상 영상 길이 (초)</label>
              <div className="flex items-center gap-3">
                <input
                  type="range" min={10} max={90} step={5}
                  value={duration}
                  onChange={e => setDuration(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm font-medium text-indigo-600 w-10">{duration}초</span>
              </div>
            </div>
          </div>

          <button
            onClick={generate}
            disabled={loading || !videoFile}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-500 text-white font-medium hover:bg-indigo-600 disabled:opacity-60"
          >
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> AI 기획 중...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> 릴스 기획 생성</>
            )}
          </button>
        </div>

        {/* 결과 */}
        <div className="space-y-4">
          {plan ? (
            <>
              {/* Hook */}
              <div className="bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl p-5 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4" />
                  <span className="text-sm font-semibold">Hook 문구 (0~2초)</span>
                </div>
                <p className="text-lg font-bold">{plan.hook}</p>
              </div>

              {/* 컷 구성 */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-3 text-sm">컷 구성</h3>
                <div className="space-y-2">
                  {plan.cuts.map((cut, i) => (
                    <div key={i} className="flex gap-3 p-3 bg-gray-50 rounded-xl">
                      <div className="w-16 text-xs text-gray-400 flex-shrink-0 pt-0.5">
                        {cut.start_sec}~{cut.end_sec}초
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-700">{cut.scene}</p>
                        {cut.subtitle && (
                          <p className="text-xs text-indigo-600 mt-1 font-medium">"{cut.subtitle}"</p>
                        )}
                        {cut.effect && (
                          <p className="text-xs text-gray-400 mt-0.5">{cut.effect}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* BGM */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Music className="w-4 h-4 text-gray-400" />
                  <h3 className="font-semibold text-gray-900 text-sm">BGM 제안</h3>
                </div>
                <div className="space-y-2">
                  {plan.bgm_suggestions.map((bgm, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl text-sm">
                      <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs flex items-center justify-center flex-shrink-0">{i + 1}</span>
                      <div>
                        <p className="font-medium text-gray-700">{bgm.mood}</p>
                        <p className="text-xs text-gray-400">{bgm.genre} · {bgm.example}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div className="bg-gray-900 rounded-2xl p-4 text-white">
                <p className="text-xs text-gray-400 mb-1">마지막 CTA</p>
                <p className="font-semibold">{plan.cta}</p>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center shadow-sm">
              <Video className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">영상을 업로드하고 AI 기획을 시작하세요</p>
            </div>
          )}
        </div>
      </div>}
    </div>
  )
}
