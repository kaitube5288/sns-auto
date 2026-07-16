import { createServerSupabase } from '@/lib/supabase'
import Link from 'next/link'
import { PenSquare, CalendarDays, BarChart2, Link2, Settings2, ChevronRight, Clock, CheckCircle2, AlertCircle } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  // 계정 정보
  const { data: account } = await supabase
    .from('meta_accounts')
    .select('instagram_username, instagram_connected, threads_username, threads_connected, instagram_token_expires_at, threads_token_expires_at')
    .eq('user_id', user!.id)
    .single()

  const calcDays = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
  const expiryWarnings: string[] = []
  if (account?.instagram_token_expires_at && calcDays(account.instagram_token_expires_at) <= 14)
    expiryWarnings.push(`Instagram (${calcDays(account.instagram_token_expires_at)}일 후 만료)`)
  if (account?.threads_token_expires_at && calcDays(account.threads_token_expires_at) <= 14)
    expiryWarnings.push(`Threads (${calcDays(account.threads_token_expires_at)}일 후 만료)`)

  // 최근 콘텐츠
  const { data: contents } = await supabase
    .from('contents')
    .select('id, content_type, caption, status, scheduled_at, published_at, platform')
    .eq('user_id', user!.id)
    .in('status', ['scheduled', 'published', 'failed'])
    .order('created_at', { ascending: false })
    .limit(5)

  // 이번 달 발행 수
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  const { count: publishedCount } = await supabase
    .from('contents')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user!.id)
    .eq('status', 'published')
    .gte('published_at', startOfMonth.toISOString())

  const { count: scheduledCount } = await supabase
    .from('contents')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user!.id)
    .eq('status', 'scheduled')

  const QUICK_ACTIONS = [
    { href: '/create/threads', label: 'Threads 글 작성', icon: PenSquare, color: 'bg-gray-900 text-white' },
    { href: '/create/feed', label: '피드 만들기', icon: PenSquare, color: 'bg-pink-500 text-white' },
    { href: '/create/reels', label: '릴스 기획', icon: PenSquare, color: 'bg-purple-500 text-white' },
    { href: '/calendar', label: '예약 캘린더', icon: CalendarDays, color: 'bg-indigo-500 text-white' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="text-gray-500 mt-1">SNS 자동화 현황을 한눈에 확인하세요</p>
      </div>

      {/* 계정 상태 배너 */}
      {!account?.instagram_connected && (
        <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-100 rounded-xl">
          <div className="flex items-center gap-2 text-amber-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Instagram/Threads 계정이 연결되지 않았습니다
          </div>
          <Link href="/connect" className="flex items-center gap-1 text-sm font-medium text-amber-700 hover:underline">
            연결하기 <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* 토큰 만료 임박 배너 */}
      {expiryWarnings.length > 0 && (
        <Link href="/connect" className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors">
          <div className="flex items-center gap-2 text-amber-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span><b>{expiryWarnings.join(', ')}</b> — 재연결이 필요합니다</span>
          </div>
          <ChevronRight className="w-4 h-4 text-amber-500 flex-shrink-0" />
        </Link>
      )}

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="이번 달 발행" value={publishedCount ?? 0} suffix="개" color="indigo" />
        <StatCard label="예약 대기" value={scheduledCount ?? 0} suffix="개" color="amber" />
        <StatCard label="연결된 플랫폼" value={(account?.instagram_connected ? 1 : 0) + (account?.threads_connected ? 1 : 0)} suffix="개" color="green" />
        <StatCard label="Instagram" value={account?.instagram_username ? `@${account.instagram_username}` : '미연결'} suffix="" color="pink" isText />
      </div>

      {/* 빠른 액션 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <h2 className="font-semibold text-gray-900 mb-4">빠른 시작</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {QUICK_ACTIONS.map(({ href, label, icon: Icon, color }) => (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl ${color} text-center hover:opacity-90 transition-opacity`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* 최근 콘텐츠 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-50">
          <h2 className="font-semibold text-gray-900 text-sm">최근 콘텐츠</h2>
          <Link href="/calendar" className="text-xs text-indigo-500 hover:underline flex items-center gap-1">
            전체 보기 <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        {contents?.length ? (
          <div className="divide-y divide-gray-50">
            {contents.map(c => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  c.status === 'published' ? 'bg-green-50' :
                  c.status === 'scheduled' ? 'bg-indigo-50' : 'bg-red-50'
                }`}>
                  {c.status === 'published' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                  {c.status === 'scheduled' && <Clock className="w-4 h-4 text-indigo-500" />}
                  {c.status === 'failed' && <AlertCircle className="w-4 h-4 text-red-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 truncate">{c.caption?.slice(0, 50)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {c.platform} · {c.content_type} ·{' '}
                    {c.status === 'published' ? '발행됨' : c.status === 'scheduled' ? '예약됨' : '실패'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <PenSquare className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">아직 콘텐츠가 없습니다</p>
          </div>
        )}
      </div>

      {/* 빠른 설정 링크 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {!account?.instagram_connected && (
          <QuickSetup href="/connect" icon={Link2} title="계정 연결" desc="Instagram + Threads 연결" />
        )}
        <QuickSetup href="/setup" icon={Settings2} title="업종 분석" desc="AI 마케팅 전략 설정" />
        <QuickSetup href="/analytics" icon={BarChart2} title="성과 분석" desc="도달률·저장률 확인" />
      </div>
    </div>
  )
}

function StatCard({ label, value, suffix, color, isText }: {
  label: string; value: number | string; suffix: string; color: string; isText?: boolean
}) {
  const colors: Record<string, string> = {
    indigo: 'text-indigo-600', amber: 'text-amber-600',
    green: 'text-green-600', pink: 'text-pink-600',
  }
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <p className="text-xs text-gray-400 mb-2">{label}</p>
      <p className={`font-bold ${isText ? 'text-sm' : 'text-2xl'} ${colors[color]}`}>
        {value}{suffix}
      </p>
    </div>
  )
}

function QuickSetup({ href, icon: Icon, title, desc }: { href: string; icon: React.ElementType; title: string; desc: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-indigo-200 transition-colors shadow-sm">
      <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center">
        <Icon className="w-4 h-4 text-indigo-500" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="text-xs text-gray-400">{desc}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300 ml-auto" />
    </Link>
  )
}
