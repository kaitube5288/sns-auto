import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { createIGImageContainer, createIGCarouselContainer, publishIGMedia } from '@/lib/meta-api'
import { decryptToken, hashtagsToString } from '@/lib/utils'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { content_id } = await req.json()

  const { data: content } = await supabase
    .from('contents')
    .select('*')
    .eq('id', content_id)
    .eq('user_id', user.id)
    .single()

  if (!content) return NextResponse.json({ error: '콘텐츠를 찾을 수 없습니다.' }, { status: 404 })

  const { data: account } = await supabase
    .from('meta_accounts')
    .select('instagram_user_id, instagram_access_token, instagram_connected')
    .eq('user_id', user.id)
    .single()

  if (!account?.instagram_connected || !account.instagram_user_id) {
    return NextResponse.json({ error: 'Instagram 계정을 먼저 연결해주세요.' }, { status: 400 })
  }

  const accessToken = decryptToken(account.instagram_access_token!)
  const igUserId = account.instagram_user_id
  const caption = content.hashtags?.length
    ? `${content.caption}\n\n${hashtagsToString(content.hashtags)}`
    : content.caption

  // 슬라이드 순서에 따라 URL 정렬
  let orderedUrls: string[] = content.media_urls ?? []
  if (content.media_order?.length) {
    orderedUrls = content.media_order.map((m: { url: string }) => m.url)
  }

  await supabase.from('contents').update({ status: 'publishing' }).eq('id', content_id)

  try {
    let creationId: string

    if (orderedUrls.length === 1) {
      // 단일 이미지
      const container = await createIGImageContainer(igUserId, accessToken, orderedUrls[0], caption)
      creationId = container.id
    } else {
      // 캐러셀: 각 이미지 컨테이너 먼저 생성
      const childIds: string[] = []
      for (const url of orderedUrls) {
        const child = await createIGImageContainer(igUserId, accessToken, url)
        childIds.push(child.id)
      }
      const carousel = await createIGCarouselContainer(igUserId, accessToken, childIds, caption)
      creationId = carousel.id
    }

    const published = await publishIGMedia(igUserId, accessToken, creationId)

    await supabase.from('contents').update({
      status: 'published',
      published_at: new Date().toISOString(),
      instagram_post_id: published.id,
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
