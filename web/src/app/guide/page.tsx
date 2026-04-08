import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '사용 가이드 - 상계주공 9단지 사전동의 관리',
};

function MockCell({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <div className={`w-14 h-11 flex items-center justify-center text-xs border border-gray-300 rounded ${className}`}>
      {children}
    </div>
  );
}

function Step({ num, text }: { num: number; text: string }) {
  return (
    <div className="flex items-start gap-2.5 mb-2">
      <span className="w-5 h-5 flex-shrink-0 bg-[#2F5496] text-white rounded-full text-xs flex items-center justify-center font-semibold mt-0.5">
        {num}
      </span>
      <span className="text-sm text-gray-700 leading-relaxed">{text}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm mb-3">
      <h2 className="font-semibold text-sm text-[#2F5496] mb-3">{title}</h2>
      {children}
    </div>
  );
}

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-[#2F5496] text-white p-3.5 flex items-center sticky top-0 z-40">
        <Link href="/" className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/20 active:bg-white/30 mr-2 text-lg">←</Link>
        <div className="flex-1">
          <h1 className="font-semibold text-sm">상계주공 9단지</h1>
          <p className="text-xs opacity-80">사용 가이드</p>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-3 py-4">

        {/* 1. 색상 안내 */}
        <Section title="색상 안내">
          <p className="text-xs text-gray-500 mb-3">동별 그리드에서 각 셀의 색상은 다음을 의미합니다.</p>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex items-center gap-2.5">
              <MockCell className="bg-green-600 text-white font-semibold">홍길동</MockCell>
              <div>
                <p className="text-xs font-semibold text-gray-700">수거완료</p>
                <p className="text-[11px] text-gray-400">동의서 수거 완료</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <MockCell className="bg-blue-50 text-blue-600 font-semibold">김철수</MockCell>
              <div>
                <p className="text-xs font-semibold text-gray-700">온라인 접수</p>
                <p className="text-[11px] text-gray-400">구글폼으로 등록</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <MockCell className="bg-amber-50 text-black font-semibold">이영희</MockCell>
              <div>
                <p className="text-xs font-semibold text-gray-700">수동 입력</p>
                <p className="text-[11px] text-gray-400">웹에서 직접 입력</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <MockCell className="bg-gray-50 text-gray-300">·</MockCell>
              <div>
                <p className="text-xs font-semibold text-gray-700">미접수</p>
                <p className="text-[11px] text-gray-400">아직 동의 없음</p>
              </div>
            </div>
          </div>
        </Section>

        {/* 2. 동의서 등록 */}
        <Section title="동의서 등록하기">
          <Step num={1} text="메인 화면에서 등록할 동 카드를 터치합니다." />
          <Step num={2} text="그리드에서 빈 셀(회색, · 표시)을 터치합니다." />
          <Step num={3} text="하단에 뜨는 창에서 이름을 입력합니다." />
          <Step num={4} text="동의서를 이미 수거한 경우, '동의서를 수거하였습니까?' 체크박스를 선택합니다." />
          <Step num={5} text="저장 버튼을 누르면 등록 완료됩니다." />
          <div className="mt-3 bg-blue-50 rounded-lg p-2.5">
            <p className="text-xs text-blue-700">입력경로가 "수동입력(웹)"으로 자동 기록됩니다.</p>
          </div>
        </Section>

        {/* 3. 수정 및 수거 처리 */}
        <Section title="이름 수정 / 수거 처리">
          <Step num={1} text="이름이 표시된 셀을 터치하면 상세 창이 열립니다." />
          <Step num={2} text="이름을 수정하고 저장을 누르면 변경됩니다." />
          <div className="my-3 border-t border-gray-100" />
          <p className="text-xs font-semibold text-gray-600 mb-2">동의서 수거 처리</p>
          <Step num={1} text="상세 창에서 동의서 수거 버튼을 터치합니다." />
          <div className="flex gap-2 mt-2 mb-1">
            <div className="flex-1 p-2 rounded-lg text-center text-xs font-semibold bg-gray-100 text-gray-500 border-2 border-gray-200">
              미수거
            </div>
            <span className="text-gray-400 self-center text-xs">→</span>
            <div className="flex-1 p-2 rounded-lg text-center text-xs font-semibold bg-green-100 text-green-700 border-2 border-green-300">
              완료
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">터치할 때마다 미수거/완료가 전환됩니다.</p>
        </Section>

        {/* 4. 삭제 */}
        <Section title="삭제하기">
          <Step num={1} text="이름이 표시된 셀을 터치합니다." />
          <Step num={2} text="빨간색 삭제 버튼을 누릅니다." />
          <Step num={3} text='확인창에 "삭제"를 입력하면 삭제됩니다.' />
          <div className="mt-3 bg-red-50 rounded-lg p-2.5">
            <p className="text-xs text-red-600">삭제된 데이터는 복구할 수 없습니다. 신중하게 사용해주세요.</p>
          </div>
        </Section>

        {/* 5. 내보내기 */}
        <Section title="내보내기 (CSV / 이미지)">
          <p className="text-xs text-gray-500 mb-3">동별 그리드 상단의 버튼으로 데이터를 내보낼 수 있습니다.</p>
          <div className="flex gap-2 mb-3">
            <div className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-600 font-medium">CSV</div>
            <div className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-600 font-medium">IMG</div>
          </div>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-xs font-semibold text-gray-600 w-8 flex-shrink-0">CSV</span>
              <span className="text-xs text-gray-500">호수, 성명, 연락처, 입력경로, 등록일, 수거여부가 포함된 엑셀 호환 파일</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xs font-semibold text-gray-600 w-8 flex-shrink-0">IMG</span>
              <span className="text-xs text-gray-500">현재 그리드 화면을 그대로 이미지(PNG)로 저장</span>
            </div>
          </div>
        </Section>

        {/* 6. 전체 현황 */}
        <Section title="전체 현황 보기">
          <Step num={1} text='메인 화면 우측 상단의 "현황" 버튼을 누릅니다.' />
          <Step num={2} text="23개 동의 접수, 수거, 세대수, 접수율을 한눈에 확인할 수 있습니다." />
        </Section>

        {/* 7. 홈 화면에 추가 */}
        <Section title="홈 화면에 추가 (앱처럼 사용)">
          <p className="text-xs text-gray-500 mb-3">홈 화면에 추가하면 앱처럼 전체화면으로 열립니다.</p>
          <div className="bg-gray-50 rounded-lg p-3 mb-3">
            <p className="text-xs font-semibold text-gray-700 mb-2">iPhone (Safari)</p>
            <Step num={1} text="Safari로 이 사이트에 접속합니다." />
            <Step num={2} text="하단의 공유 버튼 (↑ 모양)을 터치합니다." />
            <Step num={3} text='"홈 화면에 추가"를 선택합니다.' />
            <Step num={4} text='"추가"를 누르면 홈 화면에 아이콘이 생깁니다.' />
            <p className="text-[11px] text-red-500 mt-1 ml-7">* iPhone은 Safari에서만 가능합니다. Chrome에서는 홈 화면 추가가 지원되지 않습니다.</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-700 mb-2">Android (Chrome)</p>
            <Step num={1} text="Chrome으로 이 사이트에 접속합니다." />
            <Step num={2} text="우측 상단 점 세개(⋮) 메뉴를 터치합니다." />
            <Step num={3} text='"홈 화면에 추가"를 선택합니다.' />
          </div>
        </Section>

        {/* 하단 링크 */}
        <Link
          href="/"
          className="block w-full p-3.5 bg-[#2F5496] text-white rounded-xl text-center font-semibold text-sm active:bg-[#1e3a6e] mb-6"
        >
          시스템 바로가기 →
        </Link>
      </div>
    </div>
  );
}
