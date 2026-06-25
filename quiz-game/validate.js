const fs = require('fs');
const path = require('path');

const EXPECTED_COUNT = 100;
const VALID_LEVELS = ['중학교', '고등학교'];

const files = [
  { file: 'history.json',   expectedCode: 'KH', category: '한국사' },
  { file: 'science.json',   expectedCode: 'SC', category: '과학' },
  { file: 'geography.json', expectedCode: 'GE', category: '지리' },
  { file: 'general.json',   expectedCode: 'GN', category: '일반상식' },
  { file: 'iq.json',        expectedCode: 'IQ', category: '인지능력' },
];

let allPass = true;
let totalQuestions = 0;
const globalIds = new Set();

files.forEach(({ file, expectedCode, category }) => {
  const filePath = path.join(__dirname, 'data', file);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    console.log(`[FAIL] ${file} — 파일 읽기 오류: ${e.message}`);
    allPass = false;
    return;
  }

  const errors = [];

  if (data.length !== EXPECTED_COUNT) {
    errors.push(`문제 수 오류: ${data.length}개 (${EXPECTED_COUNT}개 필요)`);
  }

  const localIds = new Set();
  data.forEach((q, i) => {
    const label = `${i + 1}번 문항(${q.id ?? '?'})`;

    if (!q.id) {
      errors.push(`${label}: id 필드 없음`);
    } else {
      if (!/^[A-Z]{2}-\d{3}$/.test(q.id)) {
        errors.push(`${label}: id 형식 오류 (예: ${expectedCode}-001)`);
      }
      if (localIds.has(q.id)) {
        errors.push(`${label}: 파일 내 id 중복 — "${q.id}"`);
      }
      if (globalIds.has(q.id)) {
        errors.push(`${label}: 전역 id 중복 — "${q.id}" (다른 파일과 충돌)`);
      }
      localIds.add(q.id);
      globalIds.add(q.id);
    }

    if (!q.question || q.question.trim() === '') {
      errors.push(`${label}: question 필드가 비어 있음`);
    }

    if (!q.options || q.options.length !== 4) {
      errors.push(`${label}: options 길이 오류 (${q.options?.length ?? 0}개, 필요: 4개)`);
    } else if (!q.options.includes(q.answer)) {
      errors.push(`${label}: answer="${q.answer}"가 options에 없음`);
    }

    if (!q.category) {
      errors.push(`${label}: category 필드 없음`);
    } else if (q.category !== category) {
      errors.push(`${label}: category 불일치 (파일: ${category}, 데이터: ${q.category})`);
    }

    if (!q.level) {
      errors.push(`${label}: level 필드 없음`);
    } else if (!VALID_LEVELS.includes(q.level)) {
      errors.push(`${label}: level 오류 — "${q.level}" (유효값: ${VALID_LEVELS.join(', ')})`);
    }

    if (!q.source || q.source.trim() === '') {
      errors.push(`${label}: source 필드가 비어 있음`);
    }
  });

  if (errors.length === 0) {
    console.log(`[PASS] ${file} — ${data.length}문제, 전체 검증 통과`);
    totalQuestions += data.length;
  } else {
    allPass = false;
    console.log(`[FAIL] ${file}`);
    errors.forEach(e => console.log(`  ✗ ${e}`));
  }
});

console.log('');
if (allPass) {
  console.log(`✅ 전체 검증 통과 (총 ${totalQuestions}문제)`);
} else {
  console.log('❌ 일부 검증 실패 — 위 오류를 확인하세요.');
  process.exit(1);
}
