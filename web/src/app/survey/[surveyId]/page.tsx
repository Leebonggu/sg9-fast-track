'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import QRCode from 'qrcode';
import MissingRespondents from '@/components/survey/MissingRespondents';
import SurveyAnalytics from '@/components/survey/SurveyAnalytics';

type BasicInfoFieldMeta = { key: string; label: string };
type SurveyQuestion = { id: string; label: string; options: string[] };

type SurveyResponse = {
  rowIndex: number;
  timestamp: string;
  basicInfo: Record<string, string>;
  answers: Record<string, string>;
  entryPath: string;
  pdfGenerated: boolean;
  pdfLink: string;
};

type SurveyStats = { total: number; generated: number; pending: number };

type SurveyConfigMeta = {
  id: string;
  title: string;
  basicInfoFields: BasicInfoFieldMeta[];
  questions: SurveyQuestion[];
  isClosed: boolean;
  closedAt: string;
};

export default function SurveyDetailPage() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [config, setConfig] = useState<SurveyConfigMeta | null>(null);
  const [stats, setStats] = useState<SurveyStats | null>(null);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'missing' | 'analytics'>('list');

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('auth') === '1') {
      setAuthed(true);
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surveyId]);

  useEffect(() => {
    if (!config) return;
    const formUrl = `${window.location.origin}/survey/${config.id}/form`;
    QRCode.toDataURL(formUrl, { width: 300, margin: 2 }).then(setQrDataUrl);
  }, [config]);

  async function doLogin() {
    if (!password) return;
    setLoginError('');
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (data.ok) {
      sessionStorage.setItem('auth', '1');
      setAuthed(true);
      loadData();
    } else {
      setLoginError('비밀번호가 올바르지 않습니다.');
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/survey/${surveyId}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setConfig(data.config);
      setStats(data.stats);
      setResponses(data.responses);
    } catch (e) {
      setMessage('데이터 로딩 실패: ' + (e instanceof Error ? e.message : String(e)));
    }
    setLoading(false);
  }

  async function doGenerate(mode: string, rowIndex?: number) {
    const key = mode === 'single' ? String(rowIndex) : mode;
    setGenerating(key);
    setMessage('');
    try {
      if (mode === 'all') {
        let totalDone = 0;
        let remaining = 1;
        while (remaining > 0) {
          const res = await fetch(`/api/survey/${surveyId}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode }),
          });
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          totalDone += data.count;
          remaining = data.remaining;
          if (remaining > 0) {
            setMessage(`${totalDone}건 완료, ${remaining}건 남음...`);
          }
        }
        setMessage(`${totalDone}건 생성 완료`);
      } else {
        const res = await fetch(`/api/survey/${surveyId}/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode, rowIndex }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        if (mode === 'blank') {
          setMessage('빈 설문지 생성 완료');
          if (data.links?.[0]) window.open(data.links[0], '_blank');
        } else {
          setMessage(`${data.count}건 생성 완료`);
        }
      }
      await loadData();
    } catch (e) {
      setMessage('생성 실패: ' + (e instanceof Error ? e.message : String(e)));
    }
    setGenerating(null);
  }

  const duplicateMap = useMemo(() => {
    const countMap = new Map<string, number>();
    for (const r of responses) {
      const key = `${r.basicInfo.dong}_${r.basicInfo.ho}`;
      countMap.set(key, (countMap.get(key) || 0) + 1);
    }
    const dupes = new Map<string, number>();
    for (const [key, count] of countMap) {
      if (count > 1) dupes.set(key, count);
    }
    return dupes;
  }, [responses]);

  // 질문별 응답 통계 계산
  const questionStats = useMemo(() => {
    if (!config || responses.length === 0) return [];
    return config.questions.map((q) => {
      const counts: Record<string, number> = {};
      q.options.forEach((opt) => (counts[opt] = 0));
      responses.forEach((r) => {
        const ans = r.answers[q.id];
        if (ans && counts[ans] !== undefined) counts[ans]++;
      });
      return { question: q, counts, total: responses.length };
    });
  }, [config, responses]);

  function formatDongHo(basicInfo: Record<string, string>) {
    return `${basicInfo.dong || ''} ${basicInfo.ho || ''}호`.trim();
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#2F5496] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-10 w-full max-w-sm text-center shadow-2xl">
          <h1 className="text-xl font-bold text-[#2F5496]">상계주공 9단지</h1>
          <p className="text-sm text-gray-400 mb-6">설문 관리 시스템</p>
          <input
            type="password"
            className="w-full p-3.5 border-2 border-gray-200 rounded-xl text-center text-lg outline-none focus:border-[#2F5496]"
            placeholder="비밀번호 입력"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doLogin()}
          />
          <button
            onClick={doLogin}
            className="w-full mt-3 p-3.5 bg-[#2F5496] text-white rounded-xl text-lg font-semibold active:bg-[#1e3a6e]"
          >
            입장
          </button>
          {loginError && <p className="text-red-500 text-sm mt-2">{loginError}</p>}
        </div>
      </div>
    );
  }

  const extraFields = (config?.basicInfoFields || []).filter(
    (f) => !['dong', 'ho', 'name'].includes(f.key),
  );
  const formUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/survey/${surveyId}/form`
    : '';

  return (
    <div className="min-h-screen bg-gray-50">
      {loading && (
        <div className="fixed inset-0 bg-white/80 flex items-center justify-center z-50">
          <div className="w-8 h-8 border-3 border-gray-200 border-t-[#2F5496] rounded-full animate-spin mr-3" />
          <span className="text-gray-500">로딩 중...</span>
        </div>
      )}

      <header className="bg-[#2F5496] text-white p-3.5 flex items-center sticky top-0 z-40">
        <Link
          href="/survey"
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/20 active:bg-white/30 mr-2 text-lg"
        >
          ←
        </Link>
        <span className="font-semibold flex-1 truncate">{config?.title || '설문 관리'}</span>
        {config?.isClosed && (
          <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full mr-2">마감</span>
        )}
        <button
          onClick={() => setShowQr(true)}
          className="bg-white/20 px-3 py-1.5 rounded-lg text-sm mr-2"
        >
          QR
        </button>
        <button onClick={() => loadData()} className="bg-white/20 px-3 py-1.5 rounded-lg text-sm">
          새로고침
        </button>
      </header>

      <div className="sticky top-[64px] z-30 bg-white border-b border-gray-200 flex">
        {(['list', 'missing', 'analytics'] as const).map((tab) => {
          const labels = { list: '응답 목록', missing: '미응답', analytics: '통계 분석' };
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === tab
                  ? 'text-[#2F5496] border-b-2 border-[#2F5496]'
                  : 'text-gray-500'
              }`}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      <div className="p-3 space-y-3">
        {activeTab === 'list' && (<>
        {/* 현황 카드 */}
        {stats && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex gap-4">
              <div className="flex-1 text-center">
                <p className="text-xs text-gray-400">총 응답</p>
                <p className="text-2xl font-bold text-[#2F5496]">{stats.total}</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-xs text-gray-400">PDF 완료</p>
                <p className="text-2xl font-bold text-green-600">{stats.generated}</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-xs text-gray-400">미생성</p>
                <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
              </div>
              {duplicateMap.size > 0 && (
                <div className="flex-1 text-center">
                  <p className="text-xs text-gray-400">중복</p>
                  <p className="text-2xl font-bold text-red-500">{duplicateMap.size}건</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="flex gap-2">
          <button
            onClick={() => doGenerate('all')}
            disabled={generating !== null || !stats?.pending}
            className="flex-1 p-3 bg-[#2F5496] text-white rounded-xl font-semibold text-sm disabled:opacity-50 active:bg-[#1e3a6e]"
          >
            {generating === 'all' ? '생성 중...' : `미생성분 일괄 생성 (${stats?.pending || 0}건)`}
          </button>
          <button
            onClick={() => doGenerate('blank')}
            disabled={generating !== null}
            className="p-3 bg-gray-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50 active:bg-gray-700"
          >
            {generating === 'blank' ? '생성 중...' : '빈 설문지'}
          </button>
        </div>

        {/* 메시지 */}
        {message && (
          <div className={`p-3 rounded-xl text-sm ${message.includes('실패') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
            {message}
          </div>
        )}

        {/* 응답 통계 */}
        {questionStats.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <button
              onClick={() => setShowStats((v) => !v)}
              className="w-full p-4 flex items-center justify-between text-left"
            >
              <span className="font-semibold text-sm text-gray-700">응답 통계</span>
              <span className="text-gray-400 text-sm">{showStats ? '▲' : '▼'}</span>
            </button>
            {showStats && (
              <div className="px-4 pb-4 space-y-5 border-t border-gray-100">
                {questionStats.map(({ question, counts, total }) => (
                  <div key={question.id}>
                    <p className="text-xs font-medium text-gray-500 mb-2 leading-snug">
                      {question.label}
                    </p>
                    <div className="space-y-1.5">
                      {question.options.map((opt) => {
                        const count = counts[opt] || 0;
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                        return (
                          <div key={opt}>
                            <div className="flex justify-between text-xs mb-0.5">
                              <span className="text-gray-600 truncate mr-2">{opt}</span>
                              <span className="text-gray-400 shrink-0">{count}명 ({pct}%)</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#2F5496] rounded-full transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 응답 목록 */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100 text-xs text-gray-500">
                  <th className="p-2 text-left">동/호</th>
                  <th className="p-2 text-left">성명</th>
                  {extraFields.map((f) => (
                    <th key={f.key} className="p-2 text-left">{f.label}</th>
                  ))}
                  <th className="p-2 text-left">입력경로</th>
                  <th className="p-2 text-left">시간</th>
                  <th className="p-2 text-center">상태</th>
                  <th className="p-2 text-center">액션</th>
                </tr>
              </thead>
              <tbody>
                {responses.length === 0 && (
                  <tr>
                    <td colSpan={6 + extraFields.length} className="p-8 text-center text-gray-400 text-sm">
                      응답이 없습니다
                    </td>
                  </tr>
                )}
                {responses.map((r) => {
                  const dupeKey = `${r.basicInfo.dong}_${r.basicInfo.ho}`;
                  const isDupe = duplicateMap.has(dupeKey);
                  return (
                  <tr key={r.rowIndex} className={`border-t ${isDupe ? 'bg-red-50 border-l-4 border-l-red-400' : 'border-gray-100'}`}>
                    <td className="p-2 text-sm font-medium">
                      {formatDongHo(r.basicInfo)}
                      {isDupe && <span className="ml-1 px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-[10px] font-semibold">중복</span>}
                    </td>
                    <td className="p-2 text-sm">{r.basicInfo.name || ''}</td>
                    {extraFields.map((f) => (
                      <td key={f.key} className="p-2 text-sm text-gray-600">{r.basicInfo[f.key] || ''}</td>
                    ))}
                    <td className="p-2 text-xs">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        r.entryPath === '온라인(구글)' ? 'bg-blue-100 text-blue-700' :
                        r.entryPath === '온라인(웹)' ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {r.entryPath || '수동'}
                      </span>
                    </td>
                    <td className="p-2 text-xs text-gray-400">{r.timestamp}</td>
                    <td className="p-2 text-center">
                      {r.pdfGenerated ? (
                        <a href={r.pdfLink} target="_blank" rel="noopener noreferrer"
                          className="inline-block px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                          완료
                        </a>
                      ) : (
                        <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs">대기</span>
                      )}
                    </td>
                    <td className="p-2 text-center">
                      {!r.pdfGenerated && (
                        <button
                          onClick={() => doGenerate('single', r.rowIndex)}
                          disabled={generating !== null}
                          className="px-2.5 py-1 bg-[#2F5496] text-white rounded text-xs font-medium disabled:opacity-50 active:bg-[#1e3a6e]"
                        >
                          {generating === String(r.rowIndex) ? '...' : '생성'}
                        </button>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        </>)}

        {activeTab === 'missing' && surveyId && (
          <MissingRespondents surveyId={surveyId} />
        )}
        {activeTab === 'analytics' && config && (
          <SurveyAnalytics config={config} responses={responses} />
        )}
      </div>

      {/* QR 모달 */}
      {showQr && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setShowQr(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-xs w-full text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-bold text-gray-800 mb-1">웹 설문 폼 QR</p>
            <p className="text-xs text-gray-400 mb-4 break-all">{formUrl}</p>
            {qrDataUrl && (
              <img src={qrDataUrl} alt="QR Code" className="mx-auto w-48 h-48" />
            )}
            <a
              href={qrDataUrl}
              download="survey-qr.png"
              className="mt-4 inline-block w-full py-2.5 bg-[#2F5496] text-white rounded-xl text-sm font-semibold"
            >
              이미지 저장
            </a>
            <button
              onClick={() => setShowQr(false)}
              className="mt-2 w-full py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
