export type BannerContent = {
  title: string
  subtitle: string
  bullets: string[]
  ctaText: string
  qrUrl: string
  orgName: string
  contactInfo: string
}

export type BannerTemplate = {
  id: string
  name: string
  dalleStyleHint: string
  defaultContent: BannerContent
}

// 새 템플릿 추가: TEMPLATES 배열에 항목 추가 후 TemplateSelector에 자동 반영
export const TEMPLATES: BannerTemplate[] = [
  {
    id: 'custom',
    name: '빈 템플릿',
    dalleStyleHint: 'modern professional design',
    defaultContent: {
      title: '배너 제목',
      subtitle: '부제목',
      bullets: ['첫 번째 항목', '두 번째 항목', '세 번째 항목'],
      ctaText: '지금 QR찍고\n바로 확인하세요!',
      qrUrl: '',
      orgName: '주최 기관명',
      contactInfo: '연락처 / 접수처',
    },
  },
  {
    id: 'sangga',
    name: '입간판 — 상가앞',
    dalleStyleHint: 'focus on consent form collection and community participation',
    defaultContent: {
      title: '상계9단지 재건축',
      subtitle: '신속통합자문 추진 중',
      bullets: [
        '이미 많은 주민들이 함께하고 있습니다',
        '인근 단지, 신속통합자문 추진 완료',
        '1분이면 참여할 수 있습니다',
      ],
      ctaText: '지금 QR찍고\n바로 확인하세요!',
      qrUrl: 'https://sg9.vercel.app',
      orgName: '상계9단지 재건축 추진준비위원회',
      contactInfo: '동의서 접수처: 경성부동산 / 국제부동산 / 금호부동산',
    },
  },
  {
    id: 'entrance',
    name: '입간판 — 주출입곳',
    dalleStyleHint: 'focus on survey participation and quick QR scan action',
    defaultContent: {
      title: '상계9단지 재건축',
      subtitle: '선호도 설문조사 중',
      bullets: [
        '새 아파트 몇 평에 살고 싶어?',
        '30초면 완료 (온라인/오프라인)',
        '핸드폰으로 QR찍으면 바로 참여',
      ],
      ctaText: '지금 QR찍고\n바로 확인하세요!',
      qrUrl: 'https://sg9.vercel.app/survey/survey-001',
      orgName: '상계9단지 재건축 추진준비위원회',
      contactInfo: '오프라인 접수처: 경성부동산 / 국제부동산 / 금호부동산',
    },
  },
]

export function getTemplate(id: string): BannerTemplate {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0]
}
