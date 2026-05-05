import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: analytics } = await supabase
    .from('post_analytics')
    .select('*')
    .eq('user_id', user.id)
    .order('synced_at', { ascending: false })
    .limit(30)

  const aiInsight = analytics?.find(a => a.ai_insight)?.ai_insight ?? null

  return NextResponse.json({ analytics: analytics ?? [], aiInsight })
}
