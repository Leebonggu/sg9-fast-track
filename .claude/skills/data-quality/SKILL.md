---
name: data-quality
description: 시트 데이터 정합성 점검(읽기 전용) — sync 반영 상태, 고아 중복 마킹, 설문 연락처 공백. "데이터 점검", "정합성 확인", "숫자가 안 맞아", "이상한 데이터" 요청 시 사용.
---

# 데이터 정합성 점검 (전부 읽기 전용)

숫자가 안 맞거나 시트가 의심스러울 때 아래 셋을 상황에 맞게 돌린다. 어느 것도 시트에 쓰지 않는다.

## 도구 3종 (`web/`에서)

| 명령 | 뭘 보나 | 언제 |
|---|---|---|
| `npm run verify-sync` | 통합현황 실제 반영 상태(연락처 형식·설문표기 등)를 직접 센다 | sync 후 결과 의심될 때 |
| `npm run orphans` | v2 동별 시트의 고아 `중복(이전 응답)` 마킹 (짝 없는 마킹) | 동별 시트 정리 직전 **반드시 재실행** |
| `npm run phone-gap` | 설문 연락처 보강 드라이런 + 이름 불일치 목록 | 연락처 공백 세대 보강 검토 시 |

- orphans는 시트가 라이브라 결과가 계속 변한다 — 뽑아놓고 나중에 정리하면 틀린다
- 출력 md는 `docs/raw/`(PII — gitignore, 커밋 금지)

## 함께 쓰는 판정 원칙

- 라이브 수치는 라이브 시트에서 읽는다 — memory·문서의 과거 숫자로 답하지 않는다
- /unified 숫자와 대조할 땐 같은 판정 함수(unified-utils)를 쓰는 `npm run status-report` 사용
- 전자동의 파일 검증은 `npm run verify-econsent`(econsent-import 스킬),
  업체 등록 결과는 `npm run verify-registration`(econsent-registration-check 스킬)
- 원인 불명 불일치를 발견하면 고치기 전에 사용자에게 보고 (기록: docs/MEMORY.md)
