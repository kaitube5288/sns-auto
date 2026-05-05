import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const section = req.nextUrl.searchParams.get('section')
  if (!section) return NextResponse.json({ error: 'section required' }, { status: 400 })

  const { data } = await supabase
    .from('learned_examples')
    .select('id, section, content_text, image_url, created_at')
    .eq('user_id', user.id)
    .eq('section', section)
    .order('created_at', { ascending: false })
    .limit(20)

  return NextResponse.json({ examples: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const contentType = req.headers.get('content-type') || ''
  let section = '', content_text: string | null = null, image_url: string | null = null

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    section = (formData.get('section') as string) || ''
    content_text = (formData.get('content_text') as string) || null
    const imageFile = formData.get('image') as File | null

    if (imageFile && imageFile.size > 0) {
      const ab = await imageFile.arrayBuffer()
      const path = `${user.id}/learn/${Date.now()}-${imageFile.name}`
      const { data: uploaded } = await supabase.storage
        .from('media')
        .upload(path, ab, { contentType: imageFile.type, upsert: true })
      if (uploaded) {
        const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path)
        image_url = publicUrl
      }
    }
  } else {
    const body = await req.json()
    section = body.section || ''
    content_text = body.content_text || null
    image_url = body.image_url || null
  }

  if (!section) return NextResponse.json({ error: 'section required' }, { status: 400 })
  if (!content_text && !image_url) return NextResponse.json({ error: '내용 또는 이미지를 입력해주세요.' }, { status: 400 })

  const { data, error } = await supabase
    .from('learned_examples')
    .insert({ user_id: user.id, section, content_text, image_url })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ example: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('learned_examples')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
