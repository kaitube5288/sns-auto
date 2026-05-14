import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { getIGMediaInsights, getThreadsMediaInsights, getThreadsMediaFields } from '@/lib/meta-api'
import { decryptToken } from '@/lib/utils'
import { generateText } from '@/lib/gemini'
import { buildInsightPrompt } from '@/lib/prompts'

export const maxDuration = 60

export async function POST(_req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: account } = await supabase
    .from('meta_accounts')
    .select('instagram_user_id, instagram_access_token, instagram_connected, threads_user_id, threads_access_token, threads_connected')
    .eq('user_id', user.id)
    .single()

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  let igSynced = 0
  let threadsSynced = 0

  // ── Instagram ──────────────────────────────────────────────
  if (account?.instagram_connected && account.instagram_access_token) {
    const igToken = decryptToken(account.instagram_access_token)
    const { data: igContents } = await supabase
      .from('contents')
      .select('id, instagram_post_id, caption')
      .eq('user_id', user.id)
      .eq('status', 'published')
      .not('instagram_post_id', 'is', null)
      .gte('published_at', thirtyDaysAgo)

    const igInsightRows: { caption: string; saves: number; reach: number; likes: number }[] = []

    for (const c of (igContents ?? [])) {
      try {
        const insights = await getIGMediaInsights(c.instagram_post_id!, igToken)
        // 삭제된 게시물이거나 API 에러인 경우 스킵 + DB에서 제거
        if (insights?.error) {
          await supabase.from('post_analytics')
            .delete()
            .eq('platform', 'instagram')
            .eq('post_id', c.instagram_post_id!)
          continue
        }
        const metrics = insights?.data ?? []
        const get = (name: string) => metrics.find((m: { name: string; values: { value: number }[] }) => m.name === name)?.values?.[0]?.value ?? 0
        const reach = get('reach')
        const saves = get('saved')
        const likes = get('likes')
        const comments = get('comments')
        await supabase.from('post_analytics').upsert({
          user_id: user.id, content_id: c.id, platform: 'instagram', post_id: c.instagram_post_id!,
          impressions: get('impressions'), reach, likes, comments, saves,
          save_rate: reach > 0 ? parseFloat(((saves / reach) * 100).toFixed(2)) : 0,
          engagement_rate: reach > 0 ? parseFloat((((likes + comments + saves) / reach) * 100).toFixed(2)) : 0,
          synced_at: new Date().toISOString(),
        }, { onConflict: 'platform,post_id' })
        igInsightRows.push({ caption: c.caption ?? '', saves, reach, likes })
        igSynced++
      } catch {}
    }

    if (igInsightRows.length > 0) {
      try {
        const aiInsight = await generateText(buildInsightPrompt(igInsightRows))
        await supabase.from('post_analytics').update({ ai_insight: aiInsight })
          .eq('post_id', igContents![0].instagram_post_id!)
      } catch {}
    }
  }

  // ── Threads ────────────────────────────────────────────────
  if (account?.threads_connected && account.threads_access_token) {
    const threadsToken = decryptToken(account.threads_access_token)
    const { data: threadsContents } = await supabase
      .from('contents')
      .select('id, threads_post_id, caption')
      .eq('user_id', user.id)
      .eq('status', 'published')
      .not('threads_post_id', 'is', null)
      .gte('published_at', thirtyDaysAgo)

    const threadsInsightRows: { caption: string; saves: number; reach: number; likes: number }[] = []

    for (const c of (threadsContents ?? [])) {
      try {
        const insights = await getThreadsMediaInsights(c.threads_post_id!, threadsToken)
        // 삭제된 게시물이거나 API 에러인 경우 스킵 + DB에서 제거
        if (insights?.error) {
          await supabase.from('post_analytics')
            .delete()
            .eq('platform', 'threads')
            .eq('post_id', c.threads_post_id!)
          continue
        }
        const metrics = insights?.data ?? []
        const get = (name: string) => {
          const m = metrics.find((x: { name: string; values?: { value: number }[]; value?: number }) => x.name === name)
          return m?.values?.[0]?.value ?? m?.value ?? 0
        }
        const views = get('views')
        let likes = get('likes')
        let replies = get('replies')
        let reposts = get('reposts')
        let quotes = get('quotes')

        // insights로 좋아요 등이 0이면 미디어 직접 필드로 보완
        if (likes === 0 || replies === 0) {
          try {
            const fields = await getThreadsMediaFields(c.threads_post_id!, threadsToken)
            if (!fields.error) {
              if (likes === 0 && (fields.like_count ?? 0) > 0) likes = fields.like_count!
              if (replies === 0 && (fields.reply_count ?? 0) > 0) replies = fields.reply_count!
              if (reposts === 0 && (fields.repost_count ?? 0) > 0) reposts = fields.repost_count!
              if (quotes === 0 && (fields.quote_count ?? 0) > 0) quotes = fields.quote_count!
            }
          } catch {}
        }

        const shares = reposts + quotes
        await supabase.from('post_analytics').upsert({
          user_id: user.id, content_id: c.id, platform: 'threads', post_id: c.threads_post_id!,
          impressions: views, reach: views, likes, comments: replies, saves: shares,
          save_rate: 0,
          engagement_rate: views > 0 ? parseFloat((((likes + replies + shares) / views) * 100).toFixed(2)) : 0,
          synced_at: new Date().toISOString(),
        }, { onConflict: 'platform,post_id' })
        threadsInsightRows.push({ caption: c.caption ?? '', saves: shares, reach: views, likes })
        threadsSynced++
      } catch {}
    }

    if (threadsInsightRows.length > 0) {
      try {
        const aiInsight = await generateText(buildInsightPrompt(threadsInsightRows))
        await supabase.from('post_analytics').update({ ai_insight: aiInsight })
          .eq('post_id', threadsContents![0].threads_post_id!)
      } catch {}
    }
  }

  return NextResponse.json({ igSynced, threadsSynced })
}
