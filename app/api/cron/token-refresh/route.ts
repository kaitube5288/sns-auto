import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase'
import { refreshLongLivedToken, refreshThreadsLongLivedToken } from '@/lib/meta-api'
import { decryptToken, encryptToken } from '@/lib/utils'
import webpush from 'web-push'

function daysUntil(dateStr: string) {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  webpush.setVapidDetails(
    process.env.VAPID_EMAIL!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )

  const admin = createAdminSupabase()
  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: accounts } = await admin
    .from('meta_accounts')
    .select('id, user_id, instagram_access_token, instagram_token_expires_at, threads_access_token, threads_token_expires_at, push_subscription')

  if (!accounts?.length) return NextResponse.json({ refreshed: 0 })

  let refreshed = 0
  for (const acc of accounts) {
    // Instagram 토큰 갱신: 만료일이 NULL이거나 7일 이내인 경우
    const igExpiry = acc.instagram_token_expires_at
    const igNeedsRefresh = !igExpiry || igExpiry <= sevenDaysLater

    if (igNeedsRefresh && acc.instagram_access_token) {
      try {
        const token = decryptToken(acc.instagram_access_token)
        const result = await refreshLongLivedToken(token)
        const newExpiry = new Date(Date.now() + result.expires_in * 1000).toISOString()
        await admin.from('meta_accounts').update({
          instagram_access_token: encryptToken(result.access_token),
          instagram_token_expires_at: newExpiry,
        }).eq('id', acc.id)
        acc.instagram_token_expires_at = newExpiry
        refreshed++
      } catch {}
    }

    // Threads 토큰 갱신: 만료일이 NULL이거나 7일 이내인 경우
    const thExpiry = acc.threads_token_expires_at
    const thNeedsRefresh = !thExpiry || thExpiry <= sevenDaysLater

    if (thNeedsRefresh && acc.threads_access_token) {
      try {
        const token = decryptToken(acc.threads_access_token)
        const result = await refreshThreadsLongLivedToken(token)
        const newExpiry = new Date(Date.now() + result.expires_in * 1000).toISOString()
        await admin.from('meta_accounts').update({
          threads_access_token: encryptToken(result.access_token),
          threads_token_expires_at: newExpiry,
        }).eq('id', acc.id)
        acc.threads_token_expires_at = newExpiry
        refreshed++
      } catch {}
    }

    // 갱신 후에도 14일 이내 만료 토큰이 있으면 푸시 알림
    if (!acc.push_subscription) continue

    const alerts: string[] = []
    if (acc.instagram_token_expires_at) {
      const d = daysUntil(acc.instagram_token_expires_at)
      if (d <= 14) alerts.push(`Instagram (${d}일 후 만료)`)
    }
    if (acc.threads_token_expires_at) {
      const d = daysUntil(acc.threads_token_expires_at)
      if (d <= 14) alerts.push(`Threads (${d}일 후 만료)`)
    }
    if (!alerts.length) continue

    // 24시간 내 이미 발송했으면 스킵
    const alertKey = `push_alert_${acc.id}`
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: recentAlert } = await admin
      .from('trend_cache')
      .select('fetched_at')
      .eq('hashtag', alertKey)
      .gte('fetched_at', yesterday)
      .single()

    if (recentAlert) continue

    await webpush.sendNotification(
      acc.push_subscription as webpush.PushSubscription,
      JSON.stringify({
        title: '계정 재연결이 필요합니다',
        body: alerts.join(', '),
        url: '/connect',
      })
    ).catch(() => {})

    await admin.from('trend_cache').upsert({
      user_id: acc.user_id,
      hashtag: alertKey,
      recent_posts: { sent: true },
      fetched_at: new Date().toISOString(),
    }, { onConflict: 'user_id,hashtag' })
  }

  return NextResponse.json({ refreshed })
}
