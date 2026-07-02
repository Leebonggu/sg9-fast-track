# 후원금 전체 목록 페이지 설계

## 개요

`/unified/donations` — 세대 구분 없이 후원금 전체 거래를 최신순으로 훑어보고, 그 자리에서 수정/취소까지 하는 페이지. 지금은 세대별 상세(`DonationPanel`, 동/호수로만 조회)와 `/unified` 테이블의 세대별 합계만 있어서 전체 거래를 flat하게 보는 화면이 없었다.

## API

새 라우트를 만들지 않고 기존 `GET /api/unified/donations`(`web/src/app/api/unified/donations/route.ts`)를 확장한다:
- `dong`+`ho` 파라미터가 있으면 기존 동작(해당 세대 목록) 그대로
- 둘 다 없으면 **전체 목록**을 시각 내림차순으로 반환 (400 에러 대신)

`PATCH`/`DELETE`는 이미 ID 기반이라 변경 없이 그대로 재사용.

## 데이터 레이어

`donation.ts`에 `getAllDonations(): Promise<DonationRecord[]>` 추가 — 기존 `getDonations(dong, ho)`에서 세대 필터만 뺀 버전, 취소 건도 포함해서 반환(상태 필터는 화면에서 처리), 시각 내림차순 정렬.

## UI

- 페이지: `web/src/app/unified/donations/page.tsx`, `AdminLayout` + 기존 `AdminNav` 하단 재사용(오늘 정한 패턴)
- 상태 탭: 전체/정상/취소 (클라이언트 필터)
- 동/호수 검색: 텍스트 input, 클라이언트 필터 (예: "901" 입력 시 901동만, "901-101" 형태로 정확히 검색 가능하게 동/호수 둘 다 매칭)
- 각 행: 시각/동/호수/납부일/금액/등록자/비고/상태 표시, `수정` 버튼 클릭 시 `DonationPanel.tsx`와 동일한 인라인 편집(납부일 date input, 금액 number input, 저장/취소 버튼), `취소` 버튼(상태='정상'인 행만 노출)
- 페이지네이션 없음 — `/unified` 테이블이 2,830행을 그대로 렌더링하는 기존 관례를 따름

## 컴포넌트 분리

`DonationPanel.tsx`의 인라인 편집 로직(수정 폼 상태, PATCH/DELETE 호출)은 세대별 패널 전용이라 그대로 재사용은 안 되고, 같은 UX 패턴만 참고해서 목록 페이지 전용 컴포넌트(`DonationListTable.tsx`)로 새로 만든다. 두 컴포넌트가 중복 코드를 갖게 되지만, 하나는 "세대 하나의 축소 패널"이고 하나는 "전체 목록 테이블"이라 책임이 달라 억지로 공유 추상화를 만들지 않는다(YAGNI).

## 에러 처리

기존 PATCH/DELETE 에러 처리(금액 유효성, ID 없음 등) 그대로 재사용. 목록 조회 실패시 페이지에 에러 메시지 표시.
