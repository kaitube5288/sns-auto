const IG_BASE = 'https://graph.facebook.com/v21.0'
const THREADS_BASE = 'https://graph.threads.net/v1.0'

// ─── Instagram Graph API ────────────────────────────────────────

export async function getIGUserInfo(accessToken: string) {
  const res = await fetch(
    `${IG_BASE}/me/accounts?fields=id,name,instagram_business_account{id,username,profile_picture_url,followers_count}&access_token=${accessToken}`
  )
  return res.json()
}

export async function exchangeLongLivedToken(shortToken: string) {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: process.env.META_APP_ID!,
    client_secret: process.env.META_APP_SECRET!,
    fb_exchange_token: shortToken,
  })
  const res = await fetch(`${IG_BASE}/oauth/access_token?${params}`)
  return res.json() as Promise<{ access_token: string; token_type: string; expires_in: number }>
}

export async function refreshLongLivedToken(token: string) {
  const params = new URLSearchParams({
    grant_type: 'ig_refresh_token',
    access_token: token,
  })
  const res = await fetch(`https://graph.instagram.com/refresh_access_token?${params}`)
  return res.json() as Promise<{ access_token: string; token_type: string; expires_in: number }>
}

// Instagram 이미지 컨테이너 생성
export async function createIGImageContainer(igUserId: string, accessToken: string, imageUrl: string, caption?: string) {
  const params: Record<string, string> = { image_url: imageUrl, access_token: accessToken }
  if (caption) params.caption = caption
  const res = await fetch(`${IG_BASE}/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  return res.json() as Promise<{ id: string }>
}

// Instagram 캐러셀 컨테이너 생성
export async function createIGCarouselContainer(igUserId: string, accessToken: string, childIds: string[], caption: string) {
  const res = await fetch(`${IG_BASE}/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'CAROUSEL',
      children: childIds.join(','),
      caption,
      access_token: accessToken,
    }),
  })
  return res.json() as Promise<{ id: string }>
}

// Instagram 미디어 발행
export async function publishIGMedia(igUserId: string, accessToken: string, creationId: string) {
  const res = await fetch(`${IG_BASE}/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: creationId, access_token: accessToken }),
  })
  return res.json() as Promise<{ id: string }>
}

// Instagram Insights
export async function getIGMediaInsights(mediaId: string, accessToken: string) {
  const metrics = 'impressions,reach,likes,comments,shares,saved'
  const res = await fetch(
    `${IG_BASE}/${mediaId}/insights?metric=${metrics}&access_token=${accessToken}`
  )
  return res.json()
}

// Hashtag 검색
export async function searchHashtag(hashtag: string, igUserId: string, accessToken: string) {
  const searchRes = await fetch(
    `${IG_BASE}/ig_hashtag_search?user_id=${igUserId}&q=${encodeURIComponent(hashtag)}&access_token=${accessToken}`
  )
  const { data } = await searchRes.json()
  if (!data?.[0]?.id) return null

  const hashtagId = data[0].id
  const topRes = await fetch(
    `${IG_BASE}/${hashtagId}/top_media?user_id=${igUserId}&fields=id,like_count,comments_count,caption,media_url,timestamp&access_token=${accessToken}`
  )
  return topRes.json()
}

// ─── Threads API ────────────────────────────────────────────────

export async function getThreadsUserInfo(accessToken: string) {
  const res = await fetch(
    `${THREADS_BASE}/me?fields=id,username,threads_profile_picture_url,threads_biography&access_token=${accessToken}`
  )
  return res.json()
}

// Threads 텍스트 컨테이너 생성
export async function createThreadsContainer(threadsUserId: string, accessToken: string, text: string, mediaUrl?: string) {
  const body: Record<string, string> = {
    media_type: mediaUrl ? 'IMAGE' : 'TEXT',
    text,
    access_token: accessToken,
  }
  if (mediaUrl) body.image_url = mediaUrl

  const res = await fetch(`${THREADS_BASE}/${threadsUserId}/threads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json() as Promise<{ id: string }>
}

// Threads 게시물 발행
export async function publishThreads(threadsUserId: string, accessToken: string, creationId: string) {
  const res = await fetch(`${THREADS_BASE}/${threadsUserId}/threads_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: creationId, access_token: accessToken }),
  })
  return res.json() as Promise<{ id: string }>
}

// Threads 컨테이너 상태 확인 (발행 전 준비 확인)
export async function checkThreadsStatus(containerId: string, accessToken: string) {
  const res = await fetch(
    `${THREADS_BASE}/${containerId}?fields=status,error_message&access_token=${accessToken}`
  )
  return res.json() as Promise<{ status: string; error_message?: string }>
}
