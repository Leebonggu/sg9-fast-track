---
name: apps-script-deploy
description: 범용 Apps Script 웹앱(survey_generic_webapp.gs) 수정 후 재배포 절차. "웹앱 재배포", "Apps Script 배포", "업로드가 안 돼", "백업 cron 실패" 요청 시 사용.
---

# Apps Script 웹앱 재배포 체크리스트

`src/apps-script/survey_generic_webapp.gs` 하나가 여러 모드를 서비스한다:
PDF 생성(`blank`/`single`), 신분증(`idUpload`/`idDelete`/`idFetch`), 백업(`backupCopy`/`backupCleanup`).
**코드를 고쳐도 재배포 전엔 라이브에 반영되지 않는다** — "고쳤는데 안 돼요"의 1순위 원인.

## 절차 (사람이 Apps Script 편집기에서 — 안내해줄 것)

1. repo의 `survey_generic_webapp.gs` 내용을 Apps Script 편집기에 붙여넣기 (연결된 계정: 사용자 본인)
2. 배포 → 배포 관리 → 기존 배포 **수정** → 새 버전 → 배포
   - ⚠ "새 배포"를 만들면 URL이 바뀐다 — 그러면 Vercel의 `SURVEY_WEBAPP_URL`도 갱신해야 함.
     기존 배포를 수정하면 URL 유지
3. secret 최초 설정 또는 변경 시에만: 편집기에서 `setIdUploadSecret('값')` 1회 실행
   (`.env.local`의 `ID_UPLOAD_SECRET`과 동일값. 재배포만 할 땐 다시 실행 불필요 —
   Script Properties는 배포와 무관하게 유지된다)

## 배포 후 검증 (Claude가 할 것)

- 신분증: `/check-submission`에서 업로드 1건 테스트 or `/api/upload-id/image` 프록시로 기존 이미지 열람
- 백업: `web/`에서 `npm run backup-now` → "백업 완료: 통합현황백업_YYYY-MM-DD" 확인
- PDF: `/check-submission` 결과 페이지에서 동의서 PDF 생성 확인

## 함정

- **`setup_v2.gs`/`setup_v2_master.gs`는 절대 건드리지 않는다** (라이브, hooks가 차단) —
  웹앱과 별개 프로젝트다
- 서비스 계정은 Drive 파일을 소유할 수 없어 신분증·백업이 Apps Script를 경유하는 것 —
  이 구조를 Next.js 직접 업로드로 "단순화"하지 말 것
- 모드 추가 시 `ID_UPLOAD_SECRET` 검증 분기 안쪽에 넣는다 (secret 없는 요청이 타면 보안 구멍)
- cron(백업 KST 01:00, sync KST 23:00)이 실패하면 Vercel 로그보다 먼저 재배포 여부를 의심
