/**
 * 상계주공 9단지 마스터 그리드 시스템
 *
 * v2 스프레드시트에 동별 층x호수 그리드 시트를 추가하여
 * 전체 동의 현황을 한눈에 파악할 수 있게 합니다.
 *
 * 사용법:
 * 1. v2 스프레드시트의 Apps Script에 이 코드를 추가
 * 2. setupAllGridSheets() 실행 → 그리드 시트 23개 생성
 * 3. migrateListToGrid() 실행 → 기존 데이터 마이그레이션
 * 4. v2 onFormSubmit에 hook 1줄 추가 (별도 안내)
 *
 * 주의: 기존 v2 코드/시트는 절대 수정하지 않습니다.
 */

// ============================================================
// 마스터 그리드 설정값
// ============================================================
var MASTER_CONFIG = {
  GRID_SHEET_SUFFIX: '_grid',

  // 색상
  ELECTRONIC_COLOR: '#0000FF',  // 파란색: 전자동의 (구글폼)
  MANUAL_COLOR: '#000000',      // 검정색: 수동입력 (방문/카톡)
  HEADER_BG: '#2F5496',
  HEADER_FONT: '#FFFFFF',
  TITLE_BG: '#D6E4F0',
  EMPTY_BG: '#F2F2F2',
  GRID_BG: '#FFFFFF',
  SUBTOTAL_BG: '#D6E4F0',

  // 통계 컬럼 헤더
  STATS_HEADERS: ['세대수', '동의수', '동의율'],

  // 동별 층/호 구조 (네이버 부동산 기준, 2026-04-06 확인)
  // floors: 총 층수, units: 각 층의 호수 끝자리 배열
  // excludedUnits: 존재하지 않는 세대 목록 (예: 1층 필로티 등)
  // TODO: 909동~923동은 네이버 부동산 데이터 확인 후 보정 필요
  BUILDINGS: {
    '901동': { floors: 15, units: [1, 2, 3, 4, 5, 6] },                                          // 90세대
    '902동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8] },                                    // 120세대
    '903동': { floors: 12, units: [1, 2, 3, 4, 5, 6], excludedUnits: ['103', '104'] },            // 70세대 (1층 103,104 없음)
    '904동': { floors: 12, units: [1, 2, 3, 4, 5, 6], excludedUnits: ['103', '104'] },            // 70세대 (1층 103,104 없음)
    '905동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8] },                                    // 120세대
    '906동': { floors: 15, units: [1, 2, 3, 4, 5, 6] },                                          // 90세대
    '907동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] },             // 210세대 (01-08: 70.52㎡, 09-14: 64.82㎡)
    '908동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] },             // 210세대 (01-08: 70.52㎡, 09-14: 64.82㎡)
    // --- 아래 909~923동은 미확인 (기본값 placeholder) ---
    '909동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8] },
    '910동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8] },
    '911동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8] },
    '912동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8] },
    '913동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8] },
    '914동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8] },
    '915동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8] },
    '916동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8] },
    '917동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8] },
    '918동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8] },
    '919동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8] },
    '920동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8] },
    '921동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8] },
    '922동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8] },
    '923동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8] }
  }
};


// ============================================================
// 유틸리티 함수
// ============================================================

/**
 * 호수 문자열을 층/위치로 파싱
 * "1504" → { floor: 15, position: 4 }
 * "304"  → { floor: 3, position: 4 }
 * "101"  → { floor: 1, position: 1 }
 */
function parseUnitNumber_(unitStr) {
  var num = parseInt(String(unitStr).replace(/[^0-9]/g, ''), 10);
  if (isNaN(num) || num <= 0) {
    return null;
  }
  var position = num % 100;
  var floor = Math.floor(num / 100);
  if (floor <= 0 || position <= 0) {
    return null;
  }
  return { floor: floor, position: position };
}


/**
 * 동 이름으로 그리드 시트 이름 반환
 * "912동" → "912동_grid"
 */
function getGridSheetName_(building) {
  return building + MASTER_CONFIG.GRID_SHEET_SUFFIX;
}


/**
 * 동+호수로 그리드 셀 좌표(row, col) 계산
 * 반환: { row: 행번호, col: 열번호 } (1-based) 또는 null
 *
 * 그리드 레이아웃:
 *   Row 1: 타이틀
 *   Row 2: 헤더 (층\호, 01, 02, ..., 세대수, 동의수, 동의율)
 *   Row 3: 최상층 (예: 15층)
 *   Row 4: 15-1층...
 *   ...
 *   Row (floors+2): 1층
 *   Row (floors+3): 소계
 *
 *   Col A(1): 층 라벨
 *   Col B(2): 첫번째 호 → units[0]
 *   Col C(3): 두번째 호 → units[1]
 *   ...
 */
function getGridCellCoords_(building, unitStr) {
  var config = MASTER_CONFIG.BUILDINGS[building];
  if (!config) {
    return null;
  }

  var parsed = parseUnitNumber_(unitStr);
  if (!parsed) {
    return null;
  }

  // 층 범위 확인
  if (parsed.floor < 1 || parsed.floor > config.floors) {
    return null;
  }

  // 호수 위치 확인
  var posIndex = config.units.indexOf(parsed.position);
  if (posIndex === -1) {
    return null;
  }

  // 제외 세대 확인
  var excludedUnits = config.excludedUnits || [];
  if (excludedUnits.indexOf(unitStr) !== -1) {
    return null;
  }

  // 행: 최상층이 row 3, 내림차순
  var row = 2 + (config.floors - parsed.floor + 1);
  // 열: A=층라벨, B부터 호수
  var col = 2 + posIndex;

  return { row: row, col: col };
}


// ============================================================
// 스프레드시트 연결 (독립 실행용)
// ============================================================

/**
 * 스프레드시트 찾기
 * v2 코드와 함께 사용 시: getLinkedSpreadsheet_() 사용
 * 독립 실행 시: 현재 스프레드시트 또는 ID로 직접 연결
 */
function getLinkedSpreadsheet_() {
  // 방법 1: 스프레드시트에 바인딩된 스크립트인 경우
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) return ss;
  } catch (e) {}

  // 방법 2: 저장된 ID로 열기
  var ssId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (ssId) {
    return SpreadsheetApp.openById(ssId);
  }

  // 방법 3: 파일명으로 검색
  var files = DriveApp.getFilesByName('상계주공 9단지 사전 전자동의 관리 v2');
  while (files.hasNext()) {
    return SpreadsheetApp.openById(files.next().getId());
  }

  return null;
}


// ============================================================
// 그리드 시트 생성
// ============================================================

/**
 * 전체 동 그리드 시트 일괄 생성 (1회 실행)
 */
function setupAllGridSheets() {
  Logger.log('=== 마스터 그리드 시트 생성 시작 ===');

  var ss = getLinkedSpreadsheet_();
  if (!ss) {
    Logger.log('스프레드시트를 찾을 수 없습니다.');
    return;
  }

  var buildings = Object.keys(MASTER_CONFIG.BUILDINGS);
  var created = 0;
  var skipped = 0;

  for (var i = 0; i < buildings.length; i++) {
    var building = buildings[i];
    var sheetName = getGridSheetName_(building);

    // 이미 존재하면 스킵
    if (ss.getSheetByName(sheetName)) {
      Logger.log('이미 존재: ' + sheetName);
      skipped++;
      continue;
    }

    setupGridSheet_(ss, building);
    created++;
    Logger.log('생성 완료: ' + sheetName);
  }

  Logger.log('');
  Logger.log('=== 그리드 시트 생성 완료 ===');
  Logger.log('생성: ' + created + '개, 스킵: ' + skipped + '개');
}


/**
 * 개별 동 그리드 시트 생성
 */
function setupGridSheet_(ss, building) {
  var config = MASTER_CONFIG.BUILDINGS[building];
  if (!config) {
    Logger.log('빌딩 설정 없음: ' + building);
    return;
  }

  var sheetName = getGridSheetName_(building);
  var sheet = ss.insertSheet(sheetName);

  var floors = config.floors;
  var units = config.units;
  var unitCount = units.length;
  var excludedUnits = config.excludedUnits || [];
  var totalUnits = floors * unitCount - excludedUnits.length;

  // 컬럼 구성: A(층라벨) + 호수들 + 통계3열
  var totalCols = 1 + unitCount + MASTER_CONFIG.STATS_HEADERS.length;
  var statsStartCol = 2 + unitCount; // 통계 시작 열

  // ── Row 1: 타이틀 ──
  sheet.getRange(1, 1).setValue(building + ' 마스터');
  sheet.getRange(1, 1).setFontWeight('bold');
  sheet.getRange(1, 1).setFontSize(12);

  // 타이틀 행 배경
  sheet.getRange(1, 1, 1, totalCols).setBackground(MASTER_CONFIG.TITLE_BG);

  // ── Row 2: 헤더 ──
  var headerValues = ['층\\호'];
  for (var u = 0; u < unitCount; u++) {
    headerValues.push(units[u] < 10 ? '0' + units[u] : String(units[u]));
  }
  headerValues = headerValues.concat(MASTER_CONFIG.STATS_HEADERS);

  sheet.getRange(2, 1, 1, totalCols).setValues([headerValues]);
  sheet.getRange(2, 1, 1, totalCols)
    .setFontWeight('bold')
    .setBackground(MASTER_CONFIG.HEADER_BG)
    .setFontColor(MASTER_CONFIG.HEADER_FONT)
    .setHorizontalAlignment('center');

  // ── Row 3 ~ (floors+2): 층별 데이터 행 ──
  for (var f = floors; f >= 1; f--) {
    var row = 2 + (floors - f + 1); // 최상층이 row 3

    // 층 라벨
    sheet.getRange(row, 1).setValue(f + '층');
    sheet.getRange(row, 1)
      .setFontWeight('bold')
      .setHorizontalAlignment('center');

    // 그리드 셀 영역 배경 (빈 상태)
    sheet.getRange(row, 2, 1, unitCount).setBackground(MASTER_CONFIG.GRID_BG);
    sheet.getRange(row, 2, 1, unitCount).setHorizontalAlignment('center');

    // 제외 세대 표시 (예: 1층 필로티)
    var floorExcludedCount = 0;
    for (var e = 0; e < excludedUnits.length; e++) {
      var exParsed = parseUnitNumber_(excludedUnits[e]);
      if (exParsed && exParsed.floor === f) {
        var exCol = 2 + units.indexOf(exParsed.position);
        if (exCol >= 2) {
          sheet.getRange(row, exCol).setValue('X');
          sheet.getRange(row, exCol)
            .setBackground('#D9D9D9')
            .setFontColor('#999999')
            .setHorizontalAlignment('center');
          floorExcludedCount++;
        }
      }
    }

    // 통계 수식
    var unitRangeStart = columnToLetter_(2);
    var unitRangeEnd = columnToLetter_(1 + unitCount);
    var unitRange = unitRangeStart + row + ':' + unitRangeEnd + row;

    // 세대수 (해당 층 제외세대 차감)
    var floorUnitCount = unitCount - floorExcludedCount;
    sheet.getRange(row, statsStartCol).setValue(floorUnitCount);
    sheet.getRange(row, statsStartCol).setHorizontalAlignment('center');

    // 동의수: 비어있지 않은 셀 수
    sheet.getRange(row, statsStartCol + 1).setFormula(
      '=COUNTA(' + unitRange + ')'
    );
    sheet.getRange(row, statsStartCol + 1).setHorizontalAlignment('center');

    // 동의율
    var statsCol1 = columnToLetter_(statsStartCol);
    var statsCol2 = columnToLetter_(statsStartCol + 1);
    sheet.getRange(row, statsStartCol + 2).setFormula(
      '=IF(' + statsCol1 + row + '>0,' + statsCol2 + row + '/' + statsCol1 + row + ',0)'
    );
    sheet.getRange(row, statsStartCol + 2)
      .setNumberFormat('0.0%')
      .setHorizontalAlignment('center');
  }

  // ── 소계 행 ──
  var subtotalRow = floors + 3;
  sheet.getRange(subtotalRow, 1).setValue('소계');
  sheet.getRange(subtotalRow, 1).setFontWeight('bold');
  sheet.getRange(subtotalRow, 1).setHorizontalAlignment('center');

  // 소계 행 스타일
  sheet.getRange(subtotalRow, 1, 1, totalCols)
    .setBackground(MASTER_CONFIG.SUBTOTAL_BG)
    .setFontWeight('bold');

  // 소계: 총세대수
  sheet.getRange(subtotalRow, statsStartCol).setValue(totalUnits);
  sheet.getRange(subtotalRow, statsStartCol).setHorizontalAlignment('center');

  // 소계: 총동의수
  var statsCol2Letter = columnToLetter_(statsStartCol + 1);
  sheet.getRange(subtotalRow, statsStartCol + 1).setFormula(
    '=SUM(' + statsCol2Letter + '3:' + statsCol2Letter + (subtotalRow - 1) + ')'
  );
  sheet.getRange(subtotalRow, statsStartCol + 1).setHorizontalAlignment('center');

  // 소계: 동의율
  var statsCol1Letter = columnToLetter_(statsStartCol);
  var statsCol2Letter2 = columnToLetter_(statsStartCol + 1);
  sheet.getRange(subtotalRow, statsStartCol + 2).setFormula(
    '=IF(' + statsCol1Letter + subtotalRow + '>0,' +
    statsCol2Letter2 + subtotalRow + '/' + statsCol1Letter + subtotalRow + ',0)'
  );
  sheet.getRange(subtotalRow, statsStartCol + 2)
    .setNumberFormat('0.0%')
    .setHorizontalAlignment('center');

  // ── 스타일링 ──

  // 컬럼 너비
  sheet.setColumnWidth(1, 60);  // 층 라벨
  for (var c = 0; c < unitCount; c++) {
    sheet.setColumnWidth(2 + c, 75); // 호수 셀
  }
  sheet.setColumnWidth(statsStartCol, 55);     // 세대수
  sheet.setColumnWidth(statsStartCol + 1, 55); // 동의수
  sheet.setColumnWidth(statsStartCol + 2, 60); // 동의율

  // 테두리 (그리드 영역)
  var gridRange = sheet.getRange(2, 1, floors + 1, 1 + unitCount);
  gridRange.setBorder(true, true, true, true, true, true,
    '#B0B0B0', SpreadsheetApp.BorderStyle.SOLID);

  // 행 고정 (헤더 2행)
  sheet.setFrozenRows(2);
  // 열 고정 (층 라벨 1열)
  sheet.setFrozenColumns(1);
}


/**
 * 열 번호를 알파벳으로 변환 (1 → A, 2 → B, 27 → AA)
 */
function columnToLetter_(col) {
  var letter = '';
  while (col > 0) {
    var mod = (col - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    col = Math.floor((col - 1) / 26);
  }
  return letter;
}


// ============================================================
// 그리드 셀 업데이트
// ============================================================

/**
 * 그리드 셀에 이름 기입
 * @param {Spreadsheet} ss - 스프레드시트
 * @param {string} building - 동 이름 (예: "912동")
 * @param {string} unitStr - 호수 (예: "1504")
 * @param {string} name - 성명
 * @param {string} source - "online" 또는 "manual"
 * @param {string} [note] - 셀 노트 (선택, 예: 타임스탬프+연락처)
 */
function updateGridCell(ss, building, unitStr, name, source, note) {
  var sheetName = getGridSheetName_(building);
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    Logger.log('그리드 시트 없음: ' + sheetName);
    return false;
  }

  var coords = getGridCellCoords_(building, unitStr);
  if (!coords) {
    Logger.log('셀 좌표 계산 실패: ' + building + ' ' + unitStr);
    return false;
  }

  var cell = sheet.getRange(coords.row, coords.col);

  // 이름 기입
  cell.setValue(name);

  // 색상 적용
  var fontColor = (source === 'online')
    ? MASTER_CONFIG.ELECTRONIC_COLOR
    : MASTER_CONFIG.MANUAL_COLOR;
  cell.setFontColor(fontColor);
  cell.setBackground(MASTER_CONFIG.GRID_BG);

  // 노트 추가 (선택)
  if (note) {
    cell.setNote(note);
  }

  return true;
}


// ============================================================
// 폼 → 그리드 자동 연동 (Hook)
// ============================================================

/**
 * v2 onFormSubmit에서 호출되는 hook 함수
 * v2의 e.values 순서: Timestamp, 성명, 연락처, 소유동, 호수, 주민등록상주소, 사전동의여부, 개인정보동의여부
 */
function onFormSubmitGrid(e) {
  try {
    var ss = e.range.getSheet().getParent();

    var values = e.values;
    var name = String(values[1] || '');
    var phone = String(values[2] || '');
    var building = String(values[3] || '');
    var unit = String(values[4] || '');
    var timestamp = String(values[0] || '');

    if (!building || !unit || !name) {
      Logger.log('그리드: 필수 정보 부족 - ' + building + ' ' + unit + ' ' + name);
      return;
    }

    var note = '전자동의\n' +
      '제출: ' + timestamp + '\n' +
      '연락처: ' + phone;

    var result = updateGridCell(ss, building, unit, name, 'online', note);
    if (result) {
      Logger.log('그리드 업데이트 완료: ' + building + ' ' + unit + '호 - ' + name);
    }
  } catch (err) {
    Logger.log('그리드 hook 오류: ' + err.toString());
  }
}


// ============================================================
// 기존 데이터 마이그레이션
// ============================================================

/**
 * v2 동별 리스트 데이터를 그리드로 일괄 반영 (1회 실행)
 */
function migrateListToGrid() {
  Logger.log('=== 마이그레이션 시작 ===');

  var ss = getLinkedSpreadsheet_();
  if (!ss) {
    Logger.log('스프레드시트를 찾을 수 없습니다.');
    return;
  }

  var buildings = Object.keys(MASTER_CONFIG.BUILDINGS);
  var totalMigrated = 0;

  for (var i = 0; i < buildings.length; i++) {
    var count = migrateBuildingToGrid_(ss, buildings[i]);
    totalMigrated += count;
  }

  Logger.log('');
  Logger.log('=== 마이그레이션 완료: 총 ' + totalMigrated + '건 ===');
}


/**
 * 개별 동 리스트 → 그리드 마이그레이션
 * v2 동별 시트 헤더: 타임스탬프(0), 성명(1), 연락처(2), 호수(3),
 *   주민등록상주소(4), 사전동의여부(5), 개인정보동의여부(6), 입력경로(7),
 *   동의서수거여부(8), 수거일(9), 수거자(10), 비고(11)
 */
function migrateBuildingToGrid_(ss, building) {
  var listSheet = ss.getSheetByName(building);
  if (!listSheet) {
    Logger.log('리스트 시트 없음: ' + building);
    return 0;
  }

  var lastRow = listSheet.getLastRow();
  if (lastRow <= 1) {
    Logger.log(building + ': 데이터 없음');
    return 0;
  }

  var data = listSheet.getRange(2, 1, lastRow - 1, 12).getValues();
  var migrated = 0;

  // 호수별 최신 데이터만 수집 (뒤에서부터 읽으면 마지막이 최신)
  // 중복(이전 응답)은 스킵
  var latestByUnit = {};

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var note = String(row[11] || ''); // 비고
    var unit = String(row[3] || '');
    var name = String(row[1] || '');

    if (!unit || !name) continue;

    // "중복(이전 응답)" 행은 스킵
    if (note.indexOf('중복(이전 응답)') !== -1) continue;

    var source = (String(row[7] || '') === '온라인') ? 'online' : 'manual';
    var timestamp = row[0] instanceof Date
      ? Utilities.formatDate(row[0], 'Asia/Seoul', 'yyyy-MM-dd HH:mm')
      : String(row[0] || '');
    var phone = String(row[2] || '');

    latestByUnit[unit] = {
      name: name,
      source: source,
      note: source === 'online'
        ? '전자동의\n제출: ' + timestamp + '\n연락처: ' + phone
        : '수동입력\n등록: ' + timestamp
    };
  }

  // 그리드에 반영
  var units = Object.keys(latestByUnit);
  for (var j = 0; j < units.length; j++) {
    var unitKey = units[j];
    var info = latestByUnit[unitKey];

    var result = updateGridCell(ss, building, unitKey, info.name, info.source, info.note);
    if (result) {
      migrated++;
    }
  }

  Logger.log(building + ': ' + migrated + '건 마이그레이션');
  return migrated;
}


// ============================================================
// 수동 입력 지원
// ============================================================

/**
 * 그리드 시트에서 수동 편집 감지
 * installable onEdit 트리거로 등록해야 합니다
 */
function onEditGrid(e) {
  try {
    var sheet = e.range.getSheet();
    var sheetName = sheet.getName();

    // 그리드 시트가 아니면 무시
    if (sheetName.indexOf(MASTER_CONFIG.GRID_SHEET_SUFFIX) === -1) {
      return;
    }

    var row = e.range.getRow();
    var col = e.range.getColumn();

    // 헤더/타이틀/소계 영역이면 무시 (row 1~2, col 1)
    if (row <= 2 || col <= 1) {
      return;
    }

    // 동 이름 추출: "912동_grid" → "912동"
    var building = sheetName.replace(MASTER_CONFIG.GRID_SHEET_SUFFIX, '');
    var config = MASTER_CONFIG.BUILDINGS[building];
    if (!config) return;

    // 통계 열이면 무시
    var statsStartCol = 2 + config.units.length;
    if (col >= statsStartCol) return;

    // 소계 행이면 무시
    var subtotalRow = config.floors + 3;
    if (row >= subtotalRow) return;

    var newValue = String(e.range.getValue() || '');

    if (newValue) {
      // 이름이 입력됨 → 검정색(수동입력) 적용
      e.range.setFontColor(MASTER_CONFIG.MANUAL_COLOR);

      // v2 동별 리스트에도 행 추가
      syncManualEntryToList_(e, building, row, col, newValue);
    }
  } catch (err) {
    Logger.log('onEditGrid 오류: ' + err.toString());
  }
}


/**
 * 수동 입력을 v2 동별 리스트 시트에 동기화 (선택 기능)
 * 필요 시 onEditGrid 내에서 주석 해제하여 사용
 */
function syncManualEntryToList_(e, building, row, col, name) {
  var ss = e.range.getSheet().getParent();
  var config = MASTER_CONFIG.BUILDINGS[building];

  // 그리드 좌표 → 호수 역산
  var floor = config.floors - (row - 3);
  var posIndex = col - 2;

  if (floor < 1 || floor > config.floors) return;
  if (posIndex < 0 || posIndex >= config.units.length) return;

  var unitNum = floor * 100 + config.units[posIndex];
  var unitStr = String(unitNum);

  // v2 동별 리스트 시트에 행 추가
  var listSheet = ss.getSheetByName(building);
  if (!listSheet) return;

  var newRow = [
    new Date(),              // 타임스탬프
    name,                    // 성명
    '',                      // 연락처 (수동은 모름)
    unitStr,                 // 호수
    '',                      // 주민등록상주소
    '',                      // 사전동의여부
    '',                      // 개인정보동의여부
    '수동입력(그리드)',      // 입력경로
    false,                   // 동의서수거여부
    '',                      // 수거일
    '',                      // 수거자
    ''                       // 비고
  ];

  listSheet.appendRow(newRow);

  var lastRow = listSheet.getLastRow();
  listSheet.getRange(lastRow, 1, 1, newRow.length)
    .setFontColor('#000000')
    .setBackground('#FFFFFF');

  // 체크박스 삽입 (동의서수거여부 = 9열)
  listSheet.getRange(lastRow, 9).insertCheckboxes();

  Logger.log('리스트 동기화: ' + building + ' ' + unitStr + '호 - ' + name);
}


/**
 * onEditGrid 트리거 설치 (1회 실행)
 */
function setupGridTriggers() {
  var ss = getLinkedSpreadsheet_();
  if (!ss) {
    Logger.log('스프레드시트를 찾을 수 없습니다.');
    return;
  }

  // 기존 onEditGrid 트리거 확인 및 중복 방지
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'onEditGrid') {
      Logger.log('onEditGrid 트리거가 이미 존재합니다.');
      return;
    }
  }

  ScriptApp.newTrigger('onEditGrid')
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  Logger.log('onEditGrid 트리거 설치 완료');
}


// ============================================================
// 동 구조 추론 유틸리티
// ============================================================

/**
 * 기존 v2 데이터에서 동별 층/호수 구조를 추론
 * MASTER_CONFIG.BUILDINGS를 채우는 데 참고용으로 사용
 */
function discoverBuildingLayout_() {
  var ss = getLinkedSpreadsheet_();
  if (!ss) {
    Logger.log('스프레드시트를 찾을 수 없습니다.');
    return;
  }

  var buildings = CONFIG.BUILDINGS; // v2의 CONFIG.BUILDINGS 사용

  for (var i = 0; i < buildings.length; i++) {
    var building = buildings[i];
    var sheet = ss.getSheetByName(building);
    if (!sheet || sheet.getLastRow() <= 1) {
      Logger.log(building + ': 데이터 없음 — 기본값 사용');
      continue;
    }

    var data = sheet.getRange(2, 4, sheet.getLastRow() - 1, 1).getValues(); // 호수 열
    var floors = {};
    var positions = {};

    for (var j = 0; j < data.length; j++) {
      var parsed = parseUnitNumber_(data[j][0]);
      if (parsed) {
        floors[parsed.floor] = true;
        positions[parsed.position] = true;
      }
    }

    var floorList = Object.keys(floors).map(Number).sort(function(a, b) { return a - b; });
    var posList = Object.keys(positions).map(Number).sort(function(a, b) { return a - b; });

    Logger.log(building + ':');
    Logger.log('  층: ' + floorList.join(', ') + ' (최대 ' + Math.max.apply(null, floorList) + '층)');
    Logger.log('  호: ' + posList.join(', '));
    Logger.log('  추정 CONFIG: { floors: ' + Math.max.apply(null, floorList) +
      ', units: [' + posList.join(', ') + '] }');
  }
}


// ============================================================
// 디버그
// ============================================================

/**
 * 특정 동 그리드 상태 확인
 */
function debugGridSheet(building) {
  var ss = getLinkedSpreadsheet_();
  if (!ss) {
    Logger.log('스프레드시트를 찾을 수 없습니다.');
    return;
  }

  building = building || '912동';
  var sheetName = getGridSheetName_(building);
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    Logger.log('그리드 시트 없음: ' + sheetName);
    return;
  }

  var config = MASTER_CONFIG.BUILDINGS[building];
  Logger.log(building + ' 그리드 상태:');
  Logger.log('설정: ' + config.floors + '층, ' + config.units.length + '호/층');

  var filledCount = 0;
  for (var f = config.floors; f >= 1; f--) {
    var row = 2 + (config.floors - f + 1);
    var values = sheet.getRange(row, 2, 1, config.units.length).getValues()[0];
    var floorInfo = f + '층: ';
    for (var u = 0; u < values.length; u++) {
      if (values[u]) {
        floorInfo += config.units[u] + '호=' + values[u] + ' ';
        filledCount++;
      }
    }
    if (floorInfo !== f + '층: ') {
      Logger.log('  ' + floorInfo);
    }
  }

  var totalUnitsForLog = config.floors * config.units.length - (config.excludedUnits || []).length;
  Logger.log('총 동의: ' + filledCount + '/' + totalUnitsForLog);
}
