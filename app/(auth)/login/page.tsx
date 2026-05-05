'use client'

import { useState } from 'react'
import { createBrowserSupabase } from '@/lib/supabase-browser'
import { Share2, Zap, BarChart2 } from 'lucide-react'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const supabase = createBrowserSupabase()

  async function handleGoogleLogin() {
    setLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/callback` },
    })
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 px-4">
      <div className="w-full max-w-md">
        {/* 로고 */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900">SNS 자동화</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            소상공인을 위한<br />AI SNS 마케팅
          </h1>
          <p className="text-gray-500">
            Instagram · Threads 콘텐츠를 AI가 만들고<br />자동으로 업로드합니다
          </p>
        </div>

        {/* 기능 요약 */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { icon: Share2, text: '자동 업로드', color: 'bg-pink-50 text-pink-600' },
            { icon: Zap, text: 'AI 콘텐츠', color: 'bg-indigo-50 text-indigo-600' },
            { icon: BarChart2, text: '성과 분석', color: 'bg-emerald-50 text-emerald-600' },
          ].map(({ icon: Icon, text, color }) => (
            <div key={text} className={`rounded-xl p-3 text-center ${color}`}>
              <Icon className="w-5 h-5 mx-auto mb-1" />
              <p className="text-xs font-medium">{text}</p>
            </div>
          ))}
        </div>

        {/* 로그인 카드 */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 text-center">시작하기</h2>
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors font-medium text-gray-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {loading ? '연결 중...' : 'Google로 계속하기'}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          로그인 시 서비스 이용약관 및 개인정보처리방침에 동의합니다
        </p>
      </div>
    </div>
  )
}
