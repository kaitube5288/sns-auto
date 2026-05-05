import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const state = crypto.randomUUID()

  // state를 쿠키에 임시 저장 (CSRF 방지)
  const response = NextResponse.redirect(buildMetaOAuthUrl(state))
  response.cookies.set('meta_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
    path: '/',
  })
  return response
}

function buildMetaOAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: process.env.META_REDIRECT_URI!,
    scope: [
      'instagram_basic',
      'instagram_content_publish',
      'instagram_manage_insights',
      'threads_basic',
      'threads_content_publish',
    ].join(','),
    state,
    response_type: 'code',
  })
  return `https://www.facebook.com/v21.0/dialog/oauth?${params}`
}
