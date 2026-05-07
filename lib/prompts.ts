import type { BusinessProfile, ContentTone } from './types'

export const TONE_GUIDE: Record<ContentTone, string> = {
  '공감형': '손님의 하루와 감정에 공감. "오늘도 수고하셨어요" 같은 따뜻한 한 마디. 읽는 사람이 "맞아 나도 그랬는데" 하게.',
  '밈형': 'MZ 밈·유행어 적극 활용. 자영업 + 요즘 밈 조합. 짧고 빠르게. "ㅋㅋ" "ㄹㅇ" 같은 표현 자연스럽게.',
  '사장님형': '진짜 사장님 목소리. 재료 고집, 손님 이야기, 오늘 있었던 일. 자랑 아닌 이야기.',
  '감성형': '계절·날씨·냄새·소리로 분위기 전달. 읽으면 그 가게에 있는 것 같은 느낌.',
  '고객소통형': '질문이나 선택지로 마무리. 댓글 달고 싶게. "여러분은 어떠세요?"',
  '스레드감성형': '한 문장 → 줄바꿈 → 한 문장. 반전 있는 날것의 자영업 이야기. 해시태그 없음. 읽다가 멈추게 되는 훅.',
}

interface LearnedEx { content_text: string | null; section: string }

export function buildThreadsPrompt(
  profile: Pick<BusinessProfile, 'brand_name' | 'business_type' | 'location' | 'brand_tone'>,
  tone: ContentTone,
  recentCaptions: string[],
  contextNote?: string,
  competitorHashtags?: string[],
  contentTips?: string[],
  learnedExamples?: LearnedEx[],
  trendSummary?: string
): string {
  const recentStr = recentCaptions.length
    ? `\n[최근 발행 글 - 반드시 다른 소재로]\n${recentCaptions.map((c, i) => `${i + 1}. ${c}`).join('\n')}`
    : ''

  const learnedStr = learnedExamples?.length
    ? `\n[직접 학습시킨 스타일 - 이 말투/구조를 최우선 참고]\n${learnedExamples.filter(e => e.content_text).map((e, i) => `${i + 1}. ${e.content_text}`).join('\n')}`
    : ''

  const trendStr = trendSummary
    ? `\n[오늘의 자영업 트렌드 - 이 이슈들을 소재로 활용]\n${trendSummary}`
    : ''

  const isThreadsStyle = tone === '스레드감성형'

  const styleExamples = isThreadsStyle ? `
[한국 Threads 바이럴 글 실제 예시 - 이 구조와 말투 그대로 써야 함]

예시1 (반전형):
"오늘 점심에 손님이 한명도 없었어

저녁에 웨이팅 40분

자영업은 아직도 모르겠음"

예시2 (원가 공개형):
"커피 한잔 6500원 비싸다고 하시는데

원두 650원
우유 900원
컵+뚜껑 220원
인건비 1400원
임대료 1100원
전기세 기타 300원

남은 거 1930원에서 카드 수수료 빼면

그냥 하는 거예요 저는"

예시3 (단골 이야기):
"오늘 단골손님이

"사장님 덕분에 하루가 버텨졌어요" 하고 가셨는데

이거 하나 때문에 계속하는 것 같기도 함"

예시4 (자영업 현실):
"창업 전 vs 후

전: 내 카페에서 커피 마시면서 책 읽는 내 모습
후: 설거지 설거지 설거지 설거지 설거지"

예시5 (도발형 팩폭):
"유튜브 보고 카페 창업했다는 분들

유튜브에 나오는 카페들은 이미 잘 되는 곳임
안 되는 카페는 유튜브 안 나옴

이거 알고 시작하셨나요"` : `
[한국 SNS 자영업자 글 예시 - 이 말투 참고]
예시: "비 오는 날은 손님이 줄어들 것 같았는데 오늘은 반대였어요 ㅎㅎ 따뜻한 거 찾으시는 분들이 많이 오셨나봐요 이럴 때 제일 보람차거든요"
예시: "신메뉴 개발하다가 10번 실패했는데 11번째에 드디어 됐어요. 맛있다고 하시면 그냥 눈물 날 것 같음"`

  const styleRules = isThreadsStyle
    ? `- 한 문장 쓰고 줄바꿈. 또 한 문장 쓰고 줄바꿈. 이게 핵심
- 전체 길이: 150~350자 (위 예시들처럼)
- 해시태그: 없거나 딱 1개
- 이모지: 없거나 1개 최대
- 반전, 숫자 공개, 현실 폭로, 단골 이야기, 오늘의 관찰 중 하나 선택
- 첫 문장에서 스크롤 멈추게 만들어야 함 (훅)
- "~습니다" 절대 금지. "~임" "~거든" "~더라고" "~한 것 같음" 사용`
    : `- 전체 길이: 200~350자
- 해시태그: 3~5개 별도 배열
- 이모지: 1~2개 자연스럽게
- 구어체 ("~해요" "~거든요" "~더라고요") 사용
- 홍보 문구 ("최고의", "놓치지 마세요") 절대 금지`

  return `너는 한국 ${profile.business_type} 자영업자 SNS 담당이야. 사장님이 폰으로 직접 쓴 것처럼 Threads 게시물 3개를 만들어줘.

브랜드: ${profile.brand_name} | 업종: ${profile.business_type} | 지역: ${profile.location}
톤: ${tone} — ${TONE_GUIDE[tone]}
${contextNote ? `오늘 특이사항: ${contextNote}` : ''}
${trendStr}${recentStr}${learnedStr}
${styleExamples}

[절대 하면 안 되는 것]
- "함께해요", "소중한", "행복한 하루", "최선을 다하는" 같은 뻔한 문장
- "오늘도 열심히 준비했습니다" 류의 일반적인 홍보
- 너무 짧아서 내용 없는 글 (최소 150자)
- AI가 쓴 티 나는 완벽한 문장 구조

[글쓰기 규칙]
${styleRules}
- 3개 초안이 서로 다른 포맷/소재여야 함
- 최근 발행 글과 소재 중복 금지
${competitorHashtags?.length ? `- 동종업계 트렌드 해시태그 참고: ${competitorHashtags.slice(0, 5).join(', ')}` : ''}
${contentTips?.length ? `- 콘텐츠 전략: ${contentTips[0]}` : ''}

반드시 다음 JSON 배열로만 응답 (다른 텍스트 없이):
[
  {
    "caption": "게시물 본문 (줄바꿈은 \\n으로)",
    "hashtags": ["해시태그"],
    "engagement_hook": "이 글에서 반응 유도 포인트"
  }
]`
}

export function buildFeedPrompt(
  profile: Pick<BusinessProfile, 'brand_name' | 'business_type' | 'location'>,
  tone: ContentTone,
  imageCount: number,
  learnedExamples?: LearnedEx[]
): string {
  const learnedStr = learnedExamples?.length
    ? `\n[학습된 스타일 예시 - 이 캡션 톤과 해시태그 스타일을 참고하세요]\n${learnedExamples.filter(e => e.content_text).map((e, i) => `${i + 1}. ${e.content_text}`).join('\n')}\n`
    : ''

  return `당신은 한국 소상공인이 인스타그램에 직접 올리는 글을 대신 써주는 사람입니다.

브랜드: ${profile.brand_name}
업종: ${profile.business_type}
지역: ${profile.location}
사진 수: ${imageCount}장
톤 [${tone}]: ${TONE_GUIDE[tone]}
${learnedStr}
첨부된 사진들을 분석하여 인스타그램 피드용 콘텐츠를 기획하세요.

[반드시 지켜야 할 사람 말투 규칙]
- 실제 사장님이 직접 쓴 것처럼 자연스러운 구어체로 작성
- "~합니다/~입니다" 격식체 금지 → "~해요/~거든요/~더라고요" 사용
- 홍보 티 나는 표현 금지 ("최고의", "놓치지 마세요", "지금 바로" 등)
- 캡션은 200자 이내, 자연스럽고 공감 가는 문장으로

반드시 다음 JSON 형식으로만 응답하세요:
{
  "caption": "피드 메인 캡션",
  "hashtags": ["해시태그 20개"],
  "slide_order": [0, 1, 2, ...],
  "slide_descriptions": ["각 슬라이드 설명 (순서대로)"],
  "slide_tips": "슬라이드 구성 전략 한 줄 코멘트"
}`
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
