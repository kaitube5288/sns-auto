import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { generateText, searchTrends, parseJSON } from '@/lib/gemini'
import { buildThreadsPrompt } from '@/lib/prompts'
import type { ContentTone, ThreadsDraft } from '@/lib/types'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { tone, context_note, mode = 'solo' } = await req.json()

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

  // 학습 예시 조회 (단독: threads만, 통합: 전체)
  const sections = mode === 'combined' ? ['threads', 'feed', 'reels'] : ['threads']
  const { data: learnedExamples } = await supabase
    .from('learned_examples')
    .select('content_text, section')
    .eq('user_id', user.id)
    .in('section', sections)
    .order('created_at', { ascending: false })
    .limit(20)

  // 오늘의 자영업 트렌드 검색 (실패해도 계속 진행)
  const trendSummary = await searchTrends(
    `오늘 날짜 기준 한국 ${profile.business_type} 자영업자/소상공인 커뮤니티에서 화제인 이슈, 뉴스, 공감 포인트 5가지를 간단히 요약해줘. 최저임금, 임대료, 배달앱, 원가 상승, 손님 트렌드 등 관련 최신 내용 포함.`
  ).catch(() => '')

  const prompt = buildThreadsPrompt(
    profile,
    tone as ContentTone,
    recentCaptions,
    context_note,
    profile.competitor_hashtags ?? [],
    profile.analysis_result?.content_tips ?? [],
    learnedExamples ?? [],
    trendSummary || undefined
  )

  let text: string
  try {
    text = await generateText(prompt)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'AI 생성 중 오류가 발생했습니다.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  let drafts: ThreadsDraft[]
  try {
    drafts = parseJSON(text)
  } catch {
    return NextResponse.json({ error: 'AI 응답 파싱 실패. 다시 시도해주세요.' }, { status: 500 })
  }

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
