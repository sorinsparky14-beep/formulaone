// =============================================================================
// BOX BOX BINGO — game.js
// Multiplayer: WebRTC via PeerJS (true P2P, no database)
//
// Architecture:
//   HOST  → opens Peer with ID "f1bingo-<CODE>"
//           receives 'join' messages, broadcasts lobby/start/results-update
//   GUEST → opens Peer with random ID
//           connects to host peer, sends 'join' / 'result'
//           receives 'lobby-update' / 'start' / 'results-update'
// =============================================================================

// == P2P STATE ================================================================
let mpMode        = null;   // 'solo' | 'host' | 'join'
let mpRoomCode    = null;
let mpPlayerName  = null;
let mpPendingAction = null;
let mpSeed        = null;
let mpPlayers     = {};     // { [id]: { name, id, isHost, joinedAt, result } }

let peer          = null;   // own PeerJS Peer
let hostConn      = null;   // guest's connection TO the host
let guestConns    = {};     // host's connections TO each guest { peerId: conn }

let PLAYER_ID = 'p' + Math.random().toString(36).replace(/[^a-z0-9]/g, '').slice(0, 9);

// == ROOM CODE: 6 chars =======================================================
function genRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({length: 6}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
function peerIdFromCode(code) {
  return 'f1bingo-' + code.toLowerCase();
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

// == HOST: CREATE ROOM ========================================================
function createRoom() {
  mpMode      = 'host';
  mpRoomCode  = genRoomCode();
  mpSeed      = mpRoomCode.split('').reduce((a, c) => Math.imul(a, 31) + c.charCodeAt(0), 7) >>> 0;
  mpPlayers   = {};
  mpPlayers[PLAYER_ID] = {
    name: mpPlayerName, id: PLAYER_ID,
    isHost: true, joinedAt: Date.now(), result: null
  };

  _openHostPeer(peerIdFromCode(mpRoomCode));
}

function _openHostPeer(peerId) {
  if (peer && !peer.destroyed) peer.destroy();
  peer = new Peer(peerId);

  peer.on('open', () => {
    showLobby();
  });

  peer.on('connection', conn => {
    conn.on('open', () => {
      guestConns[conn.peer] = conn;
      conn.on('data', msg => _hostReceive(conn, msg));
      conn.on('close', () => {
        delete guestConns[conn.peer];
        delete mpPlayers[conn.peer];
        _broadcastLobby();
      });
      conn.on('error', () => {
        delete guestConns[conn.peer];
      });
    });
  });

  peer.on('error', err => {
    if (err.type === 'unavailable-id') {
      // Room code taken — try another
      mpRoomCode = genRoomCode();
      mpSeed = mpRoomCode.split('').reduce((a, c) => Math.imul(a, 31) + c.charCodeAt(0), 7) >>> 0;
      peer.destroy();
      _openHostPeer(peerIdFromCode(mpRoomCode));
    } else {
      _showConnError('Could not create room. Check your connection.');
    }
  });
}

function _hostReceive(conn, msg) {
  if (msg.type === 'join') {
    mpPlayers[conn.peer] = {
      name: msg.payload.name, id: conn.peer,
      isHost: false, joinedAt: Date.now(), result: null
    };
    _broadcastLobby();
  }
  if (msg.type === 'result') {
    if (mpPlayers[conn.peer]) mpPlayers[conn.peer].result = msg.payload;
    _broadcastResultsUpdate();
    renderMpLeaderboard({ players: mpPlayers });
  }
}

function _broadcastLobby() {
  const payload = { players: mpPlayers, seed: mpSeed };
  Object.values(guestConns).forEach(c => {
    if (c.open) c.send({ type: 'lobby-update', payload });
  });
  updateLobbyUI();
}

function _broadcastStart() {
  const payload = { players: mpPlayers, seed: mpSeed };
  Object.values(guestConns).forEach(c => {
    if (c.open) c.send({ type: 'start', payload });
  });
}

function _broadcastResultsUpdate() {
  const payload = { players: mpPlayers };
  Object.values(guestConns).forEach(c => {
    if (c.open) c.send({ type: 'results-update', payload });
  });
}

// == GUEST: JOIN ROOM =========================================================
function joinRoom() {
  const code = document.getElementById('join-code-input').value.trim().toUpperCase();
  mpMode     = 'join';
  mpRoomCode = code;
  mpPlayers  = {};

  if (peer && !peer.destroyed) peer.destroy();
  // Guest peer uses own random PLAYER_ID
  peer = new Peer(PLAYER_ID);

  peer.on('open', () => {
    hostConn = peer.connect(peerIdFromCode(code), { reliable: true });

    hostConn.on('open', () => {
      hostConn.send({ type: 'join', payload: { name: mpPlayerName, id: PLAYER_ID } });
      // Add myself to local mpPlayers so lobby renders immediately
      mpPlayers[PLAYER_ID] = {
        name: mpPlayerName, id: PLAYER_ID,
        isHost: false, joinedAt: Date.now(), result: null
      };
      showLobby();
    });

    hostConn.on('data', msg => _guestReceive(msg));

    hostConn.on('close', () => {
      // Show "host disconnected" overlay — whether in lobby, game, or results
      _showHostDisconnect();
    });

    hostConn.on('error', () => {
      _showHostDisconnect();
    });
  });

  peer.on('error', err => {
    if (err.type === 'peer-unavailable') {
      _showConnError('Room not found — check the code.');
      const inp = document.getElementById('join-code-input');
      inp.value = '';
      inp.placeholder = 'Room not found';
      setTimeout(() => { inp.placeholder = 'Enter Code'; }, 3000);
    } else if (err.type === 'unavailable-id') {
      // Our random PLAYER_ID clashed — regenerate and retry
      PLAYER_ID = 'p' + Math.random().toString(36).replace(/[^a-z0-9]/g, '').slice(0, 9);
      peer.destroy();
      joinRoom();
    } else {
      _showConnError('Connection error: ' + err.type);
    }
  });
}

function _guestReceive(msg) {
  if (msg.type === 'lobby-update') {
    mpPlayers = msg.payload.players;
    mpSeed    = msg.payload.seed;
    updateLobbyUI();
  }
  if (msg.type === 'start') {
    mpPlayers = msg.payload.players;
    mpSeed    = msg.payload.seed;
    clearInterval(lobbyInterval);
    startMpGame();
  }
  if (msg.type === 'results-update') {
    mpPlayers = msg.payload.players;
    renderMpLeaderboard({ players: mpPlayers });
  }
}

function _showHostDisconnect() {
  stopSound();
  clearInterval(timerInt); clearInterval(totalInt); clearInterval(lobbyInterval);
  if (peer && !peer.destroyed) { peer.destroy(); peer = null; }
  hostConn = null; guestConns = {}; mpPlayers = {};
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
  if (peer && !peer.destroyed) { peer.destroy(); peer = null; }
  hostConn = null; guestConns = {}; mpPlayers = {};
  mpMode = null; mpRoomCode = null; mpPlayerName = null; mpSeed = null;
  gs = null; prevStreak = 0; assigning = false;
  // Close any open modals before returning to home
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
  // Refresh UI periodically (host drives this via broadcast; this is just a safety net)
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
  _broadcastStart();
  startMpGame();
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
  // Drivers: seeded-same order for ALL players (shared room seed) → same 40-driver pool
  // Categories: random per player — but pool is guaranteed to cover every category
  const categories  = generateCategories();
  const shuffledAll = seededShuffle(allDrivers, rng);
  const drivers     = buildDriverPool(shuffledAll, categories);
  return {
    categories, drivers,
    idx: 0, correct: new Set(), wrong: new Set(), assigned: new Map(),
    streak: 0, best: 0, time: 15, done: false, totalTime: 0
  };
}


// == COPY WITH FEEDBACK =======================================================
function showCopiedToast(btn) {
  const orig      = btn.innerHTML;
  const origStyle = btn.getAttribute('style');
  btn.innerHTML   = 'COPIED!';
  btn.setAttribute('style', origStyle
    .replace(/color:[^;]+/, 'color:#00d68f')
    .replace(/border:[^;]+/, 'border:1px solid #00d68f'));
  setTimeout(() => { btn.innerHTML = orig; btn.setAttribute('style', origStyle); }, 1800);
}
function copyRoomLink(btn) {
  const val = document.getElementById('lobby-share-link').value;
  navigator.clipboard.writeText(val).then(() => { if (btn) showCopiedToast(btn); }).catch(() => {});
}
function copyMpLink(btn) {
  const val = document.getElementById('mp-res-share-link').value;
  navigator.clipboard.writeText(val).then(() => { if (btn) showCopiedToast(btn); }).catch(() => {});
}

// == QR CODE (real, scannable) ================================================
function drawQR(code, url) {
  const canvas = document.getElementById('qr-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (typeof QRCode !== 'undefined') {
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
    }, 100);
  } else {
    ctx.fillStyle = '#c9a84c';
    ctx.fillRect(0, 0, 120, 120);
    ctx.fillStyle = '#080810';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(code, 60, 60);
  }
}

// == MP RESULTS ===============================================================
function _sendMyResult() {
  const result = {
    correct: gs.correct.size,
    total:   gs.categories.length,
    time:    gs.totalTime,
    streak:  gs.best
  };
  if (mpMode === 'host') {
    mpPlayers[PLAYER_ID].result = result;
    _broadcastResultsUpdate();
    renderMpLeaderboard({ players: mpPlayers });
  } else if (hostConn) {
    // Optimistically update own entry for immediate rendering
    if (mpPlayers[PLAYER_ID]) mpPlayers[PLAYER_ID].result = result;
    if (hostConn.open) {
      hostConn.send({ type: 'result', payload: result });
    } else {
      // Connection not yet open — retry up to 3s
      let attempts = 0;
      const retry = setInterval(() => {
        attempts++;
        if (hostConn && hostConn.open) {
          hostConn.send({ type: 'result', payload: result });
          clearInterval(retry);
        } else if (attempts >= 6) {
          clearInterval(retry);
        }
      }, 500);
    }
  }
}

function showMpResults() {
  _sendMyResult();

  const link = window.location.origin + '/box-box-bingo/?room=' + mpRoomCode;
  document.getElementById('mp-res-room-code').textContent = mpRoomCode;
  document.getElementById('mp-res-share-link').value      = link;

  const myResult = mpPlayers[PLAYER_ID] && mpPlayers[PLAYER_ID].result
    ? mpPlayers[PLAYER_ID].result
    : { correct: gs.correct.size, total: gs.categories.length, time: gs.totalTime, streak: gs.best };

  document.getElementById('mp-my-correct').textContent = myResult.correct;
  document.getElementById('mp-my-time').textContent    = fmt(myResult.time);
  document.getElementById('mp-my-streak').textContent  = myResult.streak + '×';

  renderMpLeaderboard({ players: mpPlayers });
  showScreen('screen-mp-results');
  const pct = Math.round((gs.correct.size / gs.categories.length) * 100);
  playSoundDelayed(pct === 100 ? 'bingo-confirmed' : 'fail-radio', 150);
}

function renderMpLeaderboard(room) {
  const allP     = Object.values(room.players);
  const finished = allP.filter(p => p.result).sort((a, b) => {
    if (b.result.correct !== a.result.correct) return b.result.correct - a.result.correct;
    return a.result.time - b.result.time;
  });

  if (finished.length > 0) {
    const winner = finished[0];
    document.getElementById('mp-winner-name').innerHTML =
      winner.name + (winner.id === PLAYER_ID ? ' <span style="font-size:1.2rem;color:var(--chrome)">(You)</span>' : '');
  }

  const tbody  = document.getElementById('mp-leaderboard');
  tbody.innerHTML = '';
  const medals = ['🥇', '🥈', '🥉'];

  finished.forEach((p, i) => {
    const isMe = p.id === PLAYER_ID;
    const tr   = document.createElement('tr');
    tr.className = 'mp-lb-row' + (isMe ? ' me' : '');
    tr.innerHTML = `
      <td style="padding:11px 16px;text-align:left">${medals[i] || `<span style="color:var(--dim);font-size:.85rem">${i + 1}</span>`}</td>
      <td style="padding:11px 10px">
        <div style="display:flex;align-items:center;gap:8px">
          <div class="player-avatar" style="width:24px;height:24px;font-size:.8rem">${p.name[0].toUpperCase()}</div>
          <span style="font-weight:800;color:${isMe ? 'var(--ivory)' : 'var(--silver)'}">${p.name}</span>
          ${isMe ? '<span style="color:var(--goldMid);font-size:.68rem">(You)</span>' : ''}
        </div>
        ${isMe && p.result ? `<div style="margin-top:6px;padding:8px 12px;background:var(--abyss);border-left:2px solid var(--goldDim);font-family:'Teko',sans-serif;font-style:italic;font-size:.78rem;color:var(--chrome)">${getRadioQuip(p.result.correct, p.result.total)}</div>` : ''}
      </td>
      <td style="padding:11px 14px;text-align:right;font-family:'Teko',sans-serif;font-size:1.3rem;color:var(--ivory)">${p.result.correct}<span style="color:var(--dim);font-size:.8em">/${p.result.total}</span></td>
      <td style="padding:11px 14px;text-align:right;color:var(--chrome);font-size:.88rem">⏱ ${fmt(p.result.time)}</td>
      <td style="padding:11px 16px;text-align:right;color:var(--amber);font-size:.88rem">🔥 ${p.result.streak}×</td>`;
    tbody.appendChild(tr);
  });

  allP.filter(p => !p.result).forEach(p => {
    const tr = document.createElement('tr');
    tr.className = 'mp-lb-row';
    tr.innerHTML = `
      <td style="padding:11px 16px;color:var(--dim)">—</td>
      <td style="padding:11px 10px;display:flex;align-items:center;gap:8px">
        <div class="player-avatar" style="width:24px;height:24px;font-size:.8rem;background:var(--bolt)">${p.name[0].toUpperCase()}</div>
        <span style="color:var(--dim)">${p.name}</span>
        <span style="color:var(--dim);font-size:.7rem;animation:pulseDot 1s infinite">Racing...</span>
      </td>
      <td colspan="3" style="padding:11px 16px;text-align:right;color:var(--dim);font-size:.8rem">In progress</td>`;
    tbody.appendChild(tr);
  });
}

function getRadioQuip(correct, total) {
  const pct = correct / total;
  if (pct === 1)  return '— Team Radio: "We had Bingo? We had Bingo!" <span style="color:var(--green)">Perfect run.</span>';
  if (pct >= 0.7) return '— Team Radio: "We had Bingo?" <span style="color:var(--amber)">Strong drive. Keep pushing.</span>';
  return '— Team Radio: "We had Bingo?" <span style="color:var(--red)">Negative. Box, we need to talk.</span>';
}

// == MY BOARD MODAL ===========================================================
function showMyBoard() {
  if (!gs) return;
  const correct = gs.correct.size, total = gs.categories.length;
  const pct     = Math.round((correct / total) * 100);
  document.getElementById('my-board-stats').innerHTML = `
    <div style="background:var(--abyss);border:1px solid var(--bolt);padding:10px 18px;text-align:center;flex:1">
      <div style="font-family:'Teko',sans-serif;font-size:2rem;color:var(--green);line-height:1">${correct}</div>
      <div style="font-size:.58rem;letter-spacing:.18em;color:var(--chrome);text-transform:uppercase;margin-top:2px">Correct</div>
    </div>
    <div style="background:var(--abyss);border:1px solid var(--bolt);padding:10px 18px;text-align:center;flex:1">
      <div style="font-family:'Teko',sans-serif;font-size:2rem;color:var(--red);line-height:1">${gs.wrong.size}</div>
      <div style="font-size:.58rem;letter-spacing:.18em;color:var(--chrome);text-transform:uppercase;margin-top:2px">Wrong</div>
    </div>
    <div style="background:var(--abyss);border:1px solid var(--bolt);padding:10px 18px;text-align:center;flex:1">
      <div style="font-family:'Teko',sans-serif;font-size:2rem;color:var(--ivory);line-height:1">${pct}%</div>
      <div style="font-size:.58rem;letter-spacing:.18em;color:var(--chrome);text-transform:uppercase;margin-top:2px">Accuracy</div>
    </div>`;
  const list = document.getElementById('my-board-list');
  list.innerHTML = '';
  gs.categories.forEach(cat => {
    const c = gs.correct.has(cat.id), w = gs.wrong.has(cat.id);
    const drv = gs.assigned.get(cat.id);
    const rowBg      = c ? 'rgba(0,214,143,.07)' : w ? 'rgba(232,0,45,.07)' : 'transparent';
    const borderC    = c ? 'rgba(0,214,143,.25)' : w ? 'rgba(232,0,45,.2)'  : 'rgba(58,58,82,.25)';
    const catColor   = c ? 'rgba(0,214,143,.9)'  : w ? 'rgba(232,80,80,.85)' : 'var(--dim)';
    const drvColor   = c ? 'rgba(0,214,143,.7)'  : w ? 'rgba(232,80,80,.6)'  : 'var(--dim)';
    const badge = c
      ? `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 9px;font-size:.66rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap;line-height:1.2;background:rgba(0,214,143,.25);color:#00ffb0;border:1px solid rgba(0,214,143,.5);clip-path:polygon(5px 0%,100% 0%,calc(100% - 5px) 100%,0% 100%);text-shadow:0 0 8px rgba(0,214,143,.6)"><span style="text-transform:none">✓</span> Correct</span>`
      : w
      ? `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 9px;font-size:.66rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap;line-height:1.2;background:rgba(232,0,45,.1);color:var(--red);border:1px solid rgba(232,0,45,.25);clip-path:polygon(5px 0%,100% 0%,calc(100% - 5px) 100%,0% 100%)"><span style="text-transform:none">✗</span> Wrong</span>`
      : `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 9px;font-size:.66rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap;line-height:1.2;background:rgba(90,90,122,.12);color:var(--dim);border:1px solid rgba(90,90,122,.25);clip-path:polygon(5px 0%,100% 0%,calc(100% - 5px) 100%,0% 100%)"><span style="text-transform:none">—</span> Skipped</span>`;
    const tr = document.createElement('tr');
    tr.style.cssText = `background:${rowBg};border-bottom:1px solid ${borderC}`;
    tr.innerHTML = `
      <td style="padding:9px 10px">${badge}</td>
      <td style="padding:9px 10px;font-size:.84rem;font-weight:600;letter-spacing:.02em;color:${catColor}">${cat.text}</td>
      <td style="padding:9px 10px;text-align:right;font-size:.8rem;letter-spacing:.04em;color:${drvColor}">${drv ? drv.name : '—'}</td>`;
    list.appendChild(tr);
  });
  document.getElementById('modal-my-board').style.display = 'flex';
}

function closeMyBoard() {
  document.getElementById('modal-my-board').style.display = 'none';
}

function mpPlayAgain() {
  stopSound();
  clearInterval(timerInt); clearInterval(totalInt); clearInterval(lobbyInterval);
  if (peer && !peer.destroyed) { peer.destroy(); peer = null; }
  hostConn = null; guestConns = {}; mpPlayers = {};
  mpMode = null; mpRoomCode = null; mpPlayerName = null; mpSeed = null;
  gs = null; prevStreak = 0; assigning = false;
  history.pushState({}, '', '/box-box-bingo/');
  showScreen('screen-home');
}

// == URL ROOM PARAM ===========================================================
function checkUrlRoom() {
  const room = new URLSearchParams(window.location.search).get('room');
  if (room) {
    document.getElementById('join-code-input').value = room.toUpperCase();
    // Auto-open name modal so the player goes straight to entering their name
    showNameModal('join');
  }
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
  clearInterval(timerInt); clearInterval(totalInt);
  if (peer && !peer.destroyed) { peer.destroy(); peer = null; }
  hostConn = null; guestConns = {}; mpPlayers = {};
  mpMode = null; mpRoomCode = null; mpPlayerName = null; mpSeed = null;
  gs = null; prevStreak = 0; assigning = false;
  history.pushState({}, '', '/box-box-bingo/');
  showScreen('screen-home');
}

function startGame() {
  stopSound();
  if (peer && !peer.destroyed) { peer.destroy(); peer = null; }
  hostConn = null; guestConns = {}; mpPlayers = {};
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
