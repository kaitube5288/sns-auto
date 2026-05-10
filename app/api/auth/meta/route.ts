import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const state = crypto.randomUUID()

  const response = NextResponse.redirect(buildThreadsOAuthUrl(state))
  response.cookies.set('meta_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
    path: '/',
  })
  return response
}

// Threads API uses its own OAuth endpoint (separate from Facebook OAuth)
function buildThreadsOAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.THREADS_APP_ID!,
    redirect_uri: process.env.META_REDIRECT_URI!,
    scope: 'threads_basic,threads_content_publish',
    state,
    response_type: 'code',
  })
  return `https://threads.net/oauth/authorize?${params}`
}
