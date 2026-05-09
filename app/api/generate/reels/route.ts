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
  const mode = (formData.get('mode') as string) || 'solo'
  const frames = formData.getAll('frames') as File[]

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

  // 영상 파일은 클라이언트에서 /api/media/upload로 별도 업로드 (크기 제한 우회)

  const sections = mode === 'combined' ? ['threads', 'feed', 'reels'] : ['reels']
  const { data: learnedExamples } = await supabase
    .from('learned_examples')
    .select('content_text, section')
    .eq('user_id', user.id)
    .in('section', sections)
    .order('created_at', { ascending: false })
    .limit(20)

  const prompt = buildReelsPrompt(profile, intent, durationSec, learnedExamples ?? [])

  let text: string
  try {
    text = await generateWithImages(prompt, frameBase64List)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'AI 생성 중 오류가 발생했습니다.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  let plan: ReelsPlan
  try {
    plan = parseJSON(text)
  } catch {
    return NextResponse.json({ error: 'AI 응답 파싱 실패. 다시 시도해주세요.' }, { status: 500 })
  }

  const { data: saved } = await supabase.from('contents').insert({
    user_id: user.id,
    platform: 'instagram',
    content_type: 'reels',
    reels_plan: plan,
    media_urls: [],
    status: 'draft',
  }).select().single()

  return NextResponse.json({ plan: { ...plan, id: saved?.id } })
}
