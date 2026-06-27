const CATEGORY_FILES = {
  '한국사':   'data/history.json',
  '과학':     'data/science.json',
  '지리':     'data/geography.json',
  '일반상식': 'data/general.json',
  '인지능력': 'data/iq.json',
};
const LEADERBOARD_KEY = 'QUIZ_LEADERBOARD';
const MAX_LB_ENTRIES = 50;
const FETCH_TIMEOUT_MS = 8000;

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
  questionCount: 3,
  advanceTimer: null,
};

// JSON 파일 캐시 (세션 동안 재로드 방지)
const jsonCache = {};

// ── 타이머 ──────────────────────────────────────────────
const TIMER_SEC = 10;
let _timerId = null;
let _timerSec = TIMER_SEC;

function startTimer() {
  stopTimer();
  _timerSec = TIMER_SEC;
  _renderTimer();
  _timerId = setInterval(() => {
    _timerSec--;
    _renderTimer();
    if (_timerSec <= 0) {
      stopTimer();
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

function _renderTimer() {
  const num = document.getElementById('timer-num');
  const ring = document.getElementById('timer-ring');
  if (!num || !ring) return;
  num.textContent = _timerSec;
  const pct = (_timerSec / TIMER_SEC) * 100;
  const clr = _timerSec > 6 ? '#22c55e' : _timerSec > 3 ? '#f59e0b' : '#ef4444';
  ring.style.setProperty('--pct', pct + '%');
  ring.style.setProperty('--clr', clr);
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

async function loadQuestions(category, count) {
  const n = Math.max(1, Math.min(100, count || 10));
  if (category === '전체혼합') {
    const all = await Promise.all(
      Object.values(CATEGORY_FILES).map(f => fetchJSON(f))
    );
    const selected = all.map(catData => shuffle(catData).slice(0, n));
    return shuffle(selected.flat());
  }
  const data = await fetchJSON(CATEGORY_FILES[category]);
  return shuffle(data).slice(0, n);
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  const screen = document.getElementById(id);
  screen.classList.remove('hidden');
  screen.focus();
}

// ── 오류 화면 ──────────────────────────────────────────
function showError(msg) {
  const app = document.getElementById('app');
  app.innerHTML = `<div class="card" style="margin-top:40px;text-align:center;gap:16px;" role="alert">
    <p style="font-size:2rem;" aria-hidden="true">⚠️</p>
    <p style="color:#b91c1c;font-weight:600;">${msg}</p>
    <p style="font-size:0.85rem;color:#64748b;">index.html을 직접 열지 말고 로컬 서버(npx serve)를 통해 실행하세요.</p>
    <button class="btn btn-secondary" onclick="location.reload()">새로고침</button>
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

  function clamp(v) { return Math.max(1, Math.min(100, v)); }

  function applyCount(val) {
    const n = clamp(parseInt(val, 10) || 10);
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

  if (isCorrect) {
    // 정답이면 0.5초 후 자동으로 다음 문제로 넘어간다.
    // 이 사이에 Enter/클릭으로 nextQuestion이 중복 실행되어 문제를 건너뛰는 것을 막기 위해
    // 수동 진행 버튼을 숨기고, 타이머 핸들을 보관해 nextQuestion에서 취소할 수 있게 한다.
    document.getElementById('next-btn').classList.add('hidden');
    state.advanceTimer = setTimeout(nextQuestion, 500);
  }
}

function showFeedback(isCorrect, correctAnswer, source) {
  const box = document.getElementById('feedback-box');
  box.className = `feedback ${isCorrect ? 'correct-fb' : 'wrong-fb'}`;
  box.setAttribute('role', 'alert');
  document.getElementById('feedback-msg').textContent = isCorrect
    ? '✓ 정답입니다!'
    : `✗ 오답입니다. 정답은 [${correctAnswer}]입니다.`;
  document.getElementById('source-text').textContent = `출처: ${source}`;
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
}

// ── 결과 화면 ──────────────────────────────────────────
function showResult() {
  showScreen('screen-result');

  const total = state.questions.length;
  const score = state.score;

  document.getElementById('score-display').innerHTML =
    `<div class="score-num" aria-label="점수 ${score}점 / ${total}점">${score} <span style="font-size:1.5rem;color:#94a3b8" aria-hidden="true">/ ${total}</span></div>
     <div class="score-label">정답 수</div>`;

  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const grade = GRADES.find(g => pct >= g.minPct);
  document.getElementById('grade-display').textContent = grade.label;

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
function saveScore(nickname, score, total) {
  let lb = loadLeaderboard();
  lb.push({ nickname, score, total, timestamp: state.currentSessionTimestamp });
  lb.sort((a, b) => b.score - a.score || a.timestamp - b.timestamp);
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
    return JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || '[]');
  } catch {
    return [];
  }
}

function showLeaderboard() {
  showScreen('screen-leaderboard');
  const lb = loadLeaderboard();
  const top10 = lb.slice(0, 10);

  const table = document.getElementById('leaderboard-table');
  // 헤더는 정적 문자열이라 안전. 데이터 행은 닉네임(사용자 입력)이 들어가므로
  // innerHTML 대신 textContent 기반 DOM 생성으로 XSS를 차단한다.
  table.innerHTML = `<tr><th scope="col">#</th><th scope="col">닉네임</th><th scope="col">점수</th><th scope="col">날짜</th></tr>`;
  top10.forEach((entry, i) => {
    const isMe = entry.nickname === state.nickname && entry.timestamp === state.currentSessionTimestamp;
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
    if (!confirm('순위 기록을 모두 삭제할까요?')) return;
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
