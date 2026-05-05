import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { generateText, parseJSON } from '@/lib/gemini'
import { buildThreadsPrompt } from '@/lib/prompts'
import type { ContentTone, ThreadsDraft } from '@/lib/types'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tone, context_note } = await req.json()

  // 비즈니스 프로필 조회
  const { data: profile } = await supabase
    .from('business_profiles')
    .select('brand_name, business_type, location, brand_tone, competitor_hashtags, analysis_result')
    .eq('user_id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: '업종 분석 설정을 먼저 완료해주세요.' }, { status: 400 })

  // 최근 7일 발행 글 (중복 방지)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recentContents } = await supabase
    .from('contents')
    .select('caption')
    .eq('user_id', user.id)
    .eq('content_type', 'threads_text')
    .eq('status', 'published')
    .gte('published_at', weekAgo)
    .limit(5)

  const recentCaptions = recentContents?.map(c => c.caption).filter(Boolean) as string[] ?? []

  const prompt = buildThreadsPrompt(
    profile,
    tone as ContentTone,
    recentCaptions,
    context_note,
    profile.competitor_hashtags ?? [],
    profile.analysis_result?.content_tips ?? []
  )
  const text = await generateText(prompt)
  const drafts: ThreadsDraft[] = parseJSON(text)

  // draft로 DB에 저장
  const insertData = drafts.map(d => ({
    user_id: user.id,
    platform: 'threads' as const,
    content_type: 'threads_text' as const,
    tone,
    caption: d.caption,
    hashtags: d.hashtags,
    status: 'draft' as const,
  }))
  const { data: saved } = await supabase.from('contents').insert(insertData).select()

  return NextResponse.json({ drafts: drafts.map((d, i) => ({ ...d, id: saved?.[i]?.id })) })
}
