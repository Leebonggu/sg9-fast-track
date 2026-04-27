import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  if (!url) {
    return NextResponse.json({ error: 'url required' }, { status: 400 })
  }

  try {
    const dataUrl = await QRCode.toDataURL(url, {
      width: 300,
      margin: 1,
      color: { dark: '#1e3a5f', light: '#ffffff' },
    })
    const base64 = dataUrl.split(',')[1]
    const buffer = Buffer.from(base64, 'base64')
    return new NextResponse(buffer, {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' },
    })
  } catch {
    return NextResponse.json({ error: 'QR generation failed' }, { status: 500 })
  }
}
