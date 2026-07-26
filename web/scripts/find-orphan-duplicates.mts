/**
 * 고아 "중복(이전 응답)" 마킹 세대 재추출 (읽기 전용 — 시트에 절대 쓰지 않는다)
 *
 * 실행: npm run orphans
 *      (= npx tsx --env-file=.env.local scripts/find-orphan-duplicates.mts)
 *
 * 배경: v2 동별 시트의 비고 `중복(이전 응답)` 마킹 중 일부는 "고아"다.
 *       짝(같은 호수의 마킹 안 된 행)이 사라졌는데 마킹만 남은 경우로,
 *       deleteConsent의 마킹 해제 로직이 "시트에서 사람이 직접 행을 지우면" 돌지 않기 때문에 생긴다.
 *
 * 왜 재추출이 필요한가: 시트는 라이브라 계속 갱신된다. 실제로 조사 당시 904동 1003호는
 *       7분 사이에 새 행이 들어와 고아 상태가 저절로 해소됐다. 행번호도 제출이 들어오면 밀린다.
 *       => 시트를 정리하기 직전에 반드시 이 스크립트를 다시 돌릴 것.
 *
 * 출력: docs/raw/YYYY-MM-DD_고아-중복마킹-목록.md  (docs/raw/는 .gitignore — PII라 커밋 금지)
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { getServiceAccountAuth } from '../src/lib/google-auth';
import { BUILDING_CONFIG } from '../src/lib/buildings';

const DUP_MARK = '중복(이전 응답)';
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

interface SheetRow {
  rowNumber: number;
  ho: string;
  collected: string;
  name: string;
  note: string;
  phone: string;
  ts: string;
  source: string;
}

interface Orphan {
  dong: string;
  row: SheetRow;
  unifiedPhone: string;
  unifiedConsent: string;
}

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) {
    console.error(`환경변수 ${key}가 없습니다. .env.local을 읽도록 --env-file=.env.local 로 실행하세요.`);
    process.exit(1);
  }
  return v;
}

async function main(): Promise<void> {
  const auth = getServiceAccountAuth();

  // --- v2 동별 시트 전수 읽기 ---
  const doc = new GoogleSpreadsheet(requireEnv('SPREADSHEET_ID'), auth);
  await doc.loadInfo();

  const byDong = new Map<string, SheetRow[]>();
  for (const dong of Object.keys(BUILDING_CONFIG)) {
    const sheet = doc.sheetsByTitle[dong];
    if (!sheet) {
      console.warn(`  ! 시트 없음: ${dong}`);
      continue;
    }
    const rows = await sheet.getRows();
    byDong.set(
      dong,
      rows.map((r) => ({
        rowNumber: r.rowNumber, // 시트 실제 행번호 (인덱스 추정 금지 — 빈 행 때문에 어긋난다)
        ho: String(r.get('호수') ?? '').trim(),
        collected: String(r.get('동의서수거여부') ?? '').trim(),
        name: String(r.get('성명') ?? '').trim(),
        note: String(r.get('비고') ?? '').trim(),
        phone: String(r.get('연락처') ?? '').trim(),
        ts: String(r.get('타임스탬프') ?? '').trim(),
        source: String(r.get('입력경로') ?? '').trim(),
      })),
    );
  }

  // --- 중복 마킹 분류: 짝이 살아있으면 정상, 없으면 고아 ---
  const orphans: Orphan[] = [];
  let pairedCount = 0;

  for (const [dong, rows] of byDong) {
    for (const row of rows) {
      if (!row.note.includes(DUP_MARK)) continue;
      const alive = rows.filter(
        (o) => o !== row && o.ho === row.ho && !o.note.includes(DUP_MARK) && o.note !== '삭제',
      );
      if (alive.length > 0) pairedCount++;
      else orphans.push({ dong, row, unifiedPhone: '', unifiedConsent: '' });
    }
  }

  // --- 통합현황과 대조해 연락처 유실 여부 확인 ---
  const ownerDoc = new GoogleSpreadsheet(requireEnv('OWNER_SPREADSHEET_ID'), auth);
  await ownerDoc.loadInfo();
  const unifiedSheet = ownerDoc.sheetsByTitle['통합현황'];
  if (!unifiedSheet) {
    console.error('통합현황 시트를 찾을 수 없습니다.');
    process.exit(1);
  }
  const unifiedMap = new Map<string, { phone: string; override: string; consent: string }>();
  for (const r of await unifiedSheet.getRows()) {
    const key = `${String(r.get('동') ?? '').trim()}-${String(r.get('호수') ?? '').trim()}`;
    unifiedMap.set(key, {
      phone: String(r.get('연락처') ?? '').trim(),
      override: String(r.get('연락처_수정') ?? '').trim(),
      consent: String(r.get('신속통합동의서_제출_완료') ?? '').trim(),
    });
  }

  let phoneLost = 0;
  for (const o of orphans) {
    const u = unifiedMap.get(`${o.dong.replace('동', '')}-${o.row.ho}`);
    o.unifiedPhone = u?.override || u?.phone || '';
    o.unifiedConsent = u?.consent || '(행없음)';
    if (o.row.phone && !o.unifiedPhone) phoneLost++;
  }

  orphans.sort((a, b) => a.dong.localeCompare(b.dong) || a.row.ho.localeCompare(b.row.ho));

  // --- 콘솔 요약 ---
  const stamp = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  console.log(`\n스냅샷: ${stamp}`);
  console.log(`중복 마킹 행 총 ${pairedCount + orphans.length}건`);
  console.log(`  - 짝이 살아있음(정상 중복): ${pairedCount}건`);
  console.log(`  - 짝이 없음(고아 마킹): ${orphans.length}건`);
  console.log(`  - 그중 연락처가 통합현황에서 유실된 세대: ${phoneLost}건\n`);
  for (const o of orphans) {
    console.log(`  ${o.dong} ${o.row.ho}호 (시트행 ${o.row.rowNumber}) ${o.row.name} · 수거=${o.row.collected}`);
  }

  // --- 문서 출력 (PII이므로 gitignore된 docs/raw/에만) ---
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }); // YYYY-MM-DD
  const outPath = resolve(REPO_ROOT, 'docs/raw', `${today}_고아-중복마킹-목록.md`);
  mkdirSync(dirname(outPath), { recursive: true });

  const table = orphans.length
    ? [
        '| 동 | 시트행 | 호수 | 성명 | 수거 | 입력경로 | 연락처(v2) | 통합현황 연락처 | 타임스탬프 | 비고 원문 |',
        '|---|---|---|---|---|---|---|---|---|---|',
        ...orphans.map((o) =>
          `| ${o.dong} | ${o.row.rowNumber} | ${o.row.ho} | ${o.row.name || '-'} | ${o.row.collected || '-'} |` +
          ` ${o.row.source || '-'} | ${o.row.phone || '(없음)'} | ${o.unifiedPhone || '⚠ 빈값'} |` +
          ` ${o.row.ts || '(없음)'} | \`${o.row.note}\` |`,
        ),
      ].join('\n')
    : '_고아 마킹이 없습니다. 정리할 것이 없습니다._';

  const doc_ = `# 고아 "${DUP_MARK}" 마킹 세대 목록

> ⚠️ **PII 포함 — 커밋 금지.** \`docs/raw/\`는 \`.gitignore\`에 등록돼 있습니다.
> 이 파일은 \`npm run orphans\`가 생성합니다. 직접 수정하지 마세요(재실행 시 덮어씀).

- **스냅샷**: ${stamp}
- 중복 마킹 행 총 **${pairedCount + orphans.length}건**
  - 짝이 살아있음(정상 중복): **${pairedCount}건**
  - 짝이 없음(**고아 마킹**): **${orphans.length}건**
  - 그중 연락처가 통합현황에서 유실된 세대: **${phoneLost}건**

## 이게 뭔가

그 세대의 **유일한 행인데 \`${DUP_MARK}\`으로 마킹**돼 있는 경우입니다. 실제로는 중복이 아닙니다.
\`deleteConsent()\`는 행 삭제 후 남은 마킹을 해제하지만, **스프레드시트에서 사람이 직접 행을 지우면
그 로직이 실행되지 않아** 짝은 사라지고 마킹만 남습니다.

## 영향

sync는 비고를 보지 않고(\`getConsentKeyset\`), 편집·연락처 경로는 중복 행을 건너뜁니다 — 그래서 비대칭이 생깁니다.

| 경로 | 결과 |
|---|---|
| \`getConsentKeyset\` (sync) | 통합현황 동의여부는 **정상** |
| \`toggleCollected\` | 수거 토글 **불가** (\`DUP_ONLY\` 409로 안내) |
| \`updateConsent\` / \`deleteConsent\` | 성명 수정·삭제 **불가** |
| \`getPhoneMap\` | **연락처가 통합현황에서 유실** |

## 목록

동/호/성명/타임스탬프로 식별하세요. **시트행 번호는 스냅샷 시점 기준이며, 새 제출이 들어오면 밀립니다.**

${table}

## 정리 방법

각 행의 **비고 셀만 비우면** 됩니다(다른 컬럼은 건드리지 않음). 비고에 다른 메모가 함께 적힌 행이
있다면 \`${DUP_MARK}\` 문구만 지우세요 — 위 "비고 원문" 열에서 확인할 수 있습니다.

정리 후 **통합현황 동기화 1회** 실행 → 연락처가 복구됩니다.

⚠️ 시트가 라이브라 목록은 계속 바뀝니다. **정리 직전에 \`npm run orphans\`를 다시 돌려 최신 목록으로 작업하세요.**
`;

  writeFileSync(outPath, doc_, 'utf8');
  console.log(`\n문서 저장: ${outPath}`);
  console.log('(docs/raw/는 gitignore — 커밋되지 않습니다)');
}

await main();
