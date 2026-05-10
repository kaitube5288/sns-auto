import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { getThreadsUserInfo } from '@/lib/meta-api'
import { encryptToken } from '@/lib/utils'

// Temporary endpoint to manually save a Threads token for testing.
// Remove this file after OAuth flow is confirmed working.
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const threadsData = await getThreadsUserInfo(token)
  if (!threadsData?.id) {
    return NextResponse.json({ error: 'Threads 계정 정보를 가져올 수 없습니다.', detail: threadsData }, { status: 400 })
  }

  // 장기 토큰은 60일, 생성기 토큰은 이미 장기 토큰임
  const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
  const encryptedToken = encryptToken(token)

  await supabase.from('meta_accounts').upsert({
    user_id: user.id,
    threads_user_id: threadsData.id,
    threads_username: threadsData.username,
    threads_access_token: encryptedToken,
    threads_token_expires_at: expiresAt,
    threads_connected: true,
  }, { onConflict: 'user_id' })

  return NextResponse.json({
    ok: true,
    threads_username: threadsData.username,
    threads_user_id: threadsData.id,
  })
}
