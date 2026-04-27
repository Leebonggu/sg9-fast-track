import { useState, useMemo } from 'react';
import { BUILDING_CONFIG } from '@/lib/buildings';

export function useBuildingSelector(
  setBasicInfo: React.Dispatch<React.SetStateAction<Record<string, string>>>
) {
  const [selectedDong, setSelectedDong] = useState('');
  const [selectedFloor, setSelectedFloor] = useState('');

  const dongList = useMemo(() => Object.keys(BUILDING_CONFIG), []);

  const floorList = useMemo(() => {
    if (!selectedDong || !BUILDING_CONFIG[selectedDong]) return [];
    const { floors } = BUILDING_CONFIG[selectedDong];
    return Array.from({ length: floors }, (_, i) => i + 1);
  }, [selectedDong]);

  const hoList = useMemo(() => {
    if (!selectedDong || !selectedFloor || !BUILDING_CONFIG[selectedDong]) return [];
    const { units, excludedUnits } = BUILDING_CONFIG[selectedDong];
    const floor = parseInt(selectedFloor, 10);
    return units
      .map((u) => `${floor}${String(u).padStart(2, '0')}`)
      .filter((ho) => !excludedUnits?.includes(ho));
  }, [selectedDong, selectedFloor]);

  function handleDongChange(dong: string) {
    setSelectedDong(dong);
    setSelectedFloor('');
    setBasicInfo((prev) => ({ ...prev, dong, ho: '' }));
  }

  function handleFloorChange(floor: string) {
    setSelectedFloor(floor);
    setBasicInfo((prev) => ({ ...prev, ho: '' }));
  }

  function handleHoChange(ho: string) {
    setBasicInfo((prev) => ({ ...prev, ho }));
  }

  function reset() {
    setSelectedDong('');
    setSelectedFloor('');
  }

  return {
    selectedDong,
    selectedFloor,
    dongList,
    floorList,
    hoList,
    handleDongChange,
    handleFloorChange,
    handleHoChange,
    reset,
  };
}
