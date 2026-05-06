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
  const tone = formData.get('tone') as ContentTone
  const mode = (formData.get('mode') as string) || 'solo'
  const imageFiles = formData.getAll('images') as File[]

  if (imageFiles.length === 0) {
    return NextResponse.json({ error: '이미지를 업로드해주세요.' }, { status: 400 })
  }

  // 비즈니스 프로필 조회
  const { data: profile } = await supabase
    .from('business_profiles')
    .select('brand_name, business_type, location')
    .eq('user_id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: '업종 분석 설정을 먼저 완료해주세요.' }, { status: 400 })

  // 이미지 → base64
  const imageBase64List: string[] = []
  const uploadedUrls: string[] = []

  for (const file of imageFiles) {
    const arrayBuffer = await file.arrayBuffer()
    const b64 = `data:${file.type};base64,${Buffer.from(arrayBuffer).toString('base64')}`
    imageBase64List.push(b64)

    // Supabase Storage 업로드
    const path = `${user.id}/media/${Date.now()}-${file.name}`
    const { data: uploaded } = await supabase.storage
      .from('media')
      .upload(path, arrayBuffer, { contentType: file.type, upsert: true })

    if (uploaded) {
      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path)
      uploadedUrls.push(publicUrl)
    }
  }

  const sections = mode === 'combined' ? ['threads', 'feed', 'reels'] : ['feed']
  const { data: learnedExamples } = await supabase
    .from('learned_examples')
    .select('content_text, section')
    .eq('user_id', user.id)
    .in('section', sections)
    .order('created_at', { ascending: false })
    .limit(20)

  const prompt = buildFeedPrompt(profile, tone, imageFiles.length, learnedExamples ?? [])

  let text: string
  try {
    text = await generateWithImages(prompt, imageBase64List)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'AI 생성 중 오류가 발생했습니다.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  let draft: FeedDraft
  try {
    draft = parseJSON(text)
  } catch {
    return NextResponse.json({ error: 'AI 응답 파싱 실패. 다시 시도해주세요.' }, { status: 500 })
  }

  // DB 저장
  const mediaOrder = draft.slide_order.map((idx: number) => ({
    index: idx,
    url: uploadedUrls[idx] ?? uploadedUrls[0],
    description: draft.slide_descriptions[idx] ?? '',
  }))

  const { data: saved } = await supabase.from('contents').insert({
    user_id: user.id,
    platform: 'instagram',
    content_type: 'feed',
    tone,
    caption: draft.caption,
    hashtags: draft.hashtags,
    media_urls: uploadedUrls,
    media_order: mediaOrder,
    status: 'draft',
  }).select().single()

  return NextResponse.json({ draft: { ...draft, id: saved?.id, media_urls: uploadedUrls } })
}
