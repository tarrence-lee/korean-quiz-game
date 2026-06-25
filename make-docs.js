const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat,
  TableOfContents, ExternalHyperlink
} = require('docx');
const fs = require('fs');

// ─── 공통 색상 ───────────────────────────────────────────────
const C = {
  primary:  '3B82F6',
  dark:     '1E293B',
  mid:      '334155',
  muted:    '64748B',
  light:    'EFF6FF',
  border:   'E2E8F0',
  success:  '15803D',
  white:    'FFFFFF',
  header:   '1D4ED8',
};

// ─── 헬퍼 ────────────────────────────────────────────────────
function hr() {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.border } },
    spacing: { after: 160 },
    children: [],
  });
}

function spacer(pt = 120) {
  return new Paragraph({ spacing: { before: pt, after: 0 }, children: [] });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, color: C.header, bold: true })],
    spacing: { before: 360, after: 160 },
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, color: C.dark, bold: true })],
    spacing: { before: 280, after: 120 },
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [new TextRun({ text, color: C.mid, bold: true })],
    spacing: { before: 200, after: 80 },
  });
}

function body(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, color: C.mid, size: 22, ...opts })],
  });
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, color: C.mid, size: 22 })],
  });
}

function numbered(text) {
  return new Paragraph({
    numbering: { reference: 'numbers', level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, color: C.mid, size: 22 })],
  });
}

function code(text) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    indent: { left: 720 },
    children: [new TextRun({ text, font: 'Courier New', size: 20, color: C.success })],
  });
}

// ─── 테이블 헬퍼 ────────────────────────────────────────────
const bdr = { style: BorderStyle.SINGLE, size: 1, color: C.border };
const borders = { top: bdr, bottom: bdr, left: bdr, right: bdr };
const cellMargins = { top: 80, bottom: 80, left: 160, right: 160 };

function headerCell(text, width) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: C.primary, type: ShadingType.CLEAR },
    margins: cellMargins,
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      children: [new TextRun({ text, bold: true, color: C.white, size: 20 })],
    })],
  });
}

function dataCell(text, width, shade = false) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: shade ? 'F8FAFC' : C.white, type: ShadingType.CLEAR },
    margins: cellMargins,
    children: [new Paragraph({
      children: [new TextRun({ text, color: C.mid, size: 20 })],
    })],
  });
}

function makeTable(headers, rows, colWidths) {
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((h, i) => headerCell(h, colWidths[i])),
      }),
      ...rows.map((row, ri) =>
        new TableRow({
          children: row.map((cell, ci) => dataCell(cell, colWidths[ci], ri % 2 === 0)),
        })
      ),
    ],
  });
}

// ─── 커버 페이지 ─────────────────────────────────────────────
function coverPage() {
  return [
    spacer(1800),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: '상식퀴즈 게임', size: 64, bold: true, color: C.primary })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 120 },
      children: [new TextRun({ text: 'Korean General Knowledge Quiz Game', size: 28, color: C.muted })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.primary } },
      spacing: { after: 200 },
      children: [],
    }),
    spacer(300),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: '프로젝트 개발 문서', size: 32, color: C.dark, bold: true })],
    }),
    spacer(800),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: '작성일: 2026년 6월 15일', size: 22, color: C.muted })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 60 },
      children: [new TextRun({ text: 'GitHub: tarrence-lee/korean-quiz-game', size: 22, color: C.muted })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 60 },
      children: [new TextRun({ text: '배포 URL: tarrence-lee.github.io/korean-quiz-game', size: 22, color: C.primary })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ─── 본문 섹션 ───────────────────────────────────────────────
function overviewSection() {
  return [
    h1('1. 프로젝트 개요'),
    hr(),
    h2('1.1 서비스 소개'),
    body('한국 일반상식 퀴즈 게임은 한국사, 과학, 지리, 일반상식 4개 카테고리에 걸쳐 총 400문제의 문제은행을 보유한 웹 기반 퀴즈 서비스입니다. 사용자는 카테고리와 문제 수를 직접 설정하여 매 세션마다 다른 문제로 도전할 수 있으며, 즉각적인 피드백과 점수 및 순위를 확인할 수 있습니다.'),
    spacer(),
    h2('1.2 핵심 목표'),
    bullet('검증된 출처(국사편찬위원회, 교육부 교육과정 등)의 문제만 수록하여 신뢰성 확보'),
    bullet('중학교·고등학교 수준을 고르게 배분하여 다양한 사용자 수준에 대응'),
    bullet('별도 빌드 도구 없이 index.html 하나로 실행 가능한 Zero-dependency SPA'),
    bullet('file:// 프로토콜 및 GitHub Pages 환경 모두에서 정상 동작'),
    bullet('모바일 환경 최적화 UI (48px 터치 타깃, 한국어 줄바꿈 최적화)'),
    spacer(),
    h2('1.3 배포 정보'),
    makeTable(
      ['항목', '내용'],
      [
        ['GitHub 저장소', 'github.com/tarrence-lee/korean-quiz-game'],
        ['라이브 URL', 'tarrence-lee.github.io/korean-quiz-game'],
        ['호스팅', 'GitHub Pages (master 브랜치 루트)'],
        ['접근 방식', '공개(Public) 저장소, 누구나 접근 가능'],
      ],
      [3120, 6240]
    ),
  ];
}

function techSection() {
  return [
    spacer(),
    h1('2. 기술 스택'),
    hr(),
    h2('2.1 프론트엔드'),
    makeTable(
      ['기술', '버전/방식', '용도'],
      [
        ['HTML5', 'Semantic HTML', '화면 구조 (4개 screen div)'],
        ['CSS3', 'Custom Properties', '반응형 테마, CSS 변수 18종'],
        ['Vanilla JavaScript', 'ES2020 (async/await)', '상태관리, 문제 로딩, 게임 로직'],
        ['Web Storage API', 'localStorage', '순위표 영속화 (최대 50개 항목)'],
        ['Fetch API', 'AbortController', 'JSON 로딩 (8초 타임아웃)'],
      ],
      [2100, 2100, 5160]
    ),
    spacer(),
    h2('2.2 데이터 파이프라인'),
    makeTable(
      ['파일', '역할'],
      [
        ['data/history.json', '한국사 100문제 (KH-001~KH-100)'],
        ['data/science.json', '과학 100문제 (SC-001~SC-100)'],
        ['data/geography.json', '지리 100문제 (GE-001~GE-100)'],
        ['data/general.json', '일반상식 100문제 (GN-001~GN-100)'],
        ['build-data.js', '4개 JSON을 data/questions.js로 번들링하는 Node.js 스크립트'],
        ['data/questions.js', 'window.__QUIZ_DATA__ 인라인 번들 (file:// 지원용)'],
        ['validate.js', '400문제 전체 스키마·중복·출처 검증 스크립트'],
      ],
      [3120, 6240]
    ),
    spacer(),
    h2('2.3 개발 도구'),
    bullet('로컬 서버: npx serve quiz-game --listen 3001'),
    bullet('빌드: node build-data.js (JSON → questions.js)'),
    bullet('검증: node validate.js'),
    bullet('배포: GitHub Pages (git push만으로 자동 반영)'),
  ];
}

function fileSection() {
  return [
    spacer(),
    h1('3. 파일 구조'),
    hr(),
    makeTable(
      ['경로', '설명'],
      [
        ['index.html', '진입점. 4개 screen 화면, ARIA 속성, 스크립트 로드'],
        ['app.js', '전체 게임 로직 (상태관리, 문제 로딩, 렌더링, 키보드 단축키)'],
        ['style.css', 'CSS Custom Properties 기반 반응형 스타일시트'],
        ['build-data.js', 'JSON 문제은행 → questions.js 번들러 (Node.js)'],
        ['validate.js', '400문제 전체 스키마 검증기 (Node.js)'],
        ['data/history.json', '한국사 100문제'],
        ['data/science.json', '과학 100문제'],
        ['data/geography.json', '지리 100문제'],
        ['data/general.json', '일반상식 100문제'],
        ['data/questions.js', '번들된 전체 문제 데이터 (window.__QUIZ_DATA__)'],
      ],
      [3120, 6240]
    ),
  ];
}

function featureSection() {
  return [
    spacer(),
    h1('4. 기능 명세'),
    hr(),
    h2('4.1 시작 화면'),
    bullet('닉네임 입력 (2자 이상, 최대 12자, ARIA 유효성 표시)'),
    bullet('카테고리 선택: 한국사 / 과학 / 지리 / 일반상식 / 전체혼합 (기본값: 전체혼합)'),
    bullet('카테고리별 문제 수 설정: − / 숫자 입력창 / + 버튼, 범위 1~100 (기본값: 3)'),
    bullet('subtitle 실시간 업데이트: "카테고리별 N문제씩, 최대 M문제에 도전하세요!"'),
    bullet('전체혼합 선택 시 카테고리당 N문제씩 × 4 = 최대 4N문제 출제'),

    spacer(),
    h2('4.2 문제 화면'),
    bullet('카테고리 배지 + 진행 현황 (예: 3 / 12)'),
    bullet('진행률 프로그레스바'),
    bullet('Fisher-Yates 셔플로 매 세션 무작위 문제·보기 순서'),
    bullet('정답 선택 → 즉시 정답/오답 색상 표시 + 출처 안내'),
    bullet('정답 시: 0.5초 후 자동으로 다음 문제 이동'),
    bullet('오답 시: "다음 문제 →" 버튼으로 수동 진행'),
    bullet('키보드 단축키: 1~4 보기 선택, Enter 다음 문제'),

    spacer(),
    h2('4.3 결과 화면'),
    bullet('총 점수 표시 (정답 수 / 전체 문제 수)'),
    bullet('정답률 기반 등급 판정: S(100%) / A(85%) / B(70%) / C(50%) / D(0%)'),
    bullet('카테고리별 세부 점수 테이블'),
    bullet('취약 카테고리 자동 감지 (전체혼합 시)'),
    bullet('순위표 보기 / 다시하기 버튼'),

    spacer(),
    h2('4.4 순위표'),
    bullet('localStorage 기반 상위 10명 표시 (전체 최대 50개 항목 저장)'),
    bullet('점수 내림차순 → 동점 시 플레이 시간 오름차순 정렬'),
    bullet('현재 세션 항목 하이라이트 표시'),
    bullet('우상단 "초기화" 버튼: 확인 다이얼로그 후 전체 기록 삭제'),
    bullet('QuotaExceededError 예외 처리: 항목 절반 축소 후 재시도'),
  ];
}

function dataSection() {
  return [
    spacer(),
    h1('5. 문제 데이터 구조'),
    hr(),
    h2('5.1 JSON 스키마'),
    makeTable(
      ['필드', '타입', '설명', '예시'],
      [
        ['id', 'string', '카테고리코드-순번 형식', 'KH-001'],
        ['category', 'string', '카테고리명', '한국사'],
        ['level', 'string', '중학교 또는 고등학교', '중학교'],
        ['question', 'string', '질문 텍스트', '고조선을 건국한 인물은?'],
        ['options', 'string[]', '보기 4개 배열 (순서 랜덤화)', '["단군왕검", "주몽", ...]'],
        ['answer', 'string', 'options 중 하나와 동일한 정답', '단군왕검'],
        ['source', 'string', '출처 (비어있으면 검증 실패)', '국사편찬위원회'],
      ],
      [1440, 1200, 3000, 3720]
    ),
    spacer(),
    h2('5.2 카테고리별 ID 체계'),
    makeTable(
      ['카테고리', 'ID 접두사', '문제 수', '주요 출처'],
      [
        ['한국사', 'KH', '100문제', '국사편찬위원회 한국사 데이터베이스'],
        ['과학', 'SC', '100문제', '교육부 과학 교육과정'],
        ['지리', 'GE', '100문제', '교육부 / 국토지리정보원'],
        ['일반상식', 'GN', '100문제', '법령정보센터 / 외교부 등'],
      ],
      [2340, 1440, 1440, 4140]
    ),
    spacer(),
    h2('5.3 검증 규칙 (validate.js)'),
    bullet('파일당 정확히 100문제'),
    bullet('id 형식: 영문 2자리-숫자 3자리 (예: KH-001)'),
    bullet('파일 내 id 중복 없음 + 전체 파일 간 id 중복 없음'),
    bullet('category 필드가 해당 파일의 카테고리와 일치'),
    bullet('level 값이 "중학교" 또는 "고등학교" 중 하나'),
    bullet('source 필드 비어있지 않음'),
    bullet('options 길이 정확히 4개, answer가 options에 포함'),
  ];
}

function architectureSection() {
  return [
    spacer(),
    h1('6. 애플리케이션 아키텍처'),
    hr(),
    h2('6.1 화면 흐름'),
    makeTable(
      ['화면', 'DOM ID', '진입 조건', '이탈 조건'],
      [
        ['시작 화면', 'screen-start', '앱 초기 진입 / 다시하기', '유효한 닉네임 + 카테고리 선택 후 게임 시작'],
        ['문제 화면', 'screen-quiz', '게임 시작 버튼 클릭', '마지막 문제 다음 버튼 클릭'],
        ['결과 화면', 'screen-result', '모든 문제 완료', '순위표 보기 또는 다시하기'],
        ['순위표', 'screen-leaderboard', '"순위표 보기" 버튼', '다시하기'],
      ],
      [2100, 2100, 2880, 2280]
    ),
    spacer(),
    h2('6.2 상태 관리 (state 객체)'),
    makeTable(
      ['속성', '타입', '설명'],
      [
        ['nickname', 'string', '사용자 닉네임'],
        ['category', 'string', '선택된 카테고리 (전체혼합 포함)'],
        ['questions', 'array', '현재 세션 문제 배열'],
        ['currentIndex', 'number', '현재 문제 인덱스'],
        ['score', 'number', '정답 누적 수'],
        ['categoryScores', 'object', '카테고리별 정답 수 (결과 테이블용)'],
        ['questionCount', 'number', '카테고리당 출제 문제 수 (기본값: 3)'],
        ['currentSessionTimestamp', 'number', '세션 타임스탬프 (순위표 본인 식별용)'],
      ],
      [2340, 1440, 5580]
    ),
    spacer(),
    h2('6.3 file:// 프로토콜 대응'),
    body('fetch() API는 file:// 환경에서 CORS 오류를 발생시킵니다. 이를 해결하기 위해 build-data.js가 모든 JSON 문제를 window.__QUIZ_DATA__ 글로벌 변수에 번들링한 questions.js를 생성합니다. fetchJSON() 함수는 이 변수를 우선 확인하여 네트워크 요청 없이 데이터를 반환합니다.'),
    spacer(80),
    code('// fetchJSON() 우선순위:'),
    code('// 1. jsonCache 캐시 확인'),
    code('// 2. window.__QUIZ_DATA__ 인라인 번들 확인'),
    code('// 3. fetch() 네트워크 요청 (8초 타임아웃)'),
  ];
}

function uiSection() {
  return [
    spacer(),
    h1('7. UI / UX 설계'),
    hr(),
    h2('7.1 반응형 레이아웃'),
    makeTable(
      ['구간', '최대 너비', '패딩'],
      [
        ['소형 모바일 (≤360px)', '480px', '카드 20px / 14px'],
        ['모바일 (≤639px)', '480px', '카드 28px / 20px'],
        ['데스크톱 (≥640px)', '560px', '카드 36px / 32px'],
      ],
      [3120, 2340, 3900]
    ),
    spacer(),
    h2('7.2 터치 최적화'),
    bullet('모든 버튼 최소 높이 48px (CSS --touch-min 변수)'),
    bullet('-webkit-tap-highlight-color: transparent 적용'),
    bullet('user-select: none으로 버튼 텍스트 선택 방지'),
    bullet('word-break: keep-all로 한국어 어절 단위 줄바꿈'),
    spacer(),
    h2('7.3 접근성 (ARIA)'),
    bullet('카테고리 버튼: aria-pressed="true/false"'),
    bullet('닉네임 입력: aria-invalid, aria-required, aria-describedby'),
    bullet('진행 현황: aria-live="polite" aria-atomic="true"'),
    bullet('피드백 박스: role="alert" aria-live="assertive"'),
    bullet('보기 컨테이너: role="group" aria-label="보기"'),
    bullet('각 보기 버튼: aria-label에 "(정답)"/"(오답)" 동적 추가'),
    spacer(),
    h2('7.4 CSS 변수 (테마)'),
    makeTable(
      ['변수', '값', '용도'],
      [
        ['--color-primary', '#3B82F6', '주요 버튼, 선택 상태, 배지'],
        ['--color-success', '#22C55E', '정답 피드백'],
        ['--color-error', '#EF4444', '오답 피드백, 오류 메시지'],
        ['--color-danger', '#DC2626', '기록 초기화 버튼'],
        ['--touch-min', '48px', '터치 버튼 최소 높이'],
        ['--radius-md', '12px', '카드 및 버튼 기본 라운드'],
        ['--transition', '0.2s', '호버/포커스 전환 속도'],
      ],
      [2880, 1680, 4800]
    ),
  ];
}

function deploySection() {
  return [
    spacer(),
    h1('8. 빌드 및 배포'),
    hr(),
    h2('8.1 로컬 실행'),
    numbered('npx serve . --listen 3001 (루트에서 실행)'),
    numbered('브라우저에서 http://localhost:3001 접속'),
    spacer(80),
    body('또는 data/questions.js가 있다면 index.html을 직접 더블클릭하여 실행 가능 (file:// 지원).'),
    spacer(),
    h2('8.2 문제 데이터 갱신 절차'),
    numbered('data/*.json 파일 편집'),
    numbered('node validate.js — 검증 통과 확인'),
    numbered('node build-data.js — questions.js 재생성'),
    numbered('git add . && git commit && git push — GitHub Pages 자동 반영'),
    spacer(),
    h2('8.3 GitHub Pages 설정'),
    makeTable(
      ['항목', '설정값'],
      [
        ['Branch', 'master'],
        ['Path', '/ (루트)'],
        ['Visibility', 'Public'],
        ['HTTPS', '강제 적용'],
      ],
      [3120, 6240]
    ),
  ];
}

function appendixSection() {
  return [
    spacer(),
    h1('9. 부록'),
    hr(),
    h2('9.1 등급 기준표'),
    makeTable(
      ['등급', '정답률', '메시지'],
      [
        ['S', '100%', '완벽합니다!'],
        ['A', '85% 이상', '훌륭합니다!'],
        ['B', '70% 이상', '잘 하셨습니다!'],
        ['C', '50% 이상', '조금 더 노력해봐요!'],
        ['D', '50% 미만', '다시 도전해보세요!'],
      ],
      [1440, 2340, 5580]
    ),
    spacer(),
    h2('9.2 주요 개발 이력'),
    makeTable(
      ['단계', '내용'],
      [
        ['1단계', '기본 퀴즈 게임 구현 (4 카테고리, 4지선다, 즉각 피드백, localStorage 순위표)'],
        ['2단계', '100문제 문제은행 구축, 무작위 10문제 추출, 중학교/고등학교 레벨 배분'],
        ['3단계', '최적화: CSS 변수, ARIA 접근성, validate.js, file:// 프로토콜 지원'],
        ['추가 1', '카테고리별 문제 수 설정 UI (−/숫자/+ 컨트롤, 실시간 subtitle 반영)'],
        ['추가 2', '기본값 변경: 전체혼합 기본 선택, 문제 수 기본값 3'],
        ['추가 3', '순위표 기록 초기화 버튼 (우상단 소형 버튼)'],
        ['추가 4', '모바일 UI 최적화 (48px 터치 타깃, 반응형 레이아웃 재설계)'],
        ['추가 5', '정답 시 0.5초 후 자동 다음 문제 이동'],
        ['배포', 'GitHub Pages 공개 배포 (tarrence-lee.github.io/korean-quiz-game)'],
      ],
      [1440, 7920]
    ),
  ];
}

// ─── 문서 조립 ───────────────────────────────────────────────
const doc = new Document({
  numbering: {
    config: [
      {
        reference: 'bullets',
        levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
      },
      {
        reference: 'numbers',
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }],
      },
    ],
  },
  styles: {
    default: {
      document: { run: { font: 'Malgun Gothic', size: 22, color: C.mid } },
    },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 36, bold: true, font: 'Malgun Gothic' },
        paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 28, bold: true, font: 'Malgun Gothic' },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 24, bold: true, font: 'Malgun Gothic' },
        paragraph: { spacing: { before: 180, after: 80 }, outlineLevel: 2 } },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 }, // A4
          margin: { top: 1440, right: 1080, bottom: 1440, left: 1080 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.border } },
            children: [
              new TextRun({ text: '상식퀴즈 게임 — 개발 문서', color: C.muted, size: 18 }),
            ],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.border } },
            children: [
              new TextRun({ text: 'Page ', color: C.muted, size: 18 }),
              new TextRun({ children: [PageNumber.CURRENT], color: C.muted, size: 18 }),
              new TextRun({ text: ' / ', color: C.muted, size: 18 }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], color: C.muted, size: 18 }),
            ],
          })],
        }),
      },
      children: [
        ...coverPage(),
        // TOC
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: '목  차', color: C.header, bold: true })] }),
        new TableOfContents('목차', { hyperlink: true, headingStyleRange: '1-2' }),
        new Paragraph({ children: [new PageBreak()] }),
        // 본문
        ...overviewSection(),
        ...techSection(),
        ...fileSection(),
        ...featureSection(),
        ...dataSection(),
        ...architectureSection(),
        ...uiSection(),
        ...deploySection(),
        ...appendixSection(),
      ],
    },
  ],
});

const outPath = 'C:\\Users\\peter\\Documents\\Claude_Project\\Test_QuizGame\\상식퀴즈_게임_개발문서.docx';
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(outPath, buf);
  console.log('생성 완료:', outPath);
}).catch(e => console.error('오류:', e));
