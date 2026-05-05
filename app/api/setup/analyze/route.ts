import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { generateText, parseJSON } from '@/lib/gemini'
import { buildAnalysisPrompt } from '@/lib/prompts'
import type { BusinessAnalysis } from '@/lib/types'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { brand_name, business_type, location, sub_category, target_audience, brand_tone, competitor_hashtags } = body

  // business_profile upsert
  await supabase.from('business_profiles').upsert({
    user_id: user.id,
    brand_name,
    business_type,
    location,
    sub_category: sub_category || null,
    target_audience: target_audience || null,
    brand_tone: brand_tone || null,
    competitor_hashtags: competitor_hashtags || [],
  }, { onConflict: 'user_id' })

  // AI 분석 실행
  const trendSummary = competitor_hashtags?.length
    ? `경쟁 키워드: ${competitor_hashtags.join(', ')}`
    : '경쟁 키워드 없음'

  const prompt = buildAnalysisPrompt(
    { brand_name, business_type, location, sub_category },
    competitor_hashtags || [],
    trendSummary
  )

  const text = await generateText(prompt)
  const analysis: BusinessAnalysis = parseJSON(text)

  // 분석 결과 저장
  await supabase
    .from('business_profiles')
    .update({ analysis_result: analysis, analysis_updated_at: new Date().toISOString() })
    .eq('user_id', user.id)

  return NextResponse.json({ analysis })
}
