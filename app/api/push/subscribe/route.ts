import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const subscription = await req.json()
  await supabase
    .from('meta_accounts')
    .update({ push_subscription: subscription })
    .eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
