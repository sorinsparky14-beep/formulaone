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
    if (mpMode !== null) {
      // Dacă eram conectați și s-a închis neașteptat
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
      if (msg.payload.started && mpMode === 'join') {
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
  if (_ws) { _ws.close(); _ws = null; }
  mpPlayers = {};
  mpMode = null; mpRoomCode = null; mpPlayerName = null; mpSeed = null;
  gs = null; prevStreak = 0; assigning = false;
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
  if (_ws) { _ws.close(); _ws = null; }
  mpPlayers = {};
  mpMode = null; mpRoomCode = null; mpPlayerName = null; mpSeed = null;
  gs = null; prevStreak = 0; assigning = false;
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

function updateLobbyUI() {
  const players = Object.values(mpPlayers);
  document.getElementById('lobby-player-count').textContent = players.length;
  document.getElementById('start-race-btn').textContent =
    `Start Race — ${players.length} Player${players.length !== 1 ? 's' : ''}`;

  const tbody = document.getElementById('lobby-players-list');
  tbody.innerHTML = '';
  players.sort((a, b) => a.joinedAt - b.joinedAt).forEach((p, i) => {
    const isMe = p.id === PLAYER_ID;
    const tr   = document.createElement('tr');
    tr.className = 'lobby-player-row';
    tr.innerHTML = `
      <td style="padding:10px 20px;color:var(--dim);font-size:.8rem">${i + 1}</td>
      <td style="padding:10px 12px;display:flex;align-items:center;gap:10px">
        <div class="player-avatar">${p.name[0].toUpperCase()}</div>
        <span style="font-weight:800;letter-spacing:.06em;color:${isMe ? 'var(--ivory)' : 'var(--silver)'}">
          ${p.name}${isMe ? ' <span style="color:var(--goldMid);font-size:.7em">(You)</span>' : ''}
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
  const rng = seededRandom(mpSeed);
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
  const answered  = gs.correct.size + gs.wrong.size;
  const remaining = gs.drivers.length - gs.idx;
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



  if (gs.correct.size + gs.wrong.size >= gs.categories.length) { gs.done = true; assigning = false; endGame(); return; }
  gs.idx++; gs.time = 15;
  if (gs.idx >= gs.drivers.length) { gs.done = true; assigning = false; endGame(); return; }
  renderDriver(); renderStats(); renderGrid(); updateTimerUI();
  assigning = false;
}


// == END GAME =================================================================
function endGame() {
  clearInterval(timerInt); clearInterval(totalInt);
  assigning = false;

  if (mpMode !== 'solo' && mpRoomCode) {
    showMpResults();
    return;
  }

  // ── Solo ──
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

// == LIFECYCLE ================================================================
function showHowToPlay() {
  history.pushState({}, '', '/box-box-bingo/how-to-play');
  showScreen('screen-how-to-play');
}

function goHome() {
  stopSound();
  clearInterval(timerInt); clearInterval(totalInt); clearInterval(lobbyInterval);
  if (_ws) { _ws.close(); _ws = null; }
  mpPlayers = {};
  mpMode = null; mpRoomCode = null; mpPlayerName = null; mpSeed = null;
  gs = null; prevStreak = 0; assigning = false;
  history.pushState({}, '', '/box-box-bingo/');
  showScreen('screen-home');
}

function startGame() {
  stopSound();
  if (_ws) { _ws.close(); _ws = null; }
  mpPlayers = {};
  mpMode = 'solo'; mpRoomCode = null; mpPlayerName = null;
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
    goHome();
  }
});
