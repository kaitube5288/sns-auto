'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Share2, CheckCircle2, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react'
import { daysUntil, formatKST } from '@/lib/utils'

interface AccountInfo {
  instagram_username: string | null
  instagram_connected: boolean
  instagram_token_expires_at: string | null
  threads_username: string | null
  threads_connected: boolean
  threads_token_expires_at: string | null
}

export default function ConnectPage() {
  const [account, setAccount] = useState<AccountInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const params = useSearchParams()
  const success = params.get('success')
  const error = params.get('error')

  useEffect(() => {
    fetch('/api/account/profile')
      .then(r => r.json())
      .then(d => setAccount(d.account))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">계정 연결</h1>
        <p className="text-gray-500 mt-1">Instagram과 Threads 계정을 연결하세요</p>
      </div>

      {success && (
        <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-100 rounded-xl text-green-700 text-sm">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          계정이 성공적으로 연결되었습니다!
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error === 'meta_denied' ? '연결이 거부되었습니다.' :
           error === 'invalid_state' ? '보안 검증에 실패했습니다. 다시 시도하세요.' :
           '연결 중 오류가 발생했습니다.'}
        </div>
      )}

      {/* Meta 통합 연결 카드 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="font-semibold text-gray-900 text-lg">Instagram + Threads 연결</h2>
            <p className="text-gray-500 text-sm mt-1">Meta 계정 하나로 두 플랫폼을 동시에 연결합니다</p>
          </div>
          <a
            href="/api/auth/meta"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            {account?.instagram_connected ? '재연결' : '연결하기'}
          </a>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[0, 1].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AccountCard
              name="Instagram"
              username={account?.instagram_username ?? null}
              connected={account?.instagram_connected ?? false}
              expiresAt={account?.instagram_token_expires_at ?? null}
              color="from-pink-500 to-orange-400"
            />
            <AccountCard
              name="Threads"
              username={account?.threads_username ?? null}
              connected={account?.threads_connected ?? false}
              expiresAt={account?.threads_token_expires_at ?? null}
              color="from-gray-800 to-gray-600"
            />
          </div>
        )}
      </div>

      {/* 안내 */}
      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
        <h3 className="font-medium text-amber-800 mb-2">연결 전 확인사항</h3>
        <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
          <li>Instagram <strong>비즈니스</strong> 또는 <strong>크리에이터</strong> 계정이 필요합니다</li>
          <li>Facebook 페이지와 Instagram 계정이 연결되어 있어야 합니다</li>
          <li>액세스 토큰은 60일마다 자동 갱신됩니다</li>
        </ul>
      </div>
    </div>
  )
}

function AccountCard({
  name, username, connected, expiresAt, color
}: {
  name: string
  username: string | null
  connected: boolean
  expiresAt: string | null
  color: string
}) {
  const days = expiresAt ? daysUntil(expiresAt) : null
  const expiringSoon = days !== null && days < 7

  return (
    <div className={`rounded-xl border p-4 ${connected ? 'border-green-100 bg-green-50/30' : 'border-gray-100 bg-gray-50'}`}>
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center`}>
          <Share2 className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="font-medium text-sm text-gray-900">{name}</p>
          {username ? (
            <p className="text-xs text-gray-500">@{username}</p>
          ) : (
            <p className="text-xs text-gray-400">연결되지 않음</p>
          )}
        </div>
        <div className="ml-auto">
          {connected ? (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          ) : (
            <AlertCircle className="w-5 h-5 text-gray-300" />
          )}
        </div>
      </div>

      {connected && expiresAt && (
        <div className={`flex items-center gap-1.5 text-xs mt-2 ${expiringSoon ? 'text-amber-600' : 'text-gray-400'}`}>
          <RefreshCw className="w-3 h-3" />
          {expiringSoon
            ? `${days}일 후 만료 — 재연결 필요`
            : `${formatKST(expiresAt).split(' ')[0]} 만료`}
        </div>
      )}
    </div>
  )
}
