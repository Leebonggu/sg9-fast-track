// web/src/lib/notifier.ts
import type { SyncNotifier, SyncResult } from './unified-types';

// 기본 구현: API 응답에 결과 포함 (프론트에서 토스트 표시)
export class WebToastNotifier implements SyncNotifier {
  async notify(_result: SyncResult): Promise<void> {
    // 결과는 API 응답 body로 반환되므로 별도 동작 없음
  }
}

// 플러그인 자리 — 외부 알림 수단 확정 시 추가
// export class KakaoNotifier implements SyncNotifier { ... }
// export class EmailNotifier implements SyncNotifier { ... }
// export class SlackNotifier implements SyncNotifier { ... }

export const notifiers: SyncNotifier[] = [new WebToastNotifier()];
