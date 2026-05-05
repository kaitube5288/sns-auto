import type { BusinessProfile, ContentTone } from './types'

export const TONE_GUIDE: Record<ContentTone, string> = {
  '공감형': '손님의 하루와 감정에 공감하는 따뜻한 문장. "오늘 하루 어떠셨나요?" 류.',
  '밈형': '최근 인터넷 밈, MZ 유행어, 가벼운 유머 활용. 짧고 임팩트 있게.',
  '사장님형': '진정성 있는 사장님 목소리. 제품에 대한 애착과 고집이 느껴지게.',
  '감성형': '계절, 시간대, 냄새, 소리 등 감각적 묘사. 시적인 짧은 문장.',
  '고객소통형': '댓글 유도형. 선택지 제시나 질문으로 마무리. 참여 유도.',
}

export function buildThreadsPrompt(
  profile: Pick<BusinessProfile, 'brand_name' | 'business_type' | 'location' | 'brand_tone'>,
  tone: ContentTone,
  recentCaptions: string[],
  contextNote?: string
): string {
  const recentStr = recentCaptions.length
    ? `최근 발행 글 (중복 금지):\n${recentCaptions.map((c, i) => `${i + 1}. ${c}`).join('\n')}`
    : ''

  return `당신은 한국 소상공인 SNS 마케터입니다.

브랜드: ${profile.brand_name}
업종: ${profile.business_type}
지역: ${profile.location}
브랜드 톤: ${profile.brand_tone || '친근하고 따뜻한'}

톤 지침 [${tone}]: ${TONE_GUIDE[tone]}
${contextNote ? `오늘의 특이사항: ${contextNote}` : ''}
${recentStr}

위 정보를 바탕으로 Threads 게시물 초안 3개를 작성하세요.

규칙:
- 각 초안은 150자 이내
- 해시태그는 별도 배열로 제공 (3~5개)
- 이모지 2~3개 자연스럽게 포함
- 최근 발행 글과 중복되지 않게

반드시 다음 JSON 배열 형식으로만 응답하세요:
[
  {
    "caption": "게시물 본문",
    "hashtags": ["해시태그1", "해시태그2"],
    "engagement_hook": "댓글/반응 유도 포인트"
  }
]`
}

export function buildFeedPrompt(
  profile: Pick<BusinessProfile, 'brand_name' | 'business_type' | 'location'>,
  tone: ContentTone,
  imageCount: number
): string {
  return `당신은 한국 인스타그램 피드 전문 마케터입니다.

브랜드: ${profile.brand_name}
업종: ${profile.business_type}
지역: ${profile.location}
사진 수: ${imageCount}장
톤 [${tone}]: ${TONE_GUIDE[tone]}

첨부된 사진들을 분석하여 인스타그램 피드용 콘텐츠를 기획하세요.

반드시 다음 JSON 형식으로만 응답하세요:
{
  "caption": "피드 메인 캡션 (200자 이내, 감성적이고 브랜드에 맞게)",
  "hashtags": ["해시태그 20개"],
  "slide_order": [0, 1, 2, ...],
  "slide_descriptions": ["각 슬라이드 설명 (순서대로)"],
  "slide_tips": "슬라이드 구성 전략 한 줄 코멘트"
}`
}

export function buildReelsPrompt(
  profile: Pick<BusinessProfile, 'brand_name' | 'business_type' | 'location'>,
  intent: string,
  durationSec: number
): string {
  return `당신은 한국 인스타그램 릴스 기획 전문가입니다.

브랜드: ${profile.brand_name}
업종: ${profile.business_type}
지역: ${profile.location}
기획 의도: ${intent}
영상 길이: 약 ${durationSec}초

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
