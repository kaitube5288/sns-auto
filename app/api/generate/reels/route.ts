import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { generateWithImages, parseJSON } from '@/lib/gemini'
import { buildReelsPrompt } from '@/lib/prompts'
import type { ReelsPlan } from '@/lib/types'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const intent = (formData.get('intent') as string) || '제품 소개'
  const durationSec = parseInt((formData.get('duration') as string) || '30')
  const frames = formData.getAll('frames') as File[]
  const videoFile = formData.get('video') as File | null

  const { data: profile } = await supabase
    .from('business_profiles')
    .select('brand_name, business_type, location')
    .eq('user_id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: '업종 분석 설정을 먼저 완료해주세요.' }, { status: 400 })

  // 프레임 → base64
  const frameBase64List: string[] = []
  for (const frame of frames.slice(0, 6)) {
    const ab = await frame.arrayBuffer()
    frameBase64List.push(`data:image/jpeg;base64,${Buffer.from(ab).toString('base64')}`)
  }

  // 영상 Storage 업로드
  let videoUrl: string | undefined
  if (videoFile) {
    const ab = await videoFile.arrayBuffer()
    const path = `${user.id}/media/${Date.now()}-${videoFile.name}`
    const { data: uploaded } = await supabase.storage
      .from('media')
      .upload(path, ab, { contentType: videoFile.type, upsert: true })
    if (uploaded) {
      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path)
      videoUrl = publicUrl
    }
  }

  const prompt = buildReelsPrompt(profile, intent, durationSec)
  const text = await generateWithImages(prompt, frameBase64List)
  const plan: ReelsPlan = parseJSON(text)

  const { data: saved } = await supabase.from('contents').insert({
    user_id: user.id,
    platform: 'instagram',
    content_type: 'reels',
    reels_plan: plan,
    media_urls: videoUrl ? [videoUrl] : [],
    status: 'draft',
  }).select().single()

  return NextResponse.json({ plan: { ...plan, id: saved?.id } })
}
