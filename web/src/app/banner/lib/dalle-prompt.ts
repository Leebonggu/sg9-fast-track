import type { BannerTemplate } from './templates'

// 6 composition styles — all convey 희망(hope) · 밝음(brightness) · 같이(community)
export const STYLE_PRESETS = {
  morning_clear: `
A vertical banner background photograph: Korean apartment complex reconstruction (재건축) campaign.
Concept: CLEAR MORNING — a brand-new day, fresh start, optimistic.
Composition:
- Top 35%: crystal-clear blue sky, a few soft white clouds drifting gently, brilliant morning sunlight
- Middle 40%: smooth pale-blue-to-white gradient — clean empty zone for text overlay
- Bottom 25%: 4–5 gleaming white modern Korean high-rise towers (25+ floors) aligned in a row, bright morning sun on facades, lush green trees at base
Palette: clear sky blue, crisp white, clean fresh green
Mood: hopeful new beginning, fresh, optimistic
`.trim(),

  vast_horizon: `
A vertical banner background photograph: Korean apartment complex reconstruction (재건축) campaign.
Concept: VAST HORIZON — the scale of a better future, community standing together.
Composition:
- Top 40%: expansive wide-open blue sky, slight hazy horizon glow, vast and airy
- Middle 35%: light-sky seamless gradient — empty, clean zone for text
- Bottom 25%: wide-angle panoramic view of a large Korean apartment complex, multiple towers arranged across the full width, impressive scale, people implied by the community feel
Palette: wide open sky blue, light azure, white tower facades
Mood: expansive, grand, pride in community, looking forward
`.trim(),

  sunlit_towers: `
A vertical banner background photograph: Korean apartment complex reconstruction (재건축) campaign.
Concept: SUNLIT TOWERS — warm midday sunlight reflecting off glass and white facades, alive and vibrant.
Composition:
- Top 25%: bright blue sky with sunlight glare, energetic
- Middle 45%: soft bright gradient from light-sky blue to near white — text overlay zone
- Bottom 30%: 3–4 tall modern Korean apartment towers with glass reflecting dazzling sunlight, warm white facades, vivid and dynamic perspective from slightly below
Palette: brilliant white, sky blue, warm sunlight gold highlights
Mood: vibrant, alive, energetic optimism, we can do this
`.trim(),

  community_green: `
A vertical banner background photograph: Korean apartment complex reconstruction (재건축) campaign.
Concept: COMMUNITY & GREENERY — a thriving, liveable neighbourhood, neighbours together.
Composition:
- Top 30%: gentle light-blue sky with soft fluffy clouds, peaceful and warm
- Middle 40%: very clean light-blue gradient, open zone for text
- Bottom 30%: ground-level view of a modern Korean apartment complex with wide open plaza, lush trees, benches — a vibrant neighbourhood feel
Palette: soft blue sky, clean white buildings, rich greens, warm community feel
Mood: warm, together, liveable, communal pride
`.trim(),

  new_skyline: `
A vertical banner background photograph: Korean apartment complex reconstruction (재건축) campaign.
Concept: NEW SKYLINE — the city transformed, sleek modern towers defining a new era.
Composition:
- Top 35%: deep clear blue sky, slight atmospheric haze at horizon adding depth
- Middle 40%: smooth gradient light blue — clean empty text zone
- Bottom 25%: dramatic skyline of 5–6 tall newly-built Korean apartment towers of varying heights, clean modern architecture, early afternoon clear light
Palette: deep clear blue, light gradient, crisp white modern facades
Mood: transformation, achievement, modern pride, progress
`.trim(),

  wide_panorama: `
A vertical banner background photograph: Korean apartment complex reconstruction (재건축) campaign.
Concept: WIDE PANORAMA — a commanding bird's-eye-level wide shot, the whole community in frame.
Composition:
- Top 30%: broad clear sky, strong daylight, slight white clouds
- Middle 40%: clean pale-blue gradient zone — empty for text
- Bottom 30%: sweeping wide panorama of an entire Korean apartment complex, multiple building clusters, well-planned roads and greenery visible, sense of order and scale
Palette: blue sky, muted pastels, clean white/grey buildings
Mood: grand scale, well-planned community, inspiring, confident
`.trim(),
} as const

export type StylePresetKey = keyof typeof STYLE_PRESETS

// Fixed pairs — each pair gives visually contrasting compositions
const PAIRS: [StylePresetKey, StylePresetKey][] = [
  ['morning_clear',  'vast_horizon'],
  ['sunlit_towers',  'community_green'],
  ['new_skyline',    'wide_panorama'],
]

export function pickStylePair(seed?: number): [StylePresetKey, StylePresetKey] {
  const idx = seed !== undefined ? seed % PAIRS.length : Math.floor(Math.random() * PAIRS.length)
  return PAIRS[idx]
}

const PHOTO_REQUIREMENTS = `
Technical photography requirements:
- Photorealistic real photograph — NOT illustration, NOT cartoon, NOT vector art
- Shot with DSLR, natural lighting, slight film grain, realistic shadows and depth
- Shallow depth of field, urban Korea environment, authentic Korean high-rise architecture
- The middle section must be a smooth, relatively flat gradient — NOT busy imagery
- Portrait orientation, 9:16 aspect ratio
- NO tree branches or leaves hanging from the top of the frame
- NO people, NO humans, NO faces, NO pedestrians, NO crowd — architecture and nature only.
- CRITICAL: Absolutely NO text, letters, numbers, words, or signs anywhere. Zero text.
`.trim()

export function buildDallePrompt(
  template: BannerTemplate,
  styleKey: StylePresetKey | string,
  referenceStyleHint = '',
  currentTexts: string[] = [],
  purpose = '',
): string {
  const styleDesc = STYLE_PRESETS[styleKey as StylePresetKey] ?? STYLE_PRESETS.morning_clear
  const hintText = referenceStyleHint ? `\nStyle reference from provided image: ${referenceStyleHint}` : ''
  const purposeHint = purpose ? `\nCampaign context: "${purpose}" — let this inform the atmosphere.` : ''
  const textsHint = currentTexts.length > 0
    ? `\nBanner text context (atmosphere only — do NOT render any text):\n${currentTexts.map((t) => `- ${t}`).join('\n')}`
    : ''

  return `${styleDesc}${purposeHint}${hintText}${textsHint}

${PHOTO_REQUIREMENTS}
- ${template.dalleStyleHint ?? ''}`
}
