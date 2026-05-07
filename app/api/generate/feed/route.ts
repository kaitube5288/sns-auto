import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { generateWithImages, parseJSON } from '@/lib/gemini'
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
  const videoFile = formData.get('video') as File | null
  const videoFrameFiles = formData.getAll('video_frames') as File[]

  if (imageFiles.length === 0 && !videoFile) {
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

  // 동영상 → Storage 업로드
  let videoUrl: string | null = null
  if (videoFile) {
    const ab = await videoFile.arrayBuffer()
    const path = `${user.id}/media/${Date.now()}-${videoFile.name}`
    const { data: uploaded } = await supabase.storage
      .from('media').upload(path, ab, { contentType: videoFile.type, upsert: true })
    if (uploaded) {
      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path)
      videoUrl = publicUrl
    }
    // 동영상 프레임을 AI 분석용으로 추가 (슬라이드 인덱스에는 미포함)
    for (const frame of videoFrameFiles) {
      const fab = await frame.arrayBuffer()
      imageBase64List.push(`data:image/jpeg;base64,${Buffer.from(fab).toString('base64')}`)
    }
  }

  const allUrls = videoUrl ? [...uploadedPhotoUrls, videoUrl] : uploadedPhotoUrls
  const mediaCount = imageFiles.length + (videoFile ? 1 : 0)
  const hasVideo = !!videoFile

  const sections = mode === 'combined' ? ['threads', 'feed', 'reels'] : ['feed']
  const { data: learnedExamples } = await supabase
    .from('learned_examples')
    .select('content_text, section')
    .eq('user_id', user.id)
    .in('section', sections)
    .order('created_at', { ascending: false })
    .limit(20)

  const prompt = buildFeedPrompt(profile, tones, mediaCount, hasVideo, learnedExamples ?? [])

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
