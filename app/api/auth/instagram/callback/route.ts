import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { encryptToken } from '@/lib/utils'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL!
const IG_TOKEN_URL = 'https://api.instagram.com/oauth/access_token'
const IG_LONG_TOKEN_URL = 'https://graph.instagram.com/access_token'
const IG_ME_URL = 'https://graph.instagram.com/v21.0/me'

export async function GET(req: NextRequest) {
  const url = req.nextUrl
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  if (error) return NextResponse.redirect(`${APP_URL}/connect?error=ig_denied`)

  const storedState = req.cookies.get('ig_oauth_state')?.value
  if (!state || state !== storedState) {
    return NextResponse.redirect(`${APP_URL}/connect?error=invalid_state`)
  }

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${APP_URL}/login`)

  const redirectUri = `${APP_URL}/api/auth/instagram/callback`

  try {
    // 1. 단기 토큰 교환 (Instagram Platform OAuth)
    const tokenRes = await fetch(IG_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.INSTAGRAM_APP_ID!,
        client_secret: process.env.INSTAGRAM_APP_SECRET!,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code: code!,
      }),
    })
    const tokenData = await tokenRes.json()
    if (tokenData.error) throw new Error(tokenData.error.message ?? JSON.stringify(tokenData.error))
    const shortToken = tokenData.access_token

    // 2. 장기 토큰 교환 (60일)
    const longTokenRes = await fetch(
      `${IG_LONG_TOKEN_URL}?grant_type=ig_exchange_token&client_id=${process.env.INSTAGRAM_APP_ID}&client_secret=${process.env.INSTAGRAM_APP_SECRET}&access_token=${shortToken}`
    )
    const longTokenData = await longTokenRes.json()
    if (longTokenData.error) throw new Error(longTokenData.error.message ?? JSON.stringify(longTokenData.error))
    const longToken = longTokenData.access_token
    const expiresAt = new Date(Date.now() + longTokenData.expires_in * 1000).toISOString()

    // 3. Instagram 계정 정보 조회
    const meRes = await fetch(`${IG_ME_URL}?fields=id,username&access_token=${longToken}`)
    const meData = await meRes.json()
    if (!meData?.id) throw new Error('Instagram 계정 정보를 가져올 수 없습니다.')

    // 4. DB upsert
    const encryptedToken = encryptToken(longToken)
    await supabase.from('meta_accounts').upsert({
      user_id: user.id,
      instagram_user_id: meData.id,
      instagram_username: meData.username,
      instagram_access_token: encryptedToken,
      instagram_token_expires_at: expiresAt,
      instagram_connected: true,
    }, { onConflict: 'user_id' })

    const response = NextResponse.redirect(`${APP_URL}/connect?ig_success=1`)
    response.cookies.delete('ig_oauth_state')
    return response
  } catch (err) {
    const msg = err instanceof Error ? err.message : '연결 실패'
    console.error('Instagram OAuth error:', msg)
    return NextResponse.redirect(`${APP_URL}/connect?error=${encodeURIComponent(msg)}`)
  }
}
