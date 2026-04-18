/** 천원 → "X억 Y만원" 형태 표시 */
export function fmtMoney(chun: number): string {
  if (chun === 0) return '0원';
  const sign = chun < 0 ? '-' : '';
  const abs = Math.abs(chun);
  const eok = Math.floor(abs / 100_000);
  const man = Math.round((abs % 100_000) / 10);

  if (eok === 0) return `${sign}${man.toLocaleString()}만원`;
  if (man === 0) return `${sign}${eok.toLocaleString()}억원`;
  return `${sign}${eok.toLocaleString()}억 ${man.toLocaleString()}만원`;
}

/** 천원 → "X억원" 간략 표시 */
export function fmtEok(chun: number): string {
  const sign = chun < 0 ? '-' : '';
  const eok = Math.abs(chun) / 100_000;
  return `${sign}${eok.toFixed(1)}억원`;
}

/** 비례율 → "108.79%" */
export function fmtRatio(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`;
}

/** 분담금 표시: 양수면 "납부", 음수면 "환급" */
export function fmtBurden(chun: number): { text: string; color: string } {
  if (chun === 0) return { text: '0원', color: 'text-gray-600' };
  if (chun > 0) return { text: `${fmtMoney(chun)} 납부`, color: 'text-red-600' };
  return { text: `${fmtMoney(-chun)} 환급`, color: 'text-blue-600' };
}

/** 숫자 → 로케일 형식 (콤마) */
export function fmtNum(n: number): string {
  return n.toLocaleString('ko-KR');
}
