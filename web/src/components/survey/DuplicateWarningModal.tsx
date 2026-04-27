'use client';

interface Props {
  dong: string;
  ho: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DuplicateWarningModal({
  dong,
  ho,
  confirmLabel = '그래도 제출',
  onCancel,
  onConfirm,
}: Props) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <p className="text-lg font-bold text-gray-800 mb-2">이미 제출된 호수입니다</p>
        <p className="text-sm text-gray-500 mb-5">
          {dong} {ho}호는 이미 응답 이력이 있습니다.{'\n'}
          그래도 저장하시겠습니까?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 border-2 border-gray-200 rounded-xl text-base font-semibold text-gray-600"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 bg-[#2F5496] text-white rounded-xl text-base font-semibold"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
