import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, verifyAdminViewToken } from '@/lib/kakao-verify';
import { getOwnersByDongHo, getMasterRows } from '@/lib/owner-sheets';
import {
  uploadIdImage,
  recordIdUpload,
  getIdUploads,
  markIdPurged,
  deleteIdImage,
  isCorrectionWindowOpen,
} from '@/lib/id-upload';
import { checkRateLimit, appendVerifyLog } from '@/lib/kakao-verify-log';
import { getClientIp } from '@/lib/request-ip';
import { isValidPhone } from '@/lib/phone-format';

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

// ── 신분증 업로드: 주민(토큰) 또는 관리자(pw) ────────────────
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);

    const body = await req.json();
    const { t, pw, dong: bDong, ho: bHo, ownerIndex, ownerName, mimeType, base64, phone: rawPhone } = body ?? {};

    // 관리자는 pw로 인증(기존 DELETE와 동일 패턴). 세대는 body의 dong/ho로 지정.
    const isAdmin = typeof pw === 'string' && pw.length > 0 && pw === process.env.APP_PASSWORD;

    let dong: string;
    let ho: string;
    if (isAdmin) {
      dong = typeof bDong === 'string' ? bDong.trim() : '';
      ho = typeof bHo === 'string' ? bHo.trim() : '';
      if (!dong || !ho) {
        return NextResponse.json({ error: '세대 정보가 없습니다.' }, { status: 400 });
      }
    } else {
      const tok = verifyToken(String(t || ''));
      if (!tok.valid) {
        return NextResponse.json(
          { error: tok.reason === 'expired' ? '인증이 만료되었습니다. 다시 확인해 주세요.' : '유효하지 않은 접근입니다.' },
          { status: 401 },
        );
      }
      dong = tok.dong;
      ho = tok.ho;
    }

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

    // 소유자/기존업로드는 양쪽 공통. 주민 모드에서만 rateLimit/consent도 병렬로 읽고 enforce.
    let owners: string[];
    let existingUploads: Awaited<ReturnType<typeof getIdUploads>>;
    if (isAdmin) {
      [owners, existingUploads] = await Promise.all([
        getOwnersByDongHo(dong, ho),
        getIdUploads(dong, ho),
      ]);
    } else {
      const [rateLimited, consented, o, e] = await Promise.all([
        checkRateLimit(ip),
        isConsented(dong, ho),
        getOwnersByDongHo(dong, ho),
        getIdUploads(dong, ho),
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
      owners = o;
      existingUploads = e;
    }

    const idx = Number(ownerIndex);
    if (!Number.isInteger(idx) || idx < 0 || idx >= owners.length + EXTRA_SLOT_MAX) {
      return NextResponse.json({ error: '잘못된 소유자 선택입니다.' }, { status: 400 });
    }

    let realName: string;
    if (idx < owners.length) {
      // 감지된 소유자 슬롯 — 이름 일치 확인 (공백 무시). 관리자는 검증 생략.
      realName = owners[idx];
      if (
        !isAdmin &&
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

    // 관리자는 전화번호 선택(빈 값 허용). 주민은 기존대로 필수.
    const phone = typeof rawPhone === 'string' ? rawPhone.trim() : '';
    if (!isAdmin && !isValidPhone(phone)) {
      return NextResponse.json({ error: '올바른 연락처를 입력해 주세요.' }, { status: 400 });
    }

    // 정정윈도우 잠금은 주민에게만 적용. 관리자는 이미 제출된 슬롯도 덮어쓰기 허용.
    if (!isAdmin) {
      const existingForSlot = existingUploads.find((u) => u.ownerIndex === idx);
      if (existingForSlot && !isCorrectionWindowOpen(existingForSlot.correctionAllowedAt)) {
        return NextResponse.json(
          { error: '이미 제출된 슬롯입니다. 수정이 필요하면 위원에게 문의해 주세요.' },
          { status: 403 },
        );
      }
    }

    const ext = mimeType === 'image/png' ? 'png' : 'jpg';
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const safeName = realName.replace(/[\\/:*?"<>|]/g, '');
    const fileName = `${dong}-${ho}-${safeName}-${idx + 1}-${ts}.${ext}`;

    const { link, fileId } = await uploadIdImage(fileName, mimeType || 'image/jpeg', base64);

    // 기록 + 인증로그는 서로 독립 → 병렬 (#1 속도)
    const [prevFileId] = await Promise.all([
      recordIdUpload({ dong, ho, ownerName: realName, ownerIndex: idx, fileName, fileId, link, ip, phone }),
      appendVerifyLog(dong, ho, realName, isAdmin ? '신분증업로드(관리자)' : '신분증업로드', ip),
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

// ── 현황 조회: 주민(토큰) 또는 관리자(pw / 관리자 열람토큰) ────
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const t = sp.get('t');
    const pw = sp.get('pw');
    const qDong = sp.get('dong');
    const qHo = sp.get('ho');

    let dong: string;
    let ho: string;
    let isAdmin = false;

    if (t) {
      const adminTok = verifyAdminViewToken(t);
      if (adminTok.valid) {
        dong = adminTok.dong;
        ho = adminTok.ho;
        isAdmin = true;
      } else {
        const tok = verifyToken(t);
        if (!tok.valid) {
          return NextResponse.json({ error: '유효하지 않은 접근입니다.' }, { status: 401 });
        }
        dong = tok.dong;
        ho = tok.ho;
      }
    } else if (pw && pw === process.env.APP_PASSWORD && qDong && qHo) {
      dong = String(qDong).trim();
      ho = String(qHo).trim();
      isAdmin = true;
    } else {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 401 });
    }

    const [owners, uploads] = await Promise.all([
      getOwnersByDongHo(dong, ho),
      getIdUploads(dong, ho),
    ]);
    // 주민 토큰(동/호/이름만으로 발급되는 약한 인증)에는 fileId/link를 절대 보내지 않는다 —
    // 이 값들로 /api/upload-id/image를 거치면 신분증 사진 원본까지 받아갈 수 있었다(수정 완료).
    // 전화번호도 정정윈도우가 열린(=본인이 다시 편집 가능한) 슬롯에서만 돌려준다.
    const uploaded = uploads.map((u) => {
      const correctionAllowed = isCorrectionWindowOpen(u.correctionAllowedAt);
      return {
        ownerIndex: u.ownerIndex,
        ownerName: u.ownerName,
        fileName: u.fileName,
        fileId: isAdmin ? u.fileId : '',
        link: isAdmin ? u.link : '',
        timestamp: u.timestamp,
        phone: isAdmin || correctionAllowed ? u.phone : '',
        correctionAllowed,
      };
    });
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
