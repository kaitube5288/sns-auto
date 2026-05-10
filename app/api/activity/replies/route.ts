import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { getThreadsReplies } from '@/lib/meta-api'
import { decryptToken } from '@/lib/utils'
import { generateText } from '@/lib/gemini'

export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: account } = await supabase
    .from('meta_accounts')
    .select('threads_access_token, threads_connected')
    .eq('user_id', user.id)
    .single()

  if (!account?.threads_connected) return NextResponse.json({ replies: [] })

  const token = decryptToken(account.threads_access_token!)

  const { data: posts } = await supabase
    .from('contents')
    .select('threads_post_id, caption')
    .eq('user_id', user.id)
    .eq('status', 'published')
    .not('threads_post_id', 'is', null)
    .order('published_at', { ascending: false })
    .limit(15)

  const allReplies: {
    id: string; text: string; username: string; timestamp: string
    post_id: string; post_caption: string
  }[] = []

  for (const post of (posts ?? [])) {
    try {
      const data = await getThreadsReplies(post.threads_post_id!, token)
      for (const r of (data?.data ?? [])) {
        allReplies.push({
          id: r.id,
          text: r.text ?? '',
          username: r.username ?? '',
          timestamp: r.timestamp ?? '',
          post_id: post.threads_post_id!,
          post_caption: post.caption ?? '',
        })
      }
    } catch {}
  }

  allReplies.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  return NextResponse.json({ replies: allReplies.slice(0, 60) })
}

// AI 답글 제안 생성
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { reply_text, post_caption } = await req.json()

  const { data: profile } = await supabase
    .from('business_profiles')
    .select('brand_name, business_type, brand_tone')
    .eq('user_id', user.id)
    .single()

  const brandName = profile?.brand_name ?? '우리 가게'
  const tone = profile?.brand_tone ?? '친근하고 따뜻한'

  const prompt = `당신은 ${brandName} 소셜미디어 담당자입니다.
브랜드 톤: ${tone}

아래 스레드 게시물에 달린 댓글에 대해 자연스럽고 진심 어린 답글을 1개만 작성해주세요.
답글은 2~3문장 이내로 짧게, 이모티콘 1~2개 포함, 해시태그 없이.

[원본 게시물 일부]
${post_caption.slice(0, 100)}

[댓글 내용]
${reply_text}

답글 텍스트만 출력하세요. 따옴표나 설명 없이.`

  try {
    const suggestion = await generateText(prompt)
    return NextResponse.json({ suggestion: suggestion.trim() })
  } catch {
    return NextResponse.json({ error: 'AI 생성 실패' }, { status: 500 })
  }
}
