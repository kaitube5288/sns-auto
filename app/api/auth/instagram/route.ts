import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const state = crypto.randomUUID()
  const response = NextResponse.redirect(buildIGOAuthUrl(state))
  response.cookies.set('ig_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
    path: '/',
  })
  return response
}

// Instagram Business API uses its own OAuth endpoint (separate from Facebook OAuth)
function buildIGOAuthUrl(state: string) {
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/instagram/callback`
  const params = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID!,
    redirect_uri: redirectUri,
    scope: 'instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights',
    state,
    response_type: 'code',
  })
  return `https://api.instagram.com/oauth/authorize?${params}`
}
