import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { getIGMediaInsights } from '@/lib/meta-api'
import { decryptToken } from '@/lib/utils'
import { generateText } from '@/lib/gemini'
import { buildInsightPrompt } from '@/lib/prompts'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: account } = await supabase
    .from('meta_accounts')
    .select('instagram_user_id, instagram_access_token, instagram_connected')
    .eq('user_id', user.id)
    .single()

  if (!account?.instagram_connected) {
    return NextResponse.json({ error: 'Instagram 계정을 먼저 연결해주세요.' }, { status: 400 })
  }

  const accessToken = decryptToken(account.instagram_access_token!)

  // 최근 30일 발행된 IG 게시물
  const { data: contents } = await supabase
    .from('contents')
    .select('id, instagram_post_id, caption')
    .eq('user_id', user.id)
    .eq('status', 'published')
    .not('instagram_post_id', 'is', null)
    .gte('published_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

  if (!contents?.length) return NextResponse.json({ synced: 0 })

  let synced = 0
  const insightRows: { caption: string; saves: number; reach: number; likes: number }[] = []

  for (const c of contents) {
    try {
      const insights = await getIGMediaInsights(c.instagram_post_id!, accessToken)
      const metrics = insights?.data ?? []
      const get = (name: string) => metrics.find((m: { name: string; values: { value: number }[] }) => m.name === name)?.values?.[0]?.value ?? 0

      const reach = get('reach')
      const saves = get('saved')
      const likes = get('likes')
      const comments = get('comments')

      await supabase.from('post_analytics').upsert({
        user_id: user.id,
        content_id: c.id,
        platform: 'instagram',
        post_id: c.instagram_post_id!,
        impressions: get('impressions'),
        reach,
        likes,
        comments,
        saves,
        save_rate: reach > 0 ? parseFloat(((saves / reach) * 100).toFixed(2)) : 0,
        engagement_rate: reach > 0 ? parseFloat((((likes + comments + saves) / reach) * 100).toFixed(2)) : 0,
        synced_at: new Date().toISOString(),
      }, { onConflict: 'platform,post_id' })

      insightRows.push({ caption: c.caption ?? '', saves, reach, likes })
      synced++
    } catch {}
  }

  // AI 인사이트 생성
  if (insightRows.length > 0) {
    try {
      const prompt = buildInsightPrompt(insightRows)
      const aiInsight = await generateText(prompt)

      // 가장 최근 게시물에 인사이트 저장
      const latestPostId = contents[0].instagram_post_id!
      await supabase
        .from('post_analytics')
        .update({ ai_insight: aiInsight })
        .eq('post_id', latestPostId)
    } catch {}
  }

  return NextResponse.json({ synced })
}
