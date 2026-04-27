import { NextRequest, NextResponse } from 'next/server'

// Strip markdown formatting to plain text
function stripMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, '')      // headings
    .replace(/\*\*(.+?)\*\*/g, '$1')  // bold
    .replace(/\*(.+?)\*/g, '$1')      // italic
    .replace(/~~(.+?)~~/g, '$1')      // strikethrough
    .replace(/`{1,3}[^`]*`{1,3}/g, '') // inline code / code blocks
    .replace(/^\s*[-*+]\s+/gm, '')    // unordered lists
    .replace(/^\s*\d+\.\s+/gm, '')    // ordered lists
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // links
    .replace(/!\[.*?\]\(.+?\)/g, '')  // images
    .replace(/^>\s+/gm, '')           // blockquotes
    .replace(/^-{3,}$/gm, '')         // hr
    .replace(/\n{3,}/g, '\n\n')       // collapse excess newlines
    .trim()
}

// Extract text from HWPX (zip-based XML format)
async function extractHwpx(buffer: Buffer): Promise<string> {
  const JSZip = (await import('jszip')).default
  const zip = await JSZip.loadAsync(buffer)

  // HWPX main content file
  const candidates = ['word/document.xml', 'Contents/content.hml', 'word/content.xml']
  let xmlContent = ''

  for (const path of candidates) {
    const file = zip.file(path)
    if (file) {
      xmlContent = await file.async('text')
      break
    }
  }

  // Fallback: search for any XML with hp:t or text content
  if (!xmlContent) {
    for (const [, file] of Object.entries(zip.files)) {
      if (file.name.endsWith('.xml') && !file.dir) {
        const content = await file.async('text')
        if (content.includes('hp:t') || content.includes('<t>')) {
          xmlContent = content
          break
        }
      }
    }
  }

  if (!xmlContent) return ''

  // Extract text from XML tags: <hp:t>, <t>, <a:t>
  const matches = xmlContent.match(/<(?:hp:t|t|a:t)[^>]*>([^<]*)<\/(?:hp:t|t|a:t)>/g) ?? []
  const lines = matches
    .map((m) => m.replace(/<[^>]+>/g, '').trim())
    .filter(Boolean)

  return lines.join('\n')
}

export async function POST(request: NextRequest) {
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    let text = ''

    if (ext === 'txt') {
      text = buffer.toString('utf-8')

    } else if (ext === 'md') {
      text = stripMarkdown(buffer.toString('utf-8'))

    } else if (ext === 'pdf') {
      // dynamic import avoids Next.js edge runtime issues with pdf-parse
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>
      const result = await pdfParse(buffer)
      text = result.text

    } else if (ext === 'hwpx' || ext === 'hwp') {
      text = await extractHwpx(buffer)

    } else {
      return NextResponse.json({ error: `지원하지 않는 파일 형식: .${ext}` }, { status: 400 })
    }

    return NextResponse.json({ text: text.trim() })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: `텍스트 추출 실패: ${message}` }, { status: 500 })
  }
}
