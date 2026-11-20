import { WordSpace, normalizeWord } from './wordmath.js';

const MINUS = '−';
const PLUS = '+';
const START_KEYS = ['king', 'man', 'woman', 'paris', 'france', 'italy'];
const EXPR_MAX = 30;

const el = {
  lcd: document.querySelector('.lcd'),
  expr: document.getElementById('expr'),
  result: document.getElementById('result'),
  sub: document.getElementById('sub'),
  model: document.getElementById('model'),
  input: document.getElementById('word'),
  keys: document.querySelector('.keys'),
  wordKeys: [...document.querySelectorAll('.key-word')],
};

const state = {
  space: null, // WordSpace once the vectors load
  loading: true,
  tokens: [], // words and operators, for example ['king', '−', 'man']
  answer: null, // {terms, matches} after =
  error: '',
  recent: [...START_KEYS],
};

const isOp = (t) => t === PLUS || t === MINUS;

// ---- Actions -------------------------------------------------------------

/** Move the typed word into the expression. Returns false if it was rejected. */
function commitTyped() {
  const word = normalizeWord(el.input.value);
  if (!word) return true;
  if (!/^[a-z]+$/.test(word)) return fail('LETTERS ONLY');
  if (state.loading) return fail('STILL LOADING WORDS');
  if (!state.space.has(word)) return fail(`NOT IN DICTIONARY: ${word.toUpperCase()}`);
  state.tokens.push(word);
  remember(word);
  el.input.value = '';
  return true;
}

function fail(message) {
  state.error = message;
  render();
  return false;
}

function remember(word) {
  state.recent = [word, ...state.recent.filter((w) => w !== word)].slice(0, START_KEYS.length);
}

function pressOperator(op) {
  state.error = '';
  if (state.answer) {
    // Keep going from the answer, like a calculator does.
    const top = state.answer.matches[0];
    state.answer = null;
    state.tokens = top ? [top.word] : [];
    if (top) remember(top.word);
  }
  if (!commitTyped()) return;
  const last = state.tokens[state.tokens.length - 1];
  if (last === undefined) return fail('TYPE A WORD FIRST');
  if (isOp(last)) state.tokens[state.tokens.length - 1] = op;
  else state.tokens.push(op);
  render();
}

function pressEquals() {
  state.error = '';
  if (state.answer) return render();
  if (!commitTyped()) return;
  const last = state.tokens[state.tokens.length - 1];
  if (last === undefined || isOp(last)) return fail('TYPE A WORD FIRST');

  const terms = [];
  let sign = 1;
  for (const t of state.tokens) {
    if (isOp(t)) sign = t === PLUS ? 1 : -1;
    else terms.push({ word: t, sign });
  }
  state.answer = { tokens: [...state.tokens], matches: state.space.solve(terms, { top: 3 }) };
  render();
}

function pressBack() {
  state.error = '';
  if (state.answer) {
    state.answer = null;
  } else if (el.input.value) {
    el.input.value = el.input.value.slice(0, -1);
  } else {
    const last = state.tokens.pop();
    if (last && !isOp(last)) el.input.value = last;
  }
  render();
}

function pressClear() {
  state.tokens = [];
  state.answer = null;
  state.error = '';
  el.input.value = '';
  render();
}

function pressWordKey(slot) {
  const word = state.recent[slot];
  if (!word) return;
  startFreshIfAnswered();
  state.error = '';
  el.input.value = word;
  render();
}

function startFreshIfAnswered() {
  if (state.answer) {
    state.answer = null;
    state.tokens = [];
  }
}

// ---- Rendering -------------------------------------------------------------

function render() {
  el.lcd.classList.toggle('is-error', Boolean(state.error));

  let expr = state.tokens.join(' ');
  if (state.answer) expr += ' =';
  if (expr.length > EXPR_MAX) expr = '…' + expr.slice(expr.length - EXPR_MAX + 1);

  let result;
  let sub;
  if (state.loading) {
    result = '_';
    sub = state.error || el.sub.textContent;
    expr = 'LOADING';
  } else if (state.answer) {
    const [first, ...rest] = state.answer.matches;
    if (first) {
      result = `≈ ${first.word}`;
      sub = [`${pct(first.score)} MATCH`, ...rest.map((m) => `${m.word} ${pct(m.score)}`)].join(' · ');
    } else {
      result = 'NO ANSWER';
      sub = 'THOSE WORDS CANCEL OUT';
    }
  } else {
    result = `${normalizeWord(el.input.value)}_`;
    sub = state.error || (state.tokens.length ? 'ENTER TO SOLVE' : 'TYPE A WORD, THEN + OR −');
  }

  el.expr.textContent = expr || 'READY';
  el.result.textContent = result;
  el.result.classList.toggle('is-long', result.length > 9 && result.length <= 12);
  el.result.classList.toggle('is-longer', result.length > 12);
  el.sub.textContent = sub;

  el.wordKeys.forEach((key, i) => {
    const word = state.recent[i] || '';
    key.textContent = word;
    key.setAttribute('aria-label', word ? `Use ${word}` : 'Empty word key');
  });
}

const pct = (score) => `${Math.round(score * 100)}%`;

// ---- Events ---------------------------------------------------------------

el.keys.addEventListener('click', (event) => {
  const key = event.target.closest('button');
  if (!key) return;
  const action = key.dataset.action;
  if (action === 'clear') pressClear();
  else if (action === 'back') pressBack();
  else if (action === 'minus') pressOperator(MINUS);
  else if (action === 'plus') pressOperator(PLUS);
  else if (action === 'equals') pressEquals();
  else if (key.dataset.slot !== undefined) pressWordKey(Number(key.dataset.slot));
  // Keep typing flowing on desktop; on touch screens this would pop the keyboard.
  if (!matchMedia('(pointer: coarse)').matches) el.input.focus();
});

el.input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === '=') {
    event.preventDefault();
    pressEquals();
  } else if (event.key === '+') {
    event.preventDefault();
    pressOperator(PLUS);
  } else if (event.key === '-') {
    event.preventDefault();
    pressOperator(MINUS);
  } else if (event.key === ' ') {
    event.preventDefault();
  } else if (event.key === 'Backspace' && !el.input.value) {
    event.preventDefault();
    pressBack();
  } else if (event.key === 'Escape') {
    pressClear();
  }
});

el.input.addEventListener('input', () => {
  // An operator typed right after an answer carries on from it; anything
  // else starts a new sum.
  if (!/^\s*[+\-−]/.test(el.input.value)) startFreshIfAnswered();
  state.error = '';
  // Pasted text, and some phone keyboards, put + and - straight into the
  // field without a usable keydown. Treat them as operator presses here.
  if (/[+\-−]/.test(el.input.value)) {
    absorbOperators(el.input.value);
    return;
  }
  render();
});

/** Split text like "king - man + woman" into words and operator presses. */
function absorbOperators(text) {
  const parts = text.replace(/\s+/g, '').split(/([+\-−])/);
  el.input.value = '';
  for (let i = 0; i < parts.length; i += 2) {
    const word = parts[i];
    const op = parts[i + 1];
    el.input.value = word;
    if (op === undefined) break; // the last piece stays in the field
    pressOperator(op === '+' ? PLUS : MINUS);
    if (state.error) {
      // Stop at the first rejected word and leave the rest in the field to
      // fix. A stray operator with no word before it is dropped.
      el.input.value = parts.slice(word ? i : i + 2).join('');
      break;
    }
  }
  render();
}

// ---- Loading ---------------------------------------------------------------

async function fetchWithProgress(url, onProgress) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  // When the server compresses the file (GitHub Pages does), content-length is
  // the compressed size, smaller than what the reader hands back. So collect
  // chunks without trusting it, and use it only for a rough progress figure.
  const total = Number(response.headers.get('content-length')) || 0;
  if (!response.body) return response.arrayBuffer();
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total) onProgress(Math.min(received / total, 0.99));
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes.buffer;
}

async function load() {
  render();
  try {
    const meta = await fetch('data/meta.json').then((r) => r.json());
    el.model.textContent = `WV-${meta.dims} WORD VECTOR`;
    const [vocab, vectors] = await Promise.all([
      fetch('data/vocab.txt').then((r) => r.text()),
      fetchWithProgress('data/vectors.bin', (p) => {
        el.sub.textContent = `FETCHING WORDS ${Math.round(p * 100)}%`;
      }),
    ]);
    state.space = WordSpace.fromFiles(vocab, vectors, meta.dims);
    state.loading = false;
    state.error = '';
    // Open on the classic example, already solved.
    state.tokens = ['king', MINUS, 'man', PLUS, 'woman'];
    pressEquals();
  } catch (err) {
    console.error(err);
    el.expr.textContent = 'ERROR';
    el.sub.textContent = 'COULD NOT LOAD WORDS. RELOAD TO RETRY';
  }
}

load();
