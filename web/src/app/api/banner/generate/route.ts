import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { getTemplate } from '@/app/banner/lib/templates'
import { buildDallePrompt, pickStylePair } from '@/app/banner/lib/dalle-prompt'
import {
  buildClaudeSystemPrompt,
  buildClaudeUserPrompt,
  parseClaudeResponse,
} from '@/app/banner/lib/claude-prompt'

const CLAUDE_MODELS = ['claude-opus-4-7', 'claude-haiku-4-5'] as const
type ClaudeModel = (typeof CLAUDE_MODELS)[number]

function isClaudeModel(m: string): m is ClaudeModel {
  return CLAUDE_MODELS.includes(m as ClaudeModel)
}

async function generateDalleBackground(prompt: string, openaiKey: string): Promise<string | null> {
  const openai = new OpenAI({ apiKey: openaiKey })
  const result = await openai.images.generate({
    model: 'dall-e-3',
    prompt,
    n: 1,
    size: '1024x1792',
    quality: 'hd',
    response_format: 'b64_json',
  })
  const b64 = result.data?.[0]?.b64_json
  if (!b64) return null
  return `data:image/png;base64,${b64}`
}

export async function POST(request: NextRequest) {
  let body: {
    model?: string
    templateId?: string
    style?: string
    purpose?: string
    referenceImageBase64?: string
    currentTexts?: string[]
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const model = body.model ?? 'dall-e-3'
  const templateId = body.templateId ?? 'custom'
  const style = body.style ?? 'nature'
  const purpose = body.purpose ?? ''
  const referenceImageBase64 = body.referenceImageBase64
  const currentTexts = body.currentTexts ?? []
  const template = getTemplate(templateId)

  // ── Claude path: text + DALL-E background ────────────────────────────────
  if (isClaudeModel(model)) {
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

    try {
      const anthropic = new Anthropic({ apiKey: anthropicKey })
      const hasImage = !!referenceImageBase64

      const userContent: Anthropic.MessageParam['content'] = []

      if (hasImage) {
        const match = referenceImageBase64!.match(/^data:(image\/\w+);base64,(.+)$/)
        if (match) {
          userContent.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: match[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: match[2],
            },
          })
        }
      }

      userContent.push({
        type: 'text',
        text: buildClaudeUserPrompt(template, purpose, style, hasImage, currentTexts),
      })

      const claudeRes = await anthropic.messages.create({
        model,
        max_tokens: 1024,
        system: buildClaudeSystemPrompt(),
        messages: [{ role: 'user', content: userContent }],
      })

      const textBlock = claudeRes.content.find((b) => b.type === 'text')
      const rawText = textBlock?.type === 'text' ? textBlock.text : ''
      const generated = parseClaudeResponse(rawText)

      if (!generated) {
        return NextResponse.json({ error: 'Failed to parse Claude response', raw: rawText }, { status: 500 })
      }

      generated.qrUrl = generated.qrUrl || template.defaultContent.qrUrl

      const openaiKey = process.env.OPENAI_API_KEY
      let imageUrl: string | null = null

      if (openaiKey) {
        try {
          imageUrl = await generateDalleBackground(generated.dallePrompt, openaiKey)
        } catch {
          // Background generation failed — return content only (non-fatal)
        }
      }

      const { dallePrompt: _, ...content } = generated
      return NextResponse.json({ content, imageUrl, model })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  // ── Image generation path (gpt-image-1, dall-e-3, dall-e-2) ──────────────
  const openaiKey = process.env.OPENAI_API_KEY
  if (!openaiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })
  }

  // Reference image: use GPT-4o mini vision to extract style hint for prompt
  let referenceStyleHint = ''
  if (referenceImageBase64) {
    try {
      const openai = new OpenAI({ apiKey: openaiKey })
      const vision = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 80,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: referenceImageBase64, detail: 'low' } },
            { type: 'text', text: 'Describe the visual style, color palette, and mood of this image in 1-2 sentences for use as a design reference.' },
          ],
        }],
      })
      referenceStyleHint = vision.choices[0]?.message?.content?.trim() ?? ''
    } catch { /* non-fatal */ }
  }

  const [styleA, styleB] = pickStylePair()
  const promptA = buildDallePrompt(template, styleA, referenceStyleHint, currentTexts, purpose)
  const promptB = buildDallePrompt(template, styleB, referenceStyleHint, currentTexts, purpose)
  const openai = new OpenAI({ apiKey: openaiKey })

  async function generateOne(prompt: string): Promise<string | null> {
    try {
      if (model === 'gpt-image-1') {
        const r = await openai.images.generate({ model: 'gpt-image-1', prompt, n: 1, size: '1024x1536', quality: 'high' })
        const b64 = r.data?.[0]?.b64_json
        return b64 ? `data:image/png;base64,${b64}` : null
      }
      const dalleModel = model === 'dall-e-2' ? 'dall-e-2' : 'dall-e-3'
      const params = dalleModel === 'dall-e-3'
        ? { model: 'dall-e-3' as const, prompt, n: 1, size: '1024x1792' as const, quality: 'hd' as const, response_format: 'b64_json' as const }
        : { model: 'dall-e-2' as const, prompt, n: 1, size: '1024x1024' as const, response_format: 'b64_json' as const }
      const r = await openai.images.generate(params)
      const b64 = r.data?.[0]?.b64_json
      return b64 ? `data:image/png;base64,${b64}` : null
    } catch { return null }
  }

  try {
    const [urlA, urlB] = await Promise.all([generateOne(promptA), generateOne(promptB)])
    const imageUrls = [urlA, urlB].filter(Boolean) as string[]
    if (!imageUrls.length) return NextResponse.json({ error: 'Image generation failed' }, { status: 500 })
    return NextResponse.json({ imageUrls, model })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
