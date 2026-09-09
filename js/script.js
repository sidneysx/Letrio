(() => {
  "use strict";

  const WORD_LENGTH = 5;

  const MODES = {
    termo:    { key: "termo",    boards: 1, guesses: 6, label: "termo" },
    dueto:    { key: "dueto",    boards: 2, guesses: 7, label: "dueto" },
    trio:     { key: "trio",     boards: 3, guesses: 8, label: "trio" },
    quarteto: { key: "quarteto", boards: 4, guesses: 9, label: "quarteto" },
  };
  const GAME_MAX_WIDTH = { termo: 560, dueto: 760, trio: 980, quarteto: 1200 };

  const STORAGE_STATE = "termoClone.state.v4"; // { [modeKey]: state }
  const STORAGE_STATS = "termoClone.stats.v2"; // { [modeKey]: stats }
  const STORAGE_THEME = "termoClone.theme.v1";
  const STORAGE_MODE = "termoClone.mode.v1";

  const els = {
    game: document.querySelector(".game"),
    topbar: document.querySelector(".topbar"),
    logo: document.getElementById("logo"),
    modeNav: document.getElementById("mode-nav"),
    boards: document.getElementById("boards"),
    keyboard: document.getElementById("keyboard"),
    toasts: document.getElementById("toast-container"),
    btnModes: document.getElementById("btn-modes"),
    btnHelp: document.getElementById("btn-help"),
    btnNewgame: document.getElementById("btn-newgame"),
    btnStats: document.getElementById("btn-stats"),
    btnTheme: document.getElementById("btn-theme"),
    modalHelp: document.getElementById("modal-help"),
    modalStats: document.getElementById("modal-stats"),
    helpIntro: document.getElementById("help-intro"),
    helpMulti: document.getElementById("help-multi"),
    statsTitle: document.getElementById("stats-title"),
    statPlayed: document.getElementById("stat-played"),
    statWinrate: document.getElementById("stat-winrate"),
    statStreak: document.getElementById("stat-streak"),
    statMaxstreak: document.getElementById("stat-maxstreak"),
    distribution: document.getElementById("distribution"),
    btnAgain: document.getElementById("btn-again"),
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

  function pickDistinctIndexes(n, excludeWords) {
    const exclude = new Set(excludeWords || []);
    const pool = words.map((_, i) => i).filter((i) => !exclude.has(words[i]));
    const source = pool.length >= n ? pool : words.map((_, i) => i);
    const chosen = new Set();
    while (chosen.size < n && chosen.size < source.length) {
      chosen.add(source[Math.floor(Math.random() * source.length)]);
    }
    return Array.from(chosen);
  }

  // ---------------- mode ----------------

  let modeKey = "termo";
  let mode = MODES.termo;

  function defaultState(m) {
    return {
      modeKey: m.key,
      targets: new Array(m.boards).fill(""),
      boardGuesses: Array.from({ length: m.boards }, () => []),
      solved: new Array(m.boards).fill(false),
      round: 0,
      current: new Array(WORD_LENGTH).fill(""),
      gameOver: false,
      won: false,
    };
  }

  function defaultStats(m) {
    return {
      played: 0,
      wins: 0,
      currentStreak: 0,
      maxStreak: 0,
      distribution: new Array(m.guesses).fill(0),
    };
  }

  // ---------------- game state ----------------

  let words = [];
  let normalizedToWord = new Map();
  let validSet = new Set();

  let state = defaultState(mode);
  let cursor = 0; // index in state.current the next typed letter lands on

  function firstEmptyIndex() {
    const idx = state.current.indexOf("");
    return idx === -1 ? WORD_LENGTH - 1 : idx;
  }

  function setCursor(i) {
    cursor = Math.max(0, Math.min(i, WORD_LENGTH - 1));
    renderCurrentRow();
  }

  let stats = defaultStats(mode);
  let allStates = {};
  let allStats = {};

  const keyStatus = new Map(); // letter -> 'correct' | 'present' | 'absent'

  function loadAllStats() {
    try {
      const raw = localStorage.getItem(STORAGE_STATS);
      if (raw) allStats = JSON.parse(raw) || {};
    } catch (e) {}
  }

  function loadStatsForCurrentMode() {
    const saved = allStats[modeKey];
    stats =
      saved && Array.isArray(saved.distribution) && saved.distribution.length === mode.guesses
        ? saved
        : defaultStats(mode);
  }

  function saveStats() {
    allStats[modeKey] = stats;
    try {
      localStorage.setItem(STORAGE_STATS, JSON.stringify(allStats));
    } catch (e) {}
  }

  function loadAllStates() {
    try {
      const raw = localStorage.getItem(STORAGE_STATE);
      if (raw) allStates = JSON.parse(raw) || {};
    } catch (e) {}
  }

  function saveState() {
    allStates[modeKey] = state;
    try {
      localStorage.setItem(STORAGE_STATE, JSON.stringify(allStates));
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

  function buildBoards() {
    els.boards.innerHTML = "";
    for (let b = 0; b < mode.boards; b++) {
      const boardEl = document.createElement("div");
      boardEl.className = "board";
      boardEl.dataset.board = String(b);
      for (let r = 0; r < mode.guesses; r++) {
        const row = document.createElement("div");
        row.className = "board-row";
        row.dataset.row = String(r);
        for (let c = 0; c < WORD_LENGTH; c++) {
          const tile = document.createElement("div");
          tile.className = "tile";
          tile.dataset.col = String(c);
          tile.addEventListener("click", () => {
            if (state.gameOver || busy) return;
            if (state.solved[b]) return;
            if (r !== state.round) return;
            setCursor(c);
          });
          row.appendChild(tile);
        }
        boardEl.appendChild(row);
      }
      els.boards.appendChild(boardEl);
    }
  }

  function fitBoard() {
    const rootStyle = getComputedStyle(document.documentElement);
    const tileGap = parseFloat(rootStyle.getPropertyValue("--tile-gap")) || 8;
    const boardGap = parseFloat(rootStyle.getPropertyValue("--board-gap")) || 18;
    const gameStyle = getComputedStyle(els.game);
    const paddingX = parseFloat(gameStyle.paddingLeft) + parseFloat(gameStyle.paddingRight);
    const paddingY = parseFloat(gameStyle.paddingTop) + parseFloat(gameStyle.paddingBottom);
    const gap = parseFloat(gameStyle.rowGap) || 0;
    const navHeight = els.modeNav.hidden ? 0 : els.modeNav.offsetHeight;

    const availableHeight =
      window.innerHeight - els.topbar.offsetHeight - navHeight - paddingY - gap - els.keyboard.offsetHeight;
    const availableWidth = els.game.clientWidth - paddingX;

    const rows = mode.guesses;
    const boards = mode.boards;

    const fromHeight = (availableHeight - (rows - 1) * tileGap) / rows;
    const fromWidth =
      (availableWidth - (boards - 1) * boardGap - boards * (WORD_LENGTH - 1) * tileGap) / (boards * WORD_LENGTH);

    const tileSize = Math.max(18, Math.min(84, fromHeight, fromWidth));
    document.documentElement.style.setProperty("--tile-size", `${tileSize}px`);
  }

  let fitRAF = null;
  function scheduleFit() {
    if (fitRAF) cancelAnimationFrame(fitRAF);
    fitRAF = requestAnimationFrame(fitBoard);
  }

  function getRowEl(b, r) {
    const boardEl = els.boards.querySelector(`.board[data-board="${b}"]`);
    return boardEl && boardEl.querySelector(`.board-row[data-row="${r}"]`);
  }

  function renderCurrentRow() {
    els.boards.querySelectorAll(".tile.cursor").forEach((t) => t.classList.remove("cursor"));
    if (state.gameOver || state.round >= mode.guesses) return;

    for (let b = 0; b < mode.boards; b++) {
      if (state.solved[b]) continue;
      const row = getRowEl(b, state.round);
      if (!row) continue;
      const tiles = row.querySelectorAll(".tile");
      tiles.forEach((tile, i) => {
        const ch = state.current[i];
        tile.textContent = ch || "";
        tile.classList.toggle("filled", Boolean(ch));
        tile.classList.toggle("cursor", i === cursor);
      });
    }
  }

  function renderCompletedGuesses() {
    for (let b = 0; b < mode.boards; b++) {
      state.boardGuesses[b].forEach((g, r) => {
        const row = getRowEl(b, r);
        if (!row) return;
        const tiles = row.querySelectorAll(".tile");
        tiles.forEach((tile, i) => {
          tile.textContent = g.display[i];
          tile.classList.add("filled", g.statuses[i]);
        });
      });
      if (state.solved[b]) {
        const boardEl = els.boards.querySelector(`.board[data-board="${b}"]`);
        if (boardEl) boardEl.classList.add("solved");
      }
    }
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

  function startNewGame() {
    const previousTargets = state.targets;
    const indexes = pickDistinctIndexes(mode.boards, previousTargets);
    state = defaultState(mode);
    state.targets = indexes.map((i) => words[i]);
    cursor = 0;
    keyStatus.clear();
    saveState();
    buildBoards();
    refreshKeyboardColors();
    renderCurrentRow();
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

  function evaluateGuess(guessNorm, answerNorm) {
    const result = new Array(WORD_LENGTH).fill("absent");
    const targetArr = answerNorm.split("");
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
      if (state.current[cursor]) {
        state.current[cursor] = "";
      } else if (cursor > 0) {
        cursor -= 1;
        state.current[cursor] = "";
      }
      renderCurrentRow();
      return;
    }
    if (/^[A-Z]$/.test(key)) {
      state.current[cursor] = key;
      if (cursor < WORD_LENGTH - 1) cursor += 1;
      renderCurrentRow();
    }
  }

  function shakeCurrentRow() {
    for (let b = 0; b < mode.boards; b++) {
      if (state.solved[b]) continue;
      const row = getRowEl(b, state.round);
      if (!row) continue;
      row.querySelectorAll(".tile").forEach((t) => {
        t.classList.remove("shake");
        // force reflow to restart animation
        void t.offsetWidth;
        t.classList.add("shake");
      });
    }
  }

  function submitGuess() {
    if (state.current.some((ch) => !ch)) {
      showToast("Palavra incompleta");
      shakeCurrentRow();
      return;
    }
    const word = state.current.join("");
    const guessNorm = normalize(word);
    if (!validSet.has(guessNorm)) {
      showToast("Palavra não encontrada");
      shakeCurrentRow();
      return;
    }

    const display = normalizedToWord.get(guessNorm) || word;
    const r = state.round;

    els.boards.querySelectorAll(".tile.cursor").forEach((t) => t.classList.remove("cursor"));
    busy = true;

    const justSolved = [];
    for (let b = 0; b < mode.boards; b++) {
      if (state.solved[b]) continue;
      const statuses = evaluateGuess(guessNorm, normalize(state.targets[b]));
      state.boardGuesses[b].push({ display, statuses });
      updateKeyStatuses(guessNorm, statuses);
      animateRowReveal(b, r, display, statuses);
      if (statuses.every((s) => s === "correct")) {
        state.solved[b] = true;
        justSolved.push(b);
      }
    }

    const flipDuration = 500;
    const stagger = 220;
    const totalAnim = (WORD_LENGTH - 1) * stagger + flipDuration + 80;

    setTimeout(() => {
      state.round += 1;
      state.current = new Array(WORD_LENGTH).fill("");
      cursor = 0;
      busy = false;

      justSolved.forEach((b) => {
        bounceRow(b, r);
        const boardEl = els.boards.querySelector(`.board[data-board="${b}"]`);
        if (boardEl) boardEl.classList.add("solved");
      });

      const won = state.solved.every(Boolean);
      const lost = !won && state.round >= mode.guesses;

      if (won || lost) {
        state.gameOver = true;
        state.won = won;
        finishGame(won);
      } else {
        renderCurrentRow();
      }
      saveState();
    }, totalAnim);
  }

  function animateRowReveal(b, r, display, statuses) {
    const row = getRowEl(b, r);
    if (!row) return;
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
  }

  function bounceRow(b, r) {
    const row = getRowEl(b, r);
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
      const idx = Math.min(state.round, mode.guesses) - 1;
      stats.distribution[idx] = (stats.distribution[idx] || 0) + 1;
      setTimeout(() => showToast(pickWinMessage(state.round)), 350);
    } else {
      stats.currentStreak = 0;
      const remaining = state.targets.filter((_, b) => !state.solved[b]);
      const msg = mode.boards === 1 ? `A palavra era ${remaining[0]}` : `Palavras: ${remaining.join(", ")}`;
      setTimeout(() => showToast(msg), 350);
    }
    saveStats();
    setTimeout(openStats, won ? 1600 : 1400);
  }

  function pickWinMessage(tries) {
    const msgs = ["Excelente!", "Muito bem!", "Ótimo!", "Bom trabalho!", "Conseguiu!", "Por pouco!"];
    return msgs[Math.min(tries, msgs.length) - 1];
  }

  function renderStats() {
    els.statsTitle.textContent = `Estatísticas — ${mode.label}`;
    els.statPlayed.textContent = String(stats.played);
    const winrate = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
    els.statWinrate.textContent = String(winrate);
    els.statStreak.textContent = String(stats.currentStreak);
    els.statMaxstreak.textContent = String(stats.maxStreak);

    const max = Math.max(1, ...stats.distribution);
    els.distribution.innerHTML = "";
    stats.distribution.forEach((count, i) => {
      const isCurrent = state.gameOver && state.won && state.round - 1 === i;
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

    els.btnAgain.hidden = false;
    els.btnShare.hidden = !state.gameOver;
  }

  function buildShareText() {
    const emoji = (s) => (s === "correct" ? "🟩" : s === "present" ? "🟨" : "⬛");
    const lines = [];
    for (let r = 0; r < state.round; r++) {
      const parts = [];
      for (let b = 0; b < mode.boards; b++) {
        const g = state.boardGuesses[b][r];
        parts.push(g ? g.statuses.map(emoji).join("") : " ".repeat(WORD_LENGTH));
      }
      lines.push(parts.join("  "));
    }
    const triesLabel = state.won ? state.round : "X";
    return `${mode.label} ${triesLabel}/${mode.guesses}\n\n${lines.join("\n")}`;
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

  function updateHelpText() {
    const wordLabel = mode.boards > 1 ? "as palavras certas" : "a palavra certa";
    els.helpIntro.textContent = `Descubra ${wordLabel} em ${mode.guesses} tentativas. Depois de cada tentativa, as peças mudam de cor para mostrar o quão perto você está da solução.`;
    els.helpMulti.hidden = mode.boards <= 1;
    if (!els.helpMulti.hidden) {
      els.helpMulti.textContent = `Nesse modo você precisa descobrir ${mode.boards} palavras ao mesmo tempo: cada palavra que você digitar vale para todos os tabuleiros que ainda não foram resolvidos.`;
    }
  }

  function confirmDiscardIfNeeded() {
    const inProgress = !state.gameOver && state.boardGuesses.some((g) => g.length > 0);
    if (!inProgress) return true;
    return window.confirm("Começar um novo jogo? Seu progresso atual será perdido.");
  }

  function wireModals() {
    els.btnHelp.addEventListener("click", () => {
      updateHelpText();
      openModal(els.modalHelp);
    });
    els.btnStats.addEventListener("click", openStats);
    els.btnNewgame.addEventListener("click", () => {
      if (!confirmDiscardIfNeeded()) return;
      startNewGame();
    });
    els.btnAgain.addEventListener("click", () => {
      if (!confirmDiscardIfNeeded()) return;
      closeModal(els.modalStats);
      startNewGame();
    });
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
        closeModeNav();
      }
    });
    els.btnShare.addEventListener("click", shareResult);
  }

  function wireTheme() {
    els.btnTheme.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme") || "light";
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try {
        localStorage.setItem(STORAGE_THEME, next);
      } catch (e) {}
    });
  }

  // ---------------- mode switching ----------------

  function updateModeNavActive() {
    els.modeNav.querySelectorAll(".mode-link").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === modeKey);
    });
  }

  function applyModeUI() {
    els.logo.textContent = mode.label;
    document.title = mode.key === "termo" ? "termo" : `termo · ${mode.label}`;
    document.documentElement.style.setProperty("--game-max-width", `${GAME_MAX_WIDTH[mode.key]}px`);
    updateHelpText();
    updateModeNavActive();
  }

  function loadOrStartGameForMode() {
    const saved = allStates[modeKey];
    const valid =
      saved &&
      Array.isArray(saved.targets) &&
      saved.targets.length === mode.boards &&
      saved.targets.every((t) => words.includes(t)) &&
      Array.isArray(saved.current) &&
      Array.isArray(saved.boardGuesses) &&
      saved.boardGuesses.length === mode.boards;

    keyStatus.clear();
    buildBoards();

    if (valid) {
      state = saved;
      cursor = firstEmptyIndex();
      renderCompletedGuesses();
      for (let b = 0; b < mode.boards; b++) {
        state.boardGuesses[b].forEach((g) => updateKeyStatuses(normalize(g.display), g.statuses));
      }
      renderCurrentRow();
      if (state.gameOver) setTimeout(openStats, 300);
    } else {
      startNewGame();
    }
  }

  function toggleModeNav() {
    const isOpen = !els.modeNav.hidden;
    els.modeNav.hidden = isOpen;
    els.btnModes.setAttribute("aria-expanded", String(!isOpen));
    scheduleFit();
  }

  function closeModeNav() {
    if (!els.modeNav.hidden) {
      els.modeNav.hidden = true;
      els.btnModes.setAttribute("aria-expanded", "false");
      scheduleFit();
    }
  }

  function switchMode(key) {
    if (key === modeKey) {
      closeModeNav();
      return;
    }
    saveState();
    modeKey = key;
    mode = MODES[modeKey];
    try {
      localStorage.setItem(STORAGE_MODE, modeKey);
    } catch (e) {}
    loadStatsForCurrentMode();
    applyModeUI();
    loadOrStartGameForMode();
    closeModeNav();
    scheduleFit();
  }

  function wireModeNav() {
    els.btnModes.addEventListener("click", toggleModeNav);
    els.modeNav.querySelectorAll(".mode-link").forEach((btn) => {
      btn.addEventListener("click", () => switchMode(btn.dataset.mode));
    });
    document.addEventListener("click", (e) => {
      if (els.modeNav.hidden) return;
      if (els.modeNav.contains(e.target) || els.btnModes.contains(e.target)) return;
      closeModeNav();
    });
  }

  function wirePhysicalKeyboard() {
    document.addEventListener("keydown", (e) => {
      if (!els.modalHelp.hidden || !els.modalStats.hidden) return;
      if (!els.modeNav.hidden) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowLeft") {
        if (state.gameOver || busy) return;
        setCursor(cursor - 1);
        return;
      }
      if (e.key === "ArrowRight") {
        if (state.gameOver || busy) return;
        setCursor(cursor + 1);
        return;
      }
      const k = e.key.toUpperCase();
      if (k === "ENTER") handleKey("ENTER");
      else if (k === "BACKSPACE") handleKey("BACK");
      else if (/^[A-Z]$/.test(k)) handleKey(k);
    });
  }

  // ---------------- boot ----------------

  async function init() {
    loadTheme();
    loadAllStats();
    loadAllStates();
    try {
      const savedMode = localStorage.getItem(STORAGE_MODE);
      if (savedMode && MODES[savedMode]) modeKey = savedMode;
    } catch (e) {}
    mode = MODES[modeKey];

    applyModeUI();
    wireModals();
    wireModeNav();
    wireTheme();
    wirePhysicalKeyboard();
    buildKeyboard();
    fitBoard();
    window.addEventListener("resize", scheduleFit);
    window.addEventListener("orientationchange", scheduleFit);

    const res = await fetch("data/palavras.json");
    const data = await res.json();
    words = data.palavras;

    words.forEach((w) => {
      const n = normalize(w);
      if (!normalizedToWord.has(n)) normalizedToWord.set(n, w);
      validSet.add(n);
    });

    loadStatsForCurrentMode();
    loadOrStartGameForMode();
  }

  init();
})();
