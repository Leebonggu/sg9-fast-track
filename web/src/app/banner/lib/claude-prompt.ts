import type { BannerContent, BannerTemplate } from './templates'

export function buildClaudeSystemPrompt(): string {
  return `You are a professional banner designer and copywriter. Given a description and optional reference image, generate banner text content AND a DALL-E image generation prompt for the background.

Return ONLY valid JSON matching this exact structure (no markdown, no explanation):
{
  "title": "main title text",
  "subtitle": "subtitle or badge text",
  "bullets": ["bullet 1", "bullet 2", "bullet 3"],
  "ctaText": "call to action text (can include newline \\n)",
  "orgName": "organization name",
  "contactInfo": "contact or location info",
  "dallePrompt": "English prompt for DALL-E to generate the banner background image"
}

Rules for text fields:
- title: 2-4 Korean words, punchy and memorable
- subtitle: short badge text (5-15 chars)
- bullets: exactly 3 items, each under 25 chars
- ctaText: action-oriented, short (include \\n for line break)
- Write in Korean unless user specifies otherwise

Rules for dallePrompt:
- Always in English
- Describe a vertical banner background photograph (9:16 portrait ratio) for a Korean apartment complex reconstruction campaign
- Photorealistic real photograph aesthetic — NOT illustration, NOT cartoon, NOT vector art
- Specify: shot with DSLR, natural lighting, slight film grain, realistic shadows, depth of field, urban Korea environment, authentic Korean high-rise apartment towers
- Describe the composition in zones (top / middle text-area / lower buildings / bottom band), colors, and mood
- Match the style/mood from the reference image if provided
- End with: "Absolutely NO text, letters, numbers, or signs anywhere in the image."
- Do NOT describe text content, only visual/photographic design elements`
}

export function buildClaudeUserPrompt(
  template: BannerTemplate,
  purpose: string,
  style: string,
  hasReferenceImage: boolean,
  currentTexts: string[] = [],
): string {
  const styleHints: Record<string, string> = {
    nature: '자연스럽고 신뢰감 있는 톤, 밝고 따뜻한 느낌, 청명한 자연 색감',
    bold: '강렬하고 긴급한 톤, 큰 임팩트, 강한 대비',
    public: '공식적이고 전문적인 톤, 신뢰감, 정부/공공기관 스타일',
  }

  const hint = styleHints[style] ?? styleHints.nature

  const textsSection = currentTexts.length > 0
    ? `현재 배너에 작성된 텍스트 (이 내용을 기반으로 문구를 다듬거나 발전시키세요):\n${currentTexts.map((t) => `"${t}"`).join('\n')}`
    : ''

  const lines = [
    hasReferenceImage
      ? '위 참고 이미지의 스타일, 색감, 분위기, 레이아웃을 분석하고 dallePrompt에 반영하세요.'
      : '',
    textsSection,
    `목적: ${purpose || '배너 홍보'}`,
    `스타일 방향: ${hint}`,
    '',
    '위 정보를 바탕으로 배너 문구와 DALL-E 배경 프롬프트를 포함한 JSON을 생성하세요.',
  ]

  return lines.filter(Boolean).join('\n')
}

export type ClaudeGeneratedBanner = BannerContent & { dallePrompt: string }

export function parseClaudeResponse(text: string): ClaudeGeneratedBanner | null {
  try {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    const parsed = JSON.parse(match[0])
    if (
      typeof parsed.title === 'string' &&
      typeof parsed.subtitle === 'string' &&
      Array.isArray(parsed.bullets) &&
      typeof parsed.ctaText === 'string' &&
      typeof parsed.dallePrompt === 'string'
    ) {
      return {
        title: parsed.title,
        subtitle: parsed.subtitle,
        bullets: parsed.bullets.slice(0, 3),
        ctaText: parsed.ctaText,
        qrUrl: parsed.qrUrl ?? '',
        orgName: parsed.orgName ?? '',
        contactInfo: parsed.contactInfo ?? '',
        dallePrompt: parsed.dallePrompt,
      }
    }
    return null
  } catch {
    return null
  }
}
