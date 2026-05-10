import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { getThreadsProfile } from '@/lib/meta-api'
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
    .select('threads_access_token, threads_connected')
    .eq('user_id', user.id)
    .single()

  if (!account?.threads_connected) {
    return NextResponse.json({ error: 'Threads 계정을 먼저 연결해주세요.' }, { status: 400 })
  }

  const token = decryptToken(account.threads_access_token!)
  const profile = await getThreadsProfile(token)

  if (typeof profile.followers_count !== 'number') {
    return NextResponse.json({ error: '팔로워 수를 가져올 수 없습니다.' }, { status: 500 })
  }

  await supabase.from('follower_snapshots').insert({
    user_id: user.id,
    platform: 'threads',
    followers_count: profile.followers_count,
    recorded_at: new Date().toISOString(),
  })

  return NextResponse.json({ followers_count: profile.followers_count })
}
