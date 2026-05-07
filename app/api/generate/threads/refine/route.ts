import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { generateText } from '@/lib/gemini'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { caption, instruction } = await req.json()
  if (!caption || !instruction) return NextResponse.json({ error: '내용을 입력해주세요.' }, { status: 400 })

  const prompt = `다음 Threads 게시물을 수정해줘.

현재 글:
${caption}

수정 지시사항: ${instruction}

규칙:
- 한국 자영업자 Threads 말투 유지 (한 문장씩 줄바꿈)
- "~습니다/~입니다" 절대 금지 → "~거든" "~임" "~더라고" "~한 것 같음" 사용
- 홍보 문구 금지
- 수정된 글 텍스트만 반환 (설명, 따옴표, JSON 없이 글 본문만)`

  try {
    const text = await generateText(prompt)
    return NextResponse.json({ caption: text.trim() })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'AI 수정 중 오류가 발생했습니다.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
