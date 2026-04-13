// 동별 층수/호수/제외호수 데이터 (공통)
export const BUILDING_CONFIG: Record<string, { floors: number; units: number[]; excludedUnits?: string[] }> = {
  '901동': { floors: 15, units: [1, 2, 3, 4, 5, 6] },
  '902동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8] },
  '903동': { floors: 12, units: [1, 2, 3, 4, 5, 6], excludedUnits: ['103', '104'] },
  '904동': { floors: 12, units: [1, 2, 3, 4, 5, 6], excludedUnits: ['103', '104'] },
  '905동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8] },
  '906동': { floors: 15, units: [1, 2, 3, 4, 5, 6] },
  '907동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] },
  '908동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] },
  '909동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8] },
  '910동': { floors: 12, units: [1, 2, 3, 4, 5, 6], excludedUnits: ['103', '104'] },
  '911동': { floors: 12, units: [1, 2, 3, 4, 5, 6], excludedUnits: ['103', '104'] },
  '912동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8] },
  '913동': { floors: 15, units: [1, 2, 3, 4, 5, 6] },
  '914동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8] },
  '915동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] },
  '916동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8] },
  '917동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  '918동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7] },
  '919동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8] },
  '920동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] },
  '921동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8] },
  '922동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8] },
  '923동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7] },
};

export const BUILDINGS = Object.keys(BUILDING_CONFIG);

export function getTotalUnits(building: string): number {
  const config = BUILDING_CONFIG[building];
  if (!config) return 0;
  return config.floors * config.units.length - (config.excludedUnits?.length || 0);
}
