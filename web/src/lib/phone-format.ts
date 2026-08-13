export interface Contact {
  name: string;   // 병기된 응답자명, 없으면 ''
  number: string; // 정규화된 번호
}

// 통합현황 `연락처`에는 두 형태가 섞여 있다:
//   v2 동의서에서 온 순수 번호        "010-1234-5678"
//   설문에서 온 응답자명 병기          "나영선 010-2150-9054"
//   여러 명이면 ' / '로 이어짐         "김원배 010-… / 김회영 010-…"
// 실측(2026-08-13) 1,208세대 중 1,201건이 이름 병기 형태다.
//
// 한 줄에 이름과 번호를 같이 그리면 인쇄물에서 셀을 넘쳐 글자가 겹친다.
// 번호가 통째로 보이는 게 최우선이라 분리해서 각자 줄을 주려고 쪼갠다.
export function splitContacts(raw: string): Contact[] {
  return raw
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => {
      const tokens = part.split(/\s+/);
      const last = tokens[tokens.length - 1];
      // 마지막 토큰에 숫자가 있으면 그게 번호, 앞쪽은 전부 이름으로 본다
      if (/\d/.test(last)) {
        return {
          name: tokens.slice(0, -1).join(' '),
          number: normalizePhone(last),
        };
      }
      return { name: part, number: '' };
    });
}

export function isValidPhone(v: string): boolean {
  const digits = v.replace(/[^0-9]/g, '');
  return digits.length >= 9 && digits.length <= 11;
}

// 이 단지 연락처는 전부 휴대폰 번호다.
// 시트가 번호를 숫자로 저장하면 선행 0이 날아가 "1026302685"(10자리)가 된다.
// 선행 0이 날아간 휴대폰은 항상 1로 시작하므로(01X → 1XX) 그 경우만 0을 복원한다.
// 휴대폰으로 판단되지 않는 형태는 건드리지 않고 원본을 그대로 돌려준다.
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/[^0-9]/g, '');
  if (!digits) return trimmed;
  const restored =
    digits.length === 10 && digits.startsWith('1') ? `0${digits}` : digits;
  if (restored.length === 11 && restored.startsWith('01')) {
    return `${restored.slice(0, 3)}-${restored.slice(3, 7)}-${restored.slice(7)}`;
  }
  return trimmed;
}
