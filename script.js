(() => {
  "use strict";

  const WORD_LENGTH = 5;
  const MAX_GUESSES = 6;
  const EPOCH = new Date(2022, 0, 1); // day 0 reference, same spirit as the original Wordle
  const STORAGE_STATE = "termoClone.state.v1";
  const STORAGE_STATS = "termoClone.stats.v1";
  const STORAGE_THEME = "termoClone.theme.v1";

  const els = {
    board: document.getElementById("board"),
    keyboard: document.getElementById("keyboard"),
    toasts: document.getElementById("toast-container"),
    btnHelp: document.getElementById("btn-help"),
    btnStats: document.getElementById("btn-stats"),
    btnTheme: document.getElementById("btn-theme"),
    modalHelp: document.getElementById("modal-help"),
    modalStats: document.getElementById("modal-stats"),
    statPlayed: document.getElementById("stat-played"),
    statWinrate: document.getElementById("stat-winrate"),
    statStreak: document.getElementById("stat-streak"),
    statMaxstreak: document.getElementById("stat-maxstreak"),
    distribution: document.getElementById("distribution"),
    nextWord: document.getElementById("next-word"),
    countdown: document.getElementById("countdown"),
    btnShare: document.getElementById("btn-share"),
  };

  const KEY_ROWS = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACK"],
  ];

  const ACCENT_MAP = {
    "Á": "A", "À": "A", "Â": "A", "Ã": "A", "Ä": "A",
    "É": "E", "È": "E", "Ê": "E", "Ë": "E",
    "Í": "I", "Ì": "I", "Î": "I", "Ï": "I",
    "Ó": "O", "Ò": "O", "Ô": "O", "Õ": "O", "Ö": "O",
    "Ú": "U", "Ù": "U", "Û": "U", "Ü": "U",
    "Ç": "C", "Ñ": "N",
  };
  const ACCENT_RE = /[ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ]/g;

  function normalize(str) {
    return str.toUpperCase().replace(ACCENT_RE, (ch) => ACCENT_MAP[ch] || ch);
  }

  function dayIndex(wordCount) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.floor((today - EPOCH) / 86400000);
    return ((diffDays % wordCount) + wordCount) % wordCount;
  }

  function msUntilNextWord() {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return next - now;
  }

  // ---------------- game state ----------------

  let words = [];
  let normalizedToWord = new Map();
  let validSet = new Set();
  let target = "";
  let targetNorm = "";
  let todayIndex = 0;

  let state = {
    dayIndex: -1,
    guesses: [], // { display, statuses }
    current: "",
    gameOver: false,
    won: false,
  };

  let stats = {
    played: 0,
    wins: 0,
    currentStreak: 0,
    maxStreak: 0,
    distribution: [0, 0, 0, 0, 0, 0],
  };

  const keyStatus = new Map(); // letter -> 'correct' | 'present' | 'absent'

  function loadStats() {
    try {
      const raw = localStorage.getItem(STORAGE_STATS);
      if (raw) stats = { ...stats, ...JSON.parse(raw) };
    } catch (e) {}
  }

  function saveStats() {
    try {
      localStorage.setItem(STORAGE_STATS, JSON.stringify(stats));
    } catch (e) {}
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_STATE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.dayIndex === todayIndex) state = parsed;
      }
    } catch (e) {}
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_STATE, JSON.stringify(state));
    } catch (e) {}
  }

  function loadTheme() {
    try {
      const saved = localStorage.getItem(STORAGE_THEME);
      if (saved) document.documentElement.setAttribute("data-theme", saved);
    } catch (e) {}
  }

  // ---------------- toast ----------------

  function showToast(msg) {
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    els.toasts.appendChild(t);
    setTimeout(() => t.remove(), 1900);
  }

  // ---------------- board ----------------

  function buildBoard() {
    els.board.innerHTML = "";
    for (let r = 0; r < MAX_GUESSES; r++) {
      const row = document.createElement("div");
      row.className = "board-row";
      row.dataset.row = String(r);
      for (let c = 0; c < WORD_LENGTH; c++) {
        const tile = document.createElement("div");
        tile.className = "tile";
        tile.dataset.col = String(c);
        row.appendChild(tile);
      }
      els.board.appendChild(row);
    }
  }

  function getRowEl(r) {
    return els.board.querySelector(`.board-row[data-row="${r}"]`);
  }

  function renderCurrentRow() {
    const r = state.guesses.length;
    if (r >= MAX_GUESSES) return;
    const row = getRowEl(r);
    if (!row) return;
    const tiles = row.querySelectorAll(".tile");
    tiles.forEach((tile, i) => {
      const ch = state.current[i];
      tile.textContent = ch || "";
      tile.classList.toggle("filled", Boolean(ch));
    });
  }

  function renderCompletedGuesses({ animate = false } = {}) {
    state.guesses.forEach((g, r) => {
      const row = getRowEl(r);
      if (!row) return;
      const tiles = row.querySelectorAll(".tile");
      tiles.forEach((tile, i) => {
        tile.textContent = g.display[i];
        tile.classList.add("filled");
        tile.classList.remove("correct", "present", "absent");
        if (!animate) tile.classList.add(g.statuses[i]);
      });
    });
  }

  // ---------------- keyboard ----------------

  function buildKeyboard() {
    els.keyboard.innerHTML = "";
    KEY_ROWS.forEach((row) => {
      const rowEl = document.createElement("div");
      rowEl.className = "key-row";
      row.forEach((key) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.dataset.key = key;
        if (key === "ENTER" || key === "BACK") {
          btn.className = "key wide";
          btn.textContent = key === "ENTER" ? "ENTER" : "⌫";
        } else {
          btn.className = "key";
          btn.textContent = key;
        }
        btn.addEventListener("click", () => handleKey(key));
        rowEl.appendChild(btn);
      });
      els.keyboard.appendChild(rowEl);
    });
  }

  function refreshKeyboardColors() {
    els.keyboard.querySelectorAll(".key").forEach((btn) => {
      const k = btn.dataset.key;
      btn.classList.remove("correct", "present", "absent");
      const s = keyStatus.get(k);
      if (s) btn.classList.add(s);
    });
  }

  const STATUS_RANK = { absent: 1, present: 2, correct: 3 };

  function updateKeyStatuses(guessNorm, statuses) {
    for (let i = 0; i < guessNorm.length; i++) {
      const letter = guessNorm[i];
      const status = statuses[i];
      const prev = keyStatus.get(letter);
      if (!prev || STATUS_RANK[status] > STATUS_RANK[prev]) {
        keyStatus.set(letter, status);
      }
    }
    refreshKeyboardColors();
  }

  // ---------------- evaluation ----------------

  function evaluateGuess(guessNorm, targetNorm) {
    const result = new Array(WORD_LENGTH).fill("absent");
    const targetArr = targetNorm.split("");
    const guessArr = guessNorm.split("");
    const used = new Array(WORD_LENGTH).fill(false);

    for (let i = 0; i < WORD_LENGTH; i++) {
      if (guessArr[i] === targetArr[i]) {
        result[i] = "correct";
        used[i] = true;
      }
    }
    for (let i = 0; i < WORD_LENGTH; i++) {
      if (result[i] === "correct") continue;
      const idx = targetArr.findIndex((c, j) => !used[j] && c === guessArr[i]);
      if (idx > -1) {
        result[i] = "present";
        used[idx] = true;
      }
    }
    return result;
  }

  // ---------------- input handling ----------------

  let busy = false;

  function handleKey(key) {
    if (state.gameOver || busy) return;

    if (key === "ENTER") {
      submitGuess();
      return;
    }
    if (key === "BACK") {
      state.current = state.current.slice(0, -1);
      renderCurrentRow();
      return;
    }
    if (/^[A-Z]$/.test(key)) {
      if (state.current.length < WORD_LENGTH) {
        state.current += key;
        renderCurrentRow();
      }
    }
  }

  function shakeCurrentRow() {
    const row = getRowEl(state.guesses.length);
    if (!row) return;
    row.querySelectorAll(".tile").forEach((t) => {
      t.classList.remove("shake");
      // force reflow to restart animation
      void t.offsetWidth;
      t.classList.add("shake");
    });
  }

  function submitGuess() {
    if (state.current.length < WORD_LENGTH) {
      showToast("Palavra incompleta");
      shakeCurrentRow();
      return;
    }
    const guessNorm = normalize(state.current);
    if (!validSet.has(guessNorm)) {
      showToast("Palavra não encontrada");
      shakeCurrentRow();
      return;
    }

    const display = normalizedToWord.get(guessNorm) || state.current;
    const statuses = evaluateGuess(guessNorm, targetNorm);
    const r = state.guesses.length;

    busy = true;
    animateRowReveal(r, display, statuses, () => {
      state.guesses.push({ display, statuses });
      updateKeyStatuses(guessNorm, statuses);
      state.current = "";
      busy = false;

      const won = statuses.every((s) => s === "correct");
      const outOfTries = state.guesses.length >= MAX_GUESSES;

      if (won || outOfTries) {
        state.gameOver = true;
        state.won = won;
        finishGame(won);
      }
      saveState();
    });
  }

  function animateRowReveal(r, display, statuses, done) {
    const row = getRowEl(r);
    const tiles = row.querySelectorAll(".tile");
    const flipDuration = 500;
    const stagger = 220;

    tiles.forEach((tile, i) => {
      setTimeout(() => {
        tile.classList.add("flip");
        setTimeout(() => {
          tile.textContent = display[i];
          tile.classList.add(statuses[i]);
        }, flipDuration / 2);
      }, i * stagger);
    });

    setTimeout(() => {
      done();
    }, (tiles.length - 1) * stagger + flipDuration + 80);
  }

  function bounceRow(r) {
    const row = getRowEl(r);
    if (!row) return;
    row.querySelectorAll(".tile").forEach((tile, i) => {
      setTimeout(() => {
        tile.classList.add("bounce");
      }, i * 90);
    });
  }

  // ---------------- end game / stats ----------------

  function finishGame(won) {
    stats.played += 1;
    if (won) {
      stats.wins += 1;
      stats.currentStreak += 1;
      stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
      const idx = Math.min(state.guesses.length, 6) - 1;
      stats.distribution[idx] = (stats.distribution[idx] || 0) + 1;
      bounceRow(state.guesses.length - 1);
      setTimeout(() => showToast(pickWinMessage(state.guesses.length)), 350);
    } else {
      stats.currentStreak = 0;
      setTimeout(() => showToast(`A palavra era ${target}`), 350);
    }
    saveStats();
    setTimeout(openStats, won ? 1600 : 1400);
  }

  function pickWinMessage(tries) {
    const msgs = ["Excelente!", "Muito bem!", "Ótimo!", "Bom trabalho!", "Conseguiu!", "Por pouco!"];
    return msgs[Math.min(tries, msgs.length) - 1];
  }

  function renderStats() {
    els.statPlayed.textContent = String(stats.played);
    const winrate = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
    els.statWinrate.textContent = String(winrate);
    els.statStreak.textContent = String(stats.currentStreak);
    els.statMaxstreak.textContent = String(stats.maxStreak);

    const max = Math.max(1, ...stats.distribution);
    els.distribution.innerHTML = "";
    stats.distribution.forEach((count, i) => {
      const isCurrent = state.gameOver && state.won && state.guesses.length - 1 === i;
      const row = document.createElement("div");
      row.className = "dist-row";
      const pct = Math.max(8, Math.round((count / max) * 100));
      row.innerHTML = `
        <span class="dist-index">${i + 1}</span>
        <div class="dist-bar-wrap">
          <div class="dist-bar${isCurrent ? " highlight" : ""}" style="width:${pct}%">${count}</div>
        </div>`;
      els.distribution.appendChild(row);
    });

    if (state.gameOver) {
      els.nextWord.hidden = false;
      tickCountdown();
    } else {
      els.nextWord.hidden = true;
    }
  }

  let countdownTimer = null;
  function tickCountdown() {
    clearInterval(countdownTimer);
    const render = () => {
      const ms = msUntilNextWord();
      const h = String(Math.floor(ms / 3600000)).padStart(2, "0");
      const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, "0");
      const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");
      els.countdown.textContent = `${h}:${m}:${s}`;
    };
    render();
    countdownTimer = setInterval(render, 1000);
  }

  function buildShareText() {
    const lines = state.guesses.map((g) =>
      g.statuses.map((s) => (s === "correct" ? "🟩" : s === "present" ? "🟨" : "⬛")).join("")
    );
    const tries = state.won ? state.guesses.length : "X";
    return `termo ${tries}/${MAX_GUESSES}\n\n${lines.join("\n")}`;
  }

  async function shareResult() {
    const text = buildShareText();
    try {
      await navigator.clipboard.writeText(text);
      showToast("Resultado copiado!");
    } catch (e) {
      window.prompt("Copie seu resultado:", text);
    }
  }

  // ---------------- modals ----------------

  function openModal(modal) {
    modal.hidden = false;
  }
  function closeModal(modal) {
    modal.hidden = true;
  }
  function openStats() {
    renderStats();
    openModal(els.modalStats);
  }

  function wireModals() {
    els.btnHelp.addEventListener("click", () => openModal(els.modalHelp));
    els.btnStats.addEventListener("click", openStats);
    document.querySelectorAll("[data-close]").forEach((btn) => {
      btn.addEventListener("click", (e) => closeModal(e.target.closest(".modal-overlay")));
    });
    [els.modalHelp, els.modalStats].forEach((overlay) => {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeModal(overlay);
      });
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeModal(els.modalHelp);
        closeModal(els.modalStats);
      }
    });
    els.btnShare.addEventListener("click", shareResult);
  }

  function wireTheme() {
    els.btnTheme.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      const next = current === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", next);
      try {
        localStorage.setItem(STORAGE_THEME, next);
      } catch (e) {}
    });
  }

  function wirePhysicalKeyboard() {
    document.addEventListener("keydown", (e) => {
      if (!els.modalHelp.hidden || !els.modalStats.hidden) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toUpperCase();
      if (k === "ENTER") handleKey("ENTER");
      else if (k === "BACKSPACE") handleKey("BACK");
      else if (/^[A-Z]$/.test(k)) handleKey(k);
    });
  }

  // ---------------- boot ----------------

  async function init() {
    loadTheme();
    loadStats();
    wireModals();
    wireTheme();
    buildBoard();
    buildKeyboard();
    wirePhysicalKeyboard();

    const res = await fetch("palavras.json");
    const data = await res.json();
    words = data.palavras;

    words.forEach((w) => {
      const n = normalize(w);
      if (!normalizedToWord.has(n)) normalizedToWord.set(n, w);
      validSet.add(n);
    });

    todayIndex = dayIndex(words.length);
    target = words[todayIndex];
    targetNorm = normalize(target);

    loadState();
    if (state.dayIndex !== todayIndex) {
      state = { dayIndex: todayIndex, guesses: [], current: "", gameOver: false, won: false };
      saveState();
    }

    renderCompletedGuesses();
    state.guesses.forEach((g) => updateKeyStatuses(normalize(g.display), g.statuses));
    renderCurrentRow();

    if (state.gameOver) {
      setTimeout(openStats, 300);
    }
  }

  init();
})();
