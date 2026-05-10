import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { createThreadsContainer, publishThreads, checkThreadsStatus } from '@/lib/meta-api'
import { decryptToken } from '@/lib/utils'
import { hashtagsToString } from '@/lib/utils'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { content_id, caption, hashtags } = await req.json()

  // 수정된 내용이 있으면 발행 전에 DB 업데이트
  if (caption !== undefined) {
    await supabase.from('contents')
      .update({ caption, hashtags: hashtags ?? [] })
      .eq('id', content_id)
      .eq('user_id', user.id)
  }

  // 콘텐츠 + 계정 정보 조회
  const { data: content } = await supabase
    .from('contents')
    .select('*')
    .eq('id', content_id)
    .eq('user_id', user.id)
    .single()

  if (!content) return NextResponse.json({ error: '콘텐츠를 찾을 수 없습니다.' }, { status: 404 })
  if (content.content_type !== 'threads_text') {
    return NextResponse.json({ error: 'Threads 글 콘텐츠가 아닙니다.' }, { status: 400 })
  }

  const { data: account } = await supabase
    .from('meta_accounts')
    .select('threads_user_id, threads_access_token, threads_connected')
    .eq('user_id', user.id)
    .single()

  if (!account?.threads_connected || !account.threads_user_id) {
    return NextResponse.json({ error: 'Threads 계정을 먼저 연결해주세요.' }, { status: 400 })
  }

  const accessToken = decryptToken(account.threads_access_token!)
  const fullText = content.hashtags?.length
    ? `${content.caption}\n\n${hashtagsToString(content.hashtags)}`
    : content.caption

  // publishing 상태로 변경
  await supabase.from('contents').update({ status: 'publishing' }).eq('id', content_id)

  try {
    // 1. 컨테이너 생성
    const container = await createThreadsContainer(account.threads_user_id, accessToken, fullText)
    if (!container.id) throw new Error('컨테이너 생성 실패')

    // 2. 준비 완료 대기 (최대 30초)
    let ready = false
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 3000))
      const status = await checkThreadsStatus(container.id, accessToken)
      if (status.status === 'FINISHED') { ready = true; break }
      if (status.status === 'ERROR') throw new Error(status.error_message ?? '준비 실패')
    }
    if (!ready) throw new Error('타임아웃: 준비 완료 대기 실패')

    // 3. 발행
    const published = await publishThreads(account.threads_user_id, accessToken, container.id)
    if (!published.id) throw new Error('발행 실패')

    await supabase.from('contents').update({
      status: 'published',
      published_at: new Date().toISOString(),
      threads_post_id: published.id,
    }).eq('id', content_id)

    return NextResponse.json({ success: true, post_id: published.id })
  } catch (err: unknown) {
    const error = err as Error
    await supabase.from('contents').update({
      status: 'failed',
      publish_error: error.message,
    }).eq('id', content_id)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
