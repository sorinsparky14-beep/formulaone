// =============================================================================
// BOX BOX BINGO — game.js
// Multiplayer: PartyKit WebSocket Server (suportă 1000+ jucători simultan)
//
// Architecture:
//   HOST  → conectat la PartyKit server, trimite "start"
//   GUEST → conectat la același server, primește "lobby-update"/"start"/"results-update"
//   SERVER → partykit-server.ts gestionează starea camerei
// =============================================================================

// ── PartyKit config ───────────────────────────────────────────────────────────
// Înlocuiește cu URL-ul tău după deploy: npx partykit deploy partykit-server.ts --name box-box-bingo
const PARTYKIT_HOST = 'box-box-bingo.sorinsparky14-beep.partykit.dev';

// == MP STATE =================================================================
let mpMode        = null;   // 'solo' | 'host' | 'join'
let mpRoomCode    = null;
let mpPlayerName  = null;
let mpPendingAction = null;
let mpSeed        = null;
let mpPlayers     = {};     // { [id]: { name, id, isHost, joinedAt, result } }

let _ws           = null;   // WebSocket conexiune la PartyKit
let PLAYER_ID = 'p' + Math.random().toString(36).replace(/[^a-z0-9]/g, '').slice(0, 9);

// == ROOM CODE: 6 chars =======================================================
function genRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length: 6}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// == SEEDED RNG (all players get identical categories) ========================
function seededRandom(seed) {
  let s = seed >>> 0;
  return function () {
    s = Math.imul(s ^ (s >>> 15), s | 1);
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
  };
}
function seededShuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// == NAME MODAL ===============================================================
function showNameModal(action) {
  mpPendingAction = action;
  if (action === 'join') {
    const code = document.getElementById('join-code-input').value.trim().toUpperCase();
    if (!code || code.length < 6) { flashEl('join-code-input'); return; }
  }
  const btn = document.getElementById('modal-confirm-btn');
  if (btn) btn.textContent = action === 'create' ? 'Create Room' : 'Join Room';
  document.getElementById('modal-name').style.display = 'flex';
  document.getElementById('player-name-input').value = '';
  setTimeout(() => document.getElementById('player-name-input').focus(), 100);
}

function confirmName() {
  const name = document.getElementById('player-name-input').value.trim();
  if (!name) { flashEl('player-name-input'); return; }
  mpPlayerName = name;
  document.getElementById('modal-name').style.display = 'none';
  if (mpPendingAction === 'create') createRoom();
  else joinRoom();
}

function closeModal() {
  document.getElementById('modal-name').style.display = 'none';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeMyBoard(); }
});

function flashEl(id) {
  const el = document.getElementById(id);
  el.style.borderColor = 'var(--red)';
  el.focus();
  setTimeout(() => { el.style.borderColor = ''; }, 1500);
}

// == PARTYKIT CONNECTION ======================================================
function _connectToRoom(code, isHost) {
  if (_ws) { _ws.close(); _ws = null; }

  const url = `wss://${PARTYKIT_HOST}/party/${code.toLowerCase()}`;
  _ws = new WebSocket(url);

  _ws.onopen = () => {
    // Trimite join cu nume și rol
    _ws.send(JSON.stringify({
      type: 'join',
      payload: { name: mpPlayerName, isHost }
    }));
    showLobby();
  };

  _ws.onmessage = (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }
    _handleServerMessage(msg);
  };

  _ws.onclose = () => {
    // Only show error if we're still actively in a game/lobby (not already done)
    if (mpMode !== null && !(gs && gs.done)) {
      _showConnError('Connection lost. Please try again.');
    }
  };

  _ws.onerror = () => {
    _showConnError('Could not connect to room. Check the code.');
  };
}

function _handleServerMessage(msg) {
  switch (msg.type) {

    case 'your-id':
      // Serverul ne trimite ID-ul real asignat conexiunii WebSocket
      PLAYER_ID = msg.payload.id;
      break;

    case 'room-state':
      // Starea curentă la conectare (ex. reconectare)
      mpPlayers = msg.payload.players;
      mpSeed    = msg.payload.seed;
      if (msg.payload.started && mpMode !== 'host') {
        startMpGame();
      } else {
        updateLobbyUI();
      }
      break;

    case 'lobby-update':
      mpPlayers = msg.payload.players;
      mpSeed    = msg.payload.seed;
      updateLobbyUI();
      break;

    case 'start':
      mpPlayers = msg.payload.players;
      mpSeed    = msg.payload.seed;
      clearInterval(lobbyInterval);
      startMpGame();
      break;

    case 'results-update':
      mpPlayers = msg.payload.players;
      renderMpLeaderboard({ players: mpPlayers });
      break;

    case 'host-disconnect':
      _showHostDisconnect();
      break;
  }
}

function _wsSend(msg) {
  if (_ws && _ws.readyState === WebSocket.OPEN) {
    _ws.send(JSON.stringify(msg));
  }
}

// == HOST: CREATE ROOM ========================================================
function createRoom() {
  mpMode     = 'host';
  mpRoomCode = genRoomCode();
  mpPlayers  = {};
  _connectToRoom(mpRoomCode, true);
}

// == GUEST: JOIN ROOM =========================================================
function joinRoom() {
  const code = document.getElementById('join-code-input').value.trim().toUpperCase();
  mpMode     = 'join';
  mpRoomCode = code;
  mpPlayers  = {};
  _connectToRoom(mpRoomCode, false);
}

// == BROADCAST HELPERS (acum trimit la server) =================================
function _broadcastStart() {
  _wsSend({ type: 'start' });
}

function _sendResult(result) {
  _wsSend({ type: 'result', payload: result });
}

function _showHostDisconnect() {
  stopSound();
  clearInterval(timerInt); clearInterval(totalInt); clearInterval(lobbyInterval);
  mpMode = null; mpRoomCode = null; mpPlayerName = null; mpSeed = null;
  gs = null; prevStreak = 0; assigning = false;
  if (_ws) { _ws.close(); _ws = null; }
  mpPlayers = {};
  document.getElementById('modal-name').style.display = 'none';
  const ov = document.getElementById('host-disconnect-overlay');
  if (ov) { ov.style.display = 'flex'; }
}

function dismissHostDisconnect() {
  const ov = document.getElementById('host-disconnect-overlay');
  if (ov) { ov.style.display = 'none'; }
  history.pushState({}, '', '/box-box-bingo/');
  showScreen('screen-home');
}

function _showConnError(msg) {
  stopSound();
  clearInterval(timerInt); clearInterval(totalInt); clearInterval(lobbyInterval);
  mpMode = null; mpRoomCode = null; mpPlayerName = null; mpSeed = null;
  gs = null; prevStreak = 0; assigning = false;
  if (_ws) { _ws.close(); _ws = null; }
  mpPlayers = {};
  document.getElementById('modal-name').style.display = 'none';
  history.pushState({}, '', '/box-box-bingo/');
  showScreen('screen-home');
  const inp = document.getElementById('join-code-input');
  inp.placeholder = msg.slice(0, 45);
  inp.style.borderColor = 'var(--red)';
  setTimeout(() => { inp.style.borderColor = ''; inp.placeholder = 'Enter Code'; }, 4000);
}

// == LOBBY ====================================================================
let lobbyInterval = null;

function showLobby() {
  history.pushState({}, '', '/box-box-bingo/room');
  showScreen('screen-lobby');
  document.getElementById('lobby-room-code').textContent = mpRoomCode;
  const link = window.location.origin + '/box-box-bingo/?room=' + mpRoomCode;
  document.getElementById('lobby-share-link').value = link;
  drawQR(mpRoomCode, link);
  updateLobbyUI();
  if (lobbyInterval) clearInterval(lobbyInterval);
  if (mpMode === 'host') {
    lobbyInterval = setInterval(updateLobbyUI, 2000);
  }
}

// == COPY WITH FEEDBACK =======================================================
function showCopiedToast(btn) {
  const orig      = btn.innerHTML;
  const origColor = btn.style.color;
  const origBorder = btn.style.borderColor;
  btn.innerHTML   = 'COPIED!';
  btn.style.color = '#00d68f';
  btn.style.borderColor = '#00d68f';
  setTimeout(() => {
    btn.innerHTML = orig;
    btn.style.color = origColor;
    btn.style.borderColor = origBorder;
  }, 1800);
}

function copyRoomLink(btn) {
  const val = document.getElementById('lobby-share-link').value;
  navigator.clipboard.writeText(val)
    .then(() => { if (btn) showCopiedToast(btn); })
    .catch(() => {
      // Fallback pentru browsere fara clipboard API
      const inp = document.getElementById('lobby-share-link');
      inp.select();
      document.execCommand('copy');
      if (btn) showCopiedToast(btn);
    });
}

function copyMpLink(btn) {
  const val = document.getElementById('mp-res-share-link').value;
  navigator.clipboard.writeText(val)
    .then(() => { if (btn) showCopiedToast(btn); })
    .catch(() => {
      const inp = document.getElementById('mp-res-share-link');
      inp.select();
      document.execCommand('copy');
      if (btn) showCopiedToast(btn);
    });
}

// == QR CODE ==================================================================
function drawQR(code, url, _attempt) {
  const canvas = document.getElementById('qr-canvas');
  if (!canvas) return;

  // Daca libraria nu e inca incarcata, incearca din nou dupa 300ms (max 10 incercari)
  if (typeof QRCode === 'undefined') {
    if ((_attempt || 0) >= 10) { console.warn('QRCode library failed to load'); return; }
    setTimeout(() => drawQR(code, url, (_attempt || 0) + 1), 300);
    return;
  }

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const tmp = document.createElement('div');
  tmp.style.display = 'none';
  document.body.appendChild(tmp);
  new QRCode(tmp, {
    text: url, width: 120, height: 120,
    colorDark: '#080810', colorLight: '#c9a84c',
    correctLevel: QRCode.CorrectLevel.M
  });
  setTimeout(() => {
    const qrc = tmp.querySelector('canvas');
    const img = tmp.querySelector('img');
    if (qrc)      ctx.drawImage(qrc, 0, 0, 120, 120);
    else if (img) { const i = new Image(); i.onload = () => ctx.drawImage(i, 0, 0, 120, 120); i.src = img.src; }
    document.body.removeChild(tmp);
  }, 150);
}


function updateLobbyUI() {
  const players = Object.values(mpPlayers);
  document.getElementById('lobby-player-count').textContent = players.length;
  document.getElementById('start-race-btn').textContent =
    `Start Race — ${players.length} Player${players.length !== 1 ? 's' : ''}`;

  const tbody = document.getElementById('lobby-players-list');
  tbody.innerHTML = '';
  players.sort((a, b) => a.joinedAt - b.joinedAt).forEach((p, i) => {
    const isMe    = p.id === PLAYER_ID;
    const safeName = p.name.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const tr   = document.createElement('tr');
    tr.className = 'lobby-player-row';
    tr.innerHTML = `
      <td style="padding:10px 20px;color:var(--dim);font-size:.8rem">${i + 1}</td>
      <td style="padding:10px 12px;display:flex;align-items:center;gap:10px">
        <div class="player-avatar">${safeName[0].toUpperCase()}</div>
        <span style="font-weight:800;letter-spacing:.06em;color:${isMe ? 'var(--ivory)' : 'var(--silver)'}">
          ${safeName}${isMe ? ' <span style="color:var(--goldMid);font-size:.7em">(You)</span>' : ''}
        </span>
      </td>
      <td style="padding:10px 20px;text-align:right">
        ${p.isHost
          ? '<span style="border:1px solid var(--goldDim);color:var(--goldMid);padding:2px 10px;font-size:.68rem;letter-spacing:.18em;font-weight:800">Host</span>'
          : '<span style="color:var(--green);font-size:.72rem;letter-spacing:.14em">Ready</span>'}
      </td>`;
    tbody.appendChild(tr);
  });

  document.getElementById('start-race-btn').style.display = mpMode === 'host' ? 'flex' : 'none';
  const hint = document.getElementById('lobby-host-hint');
  if (hint) hint.style.display = mpMode === 'host' ? '' : 'none';
}

function hostStartRace() {
  if (mpMode !== 'host') return;
  clearInterval(lobbyInterval);
  _broadcastStart();   // trimite la server, serverul trimite tuturor
}

// == MP GAME START ============================================================
function startMpGame() {
  // Guard against seed=0 which causes seededRandom to produce all-zero output
  const rng = seededRandom(mpSeed || 1);
  gs = buildGameSeeded(rng);
  prevStreak = 0; assigning = false;
  showScreen('screen-game');
  renderDriver(); renderStats(); renderGrid(); updateTimerUI();
  document.getElementById('total-timer').textContent = '0:00';
  startTimers();
}

function buildGameSeeded(rng) {
  const categories  = generateCategories();
  const shuffledAll = seededShuffle(allDrivers, rng);
  const drivers     = buildDriverPool(shuffledAll, categories);
  return {
    categories, drivers,
    idx: 0, correct: new Set(), wrong: new Set(), assigned: new Map(),
    streak: 0, best: 0, time: 15, done: false, totalTime: 0
  };
}

// == GAME STATE ===============================================================
let gs = null, timerInt = null, totalInt = null, prevStreak = 0, assigning = false;

function buildGame() {
  const categories  = generateCategories();
  const shuffledAll = _fyShuffle(allDrivers);
  const drivers     = buildDriverPool(shuffledAll, categories);
  return {
    categories, drivers,
    idx: 0, correct: new Set(), wrong: new Set(), assigned: new Map(),
    streak: 0, best: 0, time: 15, done: false, totalTime: 0
  };
}
function fmt(s) { return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`; }

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => { s.classList.remove('active'); s.style.display = 'none'; });
  const el = document.getElementById(id);
  el.style.display = 'flex'; el.classList.add('active');
}

// == TIMERS ===================================================================
function startTimers() {
  clearInterval(timerInt); clearInterval(totalInt);
  timerInt = setInterval(() => {
    if (!gs || gs.done) return;
    gs.time--;
    if (gs.time <= 0) {
      gs.idx++; gs.time = 15; gs.streak = 0;
      if (gs.idx >= gs.drivers.length) { gs.done = true; endGame(); return; }
      // Also end if all categories were already answered (skipped past last driver)
      if (gs.correct.size + gs.wrong.size >= gs.categories.length) { gs.done = true; endGame(); return; }
      renderDriver(); renderStats(); renderGrid();
    }
    updateTimerUI();
  }, 1000);
  totalInt = setInterval(() => {
    if (!gs || gs.done) return;
    gs.totalTime++;
    document.getElementById('total-timer').textContent = fmt(gs.totalTime);
  }, 1000);
}

// == RENDER ===================================================================
function renderDriver() {
  if (!gs || gs.idx >= gs.drivers.length) return;
  const d = gs.drivers[gs.idx];
  document.getElementById('driver-name').textContent = d.name;
}

function updateTimerUI() {
  if (!gs) return;
  const t    = gs.time;
  const circ = 2 * Math.PI * 24;
  const color = t <= 5 ? '#e8002d' : t <= 9 ? '#f5a623' : '#c9a84c';
  const arc  = document.getElementById('timer-arc');
  arc.style.strokeDasharray = `${circ * (t / 15)} ${circ}`;
  arc.style.stroke          = color;
  arc.style.filter          = `drop-shadow(0 0 6px ${color}80)`;
  const num = document.getElementById('timer-num');
  num.textContent = t; num.style.color = color;
  document.getElementById('timer-label').style.color = color + '70';
  const bar = document.getElementById('timer-bar');
  bar.style.width      = `${(t / 15) * 100}%`;
  bar.style.background = color;
  bar.style.boxShadow  = `0 0 8px ${color}80`;
  document.getElementById('timer-block').classList.toggle('critical', t <= 3);
}

function renderStats() {
  if (!gs) return;
  const answered  = gs.correct.size + gs.wrong.size;
  const remaining = Math.max(0, gs.drivers.length - gs.idx);
  document.getElementById('stat-answered').textContent  = answered;
  const remEl = document.getElementById('stat-remaining');
  remEl.textContent = remaining;
  remEl.style.color = remaining <= 5 ? 'var(--amber)' : 'var(--silver)';
  document.getElementById('progress-bar').style.width = `${(answered / gs.categories.length) * 100}%`;
}

function renderGrid() {
  const grid = document.getElementById('cat-grid');
  grid.innerHTML = '';
  // 15 distinct dark-tinted backgrounds — one per slot, always unique
  const CELL_PALETTES = [
    { bg: 'linear-gradient(145deg,#0d1f0f,#142a16)', mid: '#1a3a1c' }, // deep forest green
    { bg: 'linear-gradient(145deg,#1a0a0a,#2d1010)', mid: '#3d1414' }, // deep crimson
    { bg: 'linear-gradient(145deg,#0a0f1f,#101828)', mid: '#131f33' }, // deep navy
    { bg: 'linear-gradient(145deg,#1a1000,#2d1e00)', mid: '#3d2a00' }, // deep amber
    { bg: 'linear-gradient(145deg,#0f0a1f,#1a1030)', mid: '#221540' }, // deep purple
    { bg: 'linear-gradient(145deg,#001a1a,#002828)', mid: '#003333' }, // deep teal
    { bg: 'linear-gradient(145deg,#1a0f00,#2d1a00)', mid: '#3d2200' }, // deep burnt orange
    { bg: 'linear-gradient(145deg,#0a1a0a,#0f280f)', mid: '#143314' }, // deep moss green
    { bg: 'linear-gradient(145deg,#1a001a,#2a002a)', mid: '#380038' }, // deep magenta
    { bg: 'linear-gradient(145deg,#001020,#001830)', mid: '#002040' }, // deep ocean blue
    { bg: 'linear-gradient(145deg,#1a1500,#2a2000)', mid: '#382c00' }, // deep olive
    { bg: 'linear-gradient(145deg,#0a0a1a,#10101e)', mid: '#16162a' }, // deep slate blue
    { bg: 'linear-gradient(145deg,#0f1a0a,#182800)', mid: '#1e3300' }, // deep dark lime
    { bg: 'linear-gradient(145deg,#1a0a0f,#2d101a)', mid: '#3d1422' }, // deep rose
    { bg: 'linear-gradient(145deg,#001a10,#002a18)', mid: '#003820' }, // deep emerald
  ];

  gs.categories.forEach((cat, idx) => {
    const done    = gs.correct.has(cat.id) || gs.wrong.has(cat.id);
    const correct = gs.correct.has(cat.id);
    const accent  = catAccentColor(cat.text);
    const icon    = catIcon(cat.text);
    const drv     = gs.assigned.get(cat.id);
    const pal     = CELL_PALETTES[idx % CELL_PALETTES.length];
    const btn     = document.createElement('button');
    btn.className = 'cat-cell' + (done ? ' done' : '');
    btn.style.background     = done ? 'linear-gradient(145deg,#0a0a0e,#101018)' : pal.bg;
    btn.style.borderTopColor = done ? 'rgba(58,58,82,.3)' : accent + '55';

    if (done && drv) {
      btn.innerHTML = `
        <div class="cat-assigned-goldline"></div>
        <div class="cat-assigned-name"><span>${drv.name}</span></div>
        <div class="cat-bottom-strip" style="background:linear-gradient(90deg,transparent,${correct ? 'var(--green)' : 'var(--red)'}45,transparent)"></div>`;
    } else {
      btn.innerHTML = `
        <div class="cat-texture"></div>
        <div class="cat-glow" style="background:radial-gradient(ellipse at 50% 110%,${pal.mid}cc,transparent 65%)"></div>
        <div class="cat-content">
          <span class="cat-icon">${icon}</span>
          <span class="cat-text">${cat.text}</span>
        </div>
        <div class="cat-bottom-strip" style="background:linear-gradient(90deg,transparent,${accent}50,transparent)"></div>`;
      btn.addEventListener('click',      () => handleAssign(cat.id));
      btn.addEventListener('mouseenter', () => { btn.style.transform = 'translateY(-3px) scale(1.04)'; btn.style.boxShadow = `0 8px 24px rgba(0,0,0,.65),0 0 0 1px ${accent}45`; });
      btn.addEventListener('mouseleave', () => { btn.style.transform = ''; btn.style.boxShadow = ''; });
    }
    grid.appendChild(btn);
  });
}

// == ACTIONS ==================================================================
function handleSkip() {
  if (!gs || gs.done) return;
  gs.idx++; gs.time = 15; gs.streak = 0;
  if (gs.idx >= gs.drivers.length) { gs.done = true; endGame(); return; }
  if (gs.correct.size + gs.wrong.size >= gs.categories.length) { gs.done = true; endGame(); return; }
  renderDriver(); renderStats(); renderGrid(); updateTimerUI();
}

function handleAssign(catId) {
  if (!gs || gs.done || assigning) return;
  if (gs.correct.has(catId) || gs.wrong.has(catId)) return;
  assigning = true;
  const driver   = gs.drivers[gs.idx];
  const category = gs.categories.find(c => c.id === catId);
  if (!driver || !category) { assigning = false; return; }

  const hit = category.matches(driver);
  if (hit) gs.correct.add(catId); else gs.wrong.add(catId);
  gs.assigned.set(catId, driver);
  gs.streak = hit ? gs.streak + 1 : 0;
  gs.best   = Math.max(gs.best, gs.streak);

  // Increment idx FIRST so gs.idx is always up to date before endGame
  gs.idx++; gs.time = 15;

  // All categories answered — game over
  if (gs.correct.size + gs.wrong.size >= gs.categories.length) {
    gs.done = true; assigning = false; endGame(); return;
  }
  // No more drivers — game over
  if (gs.idx >= gs.drivers.length) {
    gs.done = true; assigning = false; endGame(); return;
  }
  renderDriver(); renderStats(); renderGrid(); updateTimerUI();
  assigning = false;
}


// == END GAME =================================================================
function endGame() {
  clearInterval(timerInt); clearInterval(totalInt);
  assigning = false;

  if (mpMode !== 'solo' && mpRoomCode) {
    try {
      showMpResults();
    } catch(e) {
      console.error('[endGame] showMpResults failed:', e);
      // Fallback: show solo results so the game doesn't freeze
      _showSoloResults();
    }
    return;
  }

  _showSoloResults();
}

function _showSoloResults() {
  const correct = gs.correct.size, total = gs.categories.length;
  const pct     = Math.round((correct / total) * 100);

  // Show results screen first, THEN play audio after a short delay
  // (browser autoplay policy requires user interaction before audio on some
  //  browsers; since the user just clicked/played the game this should pass,
  //  but the delay ensures the DOM transition doesn't block the audio context)
  showScreen('screen-results');
  playSoundDelayed(pct === 100 ? 'bingo-confirmed' : 'fail-radio', 150);

  document.getElementById('res-correct').textContent = correct;
  document.getElementById('res-time').textContent    = fmt(gs.totalTime);
  document.getElementById('res-streak').textContent  = gs.best + '×';
  document.getElementById('res-pct').textContent     = pct + '%';
  document.getElementById('res-end-note').textContent = pct === 100
    ? 'Perfect performance. Try again for a new set of categories.'
    : 'Categories change every game — you can do better.';

  const list = document.getElementById('res-cats-list');
  list.innerHTML = '';
  gs.categories.forEach(cat => {
    const c   = gs.correct.has(cat.id), w = gs.wrong.has(cat.id);
    const drv = gs.assigned.get(cat.id);
    const state = c ? 'correct' : w ? 'wrong' : 'unanswered';
    const row   = document.createElement('tr');
    row.className = 'results-cat-row ' + state;
    const badgeLabel = c
      ? '<span style="font-style:normal;text-transform:none">✓</span> Correct'
      : w
      ? '<span style="font-style:normal;text-transform:none">✗</span> Wrong'
      : '<span style="font-style:normal;text-transform:none">—</span> Skipped';
    const badgeStyle = c
      ? 'background:rgba(0,214,143,.25);color:#00ffb0;border:1px solid rgba(0,214,143,.5);text-shadow:0 0 8px rgba(0,214,143,.6)'
      : w
      ? 'background:rgba(232,0,45,.12);color:var(--red);border:1px solid rgba(232,0,45,.25)'
      : 'background:rgba(90,90,122,.15);color:var(--dim);border:1px solid rgba(90,90,122,.25)';
    row.innerHTML = `
      <td><span class="results-cat-badge ${state}" style="${badgeStyle}">${badgeLabel}</span></td>
      <td class="results-cat-name">${cat.text}</td>
      <td class="results-cat-driver-cell">${drv ? drv.name : '—'}</td>`;
    list.appendChild(row);
  });
}

// == MP RESULTS ===============================================================

function _sendMyResult() {
  if (!gs) return;
  _sendResult({
    correct: gs.correct.size,
    total:   gs.categories.length,
    time:    gs.totalTime,
    streak:  gs.best,
  });
}

function showMpResults() {
  _sendMyResult();

  document.getElementById('mp-my-correct').textContent = gs.correct.size;
  document.getElementById('mp-my-time').textContent    = fmt(gs.totalTime);
  document.getElementById('mp-my-streak').textContent  = gs.best + '×';

  document.getElementById('mp-res-room-code').textContent = mpRoomCode || '——';
  const link = window.location.origin + '/box-box-bingo/?room=' + (mpRoomCode || '');
  document.getElementById('mp-res-share-link').value = link;

  showScreen('screen-mp-results');
  playSoundDelayed(gs.correct.size === gs.categories.length ? 'bingo-confirmed' : 'fail-radio', 150);

  renderMpLeaderboard({ players: mpPlayers });
}

function renderMpLeaderboard({ players }) {
  const tbody = document.getElementById('mp-leaderboard');
  if (!tbody) return;

  const list = Object.values(players)
    .filter(p => p.result)
    .sort((a, b) => {
      if (b.result.correct !== a.result.correct) return b.result.correct - a.result.correct;
      return a.result.time - b.result.time;
    });

  const winner = list[0];
  document.getElementById('mp-winner-name').textContent = winner ? winner.name : '—';

  tbody.innerHTML = '';
  list.forEach((p, i) => {
    const isMe = p.id === PLAYER_ID;
    const safeName = p.name.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const pct  = Math.round((p.result.correct / p.result.total) * 100);
    const tr   = document.createElement('tr');
    tr.style.cssText = 'border-bottom:1px solid var(--bolt)' + (isMe ? ';background:rgba(201,168,76,.07)' : '');
    tr.innerHTML = `
      <td style="padding:10px 16px;font-family:'Teko',sans-serif;font-size:1.3rem;color:${i===0?'var(--goldLight)':'var(--dim)'}">${i + 1}</td>
      <td style="padding:10px 10px">
        <span style="font-weight:800;letter-spacing:.05em;color:${isMe?'var(--ivory)':'var(--silver)'}">
          ${safeName}${isMe ? ' <span style="color:var(--goldMid);font-size:.7em">(You)</span>' : ''}
        </span>
      </td>
      <td style="padding:10px 14px;text-align:right;font-family:'Teko',sans-serif;font-size:1.15rem;color:var(--ivory)">${p.result.correct}/${p.result.total} <span style="font-size:.8rem;color:var(--dim)">(${pct}%)</span></td>
      <td style="padding:10px 14px;text-align:right;font-family:'Teko',sans-serif;font-size:1.15rem;color:var(--chrome)">${fmt(p.result.time)}</td>
      <td style="padding:10px 16px;text-align:right;font-family:'Teko',sans-serif;font-size:1.15rem;color:var(--amber)">${p.result.streak}×</td>`;
    tbody.appendChild(tr);
  });

  const pending = Object.values(players).filter(p => !p.result);
  if (pending.length > 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="5" style="padding:10px 16px;text-align:center;font-size:.72rem;letter-spacing:.18em;color:var(--dim)">⏳ ${pending.length} driver${pending.length>1?'s':''} still racing…</td>`;
    tbody.appendChild(tr);
  }
}

function showMyBoard() {
  if (!gs) return;
  const modal = document.getElementById('modal-my-board');
  if (!modal) return;

  const statsEl = document.getElementById('my-board-stats');
  if (statsEl) {
    const pct = Math.round((gs.correct.size / gs.categories.length) * 100);
    statsEl.innerHTML = `
      <div style="text-align:center"><div style="font-family:'Teko',sans-serif;font-size:1.8rem;color:var(--ivory)">${gs.correct.size}/${gs.categories.length}</div><div style="font-size:.6rem;letter-spacing:.2em;color:var(--chrome)">CORRECT</div></div>
      <div style="text-align:center"><div style="font-family:'Teko',sans-serif;font-size:1.8rem;color:var(--ivory)">${pct}%</div><div style="font-size:.6rem;letter-spacing:.2em;color:var(--chrome)">SCORE</div></div>
      <div style="text-align:center"><div style="font-family:'Teko',sans-serif;font-size:1.8rem;color:var(--ivory)">${fmt(gs.totalTime)}</div><div style="font-size:.6rem;letter-spacing:.2em;color:var(--chrome)">TIME</div></div>
      <div style="text-align:center"><div style="font-family:'Teko',sans-serif;font-size:1.8rem;color:var(--amber)">${gs.best}×</div><div style="font-size:.6rem;letter-spacing:.2em;color:var(--chrome)">STREAK</div></div>`;
  }

  const list = document.getElementById('my-board-list');
  if (list) {
    list.innerHTML = '';
    gs.categories.forEach(cat => {
      const c   = gs.correct.has(cat.id), w = gs.wrong.has(cat.id);
      const drv = gs.assigned.get(cat.id);
      const badgeLabel = c ? '✓ Correct' : w ? '✗ Wrong' : '— Skipped';
      const badgeStyle = c
        ? 'background:rgba(0,214,143,.25);color:#00ffb0;border:1px solid rgba(0,214,143,.5)'
        : w
        ? 'background:rgba(232,0,45,.12);color:var(--red);border:1px solid rgba(232,0,45,.25)'
        : 'background:rgba(90,90,122,.15);color:var(--dim);border:1px solid rgba(90,90,122,.25)';
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--bolt)';
      tr.innerHTML = `
        <td style="padding:8px 10px"><span style="padding:3px 8px;font-size:.65rem;letter-spacing:.14em;font-weight:700;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;${badgeStyle}">${badgeLabel}</span></td>
        <td style="padding:8px 10px;color:var(--silver);font-size:.82rem">${cat.text}</td>
        <td style="padding:8px 10px;text-align:right;color:var(--chrome);font-size:.82rem">${drv ? drv.name : '—'}</td>`;
      list.appendChild(tr);
    });
  }

  modal.style.display = 'flex';
}

function closeMyBoard() {
  const modal = document.getElementById('modal-my-board');
  if (modal) modal.style.display = 'none';
}

function mpPlayAgain() {
  stopSound();
  clearInterval(timerInt); clearInterval(totalInt);
  gs = null; prevStreak = 0; assigning = false;
  showLobby();
}

// == LIFECYCLE ================================================================
function showHowToPlay() {
  history.pushState({}, '', '/box-box-bingo/how-to-play');
  showScreen('screen-how-to-play');
}

function goHome() {
  stopSound();
  clearInterval(timerInt); clearInterval(totalInt); clearInterval(lobbyInterval);
  mpMode = null; mpRoomCode = null; mpPlayerName = null; mpSeed = null;
  gs = null; prevStreak = 0; assigning = false;
  if (_ws) { _ws.close(); _ws = null; }
  mpPlayers = {};
  history.pushState({}, '', '/box-box-bingo/');
  showScreen('screen-home');
}

function startGame() {
  stopSound();
  mpMode = 'solo'; mpRoomCode = null; mpPlayerName = null;
  if (_ws) { _ws.close(); _ws = null; }
  mpPlayers = {};
  gs = buildGame(); prevStreak = 0; assigning = false;
  history.pushState({}, '', '/box-box-bingo/play-solo');
  showScreen('screen-game');
  renderDriver(); renderStats(); renderGrid(); updateTimerUI();
  document.getElementById('total-timer').textContent = '0:00';
  startTimers();
}

window.addEventListener('load', () => {
  const isHowToPlay = window.location.pathname === '/box-box-bingo/how-to-play';
  if (isHowToPlay) {
    // Hide skeleton immediately — no loading needed for a static page
    document.getElementById('screen-skeleton').style.display = 'none';
    showScreen('screen-how-to-play');
  } else {
    setTimeout(() => {
      document.getElementById('screen-skeleton').style.display = 'none';
      showScreen('screen-home');
      checkUrlRoom();
    }, 300);
  }
});

// == URL ROOM PARAM ===========================================================
function checkUrlRoom() {
  const room = new URLSearchParams(window.location.search).get('room');
  if (room) {
    document.getElementById('join-code-input').value = room.toUpperCase();
    showNameModal('join');
  }
}

window.addEventListener('popstate', () => {
  const path = window.location.pathname;
  if (path === '/box-box-bingo/how-to-play') {
    showScreen('screen-how-to-play');
  } else if (path === '/box-box-bingo/room' || path === '/box-box-bingo/play-solo') {
    // Back from room or play-solo → go home
    goHome();
  } else {
    goHome();
  }
});
