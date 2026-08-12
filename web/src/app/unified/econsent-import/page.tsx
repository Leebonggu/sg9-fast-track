'use client';

import { useState } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/AdminLayout';
import AdminNav from '@/components/AdminNav';
import { adminFetch } from '@/lib/admin-fetch';
import type { EconsentSummary } from '@/lib/econsent-import';
import type { EconsentChange } from '@/lib/econsent-sheets';

interface PreviewResponse {
  summary: EconsentSummary;
  isFirstUpload: boolean;
  changes: EconsentChange[];
  warnings: string[];
  batchId?: string;
}

function FilePicker({
  id, label, hint, file, onPick,
}: {
  id: string; label: string; hint: string; file: File | null; onPick: (f: File | null) => void;
}) {
  return (
    <div className="flex-1">
      <label
        htmlFor={id}
        className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-gray-300 rounded-2xl py-10 px-3 cursor-pointer hover:border-[#2F5496] hover:bg-white bg-white/60 transition-colors text-center"
      >
        <span className="text-xs font-semibold text-gray-400">{label}</span>
        <span className="text-sm font-semibold text-gray-700 break-all">
          {file ? file.name : '클릭해서 파일 선택'}
        </span>
        <span className="text-[11px] text-gray-400">{hint}</span>
      </label>
      <input
        id={id}
        type="file"
        accept=".xls,.xlsx"
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        className="hidden"
      />
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
      <div className="text-[11px] text-gray-400">{label}</div>
      <div className="text-xl font-bold text-gray-800">{value}</div>
      {sub && <div className="text-[11px] text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function EconsentImportPage() {
  const [sintoFile, setSintoFile] = useState<File | null>(null);
  const [planFile, setPlanFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [committed, setCommitted] = useState(false);

  function buildForm(): FormData {
    const fd = new FormData();
    fd.append('sinto', sintoFile!);
    fd.append('plan', planFile!);
    return fd;
  }

  async function handlePreview() {
    if (!sintoFile || !planFile) return;
    setLoading(true);
    setError('');
    setPreview(null);
    setCommitted(false);
    try {
      const res = await adminFetch('/api/unified/econsent/preview', { method: 'POST', body: buildForm() });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '미리보기 실패');
        return;
      }
      setPreview(data as PreviewResponse);
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    if (!sintoFile || !planFile) return;
    setCommitting(true);
    setError('');
    try {
      const fd = buildForm();
      const operatorName = typeof window !== 'undefined' ? sessionStorage.getItem('operatorName') : '';
      fd.append('uploader', operatorName || '');
      const res = await adminFetch('/api/unified/econsent/commit', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '업로드 실패');
        return;
      }
      setPreview(data as PreviewResponse);
      setCommitted(true);
    } finally {
      setCommitting(false);
    }
  }

  const s = preview?.summary;

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gray-50 pb-16">
        <div className="p-4 max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <Link href="/unified" className="text-xs text-gray-400 hover:text-gray-600 inline-flex items-center gap-1">
              ← 통합현황으로
            </Link>
            <Link href="/unified/donations-import" className="text-xs text-[#2F5496] hover:underline">
              후원금 일괄업로드 →
            </Link>
          </div>
          <h1 className="text-lg font-bold text-gray-800 mb-1">전자동의 명부 업로드</h1>
          <p className="text-xs text-gray-500 mb-4">
            서울시 전자동의 시스템에서 받은 「전자동의서 대상자관리」 엑셀 2개를 올립니다.
            같은 날 받은 한 쌍이어야 하며, 뒤바뀌면 자동으로 걸러집니다.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mb-3">
            <FilePicker
              id="sinto-file" label="신속통합" hint="(신속통합)…xlsx"
              file={sintoFile} onPick={setSintoFile}
            />
            <FilePicker
              id="plan-file" label="정비계획입안" hint="(정비계획입안)…xlsx"
              file={planFile} onPick={setPlanFile}
            />
          </div>

          <button
            onClick={handlePreview}
            disabled={!sintoFile || !planFile || loading}
            className="w-full text-base px-3 py-3 rounded-xl bg-[#2F5496] text-white font-semibold disabled:opacity-50"
          >
            {loading ? '분석 중...' : '미리보기'}
          </button>

          {error && <p className="text-sm text-red-500 mt-4 whitespace-pre-wrap">{error}</p>}

          {s && (
            <div className="mt-6">
              {committed && (
                <div className="mb-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3">
                  <p className="text-sm font-semibold text-green-800">업로드 완료</p>
                  <p className="text-xs text-green-700 mt-1">
                    통합현황에 반영하려면 <b>동기화를 1회 실행</b>해야 합니다. 전자동의 값은 sync가
                    매번 다시 계산하는 파생값이라 업로드만으로는 표에 나타나지 않습니다.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                <Stat label="세대" value={s.households.toLocaleString()} sub={`소유자 ${s.owners.toLocaleString()}명`} />
                <Stat label="신속통합 전자동의" value={s.sinto.full} sub={`일부제출 ${s.sinto.part}`} />
                <Stat label="정비계획입안 전자동의" value={s.plan.full} sub={`일부제출 ${s.plan.part}`} />
                <Stat
                  label="공유 세대"
                  value={s.shared}
                  sub={`대표선임 ${s.sharedWithRep} · 미선임 ${s.shared - s.sharedWithRep}`}
                />
              </div>

              {Object.keys(s.planChoice).length > 0 && (
                <div className="mb-4 bg-white rounded-xl border border-gray-200 px-4 py-3">
                  <div className="text-[11px] text-gray-400 mb-1">추진방식 선택 (세대 기준)</div>
                  <div className="flex gap-4">
                    {Object.entries(s.planChoice).map(([k, v]) => (
                      <span key={k} className="text-sm text-gray-800">
                        {k} <b>{v}</b>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-500 mb-4">
                상가 {s.commercial}행은 소유자원본에 없어 제외했습니다. 소유자 미확인 호실 {s.unnamed}건은
                세대로는 유지됩니다.
              </p>

              {preview.warnings.length > 0 && (
                <details className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <summary className="text-sm font-semibold text-amber-800 cursor-pointer">
                    확인 필요 {preview.warnings.length}건
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {preview.warnings.map((w, i) => (
                      <li key={i} className="text-xs text-amber-900">• {w}</li>
                    ))}
                  </ul>
                </details>
              )}

              <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 mb-4">
                <div className="text-sm font-semibold text-gray-800 mb-2">
                  {preview.isFirstUpload
                    ? '최초 업로드 — 비교할 직전 명부가 없습니다'
                    : `직전 업로드 대비 변경 ${preview.changes.length}건`}
                </div>
                {!preview.isFirstUpload && preview.changes.length === 0 && (
                  <p className="text-xs text-gray-500">
                    변경이 없습니다. 같은 파일을 다시 올린 것일 수 있습니다.
                  </p>
                )}
                {preview.changes.length > 0 && (
                  <div className="max-h-80 overflow-y-auto overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-white">
                        <tr className="text-gray-400 text-left">
                          <th className="py-1 pr-2 font-medium">세대</th>
                          <th className="py-1 pr-2 font-medium">이름</th>
                          <th className="py-1 pr-2 font-medium">항목</th>
                          <th className="py-1 pr-2 font-medium">이전</th>
                          <th className="py-1 font-medium">이후</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.changes.map((c, i) => (
                          <tr key={i} className="border-t border-gray-100">
                            <td className="py-1 pr-2 whitespace-nowrap">{c.dong}-{c.ho}</td>
                            <td className="py-1 pr-2 whitespace-nowrap">{c.name || '—'}</td>
                            <td className="py-1 pr-2 whitespace-nowrap text-gray-500">{c.field}</td>
                            <td className="py-1 pr-2 text-gray-400">{c.oldValue || '∅'}</td>
                            <td className="py-1 font-medium text-gray-800">{c.newValue || '∅'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {!committed && (
                <button
                  onClick={handleCommit}
                  disabled={committing}
                  className="w-full text-sm px-4 py-3 rounded-xl bg-green-600 text-white font-semibold disabled:opacity-50"
                >
                  {committing ? '업로드 중...' : '이 내용으로 확정'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <AdminNav />
    </AdminLayout>
  );
}
