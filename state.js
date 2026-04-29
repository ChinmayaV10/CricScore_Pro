/* ════════════════════════════════════════════════
   CricScore Pro — state.js
   Game state, local storage, player helpers
   ════════════════════════════════════════════════ */

// ── Global State ─────────────────────────────────
var G = {
  pA:[], pB:[], hist:[], inn:{},
  penBonus:{A:0,B:0}, penMinus:{A:0,B:0},
  innings:1, cur:1,
  tA:'', tB:'', overs:20, brkMins:10,
  joinCode:null, firestoreDocId:null,
  done:false, pg:'pg-home',
  headline:'', winTeam:null, motm:null
};

// Timer state — separated for clean save/restore
var T = { iSec:0, oSec:4*60, brkSec:0, exp:false, ts:0 };

// Timer interval handles
var iT=null, oT=null, bT=null;

// UI state
var histOpen=false, pendWkt=null, disPick='';

// LocalStorage keys
var LSG='cs6G', LST='cs6T', LSSAV='cs6sav', LSLB='cs6lb', LSTRN='cs6trn';

// ── Player factory ───────────────────────────────
function mkP(name) {
  return {
    name:name, runs:0, balls:0, fours:0, sixes:0, dots:0,
    out:false, retiredHurt:false, dismissal:'', batting:false, battingOrder:-1,
    bBalls:0, bRuns:0, bWkts:0, bMaidens:0, bNB:0, bWD:0, bDots:0, bHatrick:false
  };
}

// ── Innings factory ──────────────────────────────
function mkInn(bat) {
  return {
    bat:bat, bowl:bat==='A'?'B':'A',
    totalRuns:0, wickets:0, legalBalls:0,
    extras:{WD:0, NB:0, B:0, LB:0},
    curBalls:[], completedOvers:[], overNum:1,
    striker:null, nonStriker:null, bowler:null,
    batterIdx:0, done:false,
    fowLog:[], partnerships:[],
    curPart:{runs:0, balls:0, b1:'', b2:''}
  };
}

// ── Helpers ──────────────────────────────────────
function tname(t) { return t==='A' ? G.tA : G.tB; }
function batPl(inn) { return inn.bat==='A' ? G.pA : G.pB; }
function bwlPl(inn) { return inn.bowl==='A' ? G.pA : G.pB; }
function adjS(inn) { return Math.max(0, inn.totalRuns + (G.penBonus[inn.bat]||0) - (G.penMinus[inn.bat]||0)); }
function getOv(lb) { return Math.floor(lb/6) + '.' + (lb%6); }
function getCRR(inn) { return !inn.legalBalls ? '0.00' : (inn.totalRuns/(inn.legalBalls/6)).toFixed(2); }
function extTot(inn) { var e=inn.extras; return e.WD+e.NB+e.B+e.LB; }
function srFn(r,b) { return b>0 ? (r/b*100).toFixed(1) : '0.0'; }
function ecoFn(r,b) { return b>0 ? (r/(b/6)).toFixed(2) : '0.00'; }
function pad(n) { return n<10?'0'+n:''+n; }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── Local Storage ────────────────────────────────
function saveLocal() {
  try {
    T.ts = Date.now();
    localStorage.setItem(LSG, JSON.stringify(G));
    localStorage.setItem(LST, JSON.stringify(T));
  } catch(e) {}
}

function loadLocal() {
  try {
    var rg = localStorage.getItem(LSG), rt = localStorage.getItem(LST);
    if (!rg) return false;
    var gd = JSON.parse(rg);
    if (!gd || !gd.tA) return false;
    G = gd;
    if (rt) {
      var td = JSON.parse(rt);
      // Innings timer: subtract elapsed time since last save
      var el = Math.floor((Date.now() - (td.ts||Date.now())) / 1000);
      T.iSec = Math.max(0, (td.iSec||0) - el);
      // Over timer: ALWAYS reset to full 4 minutes on restore
      // (prevents phantom timer penalties on refresh)
      T.oSec = 4*60;
      T.brkSec = td.brkSec||0;
      T.exp = td.exp||false;
    }
    relinkInn(1); relinkInn(2);
    return true;
  } catch(e) { return false; }
}

// Re-link object references after JSON parse
function relinkInn(n) {
  var inn = G.inn[n]; if (!inn) return;
  var bp = inn.bat==='A' ? G.pA : G.pB;
  var bwp = inn.bowl==='A' ? G.pA : G.pB;
  if (inn.striker && inn.striker.name) { var f=fpByName(bp,inn.striker.name,false); if(f) inn.striker=f; }
  if (inn.nonStriker && inn.nonStriker.name) { var f2=fpByName(bp,inn.nonStriker.name,false); if(f2) inn.nonStriker=f2; }
  if (inn.bowler && inn.bowler.name) { var f3=fpByName(bwp,inn.bowler.name,true); if(f3) inn.bowler=f3; }
}
function fpByName(arr,name,anyOut) {
  for (var i=0;i<arr.length;i++) { if(arr[i].name===name&&(anyOut||!arr[i].out)) return arr[i]; }
  return null;
}

// ── Saved matches ────────────────────────────────
function getSav() { try { return JSON.parse(localStorage.getItem(LSSAV)||'[]'); } catch(e) { return []; } }
function setSav(a) { try { localStorage.setItem(LSSAV,JSON.stringify(a)); } catch(e) {} }

// ── Leaderboard ──────────────────────────────────
function getLB() { try { return JSON.parse(localStorage.getItem(LSLB)||'{}'); } catch(e) { return {}; } }
function setLB(d) { try { localStorage.setItem(LSLB,JSON.stringify(d)); } catch(e) {} }

// ── Tournaments ──────────────────────────────────
function getTrns() { try { return JSON.parse(localStorage.getItem(LSTRN)||'[]'); } catch(e) { return []; } }
function setTrns(a) { try { localStorage.setItem(LSTRN,JSON.stringify(a)); } catch(e) {} }

// ── syncNow: save local + push to Firestore ──────
function syncNow() {
  saveLocal();
  syncToFirestore(); // from firebase.js — no-op if not configured or not host
}
