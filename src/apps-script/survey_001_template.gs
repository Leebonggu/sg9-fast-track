/**
 * 1차 간단 설문 — Google Docs 템플릿 생성 (1페이지, 어르신 가독성)
 *
 * 사용법: Apps Script 에디터에서 createSurvey001Template() 실행
 *
 * 플레이스홀더 규칙:
 *   - 기본정보: {{dong}}, {{ho}}, {{name}}, {{phone}}, {{ageGroup}}
 *   - 선택지: ☐{{Q1_필요하다}}, ☐{{Q1_잘 모르겠다}} 등
 *   - PDF 생성 시: 선택된 항목 ☐{{태그}} → ☑, 미선택 → ☐ (태그 제거)
 *   - 빈 설문지 시: 기본정보 → 밑줄, 모든 선택지 → ☐ (태그 제거)
 */

var TARGET_FOLDER_ID = '16iK3rxaUcy4cCz0e_7KMgU4YZgFXo74W';

function createSurvey001Template() {
  var doc = DocumentApp.create('상계9단지 1차 간단 설문');
  var body = doc.getBody();

  // ── 페이지 설정 ──
  body.setMarginTop(30);
  body.setMarginBottom(25);
  body.setMarginLeft(45);
  body.setMarginRight(45);

  var FONT = 'Nanum Gothic';

  // ── 제목 ──
  var title = body.appendParagraph('상계9단지 재건축 관련 간단 설문 (1차)');
  title.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  title.setAttributes(makeStyle(FONT, 14, true));
  title.setSpacingAfter(1);

  var organizer = body.appendParagraph('상계주공9단지아파트 재건축추진준비위원회');
  organizer.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  organizer.setAttributes(makeStyle(FONT, 9, false));
  organizer.setSpacingAfter(2);

  var timeNote = body.appendParagraph('(소요시간: 약 30초)');
  timeNote.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  timeNote.setAttributes(makeStyle(FONT, 8, false));
  timeNote.editAsText().setForegroundColor('#666666');
  timeNote.setSpacingAfter(4);

  // ── 안내문 ──
  var introText =
    '안녕하십니까. 상계9단지 주민 여러분의 재건축 관련 의견을 확인하고자 간단한 설문을 진행합니다.';
  var intro = body.appendParagraph(introText);
  intro.setAttributes(makeStyle(FONT, 9, false));
  intro.setSpacingAfter(2);

  var checkNote = body.appendParagraph('※ 해당 항목에 ✔ 체크해 주세요.');
  checkNote.setAttributes(makeStyle(FONT, 9, true));
  checkNote.setSpacingAfter(3);

  body.appendHorizontalRule();

  // ── 기본정보 ──
  var infoTitle = body.appendParagraph('기본정보');
  infoTitle.setAttributes(makeStyle(FONT, 11, true));
  infoTitle.setSpacingBefore(4);
  infoTitle.setSpacingAfter(2);

  var infoTable = body.appendTable([
    ['동: {{dong}}', '호: {{ho}}호'],
    ['성명: {{name}}', '연락처: {{phone}}'],
    ['연령대: {{ageGroup}}', '']
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
      num: 1, id: 'Q1',
      label: '우리 단지 재건축이 필요하다고 생각하십니까?',
      options: ['필요하다', '잘 모르겠다', '필요하지 않다']
    },
    {
      num: 2, id: 'Q2',
      label: '재건축이 추진된다면 어떤 방향이 더 중요하다고 생각하십니까?',
      options: [
        '사업 지연 없이 최대한 빠르게 추진하는 것 (속도 우선)',
        '시간과 비용이 더 들더라도 신중하게 추진하는 것',
        '잘 모르겠다'
      ]
    },
    {
      num: 3, id: 'Q3',
      label: '마들역 인근 단지가 재건축 안전진단 완료 및 신속통합기획 접수를 진행 중인 사실을 알고 계셨습니까?',
      description: '(임광, 마들대림, 상계주공10·11단지, 상계보람 등)',
      options: ['잘 알고 있다', '어느 정도 알고 있다', '잘 모른다']
    },
    {
      num: 4, id: 'Q4',
      label: '상계주공 9단지가 서울시 복합정비구역으로 지정·고시되어 고층 개발(약 60층 수준)이 가능하다는 점을 알고 계셨습니까?',
      options: ['알고 있다', '처음 알았다']
    },
    {
      num: 5, id: 'Q5',
      label: '향후 재건축 관련 정보 안내를 받아보시겠습니까?',
      options: ['희망한다', '희망하지 않는다']
    },
    {
      num: 6, id: 'Q6',
      label: '재건축 후 선호하는 평형대는 어떻게 됩니까?',
      options: ['10평대', '20평대', '30평대', '40평대 이상']
    }
  ];

  for (var i = 0; i < questions.length; i++) {
    var q = questions[i];

    var qTitle = body.appendParagraph(q.num + '. ' + q.label);
    qTitle.setAttributes(makeStyle(FONT, 10, true));
    qTitle.setSpacingBefore(5);
    qTitle.setSpacingAfter(1);

    if (q.description) {
      var desc = body.appendParagraph(q.description);
      desc.setAttributes(makeStyle(FONT, 8, false));
      desc.editAsText().setForegroundColor('#444444');
      desc.setSpacingBefore(0);
      desc.setSpacingAfter(1);
    }

    // 선택지 — 모두 세로 배치 (텍스트 잘림/줄바꿈 방지)
    for (var j = 0; j < q.options.length; j++) {
      var optLine = body.appendParagraph('    ☐{{' + q.id + '_' + q.options[j] + '}} ' + q.options[j]);
      optLine.setAttributes(makeStyle(FONT, 10, false));
      optLine.setSpacingBefore(1);
      optLine.setSpacingAfter(0);
    }
  }

  // ── 하단 ──
  body.appendHorizontalRule();

  var notice = body.appendParagraph('※ 본 설문은 재건축 추진을 위한 주민 의견 참고자료로만 활용됩니다.');
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
  Logger.log('=== 1차 설문 템플릿 생성 완료 ===');
  Logger.log('문서 ID: ' + docId);
  Logger.log('문서 URL: https://docs.google.com/open?id=' + docId);
  Logger.log('.env.local에 SURVEY_001_TEMPLATE_DOC_ID=' + docId + ' 추가');

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
