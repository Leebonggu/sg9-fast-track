/**
 * 상계주공 9단지 신속통합기획 사전동의 시스템
 *
 * 사용법:
 * 1. https://script.google.com 에서 새 프로젝트 생성
 * 2. 이 코드를 전체 붙여넣기
 * 3. setupAll() 함수 선택 후 실행 (▶ 버튼)
 * 4. Google 계정 권한 승인
 * 5. 실행 로그에서 폼 URL과 시트 URL 확인
 *
 * 주의: setupAll()은 최초 1회만 실행하세요.
 *       중복 실행 시 폼/시트가 여러 개 생성됩니다.
 */

// ============================================================
// 설정값
// ============================================================
var CONFIG = {
  FORM_TITLE: '상계주공 9단지 신속통합기획 사전동의서',
  SHEET_TITLE: '상계주공 9단지 사전동의 관리',
  BUILDINGS: [
    '901동', '902동', '903동', '904동', '905동',
    '906동', '907동', '908동', '909동', '910동',
    '911동', '912동', '913동', '914동', '915동',
    '916동', '917동', '918동', '919동', '920동',
    '921동', '922동', '923동'
  ],
  // 알림 받을 이메일 주소 (본인 이메일로 변경하세요)
  NOTIFICATION_EMAIL: 'sg9.rebuild@gmail.com',
  // 동별 시트 컬럼 헤더
  BUILDING_HEADERS: [
    '타임스탬프', '이름', '전화번호', '호수',
    '소유형태', '거주형태', '실거주주소', '입력경로',
    '동의서수거여부', '수거일', '수거자', '비고'
  ],
  // 전체현황 시트 컬럼 헤더
  SUMMARY_HEADERS: ['동', '응답수', '수거완료', '미수거']
};


// ============================================================
// 1. 전체 셋업 (최초 1회 실행)
// ============================================================
function setupAll() {
  Logger.log('=== 상계주공 9단지 사전동의 시스템 셋업 시작 ===');

  // 1) Google Form 생성
  var form = createForm_();
  Logger.log('폼 생성 완료: ' + form.getEditUrl());
  Logger.log('폼 응답 URL: ' + form.getPublishedUrl());

  // 2) Google Sheets 생성 및 폼 연결
  var ss = createSpreadsheet_(form);
  Logger.log('시트 생성 완료: ' + ss.getUrl());

  // 3) 동별 시트 생성
  createBuildingSheets_(ss);
  Logger.log('동별 시트 생성 완료');

  // 4) 전체현황 시트 생성
  createSummarySheet_(ss);
  Logger.log('전체현황 시트 생성 완료');

  // 5) 시트 ID 저장 (onFormSubmit에서 사용)
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  Logger.log('시트 ID 저장 완료: ' + ss.getId());

  // 6) 폼 제출 트리거 설정 (스프레드시트 기반)
  createTrigger_(ss);
  Logger.log('트리거 설정 완료');

  // 7) 기본 시트(Sheet1) 삭제
  deleteDefaultSheet_(ss);

  Logger.log('');
  Logger.log('=== 셋업 완료 ===');
  Logger.log('폼 편집 URL: ' + form.getEditUrl());
  Logger.log('폼 응답 URL (배포용): ' + form.getPublishedUrl());
  Logger.log('시트 URL: ' + ss.getUrl());
  Logger.log('');
  Logger.log('⚠️ CONFIG.NOTIFICATION_EMAIL을 본인 이메일로 변경하세요!');
}


// ============================================================
// 2. Google Form 생성
// ============================================================
function createForm_() {
  var form = FormApp.create(CONFIG.FORM_TITLE);

  // 폼 설명
  form.setDescription(
    '본 설문은 상계주공 9단지 신속통합기획 추진을 위한 구분소유자(소유주) 사전동의 확인 목적으로 진행됩니다.\n\n' +
    '■ 제출 대상: 상계주공 9단지 구분소유자 (소유주)\n' +
    '■ 본 설문의 제출은 신속통합기획 추진에 대한 동의 의사 표현으로 간주되며,\n' +
    '   제출 후에는 철회가 불가합니다.\n\n' +
    '아래 내용을 확인하신 후 정보를 입력하고 제출해 주세요.\n\n' +
    '──────────────────────\n' +
    '[ 개인정보 수집 및 이용 동의 ]\n\n' +
    '1. 수집 항목: 이름, 전화번호, 동/호수, 소유형태, 거주형태, 실거주 주소(해당 시)\n' +
    '2. 수집 목적: 신속통합기획 사전동의 현황 확인 및 행정 절차 지원\n' +
    '3. 보유 기간: 신속통합기획 절차 완료 시까지 (완료 후 즉시 파기)\n' +
    '4. 제3자 제공: 신속통합기획 관련 행정기관 제출 외 목적으로 제공하지 않음\n' +
    '5. 동의 거부 시: 사전동의 절차에 참여할 수 없습니다.\n' +
    '──────────────────────'
  );

  form.setConfirmationMessage(
    '사전동의서가 정상적으로 제출되었습니다.\n감사합니다.'
  );

  // 이름
  var nameItem = form.addTextItem();
  nameItem.setTitle('이름')
    .setHelpText('실명을 입력해주세요.')
    .setRequired(true);

  // 전화번호
  var phoneItem = form.addTextItem();
  phoneItem.setTitle('전화번호')
    .setHelpText('01012345678 (숫자만 입력)')
    .setRequired(true);
  var phoneValidation = FormApp.createTextValidation()
    .setHelpText('01012345678 형식으로 입력해주세요. (숫자 11자리)')
    .requireTextMatchesPattern('^010\\d{8}$')
    .build();
  phoneItem.setValidation(phoneValidation);

  // 동 선택
  var buildingItem = form.addListItem();
  buildingItem.setTitle('동')
    .setHelpText('거주하시는 동을 선택해주세요.')
    .setRequired(true);
  var buildingChoices = CONFIG.BUILDINGS.map(function(b) {
    return buildingItem.createChoice(b);
  });
  buildingItem.setChoices(buildingChoices);

  // 호수
  var unitItem = form.addTextItem();
  unitItem.setTitle('호수')
    .setHelpText('숫자만 입력해주세요. (예: 101, 1504)')
    .setRequired(true);
  // 숫자만 입력 가능하도록 검증
  var unitValidation = FormApp.createTextValidation()
    .setHelpText('숫자만 입력해주세요. (예: 101, 1504)')
    .requireTextMatchesPattern('^\\d+$')
    .build();
  unitItem.setValidation(unitValidation);

  // 소유 형태 (단독/공동)
  var ownershipItem = form.addMultipleChoiceItem();
  ownershipItem.setTitle('소유 형태')
    .setHelpText('해당하는 소유 형태를 선택해주세요.')
    .setRequired(true);
  ownershipItem.setChoiceValues(['단독 소유', '공동 소유']);

  // 거주 형태 (실거주/임대 중) — 페이지 분기용
  var residenceItem = form.addMultipleChoiceItem();
  residenceItem.setTitle('거주 형태')
    .setHelpText('해당하는 거주 형태를 선택해주세요.')
    .setRequired(true);

  // 임대 중(비거주) 선택 시 실거주 주소 입력 페이지
  var addressPage = form.addPageBreakItem();
  addressPage.setTitle('실거주 주소 입력');
  addressPage.setHelpText('임대 중(비거주)이신 경우, 현재 실거주 주소를 입력해주세요.');

  var addressItem = form.addTextItem();
  addressItem.setTitle('실거주 주소')
    .setHelpText('현재 거주하고 계신 주소를 입력해주세요.')
    .setRequired(true);

  // 제출 완료 페이지 (실거주자는 여기로 바로 이동)
  var endPage = form.addPageBreakItem();
  endPage.setTitle('동의 확인 및 제출');
  endPage.setHelpText(
    '본 설문은 신속통합기획 추진에 대한 사전동의 의사를 확인하기 위한 것으로,\n' +
    '법적 효력이 있는 정식 동의서는 아닙니다.\n\n' +
    '제출 후 담당자가 방문하여 정식 서면 동의서를 안내드릴 예정입니다.\n' +
    '입력하신 정보가 정확한지 확인 후 제출해 주세요.'
  );

  // 거주 형태 선택지에 페이지 분기 설정
  residenceItem.setChoices([
    residenceItem.createChoice('실거주', endPage),
    residenceItem.createChoice('임대 중 (비거주)', addressPage)
  ]);

  return form;
}


// ============================================================
// 3. Google Sheets 생성 및 폼 연결
// ============================================================
function createSpreadsheet_(form) {
  var ss = SpreadsheetApp.create(CONFIG.SHEET_TITLE);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  // 폼 연결 후 잠시 대기 (시트 생성 대기)
  SpreadsheetApp.flush();
  Utilities.sleep(2000);

  return ss;
}


// ============================================================
// 4. 동별 시트 생성
// ============================================================
function createBuildingSheets_(ss) {
  CONFIG.BUILDINGS.forEach(function(building) {
    var sheet = ss.insertSheet(building);

    // 헤더 설정
    var headerRange = sheet.getRange(1, 1, 1, CONFIG.BUILDING_HEADERS.length);
    headerRange.setValues([CONFIG.BUILDING_HEADERS]);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#4472C4');
    headerRange.setFontColor('#FFFFFF');

    // 열 너비 조정
    sheet.setColumnWidth(1, 150); // 타임스탬프
    sheet.setColumnWidth(2, 80);  // 이름
    sheet.setColumnWidth(3, 130); // 전화번호
    sheet.setColumnWidth(4, 60);  // 호수
    sheet.setColumnWidth(5, 120); // 소유형태
    sheet.setColumnWidth(6, 130); // 거주형태
    sheet.setColumnWidth(7, 250); // 실거주주소
    sheet.setColumnWidth(8, 80);  // 입력경로
    sheet.setColumnWidth(9, 120); // 동의서수거여부
    sheet.setColumnWidth(10, 100); // 수거일
    sheet.setColumnWidth(11, 80); // 수거자
    sheet.setColumnWidth(12, 150); // 비고

    // 1행 고정
    sheet.setFrozenRows(1);
  });
}


// ============================================================
// 5. 전체현황 시트 생성
// ============================================================
function createSummarySheet_(ss) {
  var sheet = ss.insertSheet('전체현황', 0); // 맨 앞에 배치

  // 헤더
  var headerRange = sheet.getRange(1, 1, 1, CONFIG.SUMMARY_HEADERS.length);
  headerRange.setValues([CONFIG.SUMMARY_HEADERS]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#2F5496');
  headerRange.setFontColor('#FFFFFF');

  // 동별 데이터 + 수식
  for (var i = 0; i < CONFIG.BUILDINGS.length; i++) {
    var row = i + 2;
    var building = CONFIG.BUILDINGS[i];
    var sheetRef = "'" + building + "'";

    sheet.getRange(row, 1).setValue(building); // 동
    // 응답수: 동별 시트의 데이터 행 수 (헤더 제외)
    sheet.getRange(row, 2).setFormula(
      '=MAX(COUNTA(' + sheetRef + '!A:A)-1, 0)'
    );
    // 수거완료: 동의서수거여부 체크된 수
    sheet.getRange(row, 3).setFormula(
      '=COUNTIF(' + sheetRef + '!I:I, TRUE)'
    );
    // 미수거: 응답수 - 수거완료
    sheet.getRange(row, 4).setFormula(
      '=B' + row + '-C' + row
    );
  }

  // 합계 행
  var totalRow = CONFIG.BUILDINGS.length + 2;
  sheet.getRange(totalRow, 1).setValue('합계');
  sheet.getRange(totalRow, 1).setFontWeight('bold');
  sheet.getRange(totalRow, 2).setFormula('=SUM(B2:B' + (totalRow - 1) + ')');
  sheet.getRange(totalRow, 3).setFormula('=SUM(C2:C' + (totalRow - 1) + ')');
  sheet.getRange(totalRow, 4).setFormula('=SUM(D2:D' + (totalRow - 1) + ')');

  // 합계 행 스타일
  var totalRange = sheet.getRange(totalRow, 1, 1, CONFIG.SUMMARY_HEADERS.length);
  totalRange.setBackground('#D6E4F0');
  totalRange.setFontWeight('bold');

  // 열 너비 조정
  sheet.setColumnWidth(1, 80);
  sheet.setColumnWidth(2, 80);
  sheet.setColumnWidth(3, 80);
  sheet.setColumnWidth(4, 80);

  // 1행 고정
  sheet.setFrozenRows(1);
}


// ============================================================
// 6. 기본 시트 삭제
// ============================================================
function deleteDefaultSheet_(ss) {
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getName() === 'Sheet1' || sheets[i].getName() === '시트1') {
      ss.deleteSheet(sheets[i]);
      break;
    }
  }
}


// ============================================================
// 7. 폼 제출 트리거 생성 (스프레드시트 기반)
// ============================================================
function createTrigger_(ss) {
  ScriptApp.newTrigger('onFormSubmit')
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();
}


// ============================================================
// 8. 폼 응답 처리 (트리거에 의해 자동 실행)
//    - 스프레드시트 onFormSubmit 이벤트 사용
//    - e.values: 응답 값 배열, e.range: 응답이 기록된 범위
// ============================================================
function onFormSubmit(e) {
  try {
    var ss = e.range.getSheet().getParent();

    // e.namedValues에서 직접 값 가져오기 (시트 읽기보다 안정적)
    var nv = e.namedValues;
    Logger.log('namedValues: ' + JSON.stringify(nv));

    // e.values 사용 (컬럼 순서 고정: Timestamp, 이름, 전화번호, 동, 호수, 소유형태, 거주형태, 실거주주소)
    var values = e.values;
    var timestamp = new Date(values[0]) || new Date();
    var name = String(values[1] || '');
    var phone = String(values[2] || '');
    var building = String(values[3] || '');
    var unit = String(values[4] || '');
    var ownership = String(values[5] || '');
    var residence = String(values[6] || '');
    var address = String(values[7] || '');

    if (!building) {
      Logger.log('동 정보가 없습니다. 헤더: ' + JSON.stringify(headers));
      return;
    }

    var buildingSheet = ss.getSheetByName(building);
    if (!buildingSheet) {
      Logger.log('동별 시트를 찾을 수 없습니다: ' + building);
      return;
    }

    // 중복 체크
    var duplicateInfo = checkDuplicate_(buildingSheet, building, unit);

    // 동별 시트에 데이터 추가
    var newRow = [
      timestamp,     // 타임스탬프
      name,          // 이름
      phone,         // 전화번호
      unit,          // 호수
      ownership,     // 소유형태
      residence,     // 거주형태
      address,       // 실거주주소
      '온라인',      // 입력경로
      false,         // 동의서수거여부
      '',            // 수거일
      '',            // 수거자
      duplicateInfo.isDuplicate ? '중복 응답 (최신)' : '' // 비고
    ];

    buildingSheet.appendRow(newRow);

    var lastRow = buildingSheet.getLastRow();

    // 글자색을 검정으로 설정 (헤더의 흰색 상속 방지)
    buildingSheet.getRange(lastRow, 1, 1, newRow.length)
      .setFontColor('#000000')
      .setBackground('#FFFFFF');

    // 동의서수거여부 열에 체크박스 삽입
    var checkboxCol = CONFIG.BUILDING_HEADERS.indexOf('동의서수거여부') + 1;
    buildingSheet.getRange(lastRow, checkboxCol).insertCheckboxes();

    // 중복인 경우 이전 행 표시
    if (duplicateInfo.isDuplicate) {
      markDuplicateRow_(buildingSheet, duplicateInfo.rowIndex);
    }

    // 이메일 알림 발송
    sendNotification_(name, building, unit, ownership, timestamp, duplicateInfo.isDuplicate);

    Logger.log('처리 완료: ' + building + ' ' + unit + '호 - ' + name);

  } catch (error) {
    Logger.log('오류 발생: ' + error.toString());
    Logger.log('이벤트 객체: ' + JSON.stringify(e));
  }
}


// ============================================================
// 디버그: 현재 상태 확인 + 수동 동기화
// setupAll() 실행 후 이 함수를 실행하면 문제를 진단합니다.
// 이미 전체응답에 데이터가 있다면 동별 시트로 수동 복사합니다.
// ============================================================
// ============================================================
// 트리거 정리: 중복 트리거를 삭제하고 1개만 남김
// setupAll()을 여러 번 실행한 경우 이 함수를 실행하세요.
// ============================================================
function cleanupTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  Logger.log('현재 트리거 수: ' + triggers.length);

  // 모든 트리거 삭제
  triggers.forEach(function(trigger) {
    ScriptApp.deleteTrigger(trigger);
  });
  Logger.log('모든 트리거 삭제 완료');

  // 스프레드시트 기반 트리거 1개만 새로 생성
  var ssId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (ssId) {
    var ss = SpreadsheetApp.openById(ssId);
    ScriptApp.newTrigger('onFormSubmit')
      .forSpreadsheet(ss)
      .onFormSubmit()
      .create();
    Logger.log('트리거 1개 재생성 완료');
  } else {
    Logger.log('❌ 스프레드시트 ID를 찾을 수 없습니다.');
  }
}


function debugAndSync() {
  // 1) 스프레드시트 찾기
  var ss = getLinkedSpreadsheet_();
  if (!ss) {
    Logger.log('❌ 스프레드시트를 찾을 수 없습니다.');
    return;
  }
  Logger.log('✅ 스프레드시트: ' + ss.getName() + ' (' + ss.getId() + ')');

  // 2) 모든 시트 이름 출력
  var sheets = ss.getSheets();
  Logger.log('📋 시트 목록:');
  sheets.forEach(function(s) {
    Logger.log('   - ' + s.getName() + ' (행: ' + s.getLastRow() + ')');
  });

  // 3) 폼 응답 시트 찾기 (전체응답 시트 = 동별 시트가 아닌 시트)
  var responseSheet = null;
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName();
    if (name !== '전체현황' && CONFIG.BUILDINGS.indexOf(name) === -1) {
      responseSheet = sheets[i];
      break;
    }
  }

  if (!responseSheet) {
    Logger.log('❌ 폼 응답 시트를 찾을 수 없습니다.');
    return;
  }
  Logger.log('✅ 폼 응답 시트: ' + responseSheet.getName());

  // 4) 헤더 확인
  var headers = responseSheet.getRange(1, 1, 1, responseSheet.getLastColumn()).getValues()[0];
  Logger.log('📋 폼 응답 시트 헤더: ' + JSON.stringify(headers));

  // 5) 데이터 확인
  var lastRow = responseSheet.getLastRow();
  if (lastRow <= 1) {
    Logger.log('⚠️ 폼 응답 데이터가 없습니다.');
    return;
  }
  Logger.log('📋 폼 응답 데이터 ' + (lastRow - 1) + '건');

  // 6) 기존 데이터를 동별 시트로 수동 동기화
  var syncCount = 0;
  for (var r = 2; r <= lastRow; r++) {
    var rowData = responseSheet.getRange(r, 1, 1, responseSheet.getLastColumn()).getValues()[0];
    var data = {};
    for (var c = 0; c < headers.length; c++) {
      data[headers[c]] = rowData[c];
    }

    Logger.log('   행 ' + r + ': ' + JSON.stringify(data));

    var building = data['동'] || '';
    if (!building) {
      Logger.log('   ⚠️ 행 ' + r + ': 동 정보 없음');
      continue;
    }

    var buildingSheet = ss.getSheetByName(building);
    if (!buildingSheet) {
      Logger.log('   ❌ 행 ' + r + ': ' + building + ' 시트 없음');
      continue;
    }

    var timestamp = data['타임스탬프'] || data['Timestamp'] || '';
    var name = data['이름'] || '';
    var phone = data['전화번호'] || '';
    var unit = data['호수'] || '';
    var ownership = data['소유 형태'] || '';
    var residence = data['거주 형태'] || '';
    var address = data['실거주 주소'] || '';

    var newRow = [
      timestamp, name, phone, unit, ownership, residence, address,
      '온라인', false, '', '', ''
    ];

    buildingSheet.appendRow(newRow);

    var syncLastRow = buildingSheet.getLastRow();

    // 글자색을 검정으로 설정 (헤더의 흰색 상속 방지)
    buildingSheet.getRange(syncLastRow, 1, 1, newRow.length)
      .setFontColor('#000000')
      .setBackground('#FFFFFF');

    // 동의서수거여부 열에 체크박스 삽입
    var checkboxCol = CONFIG.BUILDING_HEADERS.indexOf('동의서수거여부') + 1;
    buildingSheet.getRange(syncLastRow, checkboxCol).insertCheckboxes();
    syncCount++;
    Logger.log('   ✅ ' + building + ' ' + unit + '호 동기화 완료');
  }

  Logger.log('');
  Logger.log('=== 동기화 완료: ' + syncCount + '건 ===');

  // 7) 트리거 확인
  var triggers = ScriptApp.getProjectTriggers();
  Logger.log('📋 등록된 트리거: ' + triggers.length + '개');
  triggers.forEach(function(t) {
    Logger.log('   - ' + t.getHandlerFunction() + ' / ' + t.getEventType());
  });
}


// ============================================================
// 9. 연결된 스프레드시트 찾기
// ============================================================
function getLinkedSpreadsheet_() {
  var ssId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (ssId) {
    return SpreadsheetApp.openById(ssId);
  }
  // fallback: 파일명으로 검색
  var files = DriveApp.getFilesByName(CONFIG.SHEET_TITLE);
  while (files.hasNext()) {
    var file = files.next();
    return SpreadsheetApp.openById(file.getId());
  }
  return null;
}


// ============================================================
// 10. 중복 제출 감지
// ============================================================
function checkDuplicate_(sheet, building, unit) {
  var data = sheet.getDataRange().getValues();

  // 헤더 제외, 호수 컬럼(인덱스 3)에서 동일 호수 검색
  for (var i = data.length - 1; i >= 1; i--) {
    var existingUnit = String(data[i][3]);
    var note = String(data[i][11]); // 비고

    if (existingUnit === String(unit) && note !== '중복(이전 응답)') {
      return { isDuplicate: true, rowIndex: i + 1 }; // 1-based row
    }
  }

  return { isDuplicate: false, rowIndex: -1 };
}


// ============================================================
// 11. 중복 행 표시
// ============================================================
function markDuplicateRow_(sheet, rowIndex) {
  var lastCol = CONFIG.BUILDING_HEADERS.length;
  var range = sheet.getRange(rowIndex, 1, 1, lastCol);

  // 배경색을 회색으로 변경
  range.setBackground('#D9D9D9');

  // 비고란에 중복 표시
  var noteCol = CONFIG.BUILDING_HEADERS.indexOf('비고') + 1; // 11번째
  sheet.getRange(rowIndex, noteCol).setValue('중복(이전 응답)');
}


// ============================================================
// 12. 이메일 알림 발송
// ============================================================
function sendNotification_(name, building, unit, ownership, timestamp, isDuplicate) {
  if (CONFIG.NOTIFICATION_EMAIL === 'your-email@gmail.com') {
    Logger.log('알림 이메일이 설정되지 않았습니다. CONFIG.NOTIFICATION_EMAIL을 변경하세요.');
    return;
  }

  // "901호"처럼 이미 '호'가 포함되어 있으면 중복 방지
  var unitDisplay = String(unit).replace(/호$/, '') + '호';
  var subject = '[사전동의] ' + building + ' ' + unitDisplay + ' - ' + name;
  if (isDuplicate) {
    subject = '[사전동의-중복] ' + building + ' ' + unitDisplay + ' - ' + name;
  }

  var body = '새로운 사전동의 응답이 제출되었습니다.\n\n' +
    '이름: ' + name + '\n' +
    '동: ' + building + '\n' +
    '호수: ' + unit + '\n' +
    '소유형태: ' + ownership + '\n' +
    '제출시각: ' + (timestamp instanceof Date ? Utilities.formatDate(timestamp, 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss') : String(timestamp)) + '\n';

  if (isDuplicate) {
    body += '\n⚠️ 동일 동/호수로 이전 응답이 존재합니다. 확인이 필요합니다.\n';
  }

  MailApp.sendEmail(CONFIG.NOTIFICATION_EMAIL, subject, body);
}
