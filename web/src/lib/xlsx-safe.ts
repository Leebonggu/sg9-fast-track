// CSV/Excel 수식 인젝션 방지 — 사용자 입력 문자열이 =, +, -, @ 로 시작하면
// 앞에 작은따옴표를 붙여 텍스트로 강제 취급되게 한다 (엑셀이 수식으로 실행하지 않도록).
export function sanitizeCell(value: unknown): string {
  const s = value == null ? '' : String(value);
  if (/^[=+\-@]/.test(s)) return `'${s}`;
  return s;
}
