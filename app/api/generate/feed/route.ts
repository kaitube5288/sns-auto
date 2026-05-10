import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { generateWithImages, searchTrends, parseJSON } from '@/lib/gemini'
import { buildFeedPrompt } from '@/lib/prompts'
import type { ContentTone, FeedDraft } from '@/lib/types'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const tonesRaw = formData.get('tones') as string
  const tones: ContentTone[] = tonesRaw ? JSON.parse(tonesRaw) : ['인스타감성형']
  const mode = (formData.get('mode') as string) || 'solo'
  const imageFiles = formData.getAll('images') as File[]
  const hasVideo = formData.get('has_video') === '1'
  const videoFrameFiles = formData.getAll('video_frames') as File[]

  if (imageFiles.length === 0 && !hasVideo) {
    return NextResponse.json({ error: '이미지 또는 동영상을 업로드해주세요.' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('business_profiles')
    .select('brand_name, business_type, location')
    .eq('user_id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: '업종 분석 설정을 먼저 완료해주세요.' }, { status: 400 })

  // 사진 → base64 + Storage 업로드
  const imageBase64List: string[] = []
  const uploadedPhotoUrls: string[] = []

  for (const file of imageFiles) {
    const ab = await file.arrayBuffer()
    imageBase64List.push(`data:${file.type};base64,${Buffer.from(ab).toString('base64')}`)
    const path = `${user.id}/media/${Date.now()}-${file.name}`
    const { data: uploaded } = await supabase.storage
      .from('media').upload(path, ab, { contentType: file.type, upsert: true })
    if (uploaded) {
      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path)
      uploadedPhotoUrls.push(publicUrl)
    }
  }

  // 동영상 프레임 → AI 분석용 (동영상 파일 자체는 클라이언트에서 별도 업로드)
  for (const frame of videoFrameFiles) {
    const fab = await frame.arrayBuffer()
    imageBase64List.push(`data:image/jpeg;base64,${Buffer.from(fab).toString('base64')}`)
  }

  const allUrls = uploadedPhotoUrls  // 동영상 URL은 클라이언트의 /api/media/upload 호출로 추가됨
  const mediaCount = imageFiles.length + (hasVideo ? 1 : 0)

  const sections = mode === 'combined' ? ['threads', 'feed', 'reels'] : ['feed']
  const { data: learnedExamples } = await supabase
    .from('learned_examples')
    .select('content_text, section')
    .eq('user_id', user.id)
    .in('section', sections)
    .order('created_at', { ascending: false })
    .limit(20)

  // 트렌드 검색 (1시간 캐시 — threads route와 캐시 공유)
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const todayKST = kstNow.toISOString().slice(0, 10)
  const yesterdayKST = new Date(kstNow.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const cacheKey = `trend_${profile.business_type}`
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { data: cachedTrend } = await supabase
    .from('trend_cache')
    .select('recent_posts, fetched_at')
    .eq('user_id', user.id)
    .eq('hashtag', cacheKey)
    .gte('fetched_at', oneHourAgo)
    .single()

  let trendSummary = (cachedTrend?.recent_posts as { summary?: string } | null)?.summary ?? ''

  if (!trendSummary) {
    trendSummary = await searchTrends(
      `${yesterdayKST}(전날)~${todayKST}(당일) 기준으로 한국 ${profile.business_type} 자영업자/소상공인 커뮤니티에서 화제인 이슈, 뉴스, 공감 포인트 5가지를 간단히 요약해줘. 최저임금, 임대료, 배달앱, 원가 상승, 손님 트렌드 등 관련 최신 내용 포함.`
    ).catch(() => '')

    if (trendSummary) {
      await supabase.from('trend_cache').upsert({
        user_id: user.id,
        hashtag: cacheKey,
        recent_posts: { summary: trendSummary },
        fetched_at: new Date().toISOString(),
      }, { onConflict: 'user_id,hashtag' })
    }
  }

  const prompt = buildFeedPrompt(profile, tones, mediaCount, hasVideo, learnedExamples ?? [], trendSummary || undefined)

  let text: string
  try {
    text = await generateWithImages(prompt, imageBase64List)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'AI 생성 중 오류가 발생했습니다.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  let drafts: FeedDraft[]
  try {
    const parsed = parseJSON(text)
    drafts = Array.isArray(parsed) ? parsed : [parsed, parsed]
  } catch {
    return NextResponse.json({ error: 'AI 응답 파싱 실패. 다시 시도해주세요.' }, { status: 500 })
  }

  const insertData = drafts.map(d => ({
    user_id: user.id,
    platform: 'instagram' as const,
    content_type: 'feed' as const,
    tone: d.tone ?? tones[0],
    caption: d.caption,
    hashtags: d.hashtags,
    media_urls: allUrls,
    media_order: (d.slide_order ?? []).map((idx: number) => ({
      index: idx,
      url: allUrls[idx] ?? allUrls[0],
      description: d.slide_descriptions?.[idx] ?? '',
    })),
    status: 'draft' as const,
  }))

  const { data: saved } = await supabase.from('contents').insert(insertData).select()

  return NextResponse.json({
    drafts: drafts.map((d, i) => ({ ...d, id: saved?.[i]?.id, media_urls: allUrls }))
  })
}
