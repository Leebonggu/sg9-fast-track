// 통합현황 메모에 자동으로 붙는 "설문 연락처(소유자명 불일치)" 안내 줄.
//
// 설문에 연락처는 있는데 응답자명이 소유자 명단에 없으면 연락처 컬럼에 자동 반영하지 않는다
// (배우자·가족일 수도, 세입자일 수도 있어 위원 확인이 필요하다).
// 그렇다고 그냥 버리면 번호가 있다는 사실 자체가 묻히므로 메모에 남겨 위원이 판단하게 한다.
//
// 매 sync마다 이전 자동 줄을 걷어내고 다시 계산한다 → 나중에 연락처가 채워지거나
// 소유자명이 정정되면 이 줄은 저절로 사라진다. 위원이 직접 쓴 메모는 건드리지 않는다.
import type { SurveyContact } from './survey-sheets';

export const SURVEY_PHONE_MARK = '[설문연락처]';

// 마커가 나오면 그 지점부터 줄 끝까지 걷어낸다. 줄 맨 앞이 아니라 앞 메모에 들러붙어 있어도
// 처리한다 — 단일행 입력 UI를 거치면 줄바꿈이 사라져 "종이:안명숙[설문연락처] …"처럼
// 한 줄로 뭉개질 수 있고, 그때도 자동 줄만 떼어내고 위원 메모는 살려야 하기 때문이다.
export function stripSurveyPhoneNote(memo: string): string {
  const kept: string[] = [];
  for (const line of memo.split('\n')) {
    const i = line.indexOf(SURVEY_PHONE_MARK);
    if (i === -1) {
      kept.push(line);
      continue;
    }
    const head = line.slice(0, i).trimEnd();
    if (head) kept.push(head); // 마커뿐이던 줄은 통째로 제거
  }
  return kept.join('\n').trim();
}

export function withSurveyPhoneNote(memo: string, unmatched: SurveyContact[]): string {
  const base = stripSurveyPhoneNote(memo);
  if (unmatched.length === 0) return base;
  const who = unmatched.map((c) => `${c.name} ${c.phone}`).join(' / ');
  const note = `${SURVEY_PHONE_MARK} ${who} (소유자명 불일치 — 확인 필요)`;
  return base ? `${base}\n${note}` : note;
}
