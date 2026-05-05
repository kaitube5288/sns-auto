import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase'
import { refreshLongLivedToken } from '@/lib/meta-api'
import { decryptToken, encryptToken } from '@/lib/utils'

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminSupabase()
  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: accounts } = await admin
    .from('meta_accounts')
    .select('id, instagram_access_token, instagram_token_expires_at')
    .lte('instagram_token_expires_at', sevenDaysLater)

  if (!accounts?.length) return NextResponse.json({ refreshed: 0 })

  let refreshed = 0
  for (const acc of accounts) {
    try {
      const token = decryptToken(acc.instagram_access_token!)
      const result = await refreshLongLivedToken(token)
      const newExpiry = new Date(Date.now() + result.expires_in * 1000).toISOString()

      await admin.from('meta_accounts').update({
        instagram_access_token: encryptToken(result.access_token),
        instagram_token_expires_at: newExpiry,
        threads_access_token: encryptToken(result.access_token),
        threads_token_expires_at: newExpiry,
      }).eq('id', acc.id)

      refreshed++
    } catch {}
  }

  return NextResponse.json({ refreshed })
}
