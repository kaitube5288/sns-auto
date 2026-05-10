import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { getThreadsProfile, getThreadsUserInsights } from '@/lib/meta-api'
import { decryptToken } from '@/lib/utils'

export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('follower_snapshots')
    .select('followers_count, recorded_at')
    .eq('user_id', user.id)
    .eq('platform', 'threads')
    .gte('recorded_at', thirtyDaysAgo)
    .order('recorded_at', { ascending: true })

  return NextResponse.json({ snapshots: data ?? [] })
}

export async function POST() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: account } = await supabase
    .from('meta_accounts')
    .select('threads_user_id, threads_access_token, threads_connected')
    .eq('user_id', user.id)
    .single()

  if (!account?.threads_connected) {
    return NextResponse.json({ error: 'Threads 계정을 먼저 연결해주세요.' }, { status: 400 })
  }

  const token = decryptToken(account.threads_access_token!)

  // 1차: 프로필 필드에서 직접 조회
  let followersCount: number | null = null
  const profile = await getThreadsProfile(token)
  if (typeof profile.followers_count === 'number') {
    followersCount = profile.followers_count
  }

  // 2차: 인사이트 엔드포인트로 fallback (threads_manage_insights 권한 필요)
  if (followersCount === null && account.threads_user_id) {
    try {
      const insights = await getThreadsUserInsights(account.threads_user_id, token, 'followers_count')
      const values: { value: number }[] = insights?.data?.[0]?.values ?? []
      const last = values[values.length - 1]
      if (typeof last?.value === 'number') followersCount = last.value
    } catch {}
  }

  if (followersCount === null) {
    return NextResponse.json({
      error: 'Threads 계정을 재연결하면 팔로워 수를 가져올 수 있습니다. (설정 → 계정 연결)'
    }, { status: 500 })
  }

  await supabase.from('follower_snapshots').insert({
    user_id: user.id,
    platform: 'threads',
    followers_count: followersCount,
    recorded_at: new Date().toISOString(),
  })

  return NextResponse.json({ followers_count: followersCount })
}
