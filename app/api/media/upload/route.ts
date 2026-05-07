import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const files = formData.getAll('images') as File[]
  const contentId = formData.get('content_id') as string | null

  if (files.length === 0) return NextResponse.json({ error: '이미지를 선택해주세요.' }, { status: 400 })

  const urls: string[] = []
  for (const file of files) {
    const ab = await file.arrayBuffer()
    const path = `${user.id}/threads/${Date.now()}-${file.name}`
    const { data: uploaded } = await supabase.storage
      .from('media')
      .upload(path, ab, { contentType: file.type, upsert: true })

    if (uploaded) {
      const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path)
      urls.push(publicUrl)
    }
  }

  // 콘텐츠 레코드에 미디어 URL 업데이트
  if (contentId && urls.length > 0) {
    await supabase.from('contents').update({ media_urls: urls }).eq('id', contentId).eq('user_id', user.id)
  }

  return NextResponse.json({ urls })
}
