/**
 * 상계9단지 재건축 추진 의향 설문 — Google Docs 템플릿 생성 (1페이지, 어르신 가독성)
 *
 * 사용법: Apps Script 에디터에서 createSurveyTemplate() 실행
 *
 * 플레이스홀더 규칙:
 *   - 기본정보: {{동}}, {{호}}, {{성명}}, {{연락처}}
 *   - 선택지: ☐{{Q2_매우 필요}}, ☐{{Q2_필요}} 등
 *   - PDF 생성 시: 선택된 항목 ☐{{태그}} → ☑, 미선택 → ☐ (태그 제거)
 *   - 빈 설문지 시: 기본정보 → 밑줄, 모든 선택지 → ☐ (태그 제거)
 */

// 생성된 문서를 이 폴더로 이동
var TARGET_FOLDER_ID = '1UdJbtCDGQrIYcZ7CkigWBMqaAx7u3T5X';

function createSurveyTemplate() {
  var doc = DocumentApp.create('상계9단지 재건축 추진 의향 설문');
  var body = doc.getBody();

  // ── 페이지 설정 ──
  body.setMarginTop(30);
  body.setMarginBottom(25);
  body.setMarginLeft(45);
  body.setMarginRight(45);

  var FONT = 'Nanum Gothic';

  // ── 제목 ──
  var title = body.appendParagraph('상계9단지 재건축 추진 의향 설문');
  title.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  title.setAttributes(makeStyle(FONT, 15, true));
  title.setSpacingAfter(1);

  var organizer = body.appendParagraph('상계주공9단지아파트 재건축추진준비위원회');
  organizer.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  organizer.setAttributes(makeStyle(FONT, 9, false));
  organizer.setSpacingAfter(4);

  // ── 안내문 ──
  var introText =
    '안녕하십니까. 상계9단지는 2021년 예비안전진단 이후 현재까지 사업이 멈춰 있는 상태입니다. ' +
    '반면, 주변 단지들은 재건축이 빠르게 진행되고 있어 격차가 벌어지고 있습니다. ' +
    '이에 따라 주민 여러분의 의견을 확인하고자 합니다.';
  var intro = body.appendParagraph(introText);
  intro.setAttributes(makeStyle(FONT, 9, false));
  intro.setSpacingAfter(2);

  var checkNote = body.appendParagraph('※ 해당 항목에 ✔ 체크해 주세요.');
  checkNote.setAttributes(makeStyle(FONT, 9, true));
  checkNote.setSpacingAfter(3);

  body.appendHorizontalRule();

  // ── 1. 기본정보 ──
  var q1Title = body.appendParagraph('1. 기본정보');
  q1Title.setAttributes(makeStyle(FONT, 11, true));
  q1Title.setSpacingBefore(4);
  q1Title.setSpacingAfter(2);

  var infoTable = body.appendTable([
    ['동: {{동}}동', '호: {{호}}호'],
    ['성명: {{성명}}', '연락처: {{연락처}}']
  ]);
  infoTable.setBorderWidth(1);
  infoTable.setBorderColor('#999999');
  for (var r = 0; r < infoTable.getNumRows(); r++) {
    for (var c = 0; c < infoTable.getRow(r).getNumCells(); c++) {
      var cell = infoTable.getRow(r).getCell(c);
      cell.setAttributes(makeStyle(FONT, 11, false));
      cell.setPaddingTop(4);
      cell.setPaddingBottom(4);
      cell.setPaddingLeft(8);
      cell.setPaddingRight(8);
    }
  }

  // ── 설문 질문 ──
  var questions = [
    {
      num: 2, id: 'Q2', label: '재건축 필요성',
      options: ['매우 필요', '필요', '보통', '불필요']
    },
    {
      num: 3, id: 'Q3', label: '현재 상황에 대한 인식',
      options: ['빠른 추진이 필요하다', '현 상태 유지도 괜찮다', '잘 모르겠다']
    },
    {
      num: 4, id: 'Q4', label: '재건축 추진 의향',
      options: ['적극 찬성', '조건부 찬성', '반대', '잘 모르겠다']
    },
    {
      num: 5, id: 'Q5', label: '추진 시 가장 중요한 요소 (1개 선택)',
      options: ['사업 속도', '수익성', '안정성', '주거환경 개선']
    },
    {
      num: 6, id: 'Q6', label: '향후 추진 시 참여 의향',
      options: ['적극 참여', '상황 보고 참여', '참여하지 않음']
    },
    {
      num: 7, id: 'Q7', label: '추진 방식 비교 (참고 후 선택)',
      description: '[조합방식] 주민 주도 / 수익성 높음 / 갈등·지연 시 비용 증가 가능\n[신탁방식] 신탁사 주도 / 사업 속도 빠름 / 수익 일부 제한',
      options: ['조합방식 선호', '신탁방식 선호', '잘 모르겠다']
    },
    {
      num: 8, id: 'Q8', label: '재건축 시 선호 평형 (1개 선택)',
      options: ['20평대', '30평대', '40평대 이상', '잘 모르겠다']
    }
  ];

  for (var i = 0; i < questions.length; i++) {
    var q = questions[i];

    var qTitle = body.appendParagraph(q.num + '. ' + q.label);
    qTitle.setAttributes(makeStyle(FONT, 11, true));
    qTitle.setSpacingBefore(6);
    qTitle.setSpacingAfter(1);

    // 설명 (Q7)
    if (q.description) {
      var desc = body.appendParagraph(q.description);
      desc.setAttributes(makeStyle(FONT, 8, false));
      desc.editAsText().setForegroundColor('#444444');
      desc.setSpacingBefore(0);
      desc.setSpacingAfter(1);
    }

    // 선택지 가로 배치
    var optionParts = [];
    for (var j = 0; j < q.options.length; j++) {
      optionParts.push('☐{{' + q.id + '_' + q.options[j] + '}} ' + q.options[j]);
    }
    var optionLine = body.appendParagraph('    ' + optionParts.join('      '));
    optionLine.setAttributes(makeStyle(FONT, 11, false));
    optionLine.setSpacingBefore(1);
    optionLine.setSpacingAfter(0);
  }

  // ── 하단 ──
  body.appendHorizontalRule();

  var notice = body.appendParagraph('본 설문은 재건축 추진을 위한 참고자료로만 활용되며, 개인정보는 외부에 공개되지 않습니다.');
  notice.setAttributes(makeStyle(FONT, 8, false));
  notice.editAsText().setForegroundColor('#555555');
  notice.setSpacingAfter(2);

  var thanks = body.appendParagraph('감사합니다.');
  thanks.setAttributes(makeStyle(FONT, 10, false));
  thanks.setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  // 저장
  doc.saveAndClose();

  // ── 폴더로 이동 ──
  var docFile = DriveApp.getFileById(doc.getId());
  var targetFolder = DriveApp.getFolderById(TARGET_FOLDER_ID);
  targetFolder.addFile(docFile);
  DriveApp.getRootFolder().removeFile(docFile);

  var docId = doc.getId();
  Logger.log('=== 설문지 템플릿 생성 완료 ===');
  Logger.log('문서 ID: ' + docId);
  Logger.log('문서 URL: https://docs.google.com/open?id=' + docId);
  Logger.log('저장 폴더: 26년4월_기초설문조사');
  Logger.log('.env.local에 SURVEY_TEMPLATE_DOC_ID=' + docId + ' 추가');

  return docId;
}

function makeStyle(font, size, bold) {
  var style = {};
  style[DocumentApp.Attribute.FONT_FAMILY] = font;
  style[DocumentApp.Attribute.FONT_SIZE] = size;
  style[DocumentApp.Attribute.BOLD] = bold;
  style[DocumentApp.Attribute.LINE_SPACING] = 1.05;
  return style;
}
