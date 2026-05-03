'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBuildingSelector } from '@/hooks/useBuildingSelector';
import { BuildingSelector } from '@/components/survey/BuildingSelector';

export default function KakaoVerifyPage() {
  const router = useRouter();
  const [basicInfo, setBasicInfo] = useState<Record<string, string>>({});
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const {
    selectedDong,
    selectedFloor,
    dongList,
    floorList,
    hoList,
    handleDongChange,
    handleFloorChange,
    handleHoChange,
  } = useBuildingSelector(setBasicInfo);

  async function handleSubmit() {
    if (!basicInfo.dong || !basicInfo.ho || !name.trim()) {
      setError('동, 호수, 이름을 모두 입력해 주세요.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/kakao-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dong: basicInfo.dong, ho: basicInfo.ho, name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '인증에 실패했습니다.');
      router.push(`/kakao-verify/result?t=${encodeURIComponent(data.token)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '인증에 실패했습니다.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#2F5496] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-sm shadow-2xl">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🏘️</div>
          <h1 className="text-xl font-bold text-[#2F5496]">소유자 인증</h1>
          <p className="text-sm text-gray-400 mt-1">
            상계주공 9단지 단톡방 참여를 위한 소유자 확인입니다.
          </p>
        </div>

        <div className="space-y-4">
          <BuildingSelector
            selectedDong={selectedDong}
            selectedFloor={selectedFloor}
            selectedHo={basicInfo.ho || ''}
            dongList={dongList}
            floorList={floorList}
            hoList={hoList}
            onDongChange={handleDongChange}
            onFloorChange={handleFloorChange}
            onHoChange={handleHoChange}
          />

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">
              등기부상 성명 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 10))}
              placeholder="등기부상 소유자 성명"
              className="w-full p-3.5 border border-gray-200 rounded-xl text-base outline-none focus:border-[#2F5496]"
            />
          </div>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-500 bg-red-50 rounded-xl p-3">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="mt-6 w-full py-4 bg-[#2F5496] text-white rounded-2xl text-base font-bold disabled:opacity-50 active:opacity-80"
        >
          {loading ? '확인 중...' : '소유자 인증하기'}
        </button>

        <p className="text-xs text-gray-400 text-center mt-4">
          등기부등본상 소유자가 아닌 경우 인증이 불가합니다.
        </p>
      </div>
    </div>
  );
}
