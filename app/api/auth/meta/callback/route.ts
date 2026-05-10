import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { getThreadsUserInfo } from '@/lib/meta-api'
import { encryptToken } from '@/lib/utils'

const THREADS_TOKEN_URL = 'https://graph.threads.net/oauth/access_token'
const THREADS_LONG_TOKEN_URL = 'https://graph.threads.net/access_token'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

export async function GET(req: NextRequest) {
  const url = req.nextUrl
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  if (error) return NextResponse.redirect(`${APP_URL}/connect?error=meta_denied`)

  // CSRF 검증
  const storedState = req.cookies.get('meta_oauth_state')?.value
  if (!state || state !== storedState) {
    return NextResponse.redirect(`${APP_URL}/connect?error=invalid_state`)
  }

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${APP_URL}/login`)

  try {
    // 1. 단기 토큰 교환 (Threads OAuth)
    const tokenRes = await fetch(THREADS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.THREADS_APP_ID!,
        client_secret: process.env.THREADS_APP_SECRET!,
        redirect_uri: process.env.META_REDIRECT_URI!,
        code: code!,
        grant_type: 'authorization_code',
      }),
    })
    const tokenData = await tokenRes.json()
    if (tokenData.error) {
      console.error('[Threads OAuth] short token error:', JSON.stringify(tokenData))
      throw new Error(tokenData.error?.message ?? JSON.stringify(tokenData.error))
    }
    const shortToken = tokenData.access_token

    // 2. 60일 장기 토큰 교환
    const longTokenRes = await fetch(
      `${THREADS_LONG_TOKEN_URL}?grant_type=th_exchange_token&client_id=${process.env.THREADS_APP_ID}&client_secret=${process.env.THREADS_APP_SECRET}&access_token=${shortToken}`
    )
    const longTokenData = await longTokenRes.json()
    if (longTokenData.error) {
      console.error('[Threads OAuth] long token error:', JSON.stringify(longTokenData))
      throw new Error(longTokenData.error?.message ?? JSON.stringify(longTokenData.error))
    }
    const longToken = longTokenData.access_token
    const expiresAt = new Date(Date.now() + longTokenData.expires_in * 1000).toISOString()

    // 3. Threads 계정 정보 조회
    const threadsData = await getThreadsUserInfo(longToken)
    if (!threadsData?.id) throw new Error('Threads 계정 정보를 가져올 수 없습니다.')

    // 4. DB upsert (토큰 암호화)
    const encryptedToken = encryptToken(longToken)
    await supabase.from('meta_accounts').upsert({
      user_id: user.id,
      threads_user_id: threadsData.id,
      threads_username: threadsData.username,
      threads_access_token: encryptedToken,
      threads_token_expires_at: expiresAt,
      threads_connected: true,
    }, { onConflict: 'user_id' })

    const response = NextResponse.redirect(`${APP_URL}/connect?success=1`)
    response.cookies.delete('meta_oauth_state')
    return response
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Threads OAuth callback error:', msg)
    return NextResponse.redirect(`${APP_URL}/connect?error=${encodeURIComponent(msg)}`)
  }
}
