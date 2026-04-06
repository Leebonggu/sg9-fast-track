/**
 * 상계주공 9단지 사전동의 웹 UI — 서버 로직
 *
 * 사용법:
 * 1. v2 스프레드시트의 Apps Script에 이 코드 + webapp.html 추가
 * 2. setWebAppPassword('원하는비밀번호') 실행 (1회)
 * 3. 배포 → 새 배포 → 웹 앱 → 액세스: 모든 사용자 → 배포
 * 4. 배포된 URL 공유
 */

// ============================================================
// 설정
// ============================================================
var WEB_CONFIG = {
  // 동별 층/호 구조 (setup_v2_master.gs와 동일, 네이버 부동산 기준 2026-04-06)
  // TODO: 909동~923동은 네이버 부동산 데이터 확인 후 보정 필요
  BUILDINGS: {
    '901동': { floors: 15, units: [1, 2, 3, 4, 5, 6] },
    '902동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8] },
    '903동': { floors: 12, units: [1, 2, 3, 4, 5, 6], excludedUnits: ['103', '104'] },
    '904동': { floors: 12, units: [1, 2, 3, 4, 5, 6], excludedUnits: ['103', '104'] },
    '905동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8] },
    '906동': { floors: 15, units: [1, 2, 3, 4, 5, 6] },
    '907동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] },
    '908동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] },
    // --- 909~923동 (네이버 부동산 확인 완료 2026-04-07) ---
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
    '923동': { floors: 15, units: [1, 2, 3, 4, 5, 6, 7] }
  },

  // v2 동별 시트 헤더 인덱스 (0-based)
  COL: {
    TIMESTAMP: 0,
    NAME: 1,
    PHONE: 2,
    UNIT: 3,
    ADDRESS: 4,
    CONSENT: 5,
    PRIVACY: 6,
    SOURCE: 7,
    COLLECTED: 8,
    COLLECT_DATE: 9,
    COLLECTOR: 10,
    NOTE: 11
  }
};


// ============================================================
// 웹앱 진입점
// ============================================================
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('webapp')
    .setTitle('상계주공 9단지 사전동의 관리')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
}


// ============================================================
// 비밀번호
// ============================================================
function setWebAppPassword(password) {
  PropertiesService.getScriptProperties().setProperty('WEBAPP_PASSWORD', password);
  Logger.log('웹앱 비밀번호 설정 완료');
}

function verifyPassword(password) {
  var stored = PropertiesService.getScriptProperties().getProperty('WEBAPP_PASSWORD');
  return password === stored;
}


// ============================================================
// 대시보드 데이터
// ============================================================
function getDashboardData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var buildings = Object.keys(WEB_CONFIG.BUILDINGS);
  var result = [];
  var totalConsent = 0;
  var totalUnits = 0;

  // 전체현황 시트가 있으면 그걸 활용 (빠름)
  // 없으면 각 동 시트의 lastRow만 확인 (데이터 전체를 읽지 않음)
  for (var i = 0; i < buildings.length; i++) {
    var building = buildings[i];
    var config = WEB_CONFIG.BUILDINGS[building];
    var unitCount = config.floors * config.units.length - (config.excludedUnits || []).length;
    var sheet = ss.getSheetByName(building);

    // lastRow - 1 = 데이터 행 수 (대략적 동의수, 중복 포함)
    var consentCount = 0;
    if (sheet && sheet.getLastRow() > 1) {
      consentCount = sheet.getLastRow() - 1;
    }

    result.push({
      building: building,
      consent: consentCount,
      total: unitCount,
      rate: unitCount > 0 ? Math.round(consentCount / unitCount * 1000) / 10 : 0
    });

    totalConsent += consentCount;
    totalUnits += unitCount;
  }

  return {
    buildings: result,
    totalConsent: totalConsent,
    totalUnits: totalUnits,
    totalRate: totalUnits > 0 ? Math.round(totalConsent / totalUnits * 1000) / 10 : 0,
    online: 0,
    manual: 0
  };
}


// ============================================================
// 동별 그리드 데이터
// ============================================================
function getBuildingData(building) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var config = WEB_CONFIG.BUILDINGS[building];
  if (!config) {
    return { error: '동 설정 없음: ' + building };
  }

  var sheet = ss.getSheetByName(building);
  var grid = {}; // key: "호수", value: { name, source, timestamp, phone }

  if (sheet && sheet.getLastRow() > 1) {
    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 12).getValues();

    // 최신 데이터만 수집 (뒤에서부터)
    for (var i = data.length - 1; i >= 0; i--) {
      var unit = String(data[i][WEB_CONFIG.COL.UNIT] || '');
      var name = String(data[i][WEB_CONFIG.COL.NAME] || '');
      var note = String(data[i][WEB_CONFIG.COL.NOTE] || '');

      if (!unit || !name) continue;
      if (note.indexOf('중복(이전 응답)') !== -1) continue;
      if (note.indexOf('삭제') !== -1) continue;
      if (grid[unit]) continue; // 이미 최신 데이터 있음

      var source = String(data[i][WEB_CONFIG.COL.SOURCE] || '');
      var timestamp = data[i][WEB_CONFIG.COL.TIMESTAMP];
      if (timestamp instanceof Date) {
        timestamp = Utilities.formatDate(timestamp, 'Asia/Seoul', 'yyyy-MM-dd HH:mm');
      } else {
        timestamp = String(timestamp || '');
      }

      grid[unit] = {
        name: name,
        source: source,
        timestamp: timestamp,
        phone: String(data[i][WEB_CONFIG.COL.PHONE] || '')
      };
    }
  }

  return {
    building: building,
    floors: config.floors,
    units: config.units,
    totalUnits: config.floors * config.units.length - (config.excludedUnits || []).length,
    excludedUnits: config.excludedUnits || [],
    consentCount: Object.keys(grid).length,
    grid: grid
  };
}


// ============================================================
// 동의 추가 (수동입력)
// ============================================================
function addConsent(building, unit, name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(building);
  if (!sheet) {
    return { success: false, error: '시트 없음: ' + building };
  }

  var newRow = [
    new Date(),       // 타임스탬프
    name,             // 성명
    '',               // 연락처
    unit,             // 호수
    '',               // 주민등록상주소
    '',               // 사전동의여부
    '',               // 개인정보동의여부
    '수동입력(웹)',   // 입력경로
    false,            // 동의서수거여부
    '',               // 수거일
    '',               // 수거자
    ''                // 비고
  ];

  sheet.appendRow(newRow);

  var lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, 1, 1, newRow.length)
    .setFontColor('#000000')
    .setBackground('#FFFFFF');
  sheet.getRange(lastRow, 9).insertCheckboxes();

  return { success: true };
}


// ============================================================
// 동의 수정
// ============================================================
function updateConsent(building, unit, newName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(building);
  if (!sheet) {
    return { success: false, error: '시트 없음: ' + building };
  }

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return { success: false, error: '데이터 없음' };
  }

  var data = sheet.getRange(2, 1, lastRow - 1, 12).getValues();

  // 최신 유효 행 찾기 (뒤에서부터)
  for (var i = data.length - 1; i >= 0; i--) {
    var rowUnit = String(data[i][WEB_CONFIG.COL.UNIT] || '');
    var note = String(data[i][WEB_CONFIG.COL.NOTE] || '');

    if (rowUnit === unit && note.indexOf('중복(이전 응답)') === -1 && note.indexOf('삭제') === -1) {
      sheet.getRange(i + 2, WEB_CONFIG.COL.NAME + 1).setValue(newName);
      return { success: true };
    }
  }

  return { success: false, error: '해당 호수 데이터를 찾을 수 없음' };
}


// ============================================================
// 동의 삭제 (소프트 삭제)
// ============================================================
function deleteConsent(building, unit) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(building);
  if (!sheet) {
    return { success: false, error: '시트 없음: ' + building };
  }

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    return { success: false, error: '데이터 없음' };
  }

  var data = sheet.getRange(2, 1, lastRow - 1, 12).getValues();

  for (var i = data.length - 1; i >= 0; i--) {
    var rowUnit = String(data[i][WEB_CONFIG.COL.UNIT] || '');
    var note = String(data[i][WEB_CONFIG.COL.NOTE] || '');

    if (rowUnit === unit && note.indexOf('중복(이전 응답)') === -1 && note.indexOf('삭제') === -1) {
      var rowIndex = i + 2;
      sheet.getRange(rowIndex, WEB_CONFIG.COL.NOTE + 1).setValue('삭제됨');
      sheet.getRange(rowIndex, 1, 1, 12).setBackground('#D9D9D9');
      return { success: true };
    }
  }

  return { success: false, error: '해당 호수 데이터를 찾을 수 없음' };
}


// ============================================================
// 빌딩 구조 정보 반환 (클라이언트에서 사용)
// ============================================================
function getBuildingConfig() {
  var buildings = Object.keys(WEB_CONFIG.BUILDINGS);
  var result = {};
  for (var i = 0; i < buildings.length; i++) {
    var b = buildings[i];
    result[b] = {
      floors: WEB_CONFIG.BUILDINGS[b].floors,
      units: WEB_CONFIG.BUILDINGS[b].units
    };
  }
  return result;
}
