import { NextResponse } from 'next/server'
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

  const hasMetrics = (a: Record<string, number>) => a.reach > 0 || a.likes > 0 || a.comments > 0 || a.saves > 0
  const instagram = (all ?? []).filter(a => a.platform === 'instagram' && hasMetrics(a))
  const threads = (all ?? []).filter(a => a.platform === 'threads' && hasMetrics(a))

  return NextResponse.json({
    instagram,
    threads,
    igInsight: instagram.find(a => a.ai_insight)?.ai_insight ?? null,
    threadsInsight: threads.find(a => a.ai_insight)?.ai_insight ?? null,
  })
}
