import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/kakao-verify';
import { getOwnersByDongHo, getMasterRows } from '@/lib/owner-sheets';
import {
  uploadIdImage,
  recordIdUpload,
  getIdUploads,
  markIdPurged,
  deleteIdImage,
} from '@/lib/id-upload';
import { checkRateLimit, appendVerifyLog } from '@/lib/kakao-verify-log';
import { getClientIp } from '@/lib/request-ip';

// base64 디코드 후 최대 허용 크기 (서버 보호용). 클라이언트에서 압축 후 전송.
const MAX_BYTES = 8 * 1024 * 1024;

async function isConsented(dong: string, ho: string): Promise<boolean> {
  const { rows } = await getMasterRows();
  const row = rows.find((r) => r.dong === dong && r.ho === ho);
  return !!row?.consent;
}

// 데이터 정규화가 불완전해 공동소유 감지가 누락될 수 있으므로,
// 감지된 소유자 수를 넘어 추가 신분증 업로드를 허용 (세대당 추가 슬롯 상한).
const EXTRA_SLOT_MAX = 10;

// ── 주민: 신분증 업로드 ──────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    const body = await req.json();
    const { t, ownerIndex, ownerName, mimeType, base64 } = body ?? {};

    const tok = verifyToken(String(t || ''));
    if (!tok.valid) {
      return NextResponse.json(
        { error: tok.reason === 'expired' ? '인증이 만료되었습니다. 다시 확인해 주세요.' : '유효하지 않은 접근입니다.' },
        { status: 401 },
      );
    }
    const { dong, ho } = tok;

    if (typeof base64 !== 'string' || !base64) {
      return NextResponse.json({ error: '이미지가 없습니다.' }, { status: 400 });
    }
    // base64 길이 → 대략 바이트 수 (4글자당 3바이트)
    if (Math.floor((base64.length * 3) / 4) > MAX_BYTES) {
      return NextResponse.json(
        { error: '파일이 너무 큽니다. 다시 시도해 주세요.' },
        { status: 413 },
      );
    }

    // 독립적인 3개 시트 읽기를 병렬화 (#1 속도): rate limit / 사전동의 / 소유자
    const [rateLimited, consented, owners] = await Promise.all([
      checkRateLimit(ip),
      isConsented(dong, ho),
      getOwnersByDongHo(dong, ho),
    ]);

    if (rateLimited) {
      return NextResponse.json(
        { error: '잠시 후 다시 시도해 주세요. (10분 후 재시도 가능)' },
        { status: 429 },
      );
    }
    if (!consented) {
      return NextResponse.json(
        { error: '사전동의(신속통합동의서)가 완료된 세대만 업로드할 수 있습니다.' },
        { status: 403 },
      );
    }

    const idx = Number(ownerIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx >= owners.length + EXTRA_SLOT_MAX) {
      return NextResponse.json({ error: '잘못된 소유자 선택입니다.' }, { status: 400 });
    }

    let realName: string;
    if (idx < owners.length) {
      // 감지된 소유자 슬롯 — 이름 일치 확인 (공백 무시)
      realName = owners[idx];
      if (
        typeof ownerName === 'string' &&
        ownerName.replace(/\s/g, '') !== realName.replace(/\s/g, '')
      ) {
        return NextResponse.json({ error: '소유자 정보가 일치하지 않습니다.' }, { status: 400 });
      }
    } else {
      // 추가 슬롯 (공동소유 미감지 대비) — 라벨만 저장, 이름 검증 없음
      const label = typeof ownerName === 'string' ? ownerName.trim() : '';
      realName = label ? label.slice(0, 30) : `추가${idx - owners.length + 1}`;
    }

    const ext = mimeType === 'image/png' ? 'png' : 'jpg';
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = realName.replace(/[\\/:*?"<>|]/g, '');
    const fileName = `${dong}-${ho}-${safeName}-${idx + 1}-${ts}.${ext}`;

    const { link, fileId } = await uploadIdImage(fileName, mimeType || 'image/jpeg', base64);

    // 기록 + 인증로그는 서로 독립 → 병렬 (#1 속도)
    const [prevFileId] = await Promise.all([
      recordIdUpload({ dong, ho, ownerName: realName, ownerIndex: idx, fileName, fileId, link, ip }),
      appendVerifyLog(dong, ho, realName, '신분증업로드', ip),
    ]);

    // 재업로드로 교체된 이전 파일은 Drive에서 삭제 (고아 파일·민감정보 잔존 방지)
    if (prevFileId && prevFileId !== fileId) {
      try {
        await deleteIdImage(prevFileId);
      } catch (e) {
        console.error('[upload-id] 이전 파일 삭제 실패(무시):', e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '서버 오류가 발생했습니다.';
    console.error('[upload-id] POST error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── 현황 조회: 주민(토큰) 또는 관리자(pw) ─────────────────────
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const t = sp.get('t');
    const pw = sp.get('pw');
    const qDong = sp.get('dong');
    const qHo = sp.get('ho');

    let dong: string;
    let ho: string;

    if (t) {
      const tok = verifyToken(t);
      if (!tok.valid) {
        return NextResponse.json({ error: '유효하지 않은 접근입니다.' }, { status: 401 });
      }
      dong = tok.dong;
      ho = tok.ho;
    } else if (pw && pw === process.env.APP_PASSWORD && qDong && qHo) {
      dong = String(qDong).trim();
      ho = String(qHo).trim();
    } else {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 });
    }

    const [owners, uploads] = await Promise.all([
      getOwnersByDongHo(dong, ho),
      getIdUploads(dong, ho),
    ]);
    const uploaded = uploads.map((u) => ({
      ownerIndex: u.ownerIndex,
      ownerName: u.ownerName,
      fileName: u.fileName,
      fileId: u.fileId,
      link: u.link,
      timestamp: u.timestamp,
    }));
    return NextResponse.json({ owners, uploaded });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '서버 오류가 발생했습니다.';
    console.error('[upload-id] GET error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── 관리자: 수동 폐기 (Drive 삭제 + 시트 상태 '파기') ─────────
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { dong, ho, ownerIndex, pw } = body ?? {};
    if (pw !== process.env.APP_PASSWORD) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 });
    }
    if (!dong || !ho || ownerIndex === undefined) {
      return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 });
    }
    const fileId = await markIdPurged(
      String(dong).trim(),
      String(ho).trim(),
      Number(ownerIndex),
    );
    if (fileId) {
      try {
        await deleteIdImage(fileId);
      } catch (e) {
        console.error('[upload-id] Drive 삭제 실패(시트는 파기 표기됨):', e);
      }
    }
    await appendVerifyLog(
      String(dong).trim(),
      String(ho).trim(),
      `소유자${Number(ownerIndex) + 1}`,
      '신분증삭제',
      getClientIp(req),
    );
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '서버 오류가 발생했습니다.';
    console.error('[upload-id] DELETE error:', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
