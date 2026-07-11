import Link from 'next/link';
import { verifyToken } from '@/lib/kakao-verify';
import { getMasterRows, getOwnersByDongHo } from '@/lib/owner-sheets';
import { getIdUploads, isCorrectionWindowOpen } from '@/lib/id-upload';
import { getAllSurveyConfigs } from '@/lib/surveys/registry';
import type { UnifiedRow } from '@/lib/unified-types';
import IdUploadSection from '@/components/IdUploadSection';

const shortSurveyLabel = (id: string) =>
  id.replace(/_완료$/, '').replace(/^\d{4}_\d{2}_/, '');

function Chip({ done, label }: { done: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-sm leading-none px-3 py-2 rounded-full border ${
        done
          ? 'bg-green-50 text-green-700 border-green-200'
          : 'bg-red-50/60 text-red-500 border-red-200'
      }`}
    >
      <span className="font-bold">{done ? '✓' : '✗'}</span>
      <span className="whitespace-nowrap">{label}</span>
    </span>
  );
}

export default async function CheckSubmissionResultPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;

  if (!t) {
    return <ErrorView message="잘못된 접근입니다." />;
  }

  const result = verifyToken(t);

  if (!result.valid) {
    if (result.reason === 'expired') {
      return <ExpiredView />;
    }
    return <ErrorView message="유효하지 않은 링크입니다." />;
  }

  const [{ rows, surveyIds }, surveyConfigs] = await Promise.all([
    getMasterRows(),
    Promise.resolve(getAllSurveyConfigs()),
  ]);

  const row = rows.find((r) => r.dong === result.dong && r.ho === result.ho);

  if (!row) {
    return <NotFoundView dong={result.dong} ho={result.ho} />;
  }

  const displayIdToTitle = new Map<string, string>();
  for (const cfg of surveyConfigs) {
    const key = cfg.displayId || cfg.id;
    displayIdToTitle.set(key, cfg.title);
  }

  const surveyLabel = (id: string) =>
    displayIdToTitle.get(id) ?? shortSurveyLabel(id);

  // 사전동의 완료 세대에만 신분증 업로드 노출 → 완료 시에만 소유자/현황 조회
  let owners: string[] = [];
  let uploaded: {
    ownerIndex: number;
    ownerName: string;
    fileName: string;
    timestamp: string;
    phone: string;
    correctionAllowed: boolean;
  }[] = [];
  if (row.consent) {
    const [o, ups] = await Promise.all([
      getOwnersByDongHo(result.dong, result.ho),
      getIdUploads(result.dong, result.ho),
    ]);
    owners = o;
    uploaded = ups.map((u) => ({
      ownerIndex: u.ownerIndex,
      ownerName: u.ownerName,
      fileName: u.fileName,
      timestamp: u.timestamp,
      phone: u.phone,
      correctionAllowed: isCorrectionWindowOpen(u.correctionAllowedAt),
    }));
  }

  return (
    <ResultView
      row={row}
      surveyIds={surveyIds}
      surveyLabel={surveyLabel}
      token={t}
      owners={owners}
      uploaded={uploaded}
    />
  );
}

function ResultView({
  row,
  surveyIds,
  surveyLabel,
  token,
  owners,
  uploaded,
}: {
  row: UnifiedRow;
  surveyIds: string[];
  surveyLabel: (id: string) => string;
  token: string;
  owners: string[];
  uploaded: {
    ownerIndex: number;
    ownerName: string;
    fileName: string;
    timestamp: string;
    phone: string;
    correctionAllowed: boolean;
  }[];
}) {
  const missingSurveys = surveyIds.filter((id) => !row.surveys[id]);
  const hasAnyMissing = !row.consent || missingSurveys.length > 0;

  return (
    <div className="min-h-screen bg-[#2F5496] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl">
        <div className="text-center mb-5">
          <div className="text-4xl mb-2">📋</div>
          <h1 className="text-xl font-bold text-[#2F5496]">제출 현황</h1>
          <p className="text-sm text-gray-500 mt-1">
            {row.dong}동 {row.ho}호
            {row.ownerName ? ` · ${row.ownerName}` : ''}
          </p>
        </div>

        <div className="border-t border-gray-100 pt-4 space-y-4">
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-2">
              신속통합동의서 (사전동의)
            </div>
            <Chip done={row.consent} label={row.consent ? '제출 완료' : '미제출'} />
          </div>

          <div>
            <div className="text-xs font-semibold text-gray-500 mb-2">설문</div>
            {surveyIds.length === 0 ? (
              <p className="text-xs text-gray-400">등록된 설문이 없습니다.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {surveyIds.map((id) => (
                  <Chip
                    key={id}
                    done={row.surveys[id] ?? false}
                    label={surveyLabel(id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {row.consent && (
          <IdUploadSection token={token} owners={owners} initialUploaded={uploaded} />
        )}

        {hasAnyMissing && (
          <p className="mt-5 text-xs text-gray-500 bg-amber-50 rounded-xl p-3 leading-relaxed">
            미제출 항목이 있습니다. 아래 페이지에서 제출을 완료해 주세요.
            {!row.consent && (
              <span className="block mt-1">· 신속통합동의서는 위원에게 문의</span>
            )}
            {missingSurveys.map((id) => (
              <Link
                key={id}
                href={`/survey/${findSurveyIdByDisplayId(id) ?? id}`}
                className="block mt-1 text-[#2F5496] font-semibold underline"
              >
                · {surveyLabel(id)} 제출하기
              </Link>
            ))}
          </p>
        )}

        <Link
          href="/check-submission"
          className="mt-5 block w-full py-3.5 bg-[#2F5496] text-white rounded-2xl text-base font-bold text-center"
        >
          다시 확인하기
        </Link>
      </div>
    </div>
  );
}

function findSurveyIdByDisplayId(displayId: string): string | null {
  for (const cfg of getAllSurveyConfigs()) {
    if ((cfg.displayId || cfg.id) === displayId) return cfg.id;
  }
  return null;
}

function ExpiredView() {
  return (
    <div className="min-h-screen bg-[#2F5496] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl text-center">
        <div className="text-4xl mb-3">⏱️</div>
        <h2 className="text-lg font-bold text-gray-700 mb-2">확인 링크가 만료되었습니다</h2>
        <p className="text-sm text-gray-500 mb-6">
          유효 시간(30분)이 지났습니다. 다시 확인해 주세요.
        </p>
        <Link
          href="/check-submission"
          className="block w-full py-4 bg-[#2F5496] text-white rounded-2xl text-base font-bold"
        >
          다시 확인하기
        </Link>
      </div>
    </div>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[#2F5496] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl text-center">
        <div className="text-4xl mb-3">⚠️</div>
        <h2 className="text-lg font-bold text-gray-700 mb-2">오류</h2>
        <p className="text-sm text-gray-500 mb-6">{message}</p>
        <Link
          href="/check-submission"
          className="block w-full py-4 bg-[#2F5496] text-white rounded-2xl text-base font-bold"
        >
          처음으로 돌아가기
        </Link>
      </div>
    </div>
  );
}

function NotFoundView({ dong, ho }: { dong: string; ho: string }) {
  return (
    <div className="min-h-screen bg-[#2F5496] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl text-center">
        <div className="text-4xl mb-3">🔄</div>
        <h2 className="text-lg font-bold text-gray-700 mb-2">동기화 대기 중</h2>
        <p className="text-sm text-gray-500 mb-6">
          {dong}동 {ho}호의 통합현황 데이터가 아직 동기화되지 않았습니다.
          잠시 후 다시 시도해 주세요.
        </p>
        <Link
          href="/check-submission"
          className="block w-full py-4 bg-[#2F5496] text-white rounded-2xl text-base font-bold"
        >
          처음으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
