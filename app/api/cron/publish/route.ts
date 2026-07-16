import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase'
import { createThreadsContainer, createThreadsCarouselItem, createThreadsCarouselContainer, publishThreads, checkThreadsStatus, createIGImageContainer, createIGCarouselContainer, publishIGMedia } from '@/lib/meta-api'
import { decryptToken, hashtagsToString } from '@/lib/utils'

export const maxDuration = 60

// cron-job.org에서 5분마다 호출
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminSupabase()

  // 발행 대상 조회 (meta_accounts join 없이)
  const { data: items } = await admin
    .from('contents')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(10)

  if (!items?.length) return NextResponse.json({ processed: 0 })

  // user_id 목록으로 meta_accounts 한 번에 조회
  const userIds = [...new Set(items.map(i => i.user_id))]
  const { data: accounts } = await admin
    .from('meta_accounts')
    .select('user_id, instagram_user_id, instagram_access_token, threads_user_id, threads_access_token')
    .in('user_id', userIds)

  const accountMap = Object.fromEntries((accounts ?? []).map(a => [a.user_id, a]))

  const results = { success: 0, failed: 0 }

  for (const item of items) {
    const account = accountMap[item.user_id]
    if (!account) {
      await admin.from('contents').update({
        status: 'failed',
        publish_error: '연결된 계정 없음',
        retry_count: (item.retry_count ?? 0) + 1,
      }).eq('id', item.id)
      results.failed++
      continue
    }

    // publishing 상태로 잠금
    await admin.from('contents').update({ status: 'publishing' }).eq('id', item.id)

    try {
      if (item.content_type === 'threads_text') {
        const token = decryptToken(account.threads_access_token)
        const text = item.hashtags?.length
          ? `${item.caption}\n\n${hashtagsToString(item.hashtags)}`
          : item.caption
        const mediaUrls: string[] = item.media_urls ?? []

        let containerId: string
        if (mediaUrls.length === 0) {
          const c = await createThreadsContainer(account.threads_user_id, token, text)
          containerId = c.id
        } else if (mediaUrls.length === 1) {
          const c = await createThreadsContainer(account.threads_user_id, token, text, mediaUrls[0])
          containerId = c.id
        } else {
          const childIds: string[] = []
          for (const url of mediaUrls) {
            const c = await createThreadsCarouselItem(account.threads_user_id, token, url)
            childIds.push(c.id)
          }
          const c = await createThreadsCarouselContainer(account.threads_user_id, token, childIds, text)
          containerId = c.id
        }

        // 준비 대기
        for (let i = 0; i < 10; i++) {
          await new Promise(r => setTimeout(r, 3000))
          const status = await checkThreadsStatus(containerId, token)
          if (status.status === 'FINISHED') break
          if (status.status === 'ERROR') {
            throw new Error(status.error_message ?? 'Threads container processing failed')
          }
        }

        const published = await publishThreads(account.threads_user_id, token, containerId)
        await admin.from('contents').update({
          status: 'published',
          published_at: new Date().toISOString(),
          threads_post_id: published.id,
        }).eq('id', item.id)

      } else if (item.content_type === 'feed') {
        const token = decryptToken(account.instagram_access_token)
        const igUserId = account.instagram_user_id
        const caption = item.hashtags?.length
          ? `${item.caption}\n\n${hashtagsToString(item.hashtags)}`
          : item.caption

        const orderedUrls: string[] = item.media_order?.length
          ? item.media_order.map((m: { url: string }) => m.url)
          : (item.media_urls ?? [])

        let creationId: string
        if (orderedUrls.length === 1) {
          const c = await createIGImageContainer(igUserId, token, orderedUrls[0], caption)
          creationId = c.id
        } else {
          const childIds: string[] = []
          for (const url of orderedUrls) {
            const c = await createIGImageContainer(igUserId, token, url)
            childIds.push(c.id)
          }
          const carousel = await createIGCarouselContainer(igUserId, token, childIds, caption)
          creationId = carousel.id
        }

        const published = await publishIGMedia(igUserId, token, creationId)
        await admin.from('contents').update({
          status: 'published',
          published_at: new Date().toISOString(),
          instagram_post_id: published.id,
        }).eq('id', item.id)
      }

      results.success++
    } catch (err: unknown) {
      const error = err as Error
      const newRetry = (item.retry_count ?? 0) + 1
      await admin.from('contents').update({
        status: newRetry >= 3 ? 'failed' : 'scheduled',
        publish_error: error.message,
        retry_count: newRetry,
      }).eq('id', item.id)
      results.failed++
    }
  }

  return NextResponse.json({ processed: items.length, ...results })
}
