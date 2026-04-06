'use client';

import { useState, useEffect } from 'react';

type BuildingInfo = {
  building: string;
  received: number;
  collected: number;
  total: number;
  receivedRate: number;
  collectedRate: number;
};

type DashboardData = {
  buildings: BuildingInfo[];
  totalReceived: number;
  totalCollected: number;
  totalUnits: number;
  receivedRate: number;
  collectedRate: number;
};

type GridInfo = {
  name: string;
  source: string;
  timestamp: string;
  phone: string;
  collected: boolean;
};

type BuildingData = {
  building: string;
  floors: number;
  units: number[];
  excludedUnits: string[];
  totalUnits: number;
  receivedCount: number;
  collectedCount: number;
  grid: Record<string, GridInfo>;
};

export default function Home() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [screen, setScreen] = useState<'main' | 'grid' | 'dashboard'>('main');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [buildingData, setBuildingData] = useState<BuildingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<{ unit: string; info: GridInfo | null } | null>(null);
  const [modalName, setModalName] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('auth') === '1') {
      setAuthed(true);
      loadDashboard();
    }

    // 브라우저 뒤로가기 처리
    function handlePopState(e: PopStateEvent) {
      const state = e.state;
      if (state?.screen) {
        setScreen(state.screen);
        if (state.screen === 'grid' && state.building) {
          loadBuilding(state.building);
        }
      } else {
        setScreen('main');
      }
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
      loadDashboard();
    } else {
      setLoginError('비밀번호가 올바르지 않습니다.');
    }
  }

  async function loadDashboard(pushHistory = true) {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard');
      const data = await res.json();
      setDashboard(data);
      setScreen('main');
      if (pushHistory) {
        window.history.pushState({ screen: 'main' }, '', '/');
      }
    } catch {
      alert('데이터 로딩 실패');
    }
    setLoading(false);
  }

  async function loadBuilding(building: string, pushHistory = true) {
    setModal(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/building/${encodeURIComponent(building)}`);
      const data = await res.json();
      setBuildingData(data);
      setScreen('grid');
      if (pushHistory) {
        window.history.pushState({ screen: 'grid', building }, '', `/?b=${encodeURIComponent(building)}`);
      }
    } catch {
      alert('데이터 로딩 실패');
    }
    setLoading(false);
  }

  function openModal(unitNum: string) {
    if (!buildingData) return;
    const excluded = buildingData.excludedUnits || [];
    if (excluded.includes(unitNum)) return;
    const info = buildingData.grid[unitNum] || null;
    setModalName(info?.name || '');
    setModal({ unit: unitNum, info });
  }

  async function doSave() {
    if (!modal || !buildingData || !modalName.trim()) {
      alert('이름을 입력해주세요.');
      return;
    }
    setLoading(true);
    try {
      if (modal.info) {
        await fetch('/api/consent', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ building: buildingData.building, unit: modal.unit, name: modalName.trim() }),
        });
      } else {
        await fetch('/api/consent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ building: buildingData.building, unit: modal.unit, name: modalName.trim() }),
        });
      }
      setModal(null);
      await loadBuilding(buildingData.building);
    } catch {
      alert('저장 실패');
      setLoading(false);
    }
  }

  async function doDelete() {
    if (!modal || !buildingData) return;
    const input = prompt('삭제하려면 "삭제"를 입력하세요.');
    if (input !== '삭제') return;
    setLoading(true);
    try {
      await fetch('/api/consent', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ building: buildingData.building, unit: modal.unit }),
      });
      setModal(null);
      await loadBuilding(buildingData.building);
    } catch {
      alert('삭제 실패');
      setLoading(false);
    }
  }

  // ── 로그인 화면 ──
  if (!authed) {
    return (
      <div className="min-h-screen bg-[#2F5496] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-10 w-full max-w-sm text-center shadow-2xl">
          <h1 className="text-xl font-bold text-[#2F5496]">상계주공 9단지</h1>
          <p className="text-sm text-gray-400 mb-6">사전동의 관리 시스템</p>
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

  // ── 로딩 오버레이 ──
  const loadingOverlay = loading && (
    <div className="fixed inset-0 bg-white/80 flex items-center justify-center z-50">
      <div className="w-8 h-8 border-3 border-gray-200 border-t-[#2F5496] rounded-full animate-spin mr-3" />
      <span className="text-gray-500">로딩 중...</span>
    </div>
  );

  // ── 메인 화면 ──
  if (screen === 'main' && dashboard) {
    return (
      <div className="min-h-screen bg-gray-50">
        {loadingOverlay}
        <header className="bg-[#2F5496] text-white p-3.5 flex items-center sticky top-0 z-40">
          <span className="font-semibold flex-1">상계주공 9단지</span>
          <button onClick={() => { setScreen('dashboard'); window.history.pushState({ screen: 'dashboard' }, '', '/?v=dashboard'); }} className="bg-white/20 px-3 py-1.5 rounded-lg text-sm">현황</button>
        </header>

        <div className="bg-white m-3 p-4 rounded-xl shadow-sm">
          <div className="flex gap-4 mb-2">
            <div className="flex-1">
              <p className="text-xs text-gray-400">접수</p>
              <p className="text-xl font-bold text-[#2F5496]">{dashboard.totalReceived}<span className="text-xs text-gray-400 font-normal"> ({dashboard.receivedRate}%)</span></p>
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-400">수거완료</p>
              <p className="text-xl font-bold text-green-600">{dashboard.totalCollected}<span className="text-xs text-gray-400 font-normal"> ({dashboard.collectedRate}%)</span></p>
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-400">총세대</p>
              <p className="text-xl font-bold text-gray-600">{dashboard.totalUnits}</p>
            </div>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-[#2F5496] rounded-full transition-all" style={{ width: `${dashboard.receivedRate}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 px-3 pb-6">
          {dashboard.buildings.map((b) => (
            <button
              key={b.building}
              onClick={() => loadBuilding(b.building)}
              className="bg-white rounded-xl p-3.5 text-center shadow-sm active:scale-[0.97] transition-transform"
            >
              <div className="font-semibold text-sm">{b.building}</div>
              <div className="text-xs mt-1">
                <span className="text-[#2F5496] font-semibold">접수 {b.received}</span>
                <span className="text-gray-300 mx-1">|</span>
                <span className="text-green-600 font-semibold">수거 {b.collected}</span>
              </div>
              <div className="text-xs text-gray-400">/ {b.total}세대</div>
              <div className="h-1 bg-gray-200 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-[#2F5496] rounded-full" style={{ width: `${b.receivedRate}%` }} />
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── 동별 그리드 ──
  if (screen === 'grid' && buildingData) {
    const { building, floors, units, excludedUnits, receivedCount, collectedCount, totalUnits, grid } = buildingData;

    return (
      <div className="min-h-screen bg-gray-50">
        {loadingOverlay}
        <header className="bg-[#2F5496] text-white p-3.5 flex items-center sticky top-0 z-40">
          <button onClick={() => { window.history.back(); }} className="mr-3 text-xl">←</button>
          <span className="font-semibold flex-1">{building}</span>
          <span className="text-xs opacity-90">접수 {receivedCount} | 수거 {collectedCount} / {totalUnits}</span>
        </header>

        <div className="overflow-x-auto p-3">
          <table className="border-collapse w-max min-w-full">
            <thead>
              <tr>
                <th className="bg-[#2F5496] text-white text-xs p-2 sticky left-0 z-10 min-w-[48px]">층\호</th>
                {units.map((u) => (
                  <th key={u} className="bg-[#2F5496] text-white text-xs p-2 min-w-[56px]">
                    {u < 10 ? `0${u}` : u}
                  </th>
                ))}
                <th className="bg-[#2F5496] text-white text-xs p-1.5 min-w-[32px]">접수</th>
                <th className="bg-green-700 text-white text-xs p-1.5 min-w-[32px]">수거</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: floors }, (_, i) => floors - i).map((floor) => {
                let floorCount = 0;
                return (
                  <tr key={floor}>
                    <td className="bg-[#e8edf5] font-semibold text-center text-xs p-2.5 sticky left-0 z-[5] border border-gray-300">
                      {floor}층
                    </td>
                    {units.map((u) => {
                      const unitNum = String(floor * 100 + u);
                      const isExcluded = excludedUnits.includes(unitNum);
                      const info = grid[unitNum];
                      if (info) floorCount++;

                      if (isExcluded) {
                        return (
                          <td key={u} className="bg-gray-200 text-gray-400 text-center text-xs p-1 border border-gray-300">X</td>
                        );
                      }

                      return (
                        <td
                          key={u}
                          onClick={() => openModal(unitNum)}
                          className={`text-center text-xs p-1 border border-gray-300 cursor-pointer active:bg-blue-100 h-[44px] ${
                            info
                              ? info.collected
                                ? 'text-white font-semibold bg-[#2F5496]'
                                : info.source === '온라인'
                                  ? 'text-blue-600 font-semibold bg-blue-50'
                                  : 'text-black font-semibold bg-amber-50'
                              : 'text-gray-300 bg-gray-50'
                          }`}
                        >
                          {info ? (info.name.length > 3 ? info.name.slice(0, 3) + '..' : info.name) : '·'}
                        </td>
                      );
                    })}
                    <td className="bg-blue-50 text-center text-xs p-1.5 border border-gray-300 text-[#2F5496] font-semibold">
                      {floorCount}
                    </td>
                    <td className="bg-green-50 text-center text-xs p-1.5 border border-gray-300 text-green-600 font-semibold">
                      {units.reduce((cnt, u) => {
                        const info = grid[String(floor * 100 + u)];
                        return cnt + (info?.collected ? 1 : 0);
                      }, 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="bg-white m-3 p-3 rounded-xl shadow-sm flex justify-between text-sm">
          <span>접수: <strong className="text-[#2F5496]">{receivedCount}</strong> / {totalUnits}</span>
          <span>수거: <strong className="text-green-600">{collectedCount}</strong></span>
          <span>접수율: <strong className="text-[#2F5496]">{totalUnits > 0 ? (receivedCount / totalUnits * 100).toFixed(1) : 0}%</strong></span>
        </div>

        {/* 모달 */}
        {modal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setModal(null)}>
            <div className="bg-white w-full max-w-lg rounded-t-2xl p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-semibold text-lg mb-4">
                {building} {Math.floor(parseInt(modal.unit) / 100)}층 {(parseInt(modal.unit) % 100).toString().padStart(2, '0')}호
              </h3>
              <label className="text-sm text-gray-400">성명</label>
              <input
                type="text"
                className="w-full p-3.5 border-2 border-gray-200 rounded-xl text-lg outline-none focus:border-[#2F5496] mb-3"
                placeholder="이름 입력"
                value={modalName}
                onChange={(e) => setModalName(e.target.value)}
                autoFocus
              />
              {modal.info && (
                <div className="mb-4">
                  <p className="text-xs text-gray-400 mb-3">
                    입력경로: {modal.info.source === '온라인' ? '전자동의' : '수동입력'}<br />
                    등록일: {modal.info.timestamp || '-'}
                  </p>
                  <button
                    onClick={async () => {
                      setLoading(true);
                      try {
                        await fetch('/api/consent/toggle', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ building: buildingData.building, unit: modal.unit }),
                        });
                        setModal(null);
                        await loadBuilding(buildingData.building);
                      } catch { alert('변경 실패'); setLoading(false); }
                    }}
                    className={`w-full p-3 rounded-xl font-semibold text-sm ${
                      modal.info.collected
                        ? 'bg-green-100 text-green-700 border-2 border-green-300'
                        : 'bg-gray-100 text-gray-500 border-2 border-gray-200'
                    }`}
                  >
                    동의서 수거: {modal.info.collected ? '완료' : '미수거'} (터치하여 변경)
                  </button>
                </div>
              )}
              <div className="flex gap-2.5">
                {modal.info && (
                  <button onClick={doDelete} className="flex-[0.6] p-3.5 bg-red-500 text-white rounded-xl font-semibold active:bg-red-600">삭제</button>
                )}
                <button onClick={() => setModal(null)} className="flex-1 p-3.5 bg-gray-200 rounded-xl font-semibold">취소</button>
                <button onClick={doSave} className="flex-1 p-3.5 bg-[#2F5496] text-white rounded-xl font-semibold active:bg-[#1e3a6e]">저장</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── 대시보드 ──
  if (screen === 'dashboard' && dashboard) {
    return (
      <div className="min-h-screen bg-gray-50">
        {loadingOverlay}
        <header className="bg-[#2F5496] text-white p-3.5 flex items-center sticky top-0 z-40">
          <button onClick={() => window.history.back()} className="mr-3 text-xl">←</button>
          <span className="font-semibold">전체 현황</span>
        </header>

        <div className="p-3">
          <div className="bg-white p-4 rounded-xl shadow-sm mb-3">
            <div className="flex gap-4">
              <div className="flex-1 text-center">
                <p className="text-xs text-gray-400">접수</p>
                <p className="text-2xl font-bold text-[#2F5496]">{dashboard.totalReceived}</p>
                <p className="text-xs text-gray-400">{dashboard.receivedRate}%</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-xs text-gray-400">수거완료</p>
                <p className="text-2xl font-bold text-green-600">{dashboard.totalCollected}</p>
                <p className="text-xs text-gray-400">{dashboard.collectedRate}%</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-xs text-gray-400">총세대</p>
                <p className="text-2xl font-bold text-gray-600">{dashboard.totalUnits}</p>
              </div>
            </div>
          </div>

          <table className="w-full bg-white rounded-xl overflow-hidden shadow-sm">
            <thead>
              <tr className="bg-[#2F5496] text-white">
                <th className="p-2 text-xs">동</th>
                <th className="p-2 text-xs">접수</th>
                <th className="p-2 text-xs">수거</th>
                <th className="p-2 text-xs">세대</th>
                <th className="p-2 text-xs">접수율</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.buildings.map((b) => (
                <tr key={b.building} className="border-b border-gray-100">
                  <td className="p-2 text-xs text-center">{b.building}</td>
                  <td className="p-2 text-xs text-center font-semibold text-[#2F5496]">{b.received}</td>
                  <td className="p-2 text-xs text-center font-semibold text-green-600">{b.collected}</td>
                  <td className="p-2 text-xs text-center text-gray-500">{b.total}</td>
                  <td className="p-2 text-xs text-center">{b.receivedRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-3 border-gray-200 border-t-[#2F5496] rounded-full animate-spin" />
    </div>
  );
}
