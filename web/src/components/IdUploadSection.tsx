'use client';

import { useState, useEffect, useCallback } from 'react';
import { isValidPhone } from '@/lib/phone-format';
import { compressImage } from '@/lib/image-compress';

interface UploadedItem {
  ownerIndex: number;
  ownerName: string;
  fileName: string;
  timestamp: string;
  phone?: string;
  correctionAllowed?: boolean;
}

interface Props {
  token: string;
  owners: string[];
  initialUploaded: UploadedItem[];
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// initialUploaded 기준으로 (감지 소유자 외) 추가 슬롯 개수 계산
function extraFromUploads(ups: UploadedItem[], ownerCount: number): number {
  let max = 0;
  for (const u of ups) {
    if (u.ownerIndex >= ownerCount) max = Math.max(max, u.ownerIndex - ownerCount + 1);
  }
  return max;
}

export default function IdUploadSection({ token, owners, initialUploaded }: Props) {
  // 이 세대에 기존 제출 기록이 있으면 이미 개인정보 수집·이용에 동의한 적 있는 것 →
  // 다시 방문했을 때 체크박스를 매번 새로 받을 필요 없음
  const [agreed, setAgreed] = useState(() => initialUploaded.length > 0);
  const [phones, setPhones] = useState<Record<number, string>>({});
  const [uploaded, setUploaded] = useState<Record<number, UploadedItem>>(() => {
    const m: Record<number, UploadedItem> = {};
    for (const u of initialUploaded) m[u.ownerIndex] = u;
    return m;
  });
  // 감지된 소유자 수를 넘는 추가 슬롯 개수 (데이터 정규화 불완전 대비)
  const [extraCount, setExtraCount] = useState(() =>
    extraFromUploads(initialUploaded, owners.length),
  );
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState('');

  // 마운트 시 현재 업로드 현황 재조회 — SSR prop이 비어 있어도 항상 최신 상태 표시 (#2)
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/upload-id?t=${encodeURIComponent(token)}`);
      if (!res.ok) return;
      const data = await res.json();
      const ups: UploadedItem[] = data.uploaded || [];
      const m: Record<number, UploadedItem> = {};
      for (const u of ups) m[u.ownerIndex] = u;
      setUploaded(m);
      setExtraCount((c) => Math.max(c, extraFromUploads(ups, owners.length)));
      if (ups.length > 0) setAgreed(true);
    } catch {
      /* 조회 실패 시 SSR 초기값 유지 */
    }
  }, [token, owners.length]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleFile(index: number, label: string, file: File | null) {
    if (!file) return;
    const phone = (phones[index] ?? '').trim();
    if (!isValidPhone(phone)) {
      setError('올바른 연락처를 입력해 주세요.');
      return;
    }
    setError('');
    setBusy(index);
    try {
      const { base64, mimeType } = await compressImage(file);
      const res = await fetch('/api/upload-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: token, ownerIndex: index, ownerName: label, mimeType, base64, phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '업로드에 실패했습니다.');
        return;
      }
      setUploaded((prev) => ({
        ...prev,
        [index]: {
          ownerIndex: index,
          ownerName: label,
          fileName: file.name,
          timestamp: new Date().toISOString(),
          phone,
          correctionAllowed: false,
        },
      }));
    } catch {
      setError('업로드 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setBusy(null);
    }
  }

  // 렌더할 슬롯 목록: 감지된 소유자 + 추가 슬롯
  const slots: { index: number; label: string; named: boolean }[] = [];
  owners.forEach((name, i) => slots.push({ index: i, label: name, named: true }));
  for (let k = 0; k < extraCount; k++) {
    const index = owners.length + k;
    slots.push({
      index,
      label: uploaded[index]?.ownerName || `추가 신분증 ${k + 1}`,
      named: false,
    });
  }

  return (
    <div className="border-t border-gray-100 pt-4 mt-4">
      <div className="text-xs font-semibold text-gray-500 mb-2">신분증 사본 제출</div>

      <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-[11px] leading-relaxed text-amber-800 mb-3">
        <p className="font-semibold text-center mb-1.5 text-[12px]">개인정보 수집·이용 동의</p>
        <p className="mb-2">
          본인은 &lsquo;서울시 신속통합기획&rsquo; 신청 접수 및 이와 관련된 소유자 확인 등을 위해
          아래와 같이 개인정보를 수집·이용하는 것에 동의합니다.
        </p>

        <p className="font-semibold mt-2">1. 수집·이용 목적</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>신속통합기획 신청 접수를 위한 소유자 본인 확인</li>
          <li>토지 등 소유자 정보(등기사항 등) 확인 및 최신 정보 갱신</li>
          <li>신속통합기획 추진 관련 안내 및 고지사항 전달</li>
        </ul>

        <p className="font-semibold mt-2">2. 수집 항목</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>필수항목: 신분증 사본 이미지 (성명, 주민등록번호, 전화번호, 소유주 자격사항(소유권 현황, 주소 등) 포함)</li>
        </ul>

        <p className="font-semibold mt-2">3. 보유 및 이용 기간</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>수집·이용 동의일로부터 서울시 신속통합기획 구역 지정 완료 시까지</li>
          <li>(단, 관련 법령의 규정에 따라 보존할 필요가 있는 경우 해당 기간까지 보관 후 파기함)</li>
        </ul>

        <p className="font-semibold mt-2">4. 동의를 거부할 권리 및 거부에 따른 불이익</p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>귀하는 본 개인정보 수집·이용 동의를 거부할 권리가 있습니다.</li>
          <li>
            단, 필수항목 수집에 동의하지 않으실 경우 소유자 확인 및 자격 검증이 불가능하므로
            신속통합기획 신청 접수가 되지 않습니다.
          </li>
        </ul>

        <p className="mt-2">※ 업로드된 파일은 비공개로 보관되며 운영진만 열람합니다.</p>

        <label className="flex items-center gap-2 mt-2.5 font-semibold text-amber-900">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="w-4 h-4"
          />
          위 내용을 충분히 숙지하였으며, 이에 동의합니다 (필수)
        </label>
      </div>

      <p className="text-[11px] text-gray-500 mb-3">
        공동소유 세대는 <b>소유자 각각</b>의 신분증을 올려주세요. 신분증은{' '}
        <b>가리지 말고 원본 그대로</b> 선명하게 촬영해 주세요. 표시된 소유자가 실제와 다르면
        아래 <b>＋ 신분증 추가</b>로 더 올릴 수 있습니다.
      </p>

      <div className="space-y-2">
        {slots.length === 0 && (
          <p className="text-xs text-gray-400">등록된 소유자 정보가 없습니다. 위원에게 문의해 주세요.</p>
        )}
        {slots.map(({ index, label }) => {
          const done = uploaded[index];
          const isBusy = busy === index;
          const locked = !!done && !done.correctionAllowed;
          const canUploadNow = !done || done.correctionAllowed;
          const phoneValue = phones[index] ?? done?.phone ?? '';
          const phoneOk = isValidPhone(phoneValue);
          return (
            <div
              key={index}
              className="border border-gray-200 rounded-xl px-3 py-2.5 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-700 truncate">{label}</div>
                  <div className={`text-[11px] ${done ? 'text-green-600' : 'text-gray-400'}`}>
                    {isBusy
                      ? '업로드 중…'
                      : done
                        ? locked
                          ? `✓ 제출완료${done.timestamp ? ` · ${fmtTime(done.timestamp)}` : ''} · 수정은 위원에게 문의`
                          : `✓ 제출됨${done.timestamp ? ` · ${fmtTime(done.timestamp)}` : ''} (다시 올리면 교체)`
                        : '미제출'}
                  </div>
                </div>
                {canUploadNow && (
                  <label
                    className={`shrink-0 text-xs font-semibold px-3 py-2 rounded-lg cursor-pointer ${
                      agreed && !isBusy && phoneOk
                        ? 'bg-[#2F5496] text-white'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {done ? '재촬영' : '촬영/선택'}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      disabled={!agreed || isBusy || !phoneOk}
                      onChange={(e) => {
                        handleFile(index, label, e.target.files?.[0] ?? null);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </div>
              {canUploadNow && (
                <input
                  type="tel"
                  placeholder="연락처 (010-1234-5678)"
                  value={phoneValue}
                  onChange={(e) => setPhones((prev) => ({ ...prev, [index]: e.target.value }))}
                  disabled={isBusy}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#2F5496]"
                />
              )}
            </div>
          );
        })}
      </div>

      {slots.length > 0 && (
        <button
          type="button"
          onClick={() => setExtraCount((c) => c + 1)}
          disabled={busy !== null || extraCount >= 10}
          className="mt-2 w-full text-xs font-semibold text-[#2F5496] border border-dashed border-[#2F5496]/40 rounded-xl py-2.5 disabled:opacity-40"
        >
          ＋ 신분증 추가 (공동소유·추가 제출용)
        </button>
      )}

      {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
    </div>
  );
}
