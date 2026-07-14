import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { generateText } from '@/lib/gemini'
import { TONE_GUIDE } from '@/lib/prompts'
import type { ContentTone } from '@/lib/types'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { caption, instruction, tone } = await req.json()
  if (!caption || !instruction) return NextResponse.json({ error: '내용을 입력해주세요.' }, { status: 400 })

  const toneGuide = tone && TONE_GUIDE[tone as ContentTone] ? `\n[바꿀 말투: ${tone}]\n${TONE_GUIDE[tone as ContentTone]}\n` : ''

  const prompt = `너는 한국 자영업자 Threads 글의 말투만 바꿔주는 편집자야.

[원본 글 — 내용·소재·사실·수치·에피소드·전개 순서를 절대 바꾸지 마]
${caption}
${toneGuide}
[절대 금지]
- 원본에 없는 내용·에피소드·감정 추가 금지
- 원본의 숫자·사실·장소·인물 변경 금지
- 원본의 전개 순서 변경 금지
- "~습니다/~입니다" 금지 → "~거든" "~임" "~더라고" "~한 것 같음" 사용
- 홍보 문구 금지

추가 지시: ${instruction}

수정된 글 텍스트만 반환 (설명, 따옴표, JSON 없이 글 본문만)`

  try {
    const text = await generateText(prompt)
    return NextResponse.json({ caption: text.trim() })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'AI 수정 중 오류가 발생했습니다.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
