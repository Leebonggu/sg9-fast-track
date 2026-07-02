# 후원금 전체 목록 페이지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/unified/donations` 페이지에서 후원금 전체 거래(세대 구분 없이)를 최신순으로 보고, 그 자리에서 수정/취소한다.

**Architecture:** 기존 `GET /api/unified/donations`를 확장(dong/ho 없으면 전체 반환)하고, 기존 `PATCH`/`DELETE`는 그대로 재사용. 새 컴포넌트는 `DonationPanel.tsx`의 인라인 편집 UX 패턴을 참고해 목록용으로 새로 만든다(세대 패널과 책임이 달라 공유 추상화는 만들지 않음).

**Tech Stack:** Next.js 16 App Router, TypeScript, 기존 `donation.ts`/`google-spreadsheet` 재사용. 새 패키지 없음.

## Global Constraints

- 스펙 원문: `docs/superpowers/specs/2026-07-02-donation-list-page-design.md`
- 새 API 라우트를 만들지 않는다 — 기존 `web/src/app/api/unified/donations/route.ts`의 `GET`만 확장
- `PATCH`/`DELETE`는 변경하지 않는다(이미 ID 기반, 세대 무관하게 동작)
- 페이지네이션 없음 — `/unified` 테이블 관례를 따름
- 정렬은 `납부일` 내림차순(문자열 비교, 항상 `YYYY-MM-DD` 형식이라 안전) + 동일 납부일 내에서는 `시각`을 `Date.parse()`로 파싱해 내림차순 tie-break — 시각 필드는 오늘 두 가지 형식이 섞여 있음(UTC `...Z` 구형 `addDonation()` 기록 vs KST `+09:00` 오늘 일괄등록분), 문자열 그대로 비교하면 순서가 틀릴 수 있어 반드시 `Date.parse()`로 비교할 것

---

### Task 1: `getAllDonations()` 추가 + API 확장

**Files:**
- Modify: `web/src/lib/donation.ts` (파일 끝에 함수 추가)
- Modify: `web/src/app/api/unified/donations/route.ts:12-20` (GET 핸들러)

**Interfaces:**
- Consumes: 기존 `DonationRecord`, `mapRow()`, `SHEET_TITLE`, `getDoc()` (모두 `donation.ts` 내부에 이미 존재)
- Produces: `getAllDonations(): Promise<DonationRecord[]>` — 취소 포함 전체 거래, 납부일 내림차순(동일 납부일은 시각 내림차순)

- [ ] **Step 1: `donation.ts` 파일 끝에 함수 추가**

`web/src/lib/donation.ts`의 `bulkAddDonations` 함수 뒤(파일 맨 끝)에 추가:

```ts

// 전체 후원금 거래 목록 (취소 포함) — /unified/donations 목록 페이지용
export async function getAllDonations(): Promise<DonationRecord[]> {
  const doc = await getDoc();
  const sheet = doc.sheetsByTitle[SHEET_TITLE];
  if (!sheet) return [];
  const rows = await sheet.getRows();
  return rows
    .map(mapRow)
    .sort((a, b) => {
      const dateCompare = b.paidDate.localeCompare(a.paidDate);
      if (dateCompare !== 0) return dateCompare;
      return (Date.parse(b.timestamp) || 0) - (Date.parse(a.timestamp) || 0);
    });
}
```

- [ ] **Step 2: 타입체크**

Run: `cd web && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: API 라우트 GET 핸들러 수정**

`web/src/app/api/unified/donations/route.ts`의 import 줄과 GET 함수를 다음으로 교체:

```ts
import { getDonations, getAllDonations, addDonation, updateDonation, cancelDonation } from '@/lib/donation';
```

```ts
export async function GET(req: NextRequest) {
  const dong = req.nextUrl.searchParams.get('dong');
  const ho = req.nextUrl.searchParams.get('ho');
  if (dong && ho) {
    const donations = await getDonations(dong, ho);
    return NextResponse.json({ donations });
  }
  const donations = await getAllDonations();
  return NextResponse.json({ donations });
}
```

- [ ] **Step 4: 타입체크 + 실제 API 호출 검증**

Run: `cd web && npx tsc --noEmit`
Expected: 에러 없음

Run(dev 서버가 떠 있어야 함): `curl -s "http://localhost:3000/api/unified/donations" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);console.log('전체 건수:', j.donations.length);console.log('첫 3건:', JSON.stringify(j.donations.slice(0,3).map(x=>({paidDate:x.paidDate,dong:x.dong,ho:x.ho,amount:x.amount}))));})"`
Expected: 오늘 등록한 198건(또는 그 이상)이 나오고, 첫 3건이 납부일 내림차순(가장 최근 날짜부터)으로 정렬되어 있음

- [ ] **Step 5: 커밋**

```bash
cd /Users/leebonggu/Desktop/playground/sg9
git add web/src/lib/donation.ts web/src/app/api/unified/donations/route.ts
git commit -m "feat: 후원금 전체 목록 조회 API 추가 (getAllDonations)"
```

---

### Task 2: 목록 테이블 컴포넌트

**Files:**
- Create: `web/src/components/unified/DonationListTable.tsx`

**Interfaces:**
- Consumes: `DonationRecord` type from `@/lib/donation` (Task 1에서 이미 존재하던 타입)
- Consumes: 기존 `PATCH`/`DELETE /api/unified/donations` (변경 없음)
- Produces: `<DonationListTable donations={DonationRecord[]} onChanged={() => void} />`

- [ ] **Step 1: 컴포넌트 작성**

Create `web/src/components/unified/DonationListTable.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { DonationRecord } from '@/lib/donation';

interface Props {
  donations: DonationRecord[];
  onChanged: () => void;
}

function operatorName(): string {
  return typeof window !== 'undefined' ? sessionStorage.getItem('operatorName') || '' : '';
}

export default function DonationListTable({ donations, onChanged }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPaidDate, setEditPaidDate] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [saving, setSaving] = useState(false);

  function startEdit(d: DonationRecord) {
    setEditingId(d.id);
    setEditPaidDate(d.paidDate);
    setEditAmount(String(d.amount));
  }

  async function submitEdit(id: string) {
    const amount = Number(editAmount);
    if (!editPaidDate || !amount || amount <= 0) {
      alert('납부일과 금액을 올바르게 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/unified/donations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, paidDate: editPaidDate, amount, operatorName: operatorName() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || '저장 실패');
        return;
      }
      setEditingId(null);
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function cancelEntry(id: string) {
    if (!confirm('이 후원금 납부 기록을 취소하시겠습니까?')) return;
    setSaving(true);
    try {
      const res = await fetch('/api/unified/donations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, operatorName: operatorName() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || '취소 실패');
        return;
      }
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  if (donations.length === 0) {
    return <p className="text-sm text-gray-400 py-8 text-center">거래 내역이 없습니다.</p>;
  }

  return (
    <div className="overflow-x-auto border border-gray-200 rounded">
      <table className="w-full text-xs">
        <thead className="bg-gray-50 text-gray-500">
          <tr>
            <th className="p-2 text-left">납부일</th>
            <th className="p-2 text-left">동</th>
            <th className="p-2 text-left">호수</th>
            <th className="p-2 text-right">금액</th>
            <th className="p-2 text-left">등록자</th>
            <th className="p-2 text-left">비고</th>
            <th className="p-2 text-left">상태</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {donations.map((d) => (
            <tr key={d.id} className="border-t border-gray-100">
              {editingId === d.id ? (
                <>
                  <td className="p-2">
                    <input
                      type="date"
                      value={editPaidDate}
                      onChange={(e) => setEditPaidDate(e.target.value)}
                      className="border border-gray-300 rounded px-1 py-0.5"
                    />
                  </td>
                  <td className="p-2">{d.dong}</td>
                  <td className="p-2">{d.ho}</td>
                  <td className="p-2 text-right">
                    <input
                      type="number"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="border border-gray-300 rounded px-1 py-0.5 w-24 text-right"
                    />
                  </td>
                  <td className="p-2 text-gray-400">{d.registrant}</td>
                  <td className="p-2 text-gray-400">{d.note}</td>
                  <td className="p-2">{d.status}</td>
                  <td className="p-2 whitespace-nowrap">
                    <button
                      onClick={() => submitEdit(d.id)}
                      disabled={saving}
                      className="text-[11px] px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 mr-1"
                    >
                      저장
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      disabled={saving}
                      className="text-[11px] px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                    >
                      취소
                    </button>
                  </td>
                </>
              ) : (
                <>
                  <td className="p-2 whitespace-nowrap">{d.paidDate}</td>
                  <td className="p-2">{d.dong}</td>
                  <td className="p-2">{d.ho}</td>
                  <td className="p-2 text-right">{d.amount.toLocaleString()}</td>
                  <td className="p-2 text-gray-400 truncate max-w-[140px]">{d.registrant}</td>
                  <td className="p-2 text-gray-400 truncate max-w-[160px]">{d.note}</td>
                  <td className="p-2">
                    <span className={d.status === '취소' ? 'text-red-500' : 'text-gray-600'}>{d.status}</span>
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    <button
                      onClick={() => startEdit(d)}
                      className="text-[11px] px-2 py-0.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 mr-1"
                    >
                      수정
                    </button>
                    {d.status !== '취소' && (
                      <button
                        onClick={() => cancelEntry(d.id)}
                        disabled={saving}
                        className="text-[11px] px-2 py-0.5 rounded border border-gray-300 text-red-500 hover:bg-red-50 disabled:opacity-50"
                      >
                        취소
                      </button>
                    )}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: 타입체크**

Run: `cd web && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
cd /Users/leebonggu/Desktop/playground/sg9
git add web/src/components/unified/DonationListTable.tsx
git commit -m "feat: 후원금 목록 테이블 컴포넌트 추가 (인라인 수정/취소)"
```

---

### Task 3: 목록 페이지 + 진입 링크

**Files:**
- Create: `web/src/app/unified/donations/page.tsx`
- Modify: `web/src/app/unified/page.tsx` (진입 링크 추가)
- Modify: `web/src/app/unified/donations-import/page.tsx` (진입 링크 추가)

**Interfaces:**
- Consumes: `DonationListTable` from Task 2, `GET /api/unified/donations`(전체) from Task 1

- [ ] **Step 1: 페이지 작성**

Create `web/src/app/unified/donations/page.tsx`:

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import AdminLayout from '@/components/AdminLayout';
import AdminNav from '@/components/AdminNav';
import DonationListTable from '@/components/unified/DonationListTable';
import type { DonationRecord } from '@/lib/donation';

type StatusFilter = 'all' | '정상' | '취소';

export default function DonationsListPage() {
  const [donations, setDonations] = useState<DonationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/unified/donations');
    const data = await res.json();
    setDonations(data.donations ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = donations.filter((d) => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    const digits = search.replace(/[^0-9]/g, '');
    if (digits && !`${d.dong}${d.ho}`.includes(digits)) return false;
    return true;
  });

  const statusTabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: '전체' },
    { key: '정상', label: '정상' },
    { key: '취소', label: '취소' },
  ];

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gray-50 pb-16">
        <div className="p-4 max-w-5xl mx-auto">
          <h1 className="text-lg font-bold text-gray-800 mb-4">후원금 전체 목록</h1>

          <div className="flex flex-wrap items-center gap-2 mb-4">
            {statusTabs.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  statusFilter === key
                    ? 'bg-[#2F5496] text-white border-[#2F5496]'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                }`}
              >
                {label}
              </button>
            ))}
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="동/호수 검색 (예: 901101)"
              className="text-xs border border-gray-300 rounded px-2 py-1.5 ml-auto"
            />
          </div>

          <p className="text-xs text-gray-400 mb-2">
            {filtered.length.toLocaleString()}건 표시 중 / 전체 {donations.length.toLocaleString()}건
          </p>

          {loading ? (
            <div className="text-center py-12 text-gray-400">불러오는 중...</div>
          ) : (
            <DonationListTable donations={filtered} onChanged={fetchData} />
          )}
        </div>
      </div>
      <AdminNav />
    </AdminLayout>
  );
}
```

- [ ] **Step 2: `/unified` 페이지에 진입 링크 추가**

`web/src/app/unified/page.tsx`에서 이전에 추가한 "후원금 일괄업로드" `<Link>` 바로 앞에 추가:

```tsx
              <Link
                href="/unified/donations"
                className="text-xs px-3 py-1.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                후원금 목록
              </Link>
```

(전체 블록은 `<Link href="/unified/donations-import">...</Link>` 바로 위에 위치)

- [ ] **Step 3: 일괄업로드 페이지에도 목록 페이지로 가는 링크 추가**

`web/src/app/unified/donations-import/page.tsx`의 `import AdminNav from '@/components/AdminNav';` 뒤에 추가:

```ts
import Link from 'next/link';
```

같은 파일의 `<h1 className="text-lg font-bold text-gray-800 mb-4">후원금 일괄업로드</h1>` 바로 뒤에 추가:

```tsx
          <Link href="/unified/donations" className="text-xs text-[#2F5496] hover:underline mb-4 inline-block">
            → 전체 목록 보기
          </Link>
```

- [ ] **Step 4: 타입체크 + lint**

Run: `cd web && npx tsc --noEmit`
Expected: 에러 없음

Run: `cd web && npm run lint`
Expected: 새로 만든/수정한 파일에서 에러 없음 (기존 파일의 사전 존재 에러는 무관)

- [ ] **Step 5: 실제 화면 동작 검증**

Run(dev 서버 떠 있어야 함): `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/unified/donations`
Expected: `200`

- [ ] **Step 6: 커밋**

```bash
cd /Users/leebonggu/Desktop/playground/sg9
git add web/src/app/unified/donations/page.tsx web/src/app/unified/page.tsx web/src/app/unified/donations-import/page.tsx
git commit -m "feat: 후원금 전체 목록 페이지 추가 + 진입 링크"
```
