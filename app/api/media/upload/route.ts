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

  // 기존 media_urls에 추가 (덮어쓰지 않음)
  if (contentId && urls.length > 0) {
    const { data: existing } = await supabase.from('contents').select('media_urls').eq('id', contentId).eq('user_id', user.id).single()
    const merged = [...(existing?.media_urls ?? []), ...urls]
    await supabase.from('contents').update({ media_urls: merged }).eq('id', contentId).eq('user_id', user.id)
  }

  return NextResponse.json({ urls })
}
