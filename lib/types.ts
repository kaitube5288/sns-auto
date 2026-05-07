export type Platform = 'instagram' | 'threads' | 'both'
export type ContentType = 'threads_text' | 'feed' | 'reels'
export type ContentStatus = 'draft' | 'confirmed' | 'scheduled' | 'publishing' | 'published' | 'failed'
export type ContentTone = '공감형' | '밈형' | '사장님형' | '감성형' | '고객소통형' | '스레드감성형'

export interface MetaAccount {
  id: string
  user_id: string
  instagram_user_id: string | null
  instagram_username: string | null
  instagram_access_token: string | null
  instagram_token_expires_at: string | null
  instagram_connected: boolean
  threads_user_id: string | null
  threads_username: string | null
  threads_access_token: string | null
  threads_token_expires_at: string | null
  threads_connected: boolean
  facebook_page_id: string | null
  created_at: string
}

export interface BusinessProfile {
  id: string
  user_id: string
  brand_name: string
  business_type: string
  location: string
  sub_category: string | null
  target_audience: string | null
  brand_tone: string | null
  competitor_hashtags: string[] | null
  analysis_result: BusinessAnalysis | null
  analysis_updated_at: string | null
}

export interface BusinessAnalysis {
  positioning: string
  target_summary: string
  recommended_hashtags: string[]
  content_tips: string[]
  competitor_patterns: string[]
}

export interface Content {
  id: string
  user_id: string
  platform: Platform
  content_type: ContentType
  tone: ContentTone | null
  caption: string | null
  hashtags: string[] | null
  media_urls: string[] | null
  media_order: MediaOrderItem[] | null
  reels_plan: ReelsPlan | null
  status: ContentStatus
  scheduled_at: string | null
  published_at: string | null
  instagram_post_id: string | null
  threads_post_id: string | null
  publish_error: string | null
  retry_count: number
  created_at: string
}

export interface MediaOrderItem {
  index: number
  url: string
  description: string
}

export interface ReelsCut {
  start_sec: number
  end_sec: number
  scene: string
  subtitle: string
  effect?: string
}

export interface ReelsPlan {
  hook: string
  cuts: ReelsCut[]
  bgm_suggestions: BgmSuggestion[]
  cta: string
}

export interface BgmSuggestion {
  mood: string
  genre: string
  example: string
}

export interface PostAnalytics {
  id: string
  user_id: string
  content_id: string | null
  platform: Platform
  post_id: string
  impressions: number
  reach: number
  likes: number
  comments: number
  saves: number
  save_rate: number | null
  engagement_rate: number | null
  ai_insight: string | null
  synced_at: string
}

export interface ThreadsDraft {
  tone?: string
  caption: string
  hashtags: string[]
  engagement_hook: string
}

export interface FeedDraft {
  caption: string
  hashtags: string[]
  slide_order: number[]
  slide_descriptions: string[]
}
