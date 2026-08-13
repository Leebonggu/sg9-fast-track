// web/src/lib/econsent-sheets.ts
// 「전자동의원본」 시트 read/write와 업로드 간 전이 이력(「전자동의변경로그」) 기록.
//
// 임포터가 쓰는 시트는 이 두 개뿐이다. 통합현황·원본·변경로그에는 쓰지 않는다.
// 전자동의 값이 통합현황에 올라가는 경로는 syncMasterSheet() 하나뿐이고, 거기서
// 매번 재계산되는 파생값이다. 그래서 판정 규칙이 바뀌어도 재업로드가 필요 없다.
import { getOwnerDoc, appendChangeLog } from './owner-sheets';
import { aggregateHouseholds } from './econsent-parser';
import { sanitizeCell } from './xlsx-safe';
import type {
  EconsentHousehold, EconsentOwnerRow, PlanChoice, RepStatus, SubmitStatus,
} from './econsent-types';

const RAW_SHEET = '전자동의원본';
const LOG_SHEET = '전자동의변경로그';

const RAW_HEADERS = [
  '동', '호수', '연번', '이름', '생년월일', '연락처', '소유구분', '대표자여부',
  '신통_제출상태', '신통_제출일시', '입안_제출상태', '입안_제출일시', '입안_선택항목',
  '업로드일시',
];

const LOG_HEADERS = ['시각', '동', '호수', '이름', '필드', '이전값', '새값', '업로드배치', '업로더'];

// 전이 이력에 남기는 필드. 세대 단위인 '소유자명단'만 성격이 다르다(§소유권 이전 감지).
export interface EconsentChange {
  dong: string;
  ho: string;
  name: string;
  field: string;
  oldValue: string;
  newValue: string;
}

/**
 * 직전 업로드 스냅샷을 읽는다. 시트가 아직 없으면 null — 첫 업로드다.
 *
 * 시트가 있는데 읽기가 실패하면 throw한다. 여기서 빈 배열을 돌려주면 diff가
 * "전부 신규"로 나와 900여 행이 로그에 쏟아지고, 진짜 변경이 그 안에 묻힌다.
 */
export async function readRawOwners(): Promise<EconsentOwnerRow[] | null> {
  const doc = await getOwnerDoc();
  const sheet = doc.sheetsByTitle[RAW_SHEET];
  if (!sheet) return null;

  const rows = await sheet.getRows();
  return rows.map((r) => ({
    dong: String(r.get('동') || ''),
    ho: String(r.get('호수') || ''),
    seq: String(r.get('연번') || ''),
    name: String(r.get('이름') || ''),
    birth: String(r.get('생년월일') || ''),
    phone: String(r.get('연락처') || ''),
    ownership: String(r.get('소유구분') || ''),
    repStatus: String(r.get('대표자여부') || '') as RepStatus,
    sintoStatus: String(r.get('신통_제출상태') || '') as SubmitStatus,
    sintoSubmittedAt: String(r.get('신통_제출일시') || ''),
    planStatus: String(r.get('입안_제출상태') || '') as SubmitStatus,
    planSubmittedAt: String(r.get('입안_제출일시') || ''),
    planChoice: String(r.get('입안_선택항목') || '') as PlanChoice,
  }));
}

/**
 * sync가 쓰는 세대 집계. 시트가 아직 없으면(전자동의 업로드 전) 빈 맵 — 이때만 정상이다.
 *
 * 그 외의 읽기 실패는 readRawOwners가 그대로 던진다. 여기서 catch해 빈 맵을 돌려주면
 * sync가 그대로 진행돼 통합현황의 전자동의 6컬럼이 통째로 빈칸으로 덮인다
 * (getMasterPreservation이 실패를 던지는 것과 같은 이유).
 */
export async function getEconsentHouseholds(): Promise<Map<string, EconsentHousehold>> {
  const owners = await readRawOwners();
  if (owners === null) return new Map();
  return aggregateHouseholds(owners);
}

/** 「전자동의원본」 전체 overwrite. 시트가 없으면 만든다. */
export async function writeRawOwners(owners: EconsentOwnerRow[], uploadedAt: string): Promise<void> {
  const doc = await getOwnerDoc();
  let sheet = doc.sheetsByTitle[RAW_SHEET];
  if (!sheet) {
    sheet = await doc.addSheet({ title: RAW_SHEET, headerValues: RAW_HEADERS });
  } else {
    await sheet.clear();
    await sheet.setHeaderRow(RAW_HEADERS);
  }

  const data = owners.map((o) => ({
    동: o.dong,
    호수: o.ho,
    연번: sanitizeCell(o.seq), // "2795-1" 형태라 앞에 -가 오면 엑셀이 수식으로 읽는다
    이름: sanitizeCell(o.name),
    생년월일: o.birth,
    연락처: sanitizeCell(o.phone),
    소유구분: o.ownership,
    대표자여부: o.repStatus,
    신통_제출상태: o.sintoStatus,
    신통_제출일시: o.sintoSubmittedAt,
    입안_제출상태: o.planStatus,
    입안_제출일시: o.planSubmittedAt,
    입안_선택항목: o.planChoice,
    업로드일시: uploadedAt,
  }));

  for (let i = 0; i < data.length; i += 500) {
    await sheet.addRows(data.slice(i, i + 500));
  }
}

// 소유자 단위 추적 필드. 무명 행은 비교할 값이 없으므로 키에서 제외된다.
const OWNER_FIELDS: { field: string; get: (o: EconsentOwnerRow) => string }[] = [
  { field: '신통_제출상태', get: (o) => o.sintoStatus },
  { field: '입안_제출상태', get: (o) => o.planStatus },
  { field: '입안_선택항목', get: (o) => o.planChoice },
  { field: '대표자여부', get: (o) => o.repStatus },
  { field: '연락처', get: (o) => o.phone },
];

const ownerKey = (o: EconsentOwnerRow) => `${o.dong}-${o.ho}-${o.name}`;
const houseKey = (o: EconsentOwnerRow) => `${o.dong}-${o.ho}`;

function groupNames(owners: EconsentOwnerRow[]): Map<string, string> {
  const m = new Map<string, string[]>();
  for (const o of owners) {
    if (!o.name) continue;
    const list = m.get(houseKey(o));
    if (list) list.push(o.name);
    else m.set(houseKey(o), [o.name]);
  }
  // 정렬해서 담는다 — 명부의 행 순서가 바뀐 것을 소유권 이전으로 오인하면 안 된다.
  return new Map([...m].map(([k, names]) => [k, [...names].sort().join(', ')]));
}

/**
 * 직전 스냅샷 대비 변경분을 뽑는다.
 *
 * 소유자명단만 세대 단위로 비교한다. 공유자가 늘거나 줄면 소유자 행 자체가 사라져
 * 행 단위로는 "삭제 + 추가"로 보이는데, 세대로 묶어야
 * `901-503 [류지민] → [강민규, 김채리]` 한 줄로 읽힌다.
 */
export function diffOwners(prev: EconsentOwnerRow[], next: EconsentOwnerRow[]): EconsentChange[] {
  const changes: EconsentChange[] = [];

  const prevByOwner = new Map(prev.filter((o) => o.name).map((o) => [ownerKey(o), o]));
  for (const o of next) {
    if (!o.name) continue;
    const before = prevByOwner.get(ownerKey(o));
    if (!before) continue; // 신규 소유자는 아래 소유자명단 비교에서 세대 단위로 잡힌다
    for (const { field, get } of OWNER_FIELDS) {
      const oldValue = get(before);
      const newValue = get(o);
      if (oldValue !== newValue) {
        changes.push({ dong: o.dong, ho: o.ho, name: o.name, field, oldValue, newValue });
      }
    }
  }

  const prevNames = groupNames(prev);
  const nextNames = groupNames(next);
  for (const [key, newValue] of nextNames) {
    const oldValue = prevNames.get(key);
    if (oldValue === undefined || oldValue === newValue) continue;
    const [dong, ho] = key.split('-');
    changes.push({ dong, ho, name: '', field: '소유자명단', oldValue, newValue });
  }

  return changes;
}

/**
 * 전이 이력 append. 변경이 0건이어도 배치 요약 1행은 반드시 남긴다 —
 * 언제 누가 어떤 파일을 올렸는지가 감사 가능해야 하고, 같은 파일 중복 업로드도 여기서 드러난다.
 *
 * 첫 업로드(prev 없음)는 요약만 남긴다. 비교 대상이 없어 전부를 "변경"으로 기록하면
 * 로그가 baseline 노이즈로 시작한다.
 */
export async function logEconsentBatch(
  changes: EconsentChange[],
  batchId: string,
  uploader: string,
  summary: string,
): Promise<void> {
  const doc = await getOwnerDoc();
  const rows = [
    {
      동: '', 호수: '', 이름: '',
      필드: '(업로드)',
      이전값: '',
      새값: summary,
      업로드배치: batchId,
      업로더: sanitizeCell(uploader),
    },
    ...changes.map((c) => ({
      동: c.dong,
      호수: c.ho,
      이름: sanitizeCell(c.name),
      필드: c.field,
      이전값: sanitizeCell(c.oldValue),
      새값: sanitizeCell(c.newValue),
      업로드배치: batchId,
      업로더: sanitizeCell(uploader),
    })),
  ];
  await appendChangeLog(doc, rows, { title: LOG_SHEET, headers: LOG_HEADERS });
}
