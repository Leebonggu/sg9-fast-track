import { BUILDING_CONFIG } from './buildings';

const VALID_DONG = new Set(Object.keys(BUILDING_CONFIG).map((k) => k.replace('동', '')));

// 문자열에서 숫자만 추출해 앞 3자리를 동(901~923 검증), 나머지(1~4자리)를 호수로 해석.
// 은행 송금 메모는 자유 텍스트라 구분자가 계속 늘어나므로(동/호, /, -, _, 공백 등)
// 구분자 자체를 파싱하지 않고 숫자만 뽑아내는 방식으로 대부분의 형식을 흡수한다.
export function extractDongHo(text: string): { dong: string; ho: string } | null {
  if (!text) return null;
  const digits = String(text).replace(/[^0-9]/g, '');
  if (digits.length < 4 || digits.length > 7) return null;
  const dong = digits.slice(0, 3);
  const ho = digits.slice(3);
  if (!VALID_DONG.has(dong)) return null;
  if (ho.length < 1 || ho.length > 4) return null;
  return { dong, ho };
}

export type ParseSource = 'memo' | 'sender' | 'fail';

export interface ParsedDongHo {
  dong: string;
  ho: string;
  source: ParseSource;
}

// 은행 UI가 보낸분 이름을 표시글자수 제한으로 잘라내는 경우가 있어(2026-07-02 실측 6건)
// memo가 있고 유효하게 파싱되면 memo를 우선한다. memo도 100% 정확하진 않지만
// sender보다는 사람이 사후에 확인해서 채워넣은 값일 가능성이 높다.
export function parseTransactionRow(sender: string, memo: string): ParsedDongHo {
  const fromMemo = memo ? extractDongHo(memo) : null;
  if (fromMemo) return { ...fromMemo, source: 'memo' };
  const fromSender = extractDongHo(sender);
  if (fromSender) return { ...fromSender, source: 'sender' };
  return { dong: '', ho: '', source: 'fail' };
}
