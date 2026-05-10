import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { getIGUserInfo, exchangeLongLivedToken } from '@/lib/meta-api'
import { encryptToken } from '@/lib/utils'

const IG_BASE = 'https://graph.facebook.com/v21.0'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!

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
    // 1. 단기 토큰 교환
    const tokenParams = new URLSearchParams({
      client_id: process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      redirect_uri: redirectUri,
      code: code!,
    })
    const tokenRes = await fetch(`${IG_BASE}/oauth/access_token?${tokenParams}`)
    const tokenData = await tokenRes.json()
    if (tokenData.error) throw new Error(tokenData.error.message)
    const shortToken = tokenData.access_token

    // 2. 60일 장기 토큰 교환
    const longTokenData = await exchangeLongLivedToken(shortToken)
    if (!longTokenData.access_token) throw new Error('장기 토큰 교환 실패')
    const longToken = longTokenData.access_token
    const expiresAt = new Date(Date.now() + longTokenData.expires_in * 1000).toISOString()

    // 3. Facebook Page → Instagram 비즈니스 계정 조회
    const pagesData = await getIGUserInfo(longToken)
    const page = pagesData?.data?.[0]
    const igAccount = page?.instagram_business_account
    if (!igAccount?.id) throw new Error('Instagram 비즈니스 계정을 찾을 수 없습니다. 비즈니스/크리에이터 계정과 Facebook 페이지 연결을 확인하세요.')

    // 4. DB upsert
    const encryptedToken = encryptToken(longToken)
    await supabase.from('meta_accounts').upsert({
      user_id: user.id,
      instagram_user_id: igAccount.id,
      instagram_username: igAccount.username,
      instagram_access_token: encryptedToken,
      instagram_token_expires_at: expiresAt,
      instagram_connected: true,
      facebook_page_id: page.id,
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
