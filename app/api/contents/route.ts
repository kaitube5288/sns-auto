import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = req.nextUrl
  const start = url.searchParams.get('start')
  const end = url.searchParams.get('end')
  const statusParam = url.searchParams.get('status')
  const statuses = statusParam?.split(',') ?? []

  let query = supabase
    .from('contents')
    .select('*')
    .eq('user_id', user.id)
    .order('scheduled_at', { ascending: true })

  if (statuses.length) query = query.in('status', statuses)
  if (start) query = query.gte('scheduled_at', start)
  if (end) query = query.lte('scheduled_at', end)

  const { data } = await query.limit(100)
  return NextResponse.json({ contents: data ?? [] })
}
