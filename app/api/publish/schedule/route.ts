import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { content_id, scheduled_at } = await req.json()
  if (!scheduled_at) return NextResponse.json({ error: 'scheduled_at 필요' }, { status: 400 })

  const scheduledDate = new Date(scheduled_at)
  if (scheduledDate <= new Date()) {
    return NextResponse.json({ error: '예약 시각은 현재 시각 이후여야 합니다.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('contents')
    .update({ status: 'scheduled', scheduled_at: scheduledDate.toISOString() })
    .eq('id', content_id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, scheduled_at: scheduledDate.toISOString() })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { content_id } = await req.json()

  const { error } = await supabase
    .from('contents')
    .update({ status: 'draft', scheduled_at: null })
    .eq('id', content_id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
