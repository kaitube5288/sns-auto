import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { createThreadsContainer, publishThreads, checkThreadsStatus } from '@/lib/meta-api'
import { decryptToken } from '@/lib/utils'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { reply_to_id, text } = await req.json()
  if (!reply_to_id || !text?.trim()) {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 })
  }

  const { data: account } = await supabase
    .from('meta_accounts')
    .select('threads_user_id, threads_access_token, threads_connected')
    .eq('user_id', user.id)
    .single()

  if (!account?.threads_connected || !account.threads_user_id) {
    return NextResponse.json({ error: 'Threads 계정을 먼저 연결해주세요.' }, { status: 400 })
  }

  const token = decryptToken(account.threads_access_token!)

  try {
    // reply_to_id 파라미터로 답글 컨테이너 생성
    const res = await fetch(`https://graph.threads.net/v1.0/${account.threads_user_id}/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'TEXT',
        text,
        reply_to_id,
        access_token: token,
      }),
    })
    const container = await res.json() as { id: string; error?: { message: string } }
    if (!container.id) throw new Error(container.error?.message ?? '컨테이너 생성 실패')

    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const status = await checkThreadsStatus(container.id, token)
      if (status.status === 'FINISHED') break
      if (status.status === 'ERROR') throw new Error(status.error_message ?? '준비 실패')
    }

    const published = await publishThreads(account.threads_user_id, token, container.id)
    if (!published.id) throw new Error('발행 실패')

    return NextResponse.json({ success: true, post_id: published.id })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '답글 전송 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
