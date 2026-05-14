import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { decryptToken } from '@/lib/utils'

const THREADS_BASE = 'https://graph.threads.net/v1.0'

export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: acct } = await supabase
    .from('meta_accounts')
    .select('threads_access_token, threads_connected')
    .eq('user_id', user.id)
    .single()

  if (!acct?.threads_access_token || !acct.threads_connected) {
    return NextResponse.json({ ok: false, reason: '연결된 Threads 계정이 없습니다.' })
  }

  try {
    const token = decryptToken(acct.threads_access_token)
    const res = await fetch(`${THREADS_BASE}/me?fields=id,username&access_token=${token}`)
    const data = await res.json() as { id?: string; username?: string; error?: { message: string } }

    if (data.error) {
      return NextResponse.json({ ok: false, reason: data.error.message })
    }

    return NextResponse.json({ ok: true, username: data.username })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '알 수 없는 오류'
    return NextResponse.json({ ok: false, reason: msg })
  }
}
