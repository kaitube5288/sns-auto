import type { BusinessProfile, ContentTone } from './types'

export const TONE_GUIDE: Record<ContentTone, string> = {
  '공감형': '손님의 하루와 감정에 공감. "오늘도 수고하셨어요" 같은 따뜻한 한 마디. 읽는 사람이 "맞아 나도 그랬는데" 하게.',
  '밈형': 'MZ 밈·유행어 적극 활용. 자영업 + 요즘 밈 조합. 짧고 빠르게. "ㅋㅋ" "ㄹㅇ" 같은 표현 자연스럽게.',
  '사장님형': '진짜 사장님 목소리. 재료 고집, 손님 이야기, 오늘 있었던 일. 자랑 아닌 이야기.',
  '감성형': '계절·날씨·냄새·소리로 분위기 전달. 읽으면 그 가게에 있는 것 같은 느낌.',
  '고객소통형': '질문이나 선택지로 마무리. 댓글 달고 싶게. "여러분은 어떠세요?"',
  '스레드감성형': '한 문장 → 줄바꿈 → 한 문장. 반전 있는 날것의 자영업 이야기. 해시태그 없음. 읽다가 멈추게 되는 훅.',
  '인스타감성형': '인스타 피드에 어울리는 감성 캡션. 사진의 분위기·색감·공간을 언어로 담음. 짧고 시적인 문장. 저장하고 싶은 느낌.',
}

interface LearnedEx { content_text: string | null; section: string }

export function buildThreadsPrompt(
  profile: Pick<BusinessProfile, 'brand_name' | 'business_type' | 'location' | 'brand_tone'>,
  tones: ContentTone[],
  recentCaptions: string[],
  contextNote?: string,
  competitorHashtags?: string[],
  contentTips?: string[],
  learnedExamples?: LearnedEx[],
  trendSummary?: string,
  count?: number
): string {
  const perTone = count ?? (tones.length === 1 ? 6 : 3)
  const total = count ?? (tones.length * perTone)

  const recentStr = recentCaptions.length
    ? `\n[최근 발행 글 - 반드시 다른 소재로]\n${recentCaptions.map((c, i) => `${i + 1}. ${c}`).join('\n')}`
    : ''
  const learnedStr = learnedExamples?.length
    ? `\n[직접 학습시킨 스타일 - 이 말투/구조를 최우선 참고]\n${learnedExamples.filter(e => e.content_text).map((e, i) => `${i + 1}. ${e.content_text}`).join('\n')}`
    : ''
  const trendStr = trendSummary
    ? `\n[오늘의 자영업 트렌드 - 이 이슈들을 소재로 활용]\n${trendSummary}`
    : ''

  const hasThreadsStyle = tones.includes('스레드감성형')

  const threadsExamples = `
[한국 Threads 바이럴 글 실제 예시 - 이 구조와 말투 그대로]

예시1 (반전형): "오늘 점심에 손님이 한명도 없었어\n\n저녁에 웨이팅 40분\n\n자영업은 아직도 모르겠음"
예시2 (원가공개): "커피 한잔 6500원 비싸다고 하시는데\n\n원두 650원 우유 900원 컵220원 인건비1400원 임대료1100원\n\n남는 거 카드수수료 빼면\n\n그냥 하는 거예요 저는"
예시3 (단골): "오늘 단골손님이 '사장님 덕분에 하루가 버텨졌어요' 하고 가셨는데\n\n이거 하나 때문에 계속하는 것 같기도 함"
예시4 (현실): "창업 전: 내 카페에서 커피 마시며 책 읽는 내 모습\n창업 후: 설거지 설거지 설거지 설거지 설거지"
예시5 (팩폭): "유튜브 보고 카페 창업했다는 분들\n\n유튜브에 나오는 카페들은 이미 잘 되는 곳임\n안 되는 카페는 유튜브 안 나옴"`

  const toneSection = tones.map((t, i) => {
    const rules = t === '스레드감성형'
      ? `한 문장씩 줄바꿈. 150~350자. 해시태그 0~1개. 이모지 없거나 1개. 반전/폭로/단골/관찰 형식. "~습니다" 금지.`
      : `200~350자. 해시태그 3~5개. 이모지 1~2개. 구어체("~해요" "~거든요"). 홍보문구 금지.`
    return `톤${tones.length > 1 ? i + 1 : ''}: ${t} — ${TONE_GUIDE[t]}\n  규칙: ${rules}`
  }).join('\n')

  const instruction = (count !== undefined || tones.length === 1)
    ? `${tones[0]} 톤으로 총 ${total}개 작성 (서로 다른 포맷/소재)`
    : `톤1(${tones[0]})으로 ${perTone}개 + 톤2(${tones[1]})으로 ${perTone}개 = 총 ${total}개\n- tone 필드에 정확한 톤명 기재 필수\n- 톤1 ${perTone}개를 먼저, 그 다음 톤2 ${perTone}개 순서로`

  return `너는 한국 ${profile.business_type} 자영업자 SNS 담당이야. 사장님이 폰으로 직접 쓴 것처럼 Threads 게시물을 만들어줘.

브랜드: ${profile.brand_name} | 업종: ${profile.business_type} | 지역: ${profile.location}
${toneSection}
${contextNote ? `오늘 특이사항: ${contextNote}` : ''}
${trendStr}${recentStr}${learnedStr}
${hasThreadsStyle ? threadsExamples : ''}

[절대 금지]
- "함께해요", "소중한", "행복한 하루", "최선을 다하는", "오늘도 열심히 준비했습니다"
- AI 쓴 티 나는 완벽한 문장 구조 / 최소 150자 이상
${competitorHashtags?.length ? `- 동종업계 해시태그 참고: ${competitorHashtags.slice(0, 5).join(', ')}` : ''}
${contentTips?.length ? `- 콘텐츠 전략: ${contentTips[0]}` : ''}

[지시사항]
${instruction}
- 최근 발행 글과 소재 중복 금지

반드시 다음 JSON 배열로만 응답 (다른 텍스트 없이):
[
  {
    "tone": "톤명",
    "caption": "게시물 본문 (줄바꿈은 \\n으로)",
    "hashtags": ["해시태그"],
    "engagement_hook": "반응 유도 포인트"
  }
]`
}

export function buildFeedPrompt(
  profile: Pick<BusinessProfile, 'brand_name' | 'business_type' | 'location'>,
  tones: ContentTone[],
  mediaCount: number,
  hasVideo: boolean,
  learnedExamples?: LearnedEx[],
  trendSummary?: string
): string {
  const tone1 = tones[0]
  const tone2 = tones[1] ?? tones[0]
  const learnedStr = learnedExamples?.length
    ? `\n[학습된 스타일 예시]\n${learnedExamples.filter(e => e.content_text).map((e, i) => `${i + 1}. ${e.content_text}`).join('\n')}\n`
    : ''
  const trendStr = trendSummary
    ? `\n[오늘의 자영업 트렌드 - 캡션 소재로 활용]\n${trendSummary}\n`
    : ''
  const mediaDesc = hasVideo
    ? `사진 ${mediaCount - 1}장 + 동영상 1개 (슬라이드 인덱스 ${mediaCount - 1})`
    : `사진 ${mediaCount}장`

  return `당신은 한국 소상공인이 인스타그램에 직접 올리는 글을 대신 써주는 사람입니다.

브랜드: ${profile.brand_name}
업종: ${profile.business_type}
지역: ${profile.location}
미디어: ${mediaDesc}
톤1 [${tone1}]: ${TONE_GUIDE[tone1]}
톤2 [${tone2}]: ${TONE_GUIDE[tone2]}
${trendStr}${learnedStr}
첨부된 사진·영상을 분석하여 인스타그램 피드용 콘텐츠 2개를 기획하세요.
${hasVideo ? `※ 첨부 이미지 마지막 여러 장은 동영상 프레임입니다. slide_order에서 동영상은 인덱스 ${mediaCount - 1} 하나로만 표현하세요.` : ''}

[말투 규칙]
- 구어체 ("~해요/~거든요/~더라고요"), "~합니다" 금지
- 홍보 표현 금지, 캡션 400자 이내
- slide_order: 0부터 ${mediaCount - 1}까지 정수만 사용 (${mediaCount}개)
- slide_descriptions: 인덱스 0부터 ${mediaCount - 1}까지 각 미디어 설명

반드시 다음 JSON 배열(정확히 2개)로만 응답하세요:
[
  {
    "tone": "${tone1}",
    "caption": "캡션 1",
    "hashtags": ["해시태그 20개"],
    "slide_order": [0, 1, 2, ...],
    "slide_descriptions": ["미디어 인덱스 0 설명", "미디어 인덱스 1 설명", ...],
    "slide_tips": "슬라이드 구성 한 줄 전략"
  },
  {
    "tone": "${tone2}",
    "caption": "캡션 2",
    "hashtags": ["해시태그 20개"],
    "slide_order": [0, 1, 2, ...],
    "slide_descriptions": ["미디어 인덱스 0 설명", "미디어 인덱스 1 설명", ...],
    "slide_tips": "슬라이드 구성 한 줄 전략"
  }
]`
}

export function buildReelsPrompt(
  profile: Pick<BusinessProfile, 'brand_name' | 'business_type' | 'location'>,
  intent: string,
  durationSec: number,
  learnedExamples?: LearnedEx[]
): string {
  const learnedStr = learnedExamples?.length
    ? `\n[학습된 릴스 기획 예시 - 이 구성 방식을 참고하세요]\n${learnedExamples.filter(e => e.content_text).map((e, i) => `${i + 1}. ${e.content_text}`).join('\n')}\n`
    : ''

  return `당신은 한국 인스타그램 릴스 기획 전문가입니다.

브랜드: ${profile.brand_name}
업종: ${profile.business_type}
지역: ${profile.location}
기획 의도: ${intent}
영상 길이: 약 ${durationSec}초
${learnedStr}

첨부된 영상 프레임들을 분석하여 릴스 기획안을 작성하세요.

반드시 다음 JSON 형식으로만 응답하세요:
{
  "hook": "첫 1~2초에 사용할 강렬한 Hook 문구",
  "cuts": [
    {
      "start_sec": 0,
      "end_sec": 2,
      "scene": "장면 설명",
      "subtitle": "자막 텍스트",
      "effect": "전환 효과 추천 (옵션)"
    }
  ],
  "bgm_suggestions": [
    { "mood": "분위기", "genre": "장르", "example": "예시 곡/아티스트" }
  ],
  "cta": "마지막 3초 CTA 문구"
}`
}

export function buildAnalysisPrompt(
  profile: Pick<BusinessProfile, 'brand_name' | 'business_type' | 'location' | 'sub_category'>,
  competitorHashtags: string[],
  trendPosts: string
): string {
  return `당신은 한국 소셜미디어 마케팅 전략가입니다.

분석 대상:
- 브랜드: ${profile.brand_name}
- 업종: ${profile.business_type} (${profile.sub_category || ''})
- 지역: ${profile.location}
- 경쟁 해시태그: ${competitorHashtags.join(', ')}

인기 게시물 트렌드:
${trendPosts}

위 정보를 바탕으로 마케팅 인사이트를 분석하세요.

반드시 다음 JSON 형식으로만 응답하세요:
{
  "positioning": "차별화 포지셔닝 전략 (2~3문장)",
  "target_summary": "주요 타겟 고객층 분석",
  "recommended_hashtags": ["추천 해시태그 15개"],
  "content_tips": ["콘텐츠 전략 팁 5가지"],
  "competitor_patterns": ["경쟁사/트렌드 패턴 분석 3가지"]
}`
}

export function buildInsightPrompt(posts: { caption: string; saves: number; reach: number; likes: number }[]): string {
  const data = posts.map(p => `저장:${p.saves} 도달:${p.reach} 좋아요:${p.likes} | ${p.caption?.slice(0, 50)}`).join('\n')
  return `다음 SNS 게시물 성과 데이터를 분석하고 인사이트를 제공하세요.

게시물 성과:
${data}

2~3문장으로 핵심 인사이트와 다음 콘텐츠 방향을 한국어로 요약하세요.`
}
