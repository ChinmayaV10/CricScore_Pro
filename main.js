/* ════════════════════════════════════════════════
   CricScore Pro — main.js
   App init, navigation, match setup, viewer
   ════════════════════════════════════════════════ */

// ── DOM helpers ──────────────────────────────────
var E = function(id) { return document.getElementById(id); };
function tx(id, v) { var el=E(id); if(el) el.textContent=v; }
function ih(id, v) { var el=E(id); if(el) el.innerHTML=v; }
function sd(id, v) { var el=E(id); if(el) el.style.display=v; }

// ── Page navigation ──────────────────────────────
function goPage(id, cb) {
  ['pg-home','pg-setup','pg-score','pg-viewer','pg-result','pg-saved','pg-lb','pg-fb'].forEach(function(p) {
    var el = E(p); if (!el) return;
    el.style.display = 'none';
  });
  var el = E(id); if (!el) return;
  var isFlex = (id==='pg-home'||id==='pg-score'||id==='pg-viewer');
  el.style.display = isFlex ? 'flex' : 'block';
  if (el.classList.contains('pgs')) el.scrollTop = 0;
  G.pg = id;
  if (cb) cb();
}

// ── Overlay helpers ──────────────────────────────
function showOv(id) { var el=E(id); if(el) el.style.display='flex'; }
function hideOv(id) { var el=E(id); if(el) el.style.display='none'; }
function hideAllOv() { document.querySelectorAll('.ov').forEach(function(e){e.style.display='none';}); }

// ── Toast ─────────────────────────────────────────
var _tT = null;
function toast(msg, dur) {
  var el = E('toast'); el.textContent=msg; el.style.opacity='1';
  clearTimeout(_tT); _tT=setTimeout(function(){el.style.opacity='0';}, dur||2600);
}

// ── Setup page ───────────────────────────────────
function goSetup() {
  if (!G.pA.length) {
    for (var i=1;i<=11;i++) { G.pA.push(mkP('Player A'+i)); G.pB.push(mkP('Player B'+i)); }
  }
  renderPls('A'); renderPls('B'); goPage('pg-setup');
}

function renderPls(t) {
  var arr = t==='A' ? G.pA : G.pB;
  var w = E(t==='A'?'plA':'plB');
  w.innerHTML = '';
  arr.forEach(function(p, i) {
    var d = document.createElement('div'); d.className='plrow';
    d.innerHTML = '<div class="plnum">'+(i+1)+'</div><input value="'+esc(p.name)+'" placeholder="Player '+(i+1)+'" oninput="namePl(\''+t+'\','+i+',this.value)">'+(arr.length>1?'<button class="rmbtn" onclick="rmPl(\''+t+'\','+i+')">×</button>':'');
    w.appendChild(d);
  });
  E(t==='A'?'cntA':'cntB').textContent = arr.length+' player'+(arr.length!==1?'s':'');
}
function namePl(t, i, v) { (t==='A'?G.pA:G.pB)[i].name = v.trim()||'P'+(i+1); }
function addPl(t) { var a=t==='A'?G.pA:G.pB; a.push(mkP('Player '+(a.length+1))); renderPls(t); }
function rmPl(t, i) { var a=t==='A'?G.pA:G.pB; if(a.length<=1){toast('Need at least 1 player');return;} a.splice(i,1); renderPls(t); }

// ── Start match ───────────────────────────────────
function startMatch() {
  ['A','B'].forEach(function(t) {
    var arr = t==='A'?G.pA:G.pB;
    var inputs = E(t==='A'?'plA':'plB').querySelectorAll('input');
    arr.forEach(function(p,i){if(inputs[i])p.name=inputs[i].value.trim()||p.name;});
    arr.forEach(function(p){var n=p.name; Object.assign(p,mkP(n));});
  });
  G.tA = E('s-tA').value.trim()||'Team A';
  G.tB = E('s-tB').value.trim()||'Team B';
  G.overs = Math.max(1,parseInt(E('s-ov').value)||20);
  G.brkMins = Math.max(1,parseInt(E('s-brk').value)||10);
  var tw=E('s-tw').value, td=E('s-td').value;
  G.penBonus={A:0,B:0}; G.penMinus={A:0,B:0}; G.hist=[]; G.inn={};
  G.done=false; G.headline=''; G.winTeam=null; G.motm=null;
  G.joinCode=null; G.firestoreDocId=null; G.innings=1; G.cur=1;
  G.battingTeam = (tw==='A')?(td==='bat'?'A':'B'):(td==='bat'?'B':'A');
  G.inn[1] = mkInn(G.battingTeam);
  T = {iSec:G.overs*4*60, oSec:4*60, brkSec:0, exp:false, ts:Date.now()};

  // Show loading state
  toast('Creating match room...');

  buildBtns(); goPage('pg-score');
  renderScore(); startTimers(); openInnModal(1);

  // Create Firestore room (async — updates code display when done)
  FB.isHost = true;
  createMatchRoom(function(code) {
    G.joinCode = code;
    saveLocal();
    tx('matchcode', code);
    // Show code popup to host
    showJoinCodePopup(code);
    syncNow();
  });
}

function showJoinCodePopup(code) {
  E('created-code').textContent = code;
  showOv('ov-created');
}

// ── Innings opener modal ─────────────────────────
function openInnModal(n) {
  G.cur = n; var inn = G.inn[n];
  var bp=batPl(inn), bwp=bwlPl(inn);
  E('op1').innerHTML = bp.map(function(p,i){return'<option value="'+i+'">'+esc(p.name)+'</option>';}).join('');
  E('op2').innerHTML = bp.map(function(p,i){return'<option value="'+i+'">'+esc(p.name)+'</option>';}).join('');
  if(bp.length>1) E('op2').value='1';
  E('op-bwl').innerHTML = bwp.map(function(p,i){return'<option value="'+i+'">'+esc(p.name)+'</option>';}).join('');
  E('op-title').textContent = tname(inn.bat)+' — Openers (Inn '+n+')';
  showOv('ov-openers');
}

function confirmOpeners() {
  savH(); var inn=G.inn[G.cur]; var bp=batPl(inn), bwp=bwlPl(inn);
  var i1=parseInt(E('op1').value), i2=parseInt(E('op2').value);
  if(bp.length>1&&i1===i2){toast('Pick different batters');return;}
  inn.striker=bp[i1]; inn.nonStriker=bp.length>1?bp[i2]:null;
  inn.striker.batting=true; inn.striker.battingOrder=0;
  if(inn.nonStriker){inn.nonStriker.batting=true; inn.nonStriker.battingOrder=1;}
  inn.batterIdx=2; inn.bowler=bwp[parseInt(E('op-bwl').value)];
  inn.curPart={runs:0,balls:0,b1:inn.striker.name,b2:inn.nonStriker?inn.nonStriker.name:''};
  hideOv('ov-openers'); startTimers(); renderScore(); syncNow();
}

// ── Exit / new match ──────────────────────────────
function exitMatch() {
  if(!confirm('Exit? Progress is saved.')) return;
  clearInterval(iT); clearInterval(oT); clearInterval(bT);
  syncNow(); goPage('pg-home');
}

function newMatch() {
  clearInterval(iT); clearInterval(oT); clearInterval(bT);
  stopRealtimeListener();
  localStorage.removeItem(LSG); localStorage.removeItem(LST);
  G={pA:[],pB:[],hist:[],inn:{},penBonus:{A:0,B:0},penMinus:{A:0,B:0},innings:1,cur:1,tA:'',tB:'',overs:20,brkMins:10,joinCode:null,firestoreDocId:null,done:false,pg:'pg-home',headline:'',winTeam:null,motm:null};
  T={iSec:0,oSec:4*60,brkSec:0,exp:false,ts:0};
  FB.isHost=false; FB.matchDocRef=null; FB.joinCode=null;
  histOpen=false; pendWkt=null; disPick='';
  goPage('pg-home');
}

// ── Viewer ────────────────────────────────────────
function joinViewer() {
  var raw = E('vcode').value.trim().toUpperCase();
  if (!raw) { toast('Enter a join code'); return; }
  if (!FB.initialized) { toast('Firebase not configured — go to Firebase Setup first'); return; }
  hideOv('ov-join');
  toast('Searching for match...');
  joinMatchByCode(raw, function(data, docId) {
    FB.isHost = (data.hostId === FB.deviceId);
    tx('v-codelbl', 'Code: '+raw);
    var badge = FB.isHost ? '<span class="host-badge">HOST</span>' : '<span class="viewer-badge">👁 VIEWER</span>';
    ih('v-hostbadge', badge);
    goPage('pg-viewer');
    // Parse and render initial state
    if (data.gameState) {
      try {
        var vG = JSON.parse(data.gameState);
        renderVLive(vG); renderVSC(vG);
      } catch(e) {}
    }
    fbLoadViewerExtras(null, renderVLB);
  }, function() {
    toast('❌ Invalid code — match not found');
    showOv('ov-join');
  });
}

function stopViewer() {
  stopRealtimeListener();
  goPage('pg-home');
}

function viewerRefresh() {
  if (!FB.matchDocRef) { toast('Not connected to a match'); return; }
  fbFirestoreGetDoc('matches/'+FB.matchDocRef, function(doc) {
    if (!doc) { toast('Cannot reach server'); return; }
    var data = extractDocData(doc);
    if (!data) return;
    if (data.gameState) {
      try {
        var vG = JSON.parse(data.gameState);
        renderVLive(vG); renderVSC(vG);
        toast('Refreshed ✓');
      } catch(e) {}
    }
  });
}

// ── App init ──────────────────────────────────────
function init() {
  loadFBCfg();
  updateFBStatusUI();
  buildBtns();
  var ok = loadLocal();
  if (ok) {
    buildBtns();
    if (G.done || G.pg==='pg-result') {
      goPage('pg-result'); showResult();
    } else if (G.pg==='pg-score' || G.cur>0) {
      goPage('pg-score');
      tx('matchcode', G.joinCode||'----');
      // Re-establish as host if we have a docId
      if (G.firestoreDocId) {
        FB.isHost = true;
        FB.matchDocRef = G.firestoreDocId;
        FB.joinCode = G.joinCode;
      }
      renderScore(); startTimers();
    } else {
      goPage('pg-home');
    }
    return;
  }
  goPage('pg-home');
}

init();
