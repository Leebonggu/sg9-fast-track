/**
 * 회귀 테스트 — 통합현황 표 가상 스크롤의 스크롤 위치 보존
 * 실행: npm test (또는 tsx tests/unified-table-scroll.test.ts)
 *
 * 배경(2026-07-25 버그): 표에서 동의서/개인정보 같은 토글을 누르면 스크롤이 맨 위로 튀었다.
 * 원인은 UnifiedTable의 "스크롤 리셋" useEffect가 rows 배열을 의존성으로 삼은 것.
 * 토글은 낙관적 업데이트로 부모의 rows를 map()으로 새 배열을 만들어 내려주므로,
 * 값이 실제로 바뀐 행이 하나뿐이어도 배열 identity가 달라져 effect가 매번 재실행됐다.
 *
 * 그래서 이 테스트가 고정하는 계약은 두 가지다:
 *   1) rows 내용만 바뀌면(= 같은 목록을 보고 있음) 스크롤 위치를 유지한다
 *   2) resetKey가 바뀌면(= 필터/동 변경으로 목록 자체가 바뀜) 스크롤을 맨 위로 되돌린다
 */
import { JSDOM } from 'jsdom';
import type { UnifiedRow } from '../src/lib/unified-types';

let pass = 0;
let fail = 0;

function assertEqual(label: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}\n      기대: ${e}\n      실제: ${a}`);
  }
}

// --- jsdom 환경 구성 (React 임포트 전에 전역이 준비돼 있어야 한다) ---
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  pretendToBeVisual: true, // requestAnimationFrame 제공 (onScroll이 rAF로 throttle 됨)
  url: 'http://localhost/unified',
});
const { window } = dom;

// jsdom은 레이아웃이 없어 scrollTop이 항상 0으로 클램프된다.
// 가상 스크롤 검증에는 실제 스크롤 위치가 필요하므로 요소별 저장소로 대체한다.
const scrollTops = new WeakMap<object, number>();
Object.defineProperty(window.HTMLElement.prototype, 'scrollTop', {
  configurable: true,
  get(this: object) { return scrollTops.get(this) ?? 0; },
  set(this: object, v: number) { scrollTops.set(this, Number(v)); },
});

// 컴포넌트는 matchMedia로 데스크톱/모바일을 가른다. 가상 스크롤은 데스크톱 경로에만 있다.
window.matchMedia = ((query: string) => ({
  matches: true,
  media: query,
  onchange: null,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
  dispatchEvent: () => false,
})) as unknown as typeof window.matchMedia;

const g = globalThis as unknown as Record<string, unknown>;
g.window = window;
g.document = window.document;
g.HTMLElement = window.HTMLElement;
g.Element = window.Element;
g.Node = window.Node;
g.Event = window.Event;
g.requestAnimationFrame = window.requestAnimationFrame.bind(window);
g.cancelAnimationFrame = window.cancelAnimationFrame.bind(window);
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
g.IS_REACT_ACT_ENVIRONMENT = true;

// --- 전역 준비 후 React/컴포넌트 로드 ---
const React = (await import('react')).default;
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const UnifiedTable = (await import('../src/components/unified/UnifiedTable')).default;

const ROW_H = 41; // UnifiedTable의 고정 행 높이와 일치해야 한다

function makeRows(count: number): UnifiedRow[] {
  return Array.from({ length: count }, (_, i) => ({
    dong: '901',
    ho: String(101 + i),
    ownerName: `소유자${i}`,
    postalCode: '01234',
    address: '서울시 노원구',
    residency: '실거주',
    consent: true,
    surveys: {},
    memo: '',
    lastSynced: '2026-07-25',
    planConsent: false,
    privacyConsent: false,
  }));
}

const noop = () => {};

async function run(): Promise<void> {
  const rows = makeRows(300);
  const container = window.document.getElementById('root')!;
  const root = createRoot(container);

  function render(nextRows: UnifiedRow[], resetKey: string) {
    return act(async () => {
      root.render(
        React.createElement(UnifiedTable, {
          rows: nextRows,
          resetKey,
          surveyIds: [],
          showDong: true,
          onRowClick: noop,
          onKakaoToggled: noop,
          onAgeChanged: noop,
          onPlanToggled: noop,
        }),
      );
    });
  }

  await render(rows, 'all');

  const scroller = container.querySelector('.overflow-auto') as HTMLElement;
  assertEqual('스크롤 컨테이너가 렌더된다', scroller != null, true);

  const renderedHos = () =>
    Array.from(scroller.querySelectorAll('tbody tr'))
      .map((tr) => tr.querySelectorAll('td')[1]?.textContent ?? '')
      .filter(Boolean);

  assertEqual('초기에는 첫 행(101호)이 렌더된다', renderedHos().includes('101'), true);

  // 사용자가 100번째 행 근처까지 스크롤한 상태를 만든다
  const scrolled = ROW_H * 100; // 4100
  await act(async () => {
    scroller.scrollTop = scrolled;
    scroller.dispatchEvent(new window.Event('scroll', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 50)); // rAF throttle flush
  });

  assertEqual('스크롤 후 위치가 유지된다', scroller.scrollTop, scrolled);
  assertEqual('스크롤 후 첫 행(101호)은 창 밖으로 나간다', renderedHos().includes('101'), false);
  const hosAfterScroll = renderedHos();

  // (1) 토글 낙관적 업데이트 재현 — 새 배열 + 한 행만 값 변경, resetKey는 그대로
  const patched = rows.map((r) =>
    r.ho === '201' ? { ...r, planConsent: true } : r,
  );
  assertEqual('패치된 rows는 새 배열이다 (버그 재현 조건)', patched === rows, false);

  await render(patched, 'all');

  assertEqual('토글 후에도 스크롤 위치가 유지된다', scroller.scrollTop, scrolled);
  assertEqual('토글 후에도 보이는 행이 그대로다', renderedHos(), hosAfterScroll);

  // (2) 필터 변경(resetKey 변경) 시에는 맨 위로 되돌아가야 한다
  await render(patched.slice(0, 200), 'no-consent');

  assertEqual('필터 변경 시 스크롤이 맨 위로 리셋된다', scroller.scrollTop, 0);
  assertEqual('필터 변경 후 첫 행(101호)이 다시 렌더된다', renderedHos().includes('101'), true);

  // (3) 행 높이 불변 — 가상 스크롤은 모든 행이 정확히 ROW_H라고 가정하므로,
  //     메모가 여러 줄이어도 셀은 한 줄로 렌더돼야 한다.
  //     (2026-08-03 버그: sync가 붙이는 [설문연락처] 줄 때문에 메모가 2줄이 됐는데
  //      표시용 버튼에 whitespace-pre-line이 걸려 있어 행이 41px를 넘었고 스크롤이 꿀렁거렸다.
  //      jsdom엔 레이아웃이 없어 픽셀을 못 재므로 "한 줄로 렌더되는가"로 계약을 고정한다.)
  const multiline = '종이:안명숙\n[설문연락처] 안명숙 010-8892-3392 (소유자명 불일치 — 확인 필요)';
  await render(
    makeRows(300).map((r) => (r.ho === '101' ? { ...r, memo: multiline } : r)),
    'memo-check',
  );
  const memoBtn = scroller.querySelector('button[data-cell="memo"]') as HTMLElement | null;
  assertEqual('메모 셀이 렌더된다', memoBtn != null, true);
  assertEqual('메모가 여러 줄이어도 줄바꿈 없이 렌더된다', memoBtn?.textContent?.includes('\n'), false);
  assertEqual('한 줄 유지를 위해 truncate가 걸려 있다', memoBtn?.className.includes('truncate'), true);
  assertEqual(
    '행 높이를 늘리는 whitespace-pre-line이 없다',
    memoBtn?.className.includes('whitespace-pre-line'),
    false,
  );
  assertEqual('전체 내용은 title로 보존된다', memoBtn?.getAttribute('title'), multiline);

  await act(async () => { root.unmount(); });
}

console.log('통합현황 표 스크롤 위치 회귀 테스트');
await run();

console.log(`\n결과: ${pass} 통과, ${fail} 실패`);
if (fail > 0) process.exit(1);
