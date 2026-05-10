import { NextRequest, NextResponse } from 'next/server'

// Meta requires a data deletion callback URL for app settings to save.
// This endpoint confirms deletion requests without processing user data.
export async function GET() {
  return NextResponse.json({ status: 'ok' })
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  // Meta sends a signed_request param; we acknowledge it without processing
  const confirmationCode = `del_${Date.now()}`
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/data-deletion?code=${confirmationCode}`
  return NextResponse.json({
    url,
    confirmation_code: confirmationCode,
  })
}
