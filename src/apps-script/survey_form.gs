/**
 * 상계9단지 재건축 추진 의향 설문 — Google Form + 시트 자동 생성
 *
 * 사용법: Apps Script 에디터에서 createSurveyForm() 실행
 * 결과:
 *   - Google Form 생성 (응답 수집용)
 *   - 응답 시트 자동 연결
 *   - 시트에 'PDF생성여부', 'PDF링크' 컬럼 추가
 *   - SURVEY_SPREADSHEET_ID 환경변수용 시트 ID 출력
 */

// 생성된 폼/시트를 이 폴더로 이동
var TARGET_FOLDER_ID = '1UdJbtCDGQrIYcZ7CkigWBMqaAx7u3T5X';

function createSurveyForm() {
  // ── 폼 생성 ──
  var form = FormApp.create('상계9단지 재건축 추진 의향 설문');

  form.setDescription(
    '주최: 상계주공9단지아파트 재건축추진준비위원회\n\n' +
    '안녕하십니까.\n' +
    '상계9단지는 2021년 예비안전진단 이후 현재까지 사업이 멈춰 있는 상태입니다.\n' +
    '반면, 주변 단지들은 재건축이 빠르게 진행되고 있어 격차가 벌어지고 있습니다.\n' +
    '이에 따라 주민 여러분의 의견을 확인하고자 합니다.\n\n' +
    '※ 해당 항목에 체크해 주세요'
  );
  form.setConfirmationMessage('설문에 참여해 주셔서 감사합니다.');
  form.setAllowResponseEdits(false);
  form.setLimitOneResponsePerUser(false);

  // ── 1. 기본정보 ──
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

  // ── 2. 재건축 필요성 ──
  form.addMultipleChoiceItem()
    .setTitle('재건축 필요성')
    .setChoiceValues(['매우 필요', '필요', '보통', '불필요'])
    .setRequired(true);

  // ── 3. 현재 상황에 대한 인식 ──
  form.addMultipleChoiceItem()
    .setTitle('현재 상황에 대한 인식')
    .setChoiceValues(['빠른 추진이 필요하다', '현 상태 유지도 괜찮다', '잘 모르겠다'])
    .setRequired(true);

  // ── 4. 재건축 추진 의향 ──
  form.addMultipleChoiceItem()
    .setTitle('재건축 추진 의향')
    .setChoiceValues(['적극 찬성', '조건부 찬성', '반대', '잘 모르겠다'])
    .setRequired(true);

  // ── 5. 추진 시 가장 중요한 요소 ──
  form.addMultipleChoiceItem()
    .setTitle('추진 시 가장 중요한 요소 (1개 선택)')
    .setChoiceValues(['사업 속도', '수익성', '안정성', '주거환경 개선'])
    .setRequired(true);

  // ── 6. 향후 추진 시 참여 의향 ──
  form.addMultipleChoiceItem()
    .setTitle('향후 추진 시 참여 의향')
    .setChoiceValues(['적극 참여', '상황 보고 참여', '참여하지 않음'])
    .setRequired(true);

  // ── 7. 추진 방식 비교 ──
  form.addMultipleChoiceItem()
    .setTitle('추진 방식 비교 (참고 후 선택)')
    .setHelpText(
      '[ 조합방식 ] 주민 주도 / 수익성 높음 / 조합원 간 갈등 및 사업기간 지연 시 비용 증가로 수익률 하락 가능\n' +
      '[ 신탁방식 ] 신탁사 주도 / 사업 속도 빠름 / 수익 일부 제한'
    )
    .setChoiceValues(['조합방식 선호', '신탁방식 선호', '잘 모르겠다'])
    .setRequired(true);

  // ── 8. 재건축 시 선호 평형 ──
  form.addMultipleChoiceItem()
    .setTitle('재건축 시 선호 평형 (1개 선택)')
    .setChoiceValues(['20평대', '30평대', '40평대 이상', '잘 모르겠다'])
    .setRequired(true);

  // ── 응답 시트 연결 ──
  var ss = SpreadsheetApp.create('설문응답_상계9단지_재건축의향');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  // 시트에 관리용 컬럼 추가 (폼 응답 컬럼 뒤에)
  // 폼 연결 후 잠시 대기 (시트 생성 지연)
  Utilities.sleep(2000);

  var sheet = ss.getSheets()[0];
  var lastCol = sheet.getLastColumn();

  // PDF생성여부, PDF링크 컬럼 추가
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
  Logger.log('=== 설문 폼 + 시트 생성 완료 ===');
  Logger.log('');
  Logger.log('폼 ID: ' + form.getId());
  Logger.log('폼 URL (수정): ' + form.getEditUrl());
  Logger.log('폼 URL (응답): ' + form.getPublishedUrl());
  Logger.log('');
  Logger.log('시트 ID: ' + ss.getId());
  Logger.log('시트 URL: ' + ss.getUrl());
  Logger.log('');
  Logger.log('다음 단계:');
  Logger.log('1. .env.local에 SURVEY_SPREADSHEET_ID=' + ss.getId() + ' 추가');
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
 * 이미 생성된 폼의 응답 시트에 관리 컬럼만 추가하는 유틸
 * (시트가 이미 있는 경우 사용)
 */
function addManagementColumns(spreadsheetId) {
  var ss = SpreadsheetApp.openById(spreadsheetId);
  var sheet = ss.getSheets()[0];
  var lastCol = sheet.getLastColumn();

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  if (headers.indexOf('PDF생성여부') === -1) {
    sheet.getRange(1, lastCol + 1).setValue('PDF생성여부');
    sheet.getRange(1, lastCol + 2).setValue('PDF링크');
    Logger.log('관리 컬럼 추가 완료');
  } else {
    Logger.log('관리 컬럼이 이미 존재합니다');
  }
}
