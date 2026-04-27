import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export type TextStyleSuggestion = {
  index: number
  fontSize: number
  fill: string
  fontWeight: 'bold' | 'normal'
  fontStyle: 'normal' | 'italic'
  textAlign: 'left' | 'center' | 'right'
  backgroundColor: string
  left: number   // center-X on canvas (0–340)
  top: number    // top-Y on canvas (0–1020)
  width: number  // text wrap width
}

// Canvas: 340px wide × 1020px tall
// left = center-X of the block (originX: center)
// top  = top-Y of the block    (originY: top)
const SYSTEM = `You are a professional Korean banner designer.
Canvas size: 340px wide × 1020px tall (portrait 9:16).

Given a list of text blocks, identify each block's role and return a FULL layout + style JSON array.
Return ONLY valid JSON array — no markdown, no explanation.

Layout zones (use these as guides):
- title:    top 130–220px  — the most prominent text
- subtitle: top 230–310px  — short badge or tagline
- body:     top 320–560px  — bullet points, details
- cta:      top 580–680px  — call to action
- footer:   top 900–970px  — org name, contact

Field rules:
- left: center-X of the block. Center-aligned text → 170. Left-aligned → 30–50. Right-aligned → 290–310.
- top: top edge Y position of the block
- width: text wrap width. Full-width center → 300. Left/right blocks → 260–280.
- fontSize: title 28–38px · subtitle 16–22px · body 13–16px · cta 18–24px · footer 11–13px
- fill: use palette — #ffffff, #1a3a6b, #1a5fb4, #2d8a4e, #cce0ff
- fontWeight: title/cta → "bold", others → "normal"
- backgroundColor: subtitle badge → "#1a5fb4", cta badge → "#2d8a4e", others → ""
- textAlign: mostly "center" for banners

Example output:
[
  {"index":0,"fontSize":34,"fill":"#1a3a6b","fontWeight":"bold","fontStyle":"normal","textAlign":"center","backgroundColor":"","left":170,"top":140,"width":300},
  {"index":1,"fontSize":18,"fill":"#ffffff","fontWeight":"bold","fontStyle":"normal","textAlign":"center","backgroundColor":"#1a5fb4","left":170,"top":240,"width":260}
]`

export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

  const { texts }: { texts: string[] } = await req.json()
  if (!texts?.length) return NextResponse.json({ error: 'No texts provided' }, { status: 400 })

  const userMsg = texts.map((t, i) => `[${i}] "${t}"`).join('\n')

  const client = new Anthropic({ apiKey: key })
  const res = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 768,
    system: SYSTEM,
    messages: [{ role: 'user', content: `Text blocks:\n${userMsg}\n\nReturn full layout+style JSON array.` }],
  })

  const raw = res.content.find((b) => b.type === 'text')?.text ?? ''
  try {
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('No JSON array found')
    const suggestions: TextStyleSuggestion[] = JSON.parse(match[0])
    return NextResponse.json({ suggestions })
  } catch {
    return NextResponse.json({ error: 'Failed to parse Claude response', raw }, { status: 500 })
  }
}
