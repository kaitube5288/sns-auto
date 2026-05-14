import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: all } = await supabase
    .from('post_analytics')
    .select('*')
    .eq('user_id', user.id)
    .order('synced_at', { ascending: false })
    .limit(60)

  // content_id로 caption 매핑
  const contentIds = (all ?? []).map(a => a.content_id).filter(Boolean) as string[]
  let captionMap: Record<string, string> = {}
  if (contentIds.length > 0) {
    const { data: contents } = await supabase
      .from('contents')
      .select('id, caption')
      .in('id', contentIds)
    captionMap = Object.fromEntries((contents ?? []).map(c => [c.id, c.caption]))
  }

  const withCaption = (all ?? []).map(a => ({
    ...a,
    caption: a.content_id ? (captionMap[a.content_id] ?? null) : null,
  }))

  const hasMetrics = (a: Record<string, number>) => a.reach > 0 || a.likes > 0 || a.comments > 0 || a.saves > 0
  const instagram = withCaption.filter(a => a.platform === 'instagram' && hasMetrics(a))
  const threads = withCaption.filter(a => a.platform === 'threads' && hasMetrics(a))

  return NextResponse.json({
    instagram,
    threads,
    igInsight: instagram.find(a => a.ai_insight)?.ai_insight ?? null,
    threadsInsight: threads.find(a => a.ai_insight)?.ai_insight ?? null,
  })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { post_id, impressions } = await req.json()
  if (!post_id || impressions === undefined) return NextResponse.json({ error: '잘못된 요청' }, { status: 400 })

  const views = Math.max(0, Number(impressions))
  const { data: existing } = await supabase
    .from('post_analytics')
    .select('likes, comments, saves')
    .eq('post_id', post_id)
    .eq('user_id', user.id)
    .single()

  const engagement_rate = views > 0 && existing
    ? parseFloat((((existing.likes + existing.comments + existing.saves) / views) * 100).toFixed(2))
    : null

  const { error } = await supabase
    .from('post_analytics')
    .update({ impressions: views, reach: views, engagement_rate })
    .eq('post_id', post_id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
