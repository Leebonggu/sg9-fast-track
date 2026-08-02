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
