import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('meta_accounts')
    .select('instagram_username, instagram_connected, instagram_token_expires_at, threads_username, threads_connected, threads_token_expires_at')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({ account: data })
}
