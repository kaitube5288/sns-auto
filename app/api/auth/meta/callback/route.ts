import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { exchangeLongLivedToken, getIGUserInfo, getThreadsUserInfo } from '@/lib/meta-api'
import { encryptToken } from '@/lib/utils'

const IG_BASE = 'https://graph.facebook.com/v21.0'
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
    // 1. 단기 토큰 교환
    const tokenParams = new URLSearchParams({
      client_id: process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      redirect_uri: process.env.META_REDIRECT_URI!,
      code: code!,
    })
    const tokenRes = await fetch(`${IG_BASE}/oauth/access_token?${tokenParams}`)
    const { access_token: shortToken } = await tokenRes.json()

    // 2. 60일 장기 토큰 교환
    const longTokenData = await exchangeLongLivedToken(shortToken)
    const longToken = longTokenData.access_token
    const expiresAt = new Date(Date.now() + longTokenData.expires_in * 1000).toISOString()

    // 3. Facebook Page → Instagram 비즈니스 계정 조회
    const pagesData = await getIGUserInfo(longToken)
    const page = pagesData?.data?.[0]
    const igAccount = page?.instagram_business_account

    // 4. Threads 계정 조회
    const threadsData = await getThreadsUserInfo(longToken)

    // 5. DB upsert (토큰 암호화)
    const encryptedToken = encryptToken(longToken)
    await supabase.from('meta_accounts').upsert({
      user_id: user.id,
      instagram_user_id: igAccount?.id ?? null,
      instagram_username: igAccount?.username ?? null,
      instagram_access_token: encryptedToken,
      instagram_token_expires_at: expiresAt,
      instagram_connected: !!igAccount?.id,
      threads_user_id: threadsData?.id ?? null,
      threads_username: threadsData?.username ?? null,
      threads_access_token: encryptedToken,
      threads_token_expires_at: expiresAt,
      threads_connected: !!threadsData?.id,
      facebook_page_id: page?.id ?? null,
    }, { onConflict: 'user_id' })

    const response = NextResponse.redirect(`${APP_URL}/connect?success=1`)
    response.cookies.delete('meta_oauth_state')
    return response
  } catch (err) {
    console.error('Meta OAuth callback error:', err)
    return NextResponse.redirect(`${APP_URL}/connect?error=token_exchange_failed`)
  }
}
