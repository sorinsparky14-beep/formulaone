// == AUDIO ==
let _currentAudio   = null;
let _pendingAudioId = null;   // setTimeout id for delayed playSound calls

function stopSound() {
  // Cancel any queued delayed play first — prevents it firing after a reset
  if (_pendingAudioId !== null) {
    clearTimeout(_pendingAudioId);
    _pendingAudioId = null;
  }
  if (_currentAudio) {
    _currentAudio.pause();
    _currentAudio.currentTime = 0;
    _currentAudio = null;
  }
}

function playSound(key) {
  try {
    stopSound();
    const src = AUDIO_B64[key];
    if (!src) return;
    const audio = new Audio(src);
    audio.volume = key === 'bingo-confirmed' ? 0.7 : 0.5;
    audio.play().catch(()=>{});
    _currentAudio = audio;
    audio.addEventListener('ended', () => { _currentAudio = null; });
  } catch(e) {}
}

// Delayed play — cancellable via stopSound()
function playSoundDelayed(key, ms) {
  if (_pendingAudioId !== null) clearTimeout(_pendingAudioId);
  _pendingAudioId = setTimeout(() => {
    _pendingAudioId = null;
    playSound(key);
  }, ms);
}

// == CATEGORY IMAGE MAP ==
function getCatImgKey(text) {
  const t = text.toLowerCase();
  if (t.includes('championship') || t.includes('title')) return 'champion';
  if (t.includes('race win') || t.includes('race wins') || t.includes('victory')) return 'victory';
  if (t.includes('grand slam')) return 'grand-slam';
  if (t.includes('pole')) return 'pole';
  if (t.includes('podium')) return 'podium';
  if (t.includes('points scored') || t.includes('+ points')) return 'points';
  if (t.includes('fastest lap') || t.includes('fastest laps')) return 'fastest-lap';
  if (t.includes('laps completed') || t.includes('race starts') || t.includes('starts')) return 'starts';
  if (t.includes('driver of the day')) return 'dotd';
  if (t.includes('sprint')) return 'sprint';
  if (t.includes('born') || t.includes('decade')) return 'decade-generic';
  return 'generic';
}

function catAccentColor(text) {
  const t = text.toLowerCase();
  if (t.includes('championship') || t.includes('title')) return '#f5dfa0';
  if (t.includes('sprint')) return '#00d68f';                               // before 'win'
  if (t.includes('laps completed')) return '#c0c0c0';                       // before 'lap'
  if (t.includes('win') || t.includes('victory')) return '#e8002d';
  if (t.includes('pole')) return '#2979ff';
  if (t.includes('podium')) return '#c0a060';
  if (t.includes('points')) return '#00d68f';
  if (t.includes('fastest') || t.includes('lap')) return '#f5a623';
  if (t.includes('race start') || t.includes('starts')) return '#c0c0c0';
  if (t.includes('grand slam')) return '#e8c96a';
  if (t.includes('born') || t.includes('decade')) return '#8888a8';
  if (t.includes('driver of') || t.includes('dotd')) return '#f5a623';
  if (t.includes('from') || t.includes('nationality')) return '#4fc3f7';
  // Team category colours — constructor-themed
  if (t.includes('ferrari'))              return '#e8002d';
  if (t.includes('mercedes'))             return '#00d2be';
  if (t.includes('red bull'))             return '#3671c6';
  if (t.includes('mclaren'))              return '#ff8000';
  if (t.includes('williams'))             return '#64c4ff';
  if (t.includes('renault') || t.includes('alpine')) return '#0090ff';
  if (t.includes('alphatauri') || t.includes('toro rosso')) return '#2b4562';
  if (t.includes('sauber') || t.includes('alfa romeo')) return '#900000';
  if (t.includes('haas'))                 return '#b6babd';
  if (t.includes('aston martin'))         return '#358c75';
  if (t.includes('raced for') || t.includes('drove for')) return '#c9a84c';
  // Teammate category
  if (t.includes('teammate'))             return '#c9a84c';
  return '#b8b8d0';
}

function catIcon(text) {
  const t = text.toLowerCase();
  if (t.includes('finished top')) return '🥇';                               // before 'championship'
  if (t.includes('championship') || t.includes('title')) return '🏆';
  if (t.includes('race win') || t.includes('race wins')) return '🏁';
  if (t.includes('grand slam')) return '💎';
  if (t.includes('pole')) return '⚡';
  if (t.includes('podium')) return '🥉';
  if (t.includes('points')) return '📊';
  if (t.includes('fastest')) return '⏱️';
  if (t.includes('laps completed')) return '🔄';
  if (t.includes('race starts') || t.includes('starts')) return '🏎️';
  if (t.includes('driver of the day')) return '⭐';
  if (t.includes('sprint')) return '🎯';
  if (t.includes('born') || t.includes('decade')) return '📅';
  if (t.includes('from') || t.includes('nationality')) return '🌍';
  if (t.includes('raced for')) return '🏟️';
  if (t.includes('teammate')) return '🤝';
  return '📌';
}

// == TEAM & TEAMMATE LOOKUP DATA ==
// Driver IDs per constructor (only the named popular teams)
const TEAM_DRIVERS = {
  'Ferrari':                  ['alberto-ascari','alain-prost','carlos-reutemann','carlos-sainz-jr','charles-leclerc','felipe-massa','fernando-alonso','giancarlo-fisichella','gilles-villeneuve','jacky-ickx','jody-scheckter','john-surtees','juan-manuel-fangio','kimi-raikkonen','mario-andretti','michael-schumacher','nigel-mansell','niki-lauda','nino-farina','oliver-bearman','rene-arnoux','rubens-barrichello','sebastian-vettel'],
  'Mercedes':                 ['george-russell','juan-manuel-fangio','kimi-antonelli','lewis-hamilton','michael-schumacher','nico-rosberg','valtteri-bottas'],
  'Red Bull':                 ['alexander-albon','daniil-kvyat','daniel-ricciardo','david-coulthard','mark-webber','max-verstappen','pierre-gasly','sebastian-vettel','sergio-perez'],
  'McLaren':                  ['alain-prost','ayrton-senna','bruce-mclaren','carlos-sainz-jr','daniel-ricciardo','david-coulthard','denny-hulme','emerson-fittipaldi','fernando-alonso','gilles-villeneuve','heikki-kovalainen','james-hunt','jenson-button','jody-scheckter','juan-pablo-montoya','keke-rosberg','kevin-magnussen','kimi-raikkonen','lando-norris','lewis-hamilton','mika-hakkinen','nigel-mansell','niki-lauda','oscar-piastri','sergio-perez'],
  'Williams':                 ['ayrton-senna','alain-prost','alexander-albon','carlos-reutemann','damon-hill','david-coulthard','felipe-massa','franco-colapinto','george-russell','heinz-harald-frentzen','jacky-ickx','jacques-villeneuve','jenson-button','juan-pablo-montoya','keke-rosberg','lance-stroll','logan-sargeant','mark-webber','nelson-piquet','nicholas-latifi','nico-hulkenberg','nico-rosberg','nigel-mansell','nyck-de-vries','pastor-maldonado','ralf-schumacher','rubens-barrichello','valtteri-bottas'],
  'Renault':                  ['alain-prost','carlos-sainz-jr','daniel-ricciardo','esteban-ocon','fernando-alonso','giancarlo-fisichella','heikki-kovalainen','jacques-villeneuve','jarno-trulli','jenson-button','kevin-magnussen','nico-hulkenberg','rene-arnoux','romain-grosjean'],
  'Alpine':                   ['esteban-ocon','fernando-alonso','jack-doohan','pierre-gasly'],
  'AlphaTauri/RB':            ['alexander-albon','carlos-sainz-jr','daniil-kvyat','daniel-ricciardo','liam-lawson','max-verstappen','nyck-de-vries','pierre-gasly','sebastian-vettel','yuki-tsunoda'],
  'Sauber':                   ['antonio-giovinazzi','charles-leclerc','felipe-massa','gabriel-bortoleto','guanyu-zhou','heinz-harald-frentzen','jacques-villeneuve','kimi-raikkonen','nico-hulkenberg','sebastian-vettel','sergio-perez','valtteri-bottas'],
  'Alfa Romeo':               ['antonio-giovinazzi','guanyu-zhou','juan-manuel-fangio','kimi-raikkonen','mario-andretti','nino-farina','valtteri-bottas'],
  'Haas':                     ['kevin-magnussen','mick-schumacher','nikita-mazepin','nico-hulkenberg','oliver-bearman','romain-grosjean'],
  'Lotus':                    ['ayrton-senna','carlos-reutemann','emerson-fittipaldi','graham-hill','heikki-kovalainen','jacky-ickx','jim-clark','jochen-rindt','kimi-raikkonen','mario-andretti','mika-hakkinen','nelson-piquet','nigel-mansell','pastor-maldonado','romain-grosjean','ronnie-peterson'],
  'Jordan':                   ['damon-hill','giancarlo-fisichella','heinz-harald-frentzen','jarno-trulli','michael-schumacher','ralf-schumacher','rubens-barrichello'],
  'Benetton':                 ['giancarlo-fisichella','jos-verstappen','michael-schumacher','nelson-piquet'],
  'Brabham':                  ['carlos-reutemann','damon-hill','denny-hulme','graham-hill','jack-brabham','jacky-ickx','jochen-rindt','nelson-piquet','niki-lauda'],
  'Tyrrell':                  ['jackie-stewart','jody-scheckter','jos-verstappen','ronnie-peterson'],
  'Brawn':                    ['jenson-button','rubens-barrichello'],
  'Force India/Racing Point': ['esteban-ocon','lance-stroll','nico-hulkenberg','sergio-perez'],
  'Aston Martin':             ['fernando-alonso','lance-stroll','sebastian-vettel'],
  'Minardi':                  ['fernando-alonso','mark-webber'],
};

// Driver IDs who raced as direct teammates with each named driver
// Sourced from "Notable Teammates" field — matched by exact label string
const TEAMMATE_DRIVERS = {
  'michael-schumacher': ['felipe-massa','jos-verstappen','nelson-piquet','nico-rosberg','rubens-barrichello'],
  'rubens-barrichello': ['jenson-button','michael-schumacher','pastor-maldonado','nico-hulkenberg'],
  'fernando-alonso':    ['esteban-ocon','felipe-massa','jenson-button','kimi-raikkonen','lance-stroll','lewis-hamilton'],
  'felipe-massa':       ['fernando-alonso','kimi-raikkonen','lance-stroll','michael-schumacher','valtteri-bottas'],
  'daniel-ricciardo':   ['esteban-ocon','lando-norris','max-verstappen','sebastian-vettel','yuki-tsunoda'],
};

// Display name shown on the category card
const TEAMMATE_LABELS = {
  'michael-schumacher': 'M. Schumacher',
  'rubens-barrichello': 'R. Barrichello',
  'fernando-alonso':    'Fernando Alonso',
  'felipe-massa':       'F. Massa',
  'daniel-ricciardo':   'D. Ricciardo',
};

// == CATEGORY GENERATION ==
function getPercentile(values, pct) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a,b) => a-b);
  return sorted[Math.max(0, Math.min(Math.floor((pct/100)*(sorted.length-1)), sorted.length-1))];
}
function capFirst(s) { const skip=new Set(['of','and','the','de','van','von','du']); return s.replace(/-/g,' ').replace(/\b\w+/g,(w,i)=>i===0||!skip.has(w.toLowerCase())?w[0].toUpperCase()+w.slice(1).toLowerCase():w.toLowerCase()); }

// Proper Fisher-Yates shuffle (pure, no side-effects)
function _fyShuffle(arr) {
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}

// Build a pool of POOL_SIZE drivers guaranteed to cover every category with ≥1 match.
// The base ordering comes from seededShuffle (MP) or plain shuffle (solo) — passed in as `shuffledAll`.
function buildDriverPool(shuffledAll, categories) {
  const POOL_SIZE = 40;
  const pool  = shuffledAll.slice(0, POOL_SIZE);
  const bench = shuffledAll.slice(POOL_SIZE); // remaining drivers available for swaps

  for (const cat of categories) {
    if (pool.some(d => cat.matches(d))) continue; // already covered ✓

    // Find the first bench driver that satisfies this category
    const donorIdx = bench.findIndex(d => cat.matches(d));
    if (donorIdx === -1) continue; // truly impossible across ALL drivers — skip

    // Replace a pool driver that covers no category (expendable)
    let victimIdx = -1;
    for (let i = pool.length - 1; i >= 0; i--) {
      if (!categories.some(c => c.matches(pool[i]))) { victimIdx = i; break; }
    }
    if (victimIdx === -1) victimIdx = pool.length - 1; // fallback: last slot

    pool[victimIdx] = bench[donorIdx];
    bench.splice(donorIdx, 1);
  }
  return pool;
}

function generateCategories() {
  // MIN_GLOBAL: minimum number of drivers in allDrivers that must match a category
  // before it can be included. Prevents categories that are impossible to satisfy in a 40-driver pool.
  const MIN_GLOBAL = 3;

  function rp(arr, fallback=1) {
    const clean = arr.filter(v=>v>0);
    if (!clean.length) return fallback;
    return [getPercentile(arr,50),getPercentile(arr,75),getPercentile(arr,90)][Math.floor(Math.random()*3)] || fallback;
  }

  const natCount={}, birthCount={};
  allDrivers.forEach(d=>{
    if(d.nationalityCountryId) natCount[d.nationalityCountryId]=(natCount[d.nationalityCountryId]||0)+1;
    if(d.countryOfBirthCountryId) birthCount[d.countryOfBirthCountryId]=(birthCount[d.countryOfBirthCountryId]||0)+1;
  });
  const commonNats  = Object.entries(natCount).filter(([,c])=>c>=MIN_GLOBAL).sort((a,b)=>b[1]-a[1]).slice(0,20).map(e=>e[0]);
  const commonBirth = Object.entries(birthCount).filter(([,c])=>c>=MIN_GLOBAL).sort((a,b)=>b[1]-a[1]).slice(0,15).map(e=>e[0]);
  const decades     = [...new Set(allDrivers.map(d=>Math.floor(new Date(d.dateOfBirth).getFullYear()/10)*10))];

  // Filter lookups to only IDs actually present in allDrivers
  const validIds = new Set(allDrivers.map(d => d.id));

  const filteredTeams = {};
  Object.entries(TEAM_DRIVERS).forEach(([team, ids]) => {
    const valid = ids.filter(id => validIds.has(id));
    if (valid.length >= 3) filteredTeams[team] = valid; // min 3 global matches
  });
  const availableTeams = Object.keys(filteredTeams);

  const filteredMates = {};
  Object.entries(TEAMMATE_DRIVERS).forEach(([pid, ids]) => {
    const valid = ids.filter(id => validIds.has(id));
    if (valid.length >= 3) filteredMates[pid] = valid; // min 3 global matches
  });
  const availablePrincipals = Object.keys(filteredMates);

  function validCat(cat) {
    return allDrivers.filter(d => cat.matches(d)).length >= MIN_GLOBAL;
  }

  const templates = [
    // ── Stats ──
    ()=>{ const v=Math.ceil(rp(allDrivers.map(d=>d.totalChampionshipWins||0))||1); return {id:`champ-${v}`,text:`${v}+ Championship Titles`,matches:d=>(d.totalChampionshipWins||0)>=v}; },
    ()=>{ const v=Math.ceil(rp(allDrivers.map(d=>d.totalRaceWins||0))||1); return {id:`wins-${v}`,text:`${v}+ Race Wins`,matches:d=>(d.totalRaceWins||0)>=v}; },
    ()=>{ const v=Math.ceil(rp(allDrivers.map(d=>d.totalPolePositions||0))||1); return {id:`poles-${v}`,text:`${v}+ Pole Positions`,matches:d=>(d.totalPolePositions||0)>=v}; },
    ()=>{ const v=Math.ceil(rp(allDrivers.map(d=>d.totalPodiums||0))||1); return {id:`pod-${v}`,text:`${v}+ Podiums`,matches:d=>(d.totalPodiums||0)>=v}; },
    ()=>{ const v=Math.ceil(rp(allDrivers.map(d=>d.totalRaceStarts||0),50)); return {id:`starts-${v}`,text:`${v}+ Race Starts`,matches:d=>(d.totalRaceStarts||0)>=v}; },
    ()=>{ const v=Math.ceil(rp(allDrivers.map(d=>d.totalPoints||0),100)); return {id:`pts-${v}`,text:`${v.toLocaleString()}+ Points Scored`,matches:d=>(d.totalPoints||0)>=v}; },
    ()=>{ const v=Math.ceil(rp(allDrivers.map(d=>d.totalFastestLaps||0))||1); return {id:`fl-${v}`,text:`${v}+ Fastest Laps`,matches:d=>(d.totalFastestLaps||0)>=v}; },
    ()=>{ const v=Math.ceil(rp(allDrivers.map(d=>d.totalGrandSlams||0))||1); return {id:`gs-${v}`,text:`${v}+ Grand Slams`,matches:d=>(d.totalGrandSlams||0)>=v}; },
    ()=>{ const v=Math.ceil(rp(allDrivers.map(d=>d.totalDriverOfTheDay||0))||1); return {id:`dotd-${v}`,text:`${v}+ Driver of the Day Awards`,matches:d=>(d.totalDriverOfTheDay||0)>=v}; },
    ()=>{ const vals=allDrivers.map(d=>d.totalSprintRaceWins||0).filter(v=>v>0); const v=vals.length?Math.ceil(rp(vals)):1; return {id:`sprint-${v}`,text:`${v}+ Sprint Wins`,matches:d=>(d.totalSprintRaceWins||0)>=v}; },
    ()=>{ const v=[1,3,5,10][Math.floor(Math.random()*4)]; return {id:`top-${v}`,text:`Finished Top ${v} In Championship`,matches:d=>(d.bestChampionshipPosition||999)<=v}; },
    ()=>{ const raw=rp(allDrivers.map(d=>d.totalRaceLaps||0),1000); const v=Math.round(raw/500)*500; return {id:`laps-${v}`,text:`${v.toLocaleString()}+ Laps Completed`,matches:d=>(d.totalRaceLaps||0)>=v}; },
    // ── Geography ──
    ()=>{ const nat=commonNats[Math.floor(Math.random()*commonNats.length)]; return {id:`nat-${nat}`,text:`Driver From ${capFirst(nat)}`,matches:d=>d.nationalityCountryId===nat}; },
    ()=>{ const dec=decades[Math.floor(Math.random()*decades.length)]; return {id:`dec-${dec}`,text:`Born In The ${dec}s`,matches:d=>Math.floor(new Date(d.dateOfBirth).getFullYear()/10)*10===dec}; },
    ()=>{ const c=commonBirth[Math.floor(Math.random()*commonBirth.length)]||'united-kingdom'; return {id:`birth-${c}`,text:`Born In ${capFirst(c)}`,matches:d=>d.countryOfBirthCountryId===c}; },
    // ── Teams ──
    ()=>{
      const team = availableTeams[Math.floor(Math.random() * availableTeams.length)];
      const ids  = new Set(filteredTeams[team]);
      return { id: `team-${team.toLowerCase().replace(/[^a-z0-9]/g,'-')}`, text: `Raced For ${team}`, matches: d => ids.has(d.id) };
    },
    // ── Teammates ──
    ()=>{
      const pid   = availablePrincipals[Math.floor(Math.random() * availablePrincipals.length)];
      const ids   = new Set(filteredMates[pid]);
      const label = TEAMMATE_LABELS[pid];
      return { id: `mate-${pid}`, text: `Teammate Of ${label}`, matches: d => ids.has(d.id) };
    },
  ];

  const shuffledTpls = _fyShuffle(templates);
  const result  = [];
  const usedIds = new Set();

  // Try each template up to 3 times to get a valid (≥ MIN_GLOBAL matches) category
  for (const t of shuffledTpls) {
    if (result.length >= 15) break;
    let cat = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const c = t();
      if (!usedIds.has(c.id) && validCat(c)) { cat = c; break; }
    }
    if (cat) { usedIds.add(cat.id); result.push(cat); }
  }

  // Fill any remaining slots with safe nationality/birth-country categories
  let fillIdx = 0;
  const usedNats = new Set(
    result.filter(c => c.id.startsWith('nat-')).map(c => c.text.replace('Driver From ', '').toLowerCase().replace(/ /g, '-'))
  );
  // Extinde pool-ul cu commonBirth pentru a evita infinite loop dacă commonNats e epuizat
  const fillPool = [...commonNats, ...commonBirth.filter(c => !commonNats.includes(c))];
  let fillSafety = 0;
  while (result.length < 15 && fillSafety < 500) {
    fillSafety++;
    if (fillIdx >= fillPool.length) break;
    const nat = fillPool[fillIdx]; fillIdx++;
    if (usedNats.has(nat)) continue;
    const id = `nat-fill-${fillIdx}`;
    if (!usedIds.has(id)) {
      usedIds.add(id);
      usedNats.add(nat);
      result.push({ id, text: `Driver From ${capFirst(nat)}`, matches: d => d.nationalityCountryId === nat || d.countryOfBirthCountryId === nat });
    }
  }
  return _fyShuffle(result);
}
