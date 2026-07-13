const CATEGORY_FILES = {
  '한국사':   'data/history.json',
  '과학':     'data/science.json',
  '지리':     'data/geography.json',
  '일반상식': 'data/general.json',
  '인지능력': 'data/iq.json',
};
// Supabase questions 테이블의 category_id (supabase/schema.sql과 동일한 값)
const CATEGORY_IDS = {
  '한국사':   'history',
  '과학':     'science',
  '지리':     'geography',
  '일반상식': 'general',
  '인지능력': 'iq',
};
// anon(공개) 키: RLS 읽기 전용 정책으로 보호되므로 클라이언트에 노출되어도 안전하다.
// service_role 키는 절대 이곳에 넣지 않는다(쓰기 권한을 우회하는 관리자 키, .env 전용).
const SUPABASE_URL = 'https://iewdvheollnqzmfgbhgh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlld2R2aGVvbGxucXptZmdiaGdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5Mzk3NjIsImV4cCI6MjA5OTUxNTc2Mn0.eb_h0n-zaSLXEwoyz4tviKjE1lHit497cfBtQM3dcpY';
let _supabaseClient = null;
function getSupabaseClient() {
  if (_supabaseClient) return _supabaseClient;
  if (typeof supabase === 'undefined') return null; // CDN 로드 실패(오프라인 등) 시 폴백 유도
  _supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _supabaseClient;
}
const LEADERBOARD_KEY = 'QUIZ_LEADERBOARD';
const MAX_LB_ENTRIES = 50;
const FETCH_TIMEOUT_MS = 8000;
// 정답 시 다음 문제로 자동 진행하기까지의 지연(ms). 사용자는 그 전에 버튼/Enter로 즉시 넘어갈 수도 있다.
const CORRECT_ADVANCE_MS = 500;
// 카테고리별 기본 출제 문제 수(시작 화면 입력·state·loadQuestions 폴백에서 공통 사용)
const DEFAULT_QUESTION_COUNT = 3;
const MIN_QUESTION_COUNT = 1;
const MAX_QUESTION_COUNT = 100;

// 등급은 정답률(%)로 판정
const GRADES = [
  { minPct: 100, label: 'S등급 — 완벽합니다! 🏅' },
  { minPct: 85,  label: 'A등급 — 훌륭합니다! 🎉' },
  { minPct: 70,  label: 'B등급 — 잘 하셨습니다! 👍' },
  { minPct: 50,  label: 'C등급 — 조금 더 노력해봐요! 📚' },
  { minPct: 0,   label: 'D등급 — 다시 도전해보세요! 💪' },
];

const state = {
  nickname: '',
  category: '',
  questions: [],
  currentIndex: 0,
  score: 0,
  categoryScores: {},
  currentSessionTimestamp: 0,
  currentSessionEntryId: null,
  questionCount: DEFAULT_QUESTION_COUNT,
  advanceTimer: null,
};

// JSON 파일 캐시 (세션 동안 재로드 방지)
const jsonCache = {};
// 카테고리별 문제 캐시 (Supabase 조회 결과 또는 로컬 폴백 결과, 세션 동안 재로드 방지)
const questionCache = {};

// ── 타이머 ──────────────────────────────────────────────
const TIMER_SEC = 10;
let _timerId = null;
let _timerSec = TIMER_SEC;
let _timerActive = false;
let _timerPaused = false;

function startTimer() {
  stopTimer();
  _timerSec = TIMER_SEC;
  _timerActive = true;
  _timerPaused = false;
  _renderTimer();
  _runTimer();
}

function _runTimer() {
  _timerId = setInterval(() => {
    _timerSec--;
    _renderTimer();
    if (_timerSec <= 0) {
      stopTimer();
      _timerActive = false;
      handleTimeout();
    }
  }, 1000);
}

function stopTimer() {
  if (_timerId !== null) {
    clearInterval(_timerId);
    _timerId = null;
  }
}

// 타이머 버튼 클릭 시 일시정지/재개 토글
function toggleTimer() {
  if (!_timerActive) return;
  if (_timerPaused) {
    _timerPaused = false;
    _runTimer();
  } else {
    _timerPaused = true;
    stopTimer();
  }
  _renderTimer();
}

// 타이머 색상은 CSS 변수(:root)와 일치시켜 테마 일관성을 유지한다.
const TIMER_CLR_PAUSED = 'var(--color-text-muted)';
const TIMER_CLR_SAFE   = 'var(--color-success)';
const TIMER_CLR_WARN   = '#f59e0b'; // 경고(주황)는 아직 토큰이 없어 유지
const TIMER_CLR_DANGER = 'var(--color-error)';

function _renderTimer() {
  const num = document.getElementById('timer-num');
  const ring = document.getElementById('timer-ring');
  const hint = document.getElementById('timer-hint');
  if (!num || !ring) return;
  num.textContent = _timerPaused ? '⏸' : _timerSec;
  const pct = (_timerSec / TIMER_SEC) * 100;
  const clr = _timerPaused
    ? TIMER_CLR_PAUSED
    : _timerSec > 6 ? TIMER_CLR_SAFE : _timerSec > 3 ? TIMER_CLR_WARN : TIMER_CLR_DANGER;
  ring.style.setProperty('--pct', pct + '%');
  ring.style.setProperty('--clr', clr);
  ring.classList.toggle('paused', _timerPaused);
  ring.setAttribute('aria-label', _timerActive
    ? (_timerPaused ? '일시정지됨 — 눌러서 재개' : `남은 시간 ${_timerSec}초 — 눌러서 일시정지`)
    : '타이머');
  ring.setAttribute('aria-pressed', String(_timerPaused));
  ring.setAttribute('title', _timerActive
    ? (_timerPaused ? '탭하여 재개' : '탭하여 일시정지')
    : '');
  // 일시정지 상태를 숫자 아이콘 외에 텍스트로도 보강(가시성). 평소엔 &nbsp;로 자리만 유지해 레이아웃 시프트 방지.
  if (hint) {
    if (_timerActive && _timerPaused) {
      hint.textContent = '⏸ 일시정지됨 · 탭하여 재개';
      hint.classList.add('is-paused');
    } else {
      hint.textContent = ' '; // 비파괴 공백으로 자리 유지(innerHTML 미사용)
      hint.classList.remove('is-paused');
    }
  }
}

function handleTimeout() {
  const q = state.questions[state.currentIndex];
  document.querySelectorAll('.option-btn').forEach(btn => {
    btn.disabled = true;
    if (btn.dataset.value === q.answer) {
      btn.classList.add('correct');
      btn.setAttribute('aria-label', btn.getAttribute('aria-label') + ' (정답)');
    }
  });
  const box = document.getElementById('feedback-box');
  box.className = 'feedback wrong-fb';
  box.setAttribute('role', 'alert');
  document.getElementById('feedback-msg').textContent = `⏰ 시간 초과! 정답은 [${q.answer}]입니다.`;
  document.getElementById('source-text').textContent = `출처: ${q.source}`;
  updateNextBtnLabel();
  document.getElementById('next-btn').classList.remove('hidden');
  document.getElementById('next-btn').focus();
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 부분 Fisher-Yates 샘플링: 전체 배열을 셔플하지 않고 앞에서 count개만 무작위로 뽑는다.
// 전체 셔플(O(N))과 달리 스왑을 count번만 수행하므로, N개 중 소수만 뽑을 때 O(count)로 개선된다.
function sampleN(arr, count) {
  const a = [...arr];
  const n = Math.min(count, a.length);
  for (let i = 0; i < n; i++) {
    // [i, a.length) 구간에서 하나를 골라 앞으로 스왑 → 앞 n개가 균등 무작위 표본이 된다.
    const j = i + Math.floor(Math.random() * (a.length - i));
    [a[i], a[j]] = [a[j], a[i]];
  }
  a.length = n;
  return a;
}

async function fetchJSON(filePath) {
  if (jsonCache[filePath]) return jsonCache[filePath];

  // file:// 프로토콜 또는 인라인 번들 데이터 우선 사용
  if (window.__QUIZ_DATA__) {
    const key = Object.keys(CATEGORY_FILES).find(k => CATEGORY_FILES[k] === filePath);
    if (key && window.__QUIZ_DATA__[key]) {
      jsonCache[filePath] = window.__QUIZ_DATA__[key];
      return jsonCache[filePath];
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(filePath, { signal: controller.signal });
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') {
      throw new Error(`로딩 시간 초과: ${filePath}`);
    }
    throw new Error(`네트워크 오류: ${filePath}`);
  }
  clearTimeout(timer);

  if (!res.ok) throw new Error(`파일 로딩 실패: ${filePath} (HTTP ${res.status})`);

  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new Error(`JSON 파싱 오류: ${filePath}`);
  }

  if (!Array.isArray(data)) {
    throw new Error(`데이터 형식 오류: ${filePath} (배열이 아님)`);
  }

  jsonCache[filePath] = data;
  return data;
}

async function fetchFromSupabase(categoryId) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase 클라이언트를 사용할 수 없습니다.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let data, error;
  try {
    ({ data, error } = await client
      .from('questions')
      .select('id, level, question, options, answer, source')
      .eq('category_id', categoryId)
      .abortSignal(controller.signal));
  } finally {
    clearTimeout(timer);
  }

  if (error) throw new Error(`Supabase 조회 실패: ${categoryId}`);
  if (!Array.isArray(data) || data.length === 0) throw new Error(`Supabase 데이터 없음: ${categoryId}`);
  return data;
}

// 카테고리(한글 라벨)의 문제 목록을 가져온다.
// Supabase를 우선 조회하고, 실패(오프라인·설정 누락 등) 시 번들/로컬 JSON(fetchJSON)으로 자동 폴백한다.
async function loadCategoryQuestions(label) {
  if (questionCache[label]) return questionCache[label];

  const categoryId = CATEGORY_IDS[label];
  if (categoryId) {
    try {
      const rows = await fetchFromSupabase(categoryId);
      questionCache[label] = rows.map(q => ({ ...q, category: label }));
      return questionCache[label];
    } catch (e) {
      // Supabase 조회 실패 시 조용히 로컬 폴백으로 넘어간다.
    }
  }

  questionCache[label] = await fetchJSON(CATEGORY_FILES[label]);
  return questionCache[label];
}

async function loadQuestions(category, count) {
  const n = Math.max(
    MIN_QUESTION_COUNT,
    Math.min(MAX_QUESTION_COUNT, count || DEFAULT_QUESTION_COUNT)
  );
  if (category === '전체혼합') {
    const all = await Promise.all(
      Object.keys(CATEGORY_FILES).map(label => loadCategoryQuestions(label))
    );
    // 카테고리별로 앞 n개만 부분 셔플로 표본 추출한 뒤, 합쳐서 한 번만 전체 셔플해 섞는다.
    const selected = all.map(catData => sampleN(catData, n));
    return shuffle(selected.flat());
  }
  const data = await loadCategoryQuestions(category);
  return sampleN(data, n);
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  const screen = document.getElementById(id);
  screen.classList.remove('hidden');
  screen.focus();
}

// ── 오류 화면 ──────────────────────────────────────────
// msg는 코드 내부에서 전달하는 정적 문자열(사용자 입력 아님)이라 innerHTML이 안전하다.
// 색상/폰트 하드코딩(인라인 스타일)을 CSS 클래스로 옮겨 :root 테마 토큰과 일관성을 유지한다.
function showError(msg) {
  const app = document.getElementById('app');
  app.innerHTML = `<div class="card error-card" role="alert">
    <p class="error-icon" aria-hidden="true">⚠️</p>
    <p class="error-msg-text">${msg}</p>
    <p class="error-hint">브라우저에서 파일을 직접 열면 문제 데이터를 불러올 수 없어요. 터미널에서 <b>npx serve</b>로 로컬 서버를 실행한 뒤 접속해 주세요.</p>
    <button class="btn btn-secondary" onclick="location.reload()">다시 시도</button>
  </div>`;
}

// ── 시작 화면 ──────────────────────────────────────────
function updateSubtitle(count) {
  const catCount = Object.keys(CATEGORY_FILES).length;
  const el = document.getElementById('subtitle-text');
  if (!el) return;
  el.textContent = `카테고리별 ${count}문제씩, 최대 ${count * catCount}문제에 도전하세요!`;
}

function initCountControl() {
  const input = document.getElementById('count-input');
  const countError = document.getElementById('count-error');

  function clamp(v) { return Math.max(MIN_QUESTION_COUNT, Math.min(MAX_QUESTION_COUNT, v)); }

  function applyCount(val) {
    const n = clamp(parseInt(val, 10) || DEFAULT_QUESTION_COUNT);
    input.value = n;
    state.questionCount = n;
    countError.classList.add('hidden');
    updateSubtitle(n);
  }

  applyCount(input.value);

  document.getElementById('count-down').onclick = () => applyCount(state.questionCount - 1);
  document.getElementById('count-up').onclick   = () => applyCount(state.questionCount + 1);

  input.oninput = () => {
    const val = parseInt(input.value, 10);
    if (!input.value || isNaN(val) || val < 1 || val > 100) {
      countError.classList.remove('hidden');
    } else {
      countError.classList.add('hidden');
      state.questionCount = clamp(val);
      updateSubtitle(state.questionCount);
    }
  };

  input.onblur = () => applyCount(input.value);
}

function initStartScreen() {
  showScreen('screen-start');

  state.category = '전체혼합';

  initCountControl();

  const nicknameInput = document.getElementById('nickname-input');
  const nicknameError = document.getElementById('nickname-error');
  nicknameInput.value = '';
  nicknameInput.classList.remove('input-error');
  nicknameError.classList.add('hidden');

  document.getElementById('start-btn').onclick = async () => {
    const nick = nicknameInput.value.trim();
    if (nick.length < 2) {
      nicknameInput.classList.add('input-error');
      nicknameInput.setAttribute('aria-invalid', 'true');
      nicknameError.classList.remove('hidden');
      nicknameInput.focus();
      return;
    }
    nicknameInput.classList.remove('input-error');
    nicknameInput.setAttribute('aria-invalid', 'false');
    nicknameError.classList.add('hidden');

    if (!state.category) {
      alert('카테고리를 선택해 주세요.');
      return;
    }

    const countInput = document.getElementById('count-input');
    const countVal = parseInt(countInput.value, 10);
    if (!countInput.value || isNaN(countVal) || countVal < 1 || countVal > 100) {
      document.getElementById('count-error').classList.remove('hidden');
      countInput.focus();
      return;
    }
    state.questionCount = countVal;

    state.nickname = nick;
    state.score = 0;
    state.categoryScores = {};
    state.currentIndex = 0;

    const startBtn = document.getElementById('start-btn');
    startBtn.disabled = true;
    startBtn.textContent = '불러오는 중...';

    try {
      state.questions = await loadQuestions(state.category, state.questionCount);
    } catch (e) {
      startBtn.disabled = false;
      startBtn.textContent = '게임 시작';
      showError('문제 데이터를 불러올 수 없습니다. 로컬 서버를 통해 실행해 주세요.');
      return;
    }

    startBtn.disabled = false;
    startBtn.textContent = '게임 시작';
    renderQuestion();
    showScreen('screen-quiz');
  };
}

// ── 문제 화면 ──────────────────────────────────────────
function renderQuestion() {
  const q = state.questions[state.currentIndex];
  const total = state.questions.length;
  const idx = state.currentIndex;

  document.getElementById('quiz-category').textContent = q.category;

  const progressEl = document.getElementById('quiz-progress');
  progressEl.textContent = `${idx + 1} / ${total}`;

  // 현재 문항 번호(idx+1) 기준으로 채워 마지막 문제에서 100%에 도달하도록 한다(상단 "N / total" 표기와 일치)
  const pct = total > 0 ? Math.round(((idx + 1) / total) * 100) : 0;
  const progressBar = document.getElementById('progress-bar');
  progressBar.style.width = `${pct}%`;
  progressBar.setAttribute('aria-valuenow', idx + 1);
  progressBar.setAttribute('aria-valuemax', total);

  document.getElementById('question-text').textContent = q.question;
  startTimer();

  const optionsEl = document.getElementById('options-container');
  optionsEl.innerHTML = '';
  shuffle(q.options).forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    // 보기 텍스트는 데이터 출처가 신뢰 가능하더라도 방어적으로 textContent로 삽입(XSS 차단)
    const num = document.createElement('span');
    num.className = 'num';
    num.setAttribute('aria-hidden', 'true');
    num.textContent = i + 1;
    btn.appendChild(num);
    btn.appendChild(document.createTextNode(opt));
    btn.dataset.value = opt;
    btn.setAttribute('aria-label', `${i + 1}번: ${opt}`);
    btn.addEventListener('click', () => handleAnswer(opt, q));
    optionsEl.appendChild(btn);
  });

  const feedbackBox = document.getElementById('feedback-box');
  feedbackBox.className = 'feedback hidden';
  feedbackBox.removeAttribute('role');
  document.getElementById('feedback-msg').textContent = '';
  document.getElementById('source-text').textContent = '';
  document.getElementById('next-btn').classList.add('hidden');
}

function handleAnswer(selected, q) {
  stopTimer();
  _timerActive = false;
  // 일시정지 상태로 답하면 ⏸ 힌트가 남을 수 있어, 답변 시 일시정지 표시를 정리한다.
  _timerPaused = false;
  _renderTimer();
  const isCorrect = selected === q.answer;
  if (isCorrect) {
    state.score++;
    state.categoryScores[q.category] = (state.categoryScores[q.category] || 0) + 1;
  }

  document.querySelectorAll('.option-btn').forEach(btn => {
    btn.disabled = true;
    if (btn.dataset.value === q.answer) {
      btn.classList.add('correct');
      btn.setAttribute('aria-label', btn.getAttribute('aria-label') + ' (정답)');
    } else if (btn.dataset.value === selected && !isCorrect) {
      btn.classList.add('wrong');
      btn.setAttribute('aria-label', btn.getAttribute('aria-label') + ' (오답)');
    }
  });

  showFeedback(isCorrect, q.answer, q.source);

  // 다음 문제 버튼은 정답/오답 모두 노출·포커스하여 버튼/Enter로 즉시 진행할 수 있게 한다.
  const nextBtn = document.getElementById('next-btn');
  nextBtn.classList.remove('hidden');
  nextBtn.focus();

  // 정답이면 출처를 읽을 시간(CORRECT_ADVANCE_MS)만큼 둔 뒤 자동으로 다음 문제로 넘어간다.
  // (오답은 정답/해설을 충분히 확인하도록 수동 진행 유지)
  // nextQuestion()이 state.advanceTimer를 clearTimeout 하므로, 사용자가 먼저 버튼을 눌러도 중복 진행되지 않는다.
  if (isCorrect) {
    state.advanceTimer = setTimeout(nextQuestion, CORRECT_ADVANCE_MS);
  }
}

// 마지막 문제에서는 다음 동작이 결과 화면임을 버튼 문구로 미리 알린다(예측 가능성↑).
function updateNextBtnLabel() {
  const isLast = state.currentIndex >= state.questions.length - 1;
  document.getElementById('next-btn').textContent = isLast ? '결과 보기 →' : '다음 문제 →';
}

function showFeedback(isCorrect, correctAnswer, source) {
  const box = document.getElementById('feedback-box');
  box.className = `feedback ${isCorrect ? 'correct-fb' : 'wrong-fb'}`;
  box.setAttribute('role', 'alert');
  document.getElementById('feedback-msg').textContent = isCorrect
    ? '✓ 정답입니다!'
    : `✗ 오답입니다. 정답은 [${correctAnswer}]입니다.`;
  document.getElementById('source-text').textContent = `출처: ${source}`;
  updateNextBtnLabel();
  document.getElementById('next-btn').classList.remove('hidden');
}

function nextQuestion() {
  // 정답 자동 진행 타이머가 남아 있으면 취소해 중복 진행(문제 건너뜀)을 방지한다.
  if (state.advanceTimer) {
    clearTimeout(state.advanceTimer);
    state.advanceTimer = null;
  }
  stopTimer();
  state.currentIndex++;
  if (state.currentIndex >= state.questions.length) {
    showResult();
  } else {
    renderQuestion();
  }
}

function initQuizScreen() {
  document.getElementById('next-btn').onclick = nextQuestion;
  document.getElementById('timer-ring').onclick = toggleTimer;
}

// ── 결과 화면 ──────────────────────────────────────────
function showResult() {
  showScreen('screen-result');

  const total = state.questions.length;
  const score = state.score;

  document.getElementById('score-display').innerHTML =
    `<div class="score-num" aria-label="점수 ${score}점 / ${total}점">${score} <span class="score-total" aria-hidden="true">/ ${total}</span></div>
     <div class="score-label">정답 수</div>`;

  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const grade = GRADES.find(g => pct >= g.minPct);
  const gradeEl = document.getElementById('grade-display');
  gradeEl.textContent = grade.label;
  // 정답률에 따라 등급 배경색을 달리해 성취감을 시각적으로 강화(라벨 텍스트로도 등급을 병기 → 색 의존 아님)
  gradeEl.className = 'grade ' + (pct >= 85 ? 'grade-high' : pct >= 50 ? 'grade-mid' : 'grade-low');

  const cats = Object.keys(CATEGORY_FILES);
  const activeCats = state.category === '전체혼합' ? cats : [state.category];

  let minRate = Infinity, weakCat = '';
  let tableHTML = `<tr><th scope="col">카테고리</th><th scope="col">문제 수</th><th scope="col">점수</th></tr>`;
  activeCats.forEach(cat => {
    const s = state.categoryScores[cat] || 0;
    const cnt = state.questions.filter(q => q.category === cat).length;
    tableHTML += `<tr><td>${cat}</td><td>${cnt}문제</td><td>${s} / ${cnt}</td></tr>`;
    // 카테고리별 문항 수가 다를 수 있으므로 절대 점수가 아닌 정답률로 취약 카테고리를 판정한다
    const rate = cnt > 0 ? s / cnt : 1;
    if (rate < minRate) { minRate = rate; weakCat = cat; }
  });
  document.getElementById('category-table').innerHTML = tableHTML;

  const weakEl = document.getElementById('weak-category');
  if (activeCats.length > 1 && weakCat) {
    weakEl.textContent = `📌 취약 카테고리: ${weakCat}`;
    weakEl.classList.remove('hidden');
  } else {
    weakEl.classList.add('hidden');
  }

  state.currentSessionTimestamp = Date.now();
  saveScore(state.nickname, score, total);

  document.getElementById('to-leaderboard-btn').onclick = showLeaderboard;
  document.getElementById('retry-btn-result').onclick = initStartScreen;
}

// ── 순위표 ──────────────────────────────────────────────
async function submitScoreToSupabase(nickname, score, total, category) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase 클라이언트를 사용할 수 없습니다.');
  const { data, error } = await client
    .from('rankings')
    .insert({ nickname, score, total, category })
    .select('id')
    .single();
  if (error) throw new Error('Supabase 점수 등록 실패');
  return data.id;
}

async function fetchRankingsFromSupabase(limit) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase 클라이언트를 사용할 수 없습니다.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let data, error;
  try {
    ({ data, error } = await client
      .from('rankings')
      .select('id, nickname, score, total, played_at')
      .order('rate', { ascending: false })
      .order('score', { ascending: false })
      .order('played_at', { ascending: true })
      .limit(limit)
      .abortSignal(controller.signal));
  } finally {
    clearTimeout(timer);
  }

  if (error) throw new Error('Supabase 순위 조회 실패');
  return data.map(r => ({
    id: r.id,
    nickname: r.nickname,
    score: r.score,
    total: r.total,
    timestamp: new Date(r.played_at).getTime(),
  }));
}

// 전체 사용자 공개 순위표(Supabase)에 점수를 등록한다.
// 오프라인 등으로 등록에 실패하면 이 기기에만 남는 로컬 기록으로 폴백한다.
async function saveScore(nickname, score, total) {
  try {
    state.currentSessionEntryId = await submitScoreToSupabase(nickname, score, total, state.category);
    return;
  } catch (e) {
    // Supabase 등록 실패 시 아래에서 로컬 폴백으로 저장
  }
  state.currentSessionEntryId = null;
  saveScoreLocal(nickname, score, total);
}

function saveScoreLocal(nickname, score, total) {
  let lb = loadLeaderboard();
  lb.push({ nickname, score, total, timestamp: state.currentSessionTimestamp });
  // 문제 수가 가변이므로 원점수가 아닌 정답률을 1차 정렬 키로 사용한다.
  // 동률이면 원점수(더 많이 맞힌 사람 우선), 그다음 먼저 기록한 시간 순.
  // total이 0인 손상 데이터로 NaN이 생겨 정렬이 깨지지 않도록 방어한다.
  const rate = e => (e.total > 0 ? e.score / e.total : 0);
  lb.sort((a, b) =>
    rate(b) - rate(a)
    || b.score - a.score
    || a.timestamp - b.timestamp);
  if (lb.length > MAX_LB_ENTRIES) lb = lb.slice(0, MAX_LB_ENTRIES);
  try {
    localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(lb));
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      // 저장 공간 부족 시 절반으로 축소 후 재시도
      lb = lb.slice(0, Math.max(1, Math.floor(lb.length / 2)));
      try {
        localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(lb));
      } catch (_) {
        // 재시도도 실패하면 순위 저장을 건너뜀
      }
    }
  }
}

function loadLeaderboard() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || '[]');
    // 손상된 localStorage(객체/문자열 등)로 인해 .push/.sort/.slice가 크래시나지 않도록
    // 배열이 아니면 빈 배열로 취급한다.
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function showLeaderboard() {
  showScreen('screen-leaderboard');

  const table = document.getElementById('leaderboard-table');
  const resetBtn = document.getElementById('reset-lb-btn');

  // 전체 사용자 공개 순위표(Supabase)를 우선 조회하고, 실패(오프라인 등) 시 이 기기의 로컬 기록으로 폴백한다.
  let lb, isLocal;
  try {
    lb = await fetchRankingsFromSupabase(10);
    isLocal = false;
  } catch (e) {
    lb = loadLeaderboard();
    isLocal = true;
  }
  const top10 = lb.slice(0, 10);

  // 기록이 없으면(예: 초기화 직후) 헤더만 있는 빈 표 대신 안내형 빈 상태를 보여준다.
  // 모두 정적 문자열이라 innerHTML이 안전하며, 초기화 버튼은 지울 기록이 없으므로 숨긴다.
  if (top10.length === 0) {
    table.innerHTML = `<tr><td class="empty-state">
      <span class="empty-icon" aria-hidden="true">📋</span>
      <span class="empty-title">아직 기록이 없어요</span>
      <span class="empty-desc">퀴즈를 풀면 이곳에 점수가 순위로 쌓여요.<br>지금 도전해 첫 기록의 주인공이 되어 보세요!</span>
    </td></tr>`;
    resetBtn.classList.add('hidden');
    document.getElementById('retry-btn-lb').onclick = initStartScreen;
    return;
  }
  // 전체 공개 순위표는 다른 사람의 기록도 담고 있어 임의로 지울 수 없다(서버에도 삭제 정책이 없음).
  // 초기화 버튼은 이 기기의 로컬 폴백 기록을 보고 있을 때만 의미가 있으므로 그때만 노출한다.
  resetBtn.classList.toggle('hidden', !isLocal);

  // 헤더는 정적 문자열이라 안전. 데이터 행은 닉네임(사용자 입력)이 들어가므로
  // innerHTML 대신 textContent 기반 DOM 생성으로 XSS를 차단한다.
  table.innerHTML = `<tr><th scope="col">#</th><th scope="col">닉네임</th><th scope="col">점수</th><th scope="col">날짜</th></tr>`;
  top10.forEach((entry, i) => {
    // 로컬 폴백 기록은 타임스탬프로, Supabase 기록은 등록된 행의 id로 "내 기록"을 식별한다
    // (서버가 played_at을 직접 채우므로 클라이언트 타임스탬프와 정확히 일치하지 않을 수 있다).
    const isMe = isLocal
      ? (entry.nickname === state.nickname && entry.timestamp === state.currentSessionTimestamp)
      : (entry.id != null && entry.id === state.currentSessionEntryId);
    const date = new Date(entry.timestamp).toLocaleDateString('ko-KR');

    const tr = document.createElement('tr');
    if (isMe) {
      tr.className = 'me';
      tr.setAttribute('aria-current', 'true');
    }

    const rankTd = document.createElement('td');
    rankTd.textContent = i + 1;
    const nameTd = document.createElement('td');
    nameTd.textContent = entry.nickname + (isMe ? ' 👈' : '');
    const scoreTd = document.createElement('td');
    scoreTd.textContent = `${entry.score} / ${entry.total}`;
    const dateTd = document.createElement('td');
    dateTd.textContent = date;

    tr.append(rankTd, nameTd, scoreTd, dateTd);
    table.appendChild(tr);
  });
  document.getElementById('retry-btn-lb').onclick = initStartScreen;

  document.getElementById('reset-lb-btn').onclick = () => {
    if (!confirm('이 기기에 저장된 로컬 기록을 모두 삭제할까요?')) return;
    localStorage.removeItem(LEADERBOARD_KEY);
    showLeaderboard();
  };
}

// ── 키보드 단축키 ────────────────────────────────────────
document.addEventListener('keydown', e => {
  const quizVisible = !document.getElementById('screen-quiz').classList.contains('hidden');
  if (!quizVisible) return;

  if (['1', '2', '3', '4'].includes(e.key)) {
    const btns = document.querySelectorAll('.option-btn:not(:disabled)');
    const target = btns[parseInt(e.key, 10) - 1];
    if (target) {
      e.preventDefault();
      target.click();
    }
  }

  if (e.key === 'Enter') {
    const nextBtn = document.getElementById('next-btn');
    if (!nextBtn.classList.contains('hidden')) {
      e.preventDefault();
      nextBtn.click();
    }
  }
});

// ── 초기화 ──────────────────────────────────────────────
initStartScreen();
initQuizScreen();
