/**
 * 1차 간단 설문 — Google Form + 시트 자동 생성
 *
 * 사용법: Apps Script 에디터에서 createSurvey001Form() 실행
 * 결과:
 *   - Google Form 생성 (응답 수집용)
 *   - 응답 시트 자동 연결
 *   - 시트에 'PDF생성여부', 'PDF링크' 컬럼 추가
 *   - SURVEY_001_SPREADSHEET_ID 환경변수용 시트 ID 출력
 */

var TARGET_FOLDER_ID = '16iK3rxaUcy4cCz0e_7KMgU4YZgFXo74W';
var SPREADSHEET_ID = '1bLkziGS9hO_jc_2HVFuhBNPMqciD6q3zJ3LkjzqT5us';
var FORM_ID = ''; // createSurvey001Form() 실행 후 폼 ID 입력

function createSurvey001Form() {
  // ── 폼 생성 ──
  var form = FormApp.create('상계9단지 재건축 관련 간단 설문 (1차)');

  form.setDescription(
    '주최: 상계주공9단지아파트 재건축추진준비위원회\n\n' +
    '안녕하십니까.\n' +
    '상계9단지 주민 여러분의 재건축 관련 의견을 확인하고자 간단한 설문을 진행합니다.\n' +
    '소요시간은 약 30초입니다.\n\n' +
    '※ 해당 항목에 체크해 주세요'
  );
  form.setConfirmationMessage('설문에 참여해 주셔서 감사합니다.');
  form.setAllowResponseEdits(false);
  form.setLimitOneResponsePerUser(false);

  // ── 기본정보 ──
  var dongChoices = [];
  for (var d = 901; d <= 923; d++) {
    dongChoices.push(d + '동');
  }

  form.addListItem()
    .setTitle('동')
    .setChoiceValues(dongChoices)
    .setRequired(true);

  form.addTextItem()
    .setTitle('호')
    .setHelpText('호수를 입력해 주세요 (예: 101)')
    .setRequired(true);

  form.addTextItem()
    .setTitle('성명')
    .setRequired(true);

  form.addTextItem()
    .setTitle('연락처')
    .setHelpText('010-0000-0000')
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('연령대')
    .setChoiceValues(['20대', '30대', '40대', '50대', '60대 이상'])
    .setRequired(true);

  // ── 질문 ──

  // Q1. 재건축 필요성
  form.addMultipleChoiceItem()
    .setTitle('우리 단지 재건축이 필요하다고 생각하십니까?')
    .setChoiceValues(['필요하다', '잘 모르겠다', '필요하지 않다'])
    .setRequired(true);

  // Q2. 추진 방향
  form.addMultipleChoiceItem()
    .setTitle('재건축이 추진된다면 어떤 방향이 더 중요하다고 생각하십니까?')
    .setChoiceValues([
      '사업 지연 없이 최대한 빠르게 추진하는 것 (속도 우선)',
      '시간과 비용이 더 들더라도 신중하게 추진하는 것',
      '잘 모르겠다'
    ])
    .setRequired(true);

  // Q3. 마들역 인근 단지 인식
  form.addMultipleChoiceItem()
    .setTitle('마들역 인근 단지(임광, 마들대림, 상계주공10·11단지, 상계보람 등)가 재건축 안전진단 완료 및 신속통합기획 접수를 진행 중인 사실을 알고 계셨습니까?')
    .setChoiceValues(['잘 알고 있다', '어느 정도 알고 있다', '잘 모른다'])
    .setRequired(true);

  // Q4. 복합정비구역 인식
  form.addMultipleChoiceItem()
    .setTitle('상계주공 9단지가 서울시 복합정비구역으로 지정·고시되어 고층 개발(약 60층 수준)이 가능하다는 점을 알고 계셨습니까?')
    .setChoiceValues(['알고 있다', '처음 알았다'])
    .setRequired(true);

  // Q5. 정보 안내 희망
  form.addMultipleChoiceItem()
    .setTitle('향후 재건축 관련 정보 안내를 받아보시겠습니까?')
    .setChoiceValues(['희망한다', '희망하지 않는다'])
    .setRequired(true);

  // ── 응답 시트 연결 ──
  var ss = SpreadsheetApp.create('설문응답_상계9단지_1차간단설문');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  Utilities.sleep(2000);

  var sheet = ss.getSheets()[0];
  var lastCol = sheet.getLastColumn();

  sheet.getRange(1, lastCol + 1).setValue('PDF생성여부');
  sheet.getRange(1, lastCol + 2).setValue('PDF링크');

  // 서비스 계정에 편집 권한 부여
  var serviceAccountEmail = 'rebuild@rebuild-492516.iam.gserviceaccount.com';
  try {
    ss.addEditor(serviceAccountEmail);
    Logger.log('서비스 계정에 시트 편집 권한 부여 완료');
  } catch (e) {
    Logger.log('서비스 계정 권한 부여 실패 (수동으로 공유 필요): ' + e.message);
  }

  // ── 폴더로 이동 ──
  var targetFolder = DriveApp.getFolderById(TARGET_FOLDER_ID);
  var rootFolder = DriveApp.getRootFolder();

  var formFile = DriveApp.getFileById(form.getId());
  targetFolder.addFile(formFile);
  rootFolder.removeFile(formFile);

  var ssFile = DriveApp.getFileById(ss.getId());
  targetFolder.addFile(ssFile);
  rootFolder.removeFile(ssFile);

  // ── 결과 출력 ──
  Logger.log('=== 1차 간단 설문 폼 + 시트 생성 완료 ===');
  Logger.log('');
  Logger.log('폼 ID: ' + form.getId());
  Logger.log('폼 URL (수정): ' + form.getEditUrl());
  Logger.log('폼 URL (응답): ' + form.getPublishedUrl());
  Logger.log('');
  Logger.log('시트 ID: ' + ss.getId());
  Logger.log('시트 URL: ' + ss.getUrl());
  Logger.log('');
  Logger.log('다음 단계:');
  Logger.log('1. .env.local에 SURVEY_001_SPREADSHEET_ID=' + ss.getId() + ' 추가');
  Logger.log('2. 폼 URL을 주민에게 배포');

  return {
    formId: form.getId(),
    formEditUrl: form.getEditUrl(),
    formPublishUrl: form.getPublishedUrl(),
    spreadsheetId: ss.getId(),
    spreadsheetUrl: ss.getUrl()
  };
}

/**
 * 통합응답 시트 생성 + 헤더 설정
 *
 * 사용법: 기존 스프레드시트(SPREADSHEET_ID)에 통합응답 시트를 추가할 때 1회 실행
 * 실행 전 SPREADSHEET_ID 상단 변수 확인
 */
function setupUnifiedSheet() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // 이미 있으면 초기화 여부 확인
  var existing = ss.getSheetByName('통합응답');
  if (existing) {
    Logger.log('통합응답 시트가 이미 존재합니다. 기존 시트를 유지합니다.');
    return;
  }

  var sheet = ss.insertSheet('통합응답');

  // 헤더 설정 (웹 폼 + 구글 폼 공통 컬럼)
  var headers = [
    '타임스탬프',
    '동', '호', '성명', '연락처', '연령대',
    '우리 단지 재건축이 필요하다고 생각하십니까?',
    '재건축이 추진된다면 어떤 방향이 더 중요하다고 생각하십니까?',
    '마들역 인근 단지(임광, 마들대림, 상계주공10·11단지, 상계보람 등)가 재건축 안전진단 완료 및 신속통합기획 접수를 진행 중인 사실을 알고 계셨습니까?',
    '상계주공 9단지가 서울시 복합정비구역으로 지정·고시되어 고층 개발(약 60층 수준)이 가능하다는 점을 알고 계셨습니까?',
    '향후 재건축 관련 정보 안내를 받아보시겠습니까?',
    '입력경로',
    'PDF생성여부',
    'PDF링크'
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // 헤더 스타일
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#2F5496');
  headerRange.setFontColor('#FFFFFF');
  sheet.setFrozenRows(1);

  // 서비스 계정 편집 권한 부여
  var serviceAccountEmail = 'rebuild@rebuild-492516.iam.gserviceaccount.com';
  try {
    ss.addEditor(serviceAccountEmail);
    Logger.log('서비스 계정 편집 권한 부여 완료');
  } catch (e) {
    Logger.log('서비스 계정 권한 부여 실패 (수동 공유 필요): ' + e.message);
  }

  Logger.log('=== 통합응답 시트 생성 완료 ===');
  Logger.log('시트 URL: ' + ss.getUrl());
  Logger.log('');
  Logger.log('다음 단계:');
  Logger.log('1. setupFormTrigger()를 실행해 구글 폼 연동 트리거 등록');
}

/**
 * 구글 폼 제출 → 통합응답 시트에 복사하는 트리거 등록
 *
 * 사용법: FORM_ID 설정 후 1회 실행
 * FORM_ID: 구글 폼 URL에서 /forms/d/<ID>/edit 부분
 */
function setupFormTrigger() {
  if (!FORM_ID) {
    Logger.log('오류: 상단 FORM_ID 변수에 구글 폼 ID를 입력하세요.');
    return;
  }

  // 기존 트리거 중복 방지
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'onSurvey001FormSubmit') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  ScriptApp.newTrigger('onSurvey001FormSubmit')
    .forForm(FORM_ID)
    .onFormSubmit()
    .create();

  Logger.log('폼 제출 트리거 등록 완료. 핸들러: onSurvey001FormSubmit');
}

/**
 * 구글 폼 제출 시 통합응답 시트에 복사
 * (setupFormTrigger()로 등록된 트리거가 자동 호출)
 */
function onSurvey001FormSubmit(e) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var unifiedSheet = ss.getSheetByName('통합응답');
  if (!unifiedSheet) {
    Logger.log('오류: 통합응답 시트 없음. setupUnifiedSheet()를 먼저 실행하세요.');
    return;
  }

  var itemResponses = e.response.getItemResponses();

  // 폼 응답 값 매핑 (질문 제목 → 응답값)
  var values = {};
  for (var i = 0; i < itemResponses.length; i++) {
    var item = itemResponses[i];
    values[item.getItem().getTitle()] = String(item.getResponse());
  }

  // 통합 시트 헤더 순서대로 행 구성
  var headers = unifiedSheet.getRange(1, 1, 1, unifiedSheet.getLastColumn()).getValues()[0];
  var row = [];
  for (var j = 0; j < headers.length; j++) {
    var h = headers[j];
    if (h === '타임스탬프') {
      row.push(new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }));
    } else if (h === '입력경로') {
      row.push('온라인(구글)');
    } else if (h === 'PDF생성여부') {
      row.push('FALSE');
    } else if (h === 'PDF링크') {
      row.push('');
    } else {
      row.push(values[h] || '');
    }
  }

  unifiedSheet.appendRow(row);
}
