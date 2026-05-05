import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase'
import { createThreadsContainer, publishThreads, checkThreadsStatus, createIGImageContainer, createIGCarouselContainer, publishIGMedia } from '@/lib/meta-api'
import { decryptToken, hashtagsToString } from '@/lib/utils'

export const maxDuration = 60

// cron-job.org에서 5분마다 호출
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminSupabase()

  // 발행 대상 조회
  const { data: items } = await admin
    .from('contents')
    .select('*, meta_accounts!inner(instagram_user_id, instagram_access_token, threads_user_id, threads_access_token)')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(10)

  if (!items?.length) return NextResponse.json({ processed: 0 })

  const results = { success: 0, failed: 0 }

  for (const item of items) {
    // publishing 상태로 잠금
    await admin.from('contents').update({ status: 'publishing' }).eq('id', item.id)

    try {
      const account = item.meta_accounts as {
        instagram_user_id: string
        instagram_access_token: string
        threads_user_id: string
        threads_access_token: string
      }

      if (item.content_type === 'threads_text') {
        const token = decryptToken(account.threads_access_token)
        const text = item.hashtags?.length
          ? `${item.caption}\n\n${hashtagsToString(item.hashtags)}`
          : item.caption

        const container = await createThreadsContainer(account.threads_user_id, token, text)

        // 준비 대기
        for (let i = 0; i < 10; i++) {
          await new Promise(r => setTimeout(r, 3000))
          const status = await checkThreadsStatus(container.id, token)
          if (status.status === 'FINISHED') break
        }

        const published = await publishThreads(account.threads_user_id, token, container.id)
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
