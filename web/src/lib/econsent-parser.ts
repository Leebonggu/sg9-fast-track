// 전자동의서 대상자관리 xlsx 2종(신속통합 / 정비계획입안) → 소유자 행 + 세대 집계.
//
// 순수 함수다. 네트워크·시트 접근이 없어 파싱 규칙만 단독으로 검증할 수 있고,
// 판정 규칙이 바뀌어도 재업로드 없이 raw 시트만 다시 접으면 된다.
import * as XLSX from 'xlsx';
import { normalizePhone } from './phone-format';
import type {
  EconsentHousehold,
  EconsentOwnerRow,
  EconsentParseResult,
  HouseholdConsent,
  PlanChoice,
  RepStatus,
  SubmitStatus,
} from './econsent-types';

const SHEET_NAME = '전자 동의서 대상자 관리 내역';
// 정비계획입안 파일에만 있는 컬럼 — 두 파일을 구분하는 유일한 구조적 표식이다.
const PLAN_CHOICE_COLUMN = '선택 항목';
const PHONE_PATTERN = /^\d{2,3}-\d{3,4}-\d{4}$/;
const BIRTH_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const SUBMIT_STATUSES: readonly string[] = ['미제출', '전자동의', '서면동의(직접)', ''];
const REP_STATUSES: readonly string[] = ['', '대표', '위임', '미선임'];
const PLAN_CHOICES: readonly string[] = ['', '추진위원회 구성', '직접조합설립'];

type RawRow = Record<string, string>;

const cell = (row: RawRow, key: string) => String(row[key] ?? '').trim();

// 원본에 없던 값이 새로 등장하면(예: 제출상태에 '철회' 추가) 판정 규칙이 조용히 어긋난다.
// 행마다 경고를 쌓으면 3천 줄이 되므로 컬럼별로 처음 본 값만 모았다가 한 번씩 알린다.
class UnknownValueTracker {
  private seen = new Map<string, Set<string>>();

  check<T extends string>(column: string, value: string, allowed: readonly string[]): T {
    if (!allowed.includes(value)) {
      const set = this.seen.get(column) ?? new Set<string>();
      set.add(value);
      this.seen.set(column, set);
    }
    return value as T;
  }

  flush(warnings: string[]) {
    for (const [column, values] of this.seen) {
      warnings.push(
        `'${column}' 컬럼에 알려지지 않은 값이 있습니다: ${[...values].map((v) => `'${v}'`).join(', ')}. 판정 규칙 확인이 필요합니다.`,
      );
    }
  }
}

function readRoster(buf: Buffer, label: string, warnings: string[]): RawRow[] {
  const wb = XLSX.read(buf, { type: 'buffer' });
  let sheetName = SHEET_NAME;
  if (!wb.Sheets[sheetName]) {
    sheetName = wb.SheetNames[0];
    warnings.push(`${label}: '${SHEET_NAME}' 시트가 없어 첫 시트 '${sheetName}'를 사용했습니다.`);
  }
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`${label} 파일에서 읽을 수 있는 시트를 찾지 못했습니다.`);
  // raw:false — 제출일시·생년월일이 엑셀 시리얼 숫자로 변하는 걸 막는다.
  // defval:'' — 빈 셀에도 키가 생겨 아래 컬럼 존재 검사가 성립한다.
  return XLSX.utils.sheet_to_json<RawRow>(ws, { raw: false, defval: '' });
}

// 만 나이. 생일이 아직 안 지났으면 1을 뺀다.
function ageOn(birth: string, today: Date): number {
  const [y, m, d] = birth.split('-').map(Number);
  let age = today.getFullYear() - y;
  const month = today.getMonth() + 1;
  if (month < m || (month === m && today.getDate() < d)) age -= 1;
  return age;
}

// 연령대 표기는 `unified-utils.ts`의 AGE_GROUP_OPTIONS와 같은 문자열이어야 한다.
// 통합현황에서 위원이 입력한 `연령대`와 명부 파생 `연령대_명부`를 `A || B`로 겹쳐 쓰기 때문에,
// 표기가 하나라도 어긋나면 같은 세대가 두 구간으로 갈린다.
// 선택지에 10대가 없어 20세 미만은 미지정('')으로 둔다 (2026-08-10 명부 기준 해당 없음).
function ageGroupOf(birth: string, today: Date): string {
  const age = ageOn(birth, today);
  if (age < 20) return '';
  if (age >= 90) return '90대 이상';
  return `${Math.floor(age / 10) * 10}대`;
}

const isSubmitted = (status: SubmitStatus) => status !== '' && status !== '미제출';

// 세대 판정: 제출 0명 → 미제출, 전원 → 완전, 그 외(공유자 일부만 서명) → 일부
function judgeHousehold(total: number, submitted: number): HouseholdConsent {
  if (submitted === 0) return '';
  return submitted === total ? '완전' : '일부';
}

// 세대 내 첫 유효 연락처. 시트가 번호를 숫자로 저장해 선행 0이 날아간 경우는
// normalizePhone이 되살리고, 그래도 형식이 안 맞으면 버린다(2026-08-10 명부 1건: '0105686').
function resolvePhone(list: EconsentOwnerRow[], key: string, warnings: string[]): string {
  for (const owner of list) {
    if (!owner.phone) continue;
    if (PHONE_PATTERN.test(owner.phone)) return owner.phone;
    const fixed = normalizePhone(owner.phone);
    if (PHONE_PATTERN.test(fixed)) return fixed;
    warnings.push(`${key}: 연락처 '${owner.phone}' 형식이 맞지 않아 사용하지 않습니다.`);
  }
  return '';
}

// 세대 내 최연장자 기준. 명부에 소유자별 연령이 섞여 있을 때 세대를 대표하는 값으로는
// 실제 의사결정권자에 가까운 최연장자가 낫다는 판단.
function resolveAgeGroup(
  list: EconsentOwnerRow[],
  key: string,
  today: Date,
  warnings: string[],
): string {
  const births: string[] = [];
  for (const owner of list) {
    if (!owner.birth) continue;
    if (BIRTH_PATTERN.test(owner.birth)) births.push(owner.birth);
    else warnings.push(`${key}: 생년월일 '${owner.birth}' 형식을 해석할 수 없어 연령대에서 제외했습니다.`);
  }
  if (births.length === 0) return '';
  const oldest = births.sort()[0];
  const group = ageGroupOf(oldest, today);
  if (!group) {
    warnings.push(`${key}: 최연장자 생년월일 ${oldest} 기준 연령이 연령대 선택지(20대~90대 이상) 밖이라 미지정으로 둡니다.`);
  }
  return group;
}

/**
 * 두 파일을 병합해 소유자 행과 세대 집계를 만든다.
 *
 * 두 파일은 같은 명부에서 뽑혀 행 순서까지 동일하므로 인덱스로 병합한다. 다만 위원이
 * 파일을 거꾸로 올리거나 다른 회차 명부를 섞어 올릴 수 있어, 병합 전에 행 수·고유 컬럼·
 * 행별 동/호수/이름을 모두 검증하고 하나라도 어긋나면 즉시 throw한다. 잘못 병합된 명부가
 * raw 시트를 덮으면 어느 세대가 언제 동의했는지 복구할 방법이 없다.
 *
 * @param today 연령대 계산 기준일. 테스트 재현성을 위해 주입 가능하게 열어둔다.
 */
export function parseEconsentFiles(
  sintoBuf: Buffer,
  planBuf: Buffer,
  today: Date = new Date(),
): EconsentParseResult {
  const warnings: string[] = [];
  const sintoRows = readRoster(sintoBuf, '신속통합', warnings);
  const planRows = readRoster(planBuf, '정비계획입안', warnings);

  if (sintoRows.length === 0) throw new Error('신속통합 파일에 데이터 행이 없습니다.');
  if (sintoRows.length !== planRows.length) {
    throw new Error(
      `두 파일의 행 수가 다릅니다 (신속통합 ${sintoRows.length}행, 정비계획입안 ${planRows.length}행). 같은 날 받은 한 쌍인지 확인하세요.`,
    );
  }

  // 파일 뒤바뀜 감지 — `선택 항목`은 정비계획입안 파일에만 있다.
  const sintoHasChoice = PLAN_CHOICE_COLUMN in sintoRows[0];
  const planHasChoice = PLAN_CHOICE_COLUMN in planRows[0];
  if (sintoHasChoice || !planHasChoice) {
    throw new Error(
      `두 파일의 종류가 뒤바뀐 것 같습니다. '${PLAN_CHOICE_COLUMN}' 컬럼은 정비계획입안 파일에만 있어야 하는데 신속통합=${sintoHasChoice ? '있음' : '없음'}, 정비계획입안=${planHasChoice ? '있음' : '없음'}입니다.`,
    );
  }

  const unknown = new UnknownValueTracker();
  const owners: EconsentOwnerRow[] = [];
  const skipped = { commercial: 0 };
  let unnamedOwners = 0;

  for (let i = 0; i < sintoRows.length; i++) {
    const s = sintoRows[i];
    const p = planRows[i];
    const excelRow = i + 2; // 헤더 1행 + 0-based 인덱스

    for (const col of ['동', '호수', '이름'] as const) {
      if (cell(s, col) !== cell(p, col)) {
        throw new Error(
          `${excelRow}행 '${col}'가 두 파일에서 다릅니다 (신속통합='${cell(s, col)}', 정비계획입안='${cell(p, col)}'). 서로 다른 회차의 명부이거나 파일이 뒤바뀌었습니다.`,
        );
      }
    }

    // 상가 45행(670-2 종합상가)은 소유자원본에 없어 통합현황 스키마에 들어갈 수 없다.
    const dongRaw = cell(s, '동');
    if (!dongRaw || cell(s, '건물명').includes('상가')) {
      skipped.commercial++;
      continue;
    }

    const dong = dongRaw.replace(/\D/g, '');
    const ho = cell(s, '호수').replace(/\D/g, '');
    if (!dong || !ho) {
      throw new Error(
        `${excelRow}행의 동/호수에서 숫자를 뽑지 못했습니다 (동='${dongRaw}', 호수='${cell(s, '호수')}'). 원본 표기 형식이 바뀐 것이므로 정규화 규칙을 확인하세요.`,
      );
    }

    // 이름이 빈 행 37건(2026-08-10)은 연번·소유구분까지 전부 비어 있는 자리표시 행이다.
    // 버리지 않고 미제출 소유자로 남기는 이유는 econsent-types.ts의 unnamedOwners 주석 참고.
    const name = cell(s, '이름');
    if (!name) unnamedOwners++;

    const planChoiceRaw = cell(p, PLAN_CHOICE_COLUMN);
    owners.push({
      dong,
      ho,
      seq: cell(s, '연번'),
      name,
      birth: cell(s, '생년월일'),
      phone: cell(s, '연락처'), // raw 시트는 원본 미러 — 검증·폐기는 세대 집계에서만 한다
      ownership: cell(s, '소유구분'),
      repStatus: unknown.check<RepStatus>('대표자여부', cell(s, '대표자여부'), REP_STATUSES),
      sintoStatus: unknown.check<SubmitStatus>('제출상태', cell(s, '제출상태'), SUBMIT_STATUSES),
      sintoSubmittedAt: cell(s, '제출일시'),
      planStatus: unknown.check<SubmitStatus>('제출상태', cell(p, '제출상태'), SUBMIT_STATUSES),
      planSubmittedAt: cell(p, '제출일시'),
      // '-'는 원본에서 "선택 안 함"을 뜻하므로 빈 값과 같이 다룬다.
      planChoice: unknown.check<PlanChoice>(
        PLAN_CHOICE_COLUMN,
        planChoiceRaw === '-' ? '' : planChoiceRaw,
        PLAN_CHOICES,
      ),
    });
  }

  unknown.flush(warnings);

  const households = aggregateHouseholds(owners, today, warnings);

  return { owners, households, skipped, unnamedOwners, warnings };
}

/**
 * 소유자 행 → 세대 집계.
 *
 * 임포트(xlsx 파싱)와 sync(「전자동의원본」 시트 읽기) 양쪽이 이 함수를 쓴다.
 * 세대 판정 규칙이 두 경로에서 갈리면 업로드 직후와 sync 이후의 숫자가 달라지므로
 * 반드시 여기 한 곳에만 둔다.
 */
export function aggregateHouseholds(
  owners: EconsentOwnerRow[],
  today: Date = new Date(),
  warnings: string[] = [],
): Map<string, EconsentHousehold> {
  const grouped = new Map<string, EconsentOwnerRow[]>();
  for (const owner of owners) {
    const key = `${owner.dong}-${owner.ho}`;
    const list = grouped.get(key);
    if (list) list.push(owner);
    else grouped.set(key, [owner]);
  }

  const households = new Map<string, EconsentHousehold>();
  for (const [key, list] of grouped) {
    const reps = list.filter((o) => o.repStatus === '대표' && o.name);
    if (reps.length > 1) {
      warnings.push(
        `${key}: 대표자가 ${reps.length}명입니다 (${reps.map((r) => r.name).join(', ')}). 첫 번째를 사용합니다.`,
      );
    }

    const choices = [...new Set(list.map((o) => o.planChoice).filter(Boolean))];
    if (choices.length > 1) {
      warnings.push(
        `${key}: 추진방식 선택이 소유자마다 다릅니다 (${choices.join(' / ')}). 첫 번째를 사용합니다.`,
      );
    }

    const submittedAts = list
      .flatMap((o) => [o.sintoSubmittedAt, o.planSubmittedAt])
      .filter(Boolean)
      .sort(); // 'YYYY-MM-DD HH:mm:ss' 고정 폭이라 문자열 정렬 = 시각 정렬

    households.set(key, {
      dong: list[0].dong,
      ho: list[0].ho,
      ownerCount: list.length,
      ownerNames: list.map((o) => o.name).filter(Boolean),
      sinto: judgeHousehold(list.length, list.filter((o) => isSubmitted(o.sintoStatus)).length),
      plan: judgeHousehold(list.length, list.filter((o) => isSubmitted(o.planStatus)).length),
      representative: reps[0]?.name ?? '',
      planChoice: choices[0] ?? '',
      firstSubmittedAt: submittedAts[0] ?? '',
      ageGroup: resolveAgeGroup(list, key, today, warnings),
      phone: resolvePhone(list, key, warnings),
    });
  }

  return households;
}
