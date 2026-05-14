import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'
import { generateText } from '@/lib/gemini'

export const maxDuration = 60

export async function POST() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 최근 60일 Threads 분석 데이터 + caption 조인
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
  const { data: analytics } = await supabase
    .from('post_analytics')
    .select('*')
    .eq('user_id', user.id)
    .eq('platform', 'threads')
    .gte('synced_at', sixtyDaysAgo)
    .order('likes', { ascending: false })
    .limit(30)

  if (!analytics?.length) return NextResponse.json({ error: '분석할 데이터가 없습니다. 먼저 동기화해주세요.' }, { status: 400 })

  const contentIds = analytics.map(a => a.content_id).filter(Boolean) as string[]
  let captionMap: Record<string, string> = {}
  if (contentIds.length > 0) {
    const { data: contents } = await supabase
      .from('contents')
      .select('id, caption')
      .in('id', contentIds)
    captionMap = Object.fromEntries((contents ?? []).map(c => [c.id, c.caption ?? '']))
  }

  const postLines = analytics
    .filter(a => a.content_id && captionMap[a.content_id])
    .map(a => {
      const caption = captionMap[a.content_id!]?.slice(0, 150) ?? ''
      const engagement = a.likes + a.comments + a.saves
      return `[좋아요:${a.likes} 댓글:${a.comments} 공유:${a.saves} 조회:${a.reach}] ${caption}`
    })

  if (postLines.length < 2) return NextResponse.json({ error: '분석에 필요한 게시물이 부족합니다 (최소 2개).' }, { status: 400 })

  const prompt = `다음은 내 Threads 게시물들의 성과 데이터입니다. 성과가 높은 순서대로 정렬되어 있습니다.

${postLines.join('\n')}

위 데이터를 분석해서 다음을 알려주세요:

1. **인기 게시물의 공통 패턴**: 어떤 주제, 감정, 글 스타일이 참여를 높이는지
2. **저조한 게시물과의 차이점**: 무엇이 달랐는지
3. **앞으로 쓰면 좋을 글 스타일 조언 3가지**: 구체적이고 실행 가능하게

마지막에 반드시 다음 형식으로 "학습 패턴:" 섹션을 추가해줘:
학습 패턴: [패턴1], [패턴2], [패턴3], [패턴4], [패턴5]
(각 패턴은 글 작성 시 참고할 수 있는 짧은 문장으로, 예: "손님 감사 에피소드는 공감을 유발함", "ㅎ 이모티콘으로 마무리하면 반응이 좋음")`

  let analysis: string
  try {
    analysis = await generateText(prompt)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'AI 생성 실패'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // "학습 패턴:" 섹션에서 패턴 추출
  const patternLineRaw = analysis.split('\n').find(l => l.includes('학습 패턴:')) ?? ''
  const patternLine = patternLineRaw.replace(/^.*학습 패턴:\s*/, '')
  const patterns = patternLine.split(',').map(p => p.replace(/[\[\]]/g, '').trim()).filter(Boolean)

  // learned_examples에 저장 (section: 'threads', 기존 자동학습 항목 교체)
  if (patterns.length > 0) {
    // 이전 자동 학습 패턴 삭제 (auto_analysis 태그 포함된 것)
    await supabase
      .from('learned_examples')
      .delete()
      .eq('user_id', user.id)
      .eq('section', 'threads')
      .like('content_text', '[자동학습]%')

    const inserts = patterns.map(p => ({
      user_id: user.id,
      section: 'threads',
      content_text: `[자동학습] ${p}`,
    }))
    await supabase.from('learned_examples').insert(inserts)
  }

  return NextResponse.json({ analysis, patternsLearned: patterns.length })
}
