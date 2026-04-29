/* ════════════════════════════════════════════════
   CricScore Pro — render.js
   All UI rendering functions
   ════════════════════════════════════════════════ */

// ── Ball colour helper ───────────────────────────
function ballCol(b) {
  var s = String(b);
  if (s==='W') return {bg:'#3d0d0d',c:'#ff3b3b'};
  if (s==='WD'||s.indexOf('WD+')===0) return {bg:'#3a2200',c:'#ff8c00'};
  if (s.indexOf('NB')===0) return {bg:'#3a2200',c:'#ff8c00'};
  if (s==='B'||s.indexOf('LB')===0||s.indexOf('B')===0) return {bg:'#2d2400',c:'#f5c518'};
  if (s==='0') return {bg:'#1a1d2a',c:'#8a90a8'};
  if (s==='4') return {bg:'#0d3d1a',c:'#39ff7a'};
  if (s==='6') return {bg:'#2a1060',c:'#a855f7'};
  return {bg:'#0d2540',c:'#3b9eff'};
}
function bub(b, sm) {
  var col = ballCol(b), sz = sm ? 22 : 27;
  return '<div class="bb2" style="width:'+sz+'px;height:'+sz+'px;background:'+col.bg+';color:'+col.c+';border:1px solid '+col.c+'40;font-size:'+(sm?8:9)+'px">'+b+'</div>';
}

// ── Main score screen ────────────────────────────
function renderScore() {
  var inn = G.inn[G.cur]; if (!inn) return;
  var a = adjS(inn);
  tx('lb-bat', tname(inn.bat)+' batting (Inn '+G.cur+')');
  tx('lb-score', a+'/'+inn.wickets);
  tx('lb-ov', getOv(inn.legalBalls)+' ov');
  tx('lb-balls', inn.legalBalls+'/'+(G.overs*6)+' balls');
  tx('lb-crr', 'CRR '+getCRR(inn));
  tx('lb-ext', 'Extras '+extTot(inn));
  var e = inn.extras; tx('lb-extd','WD'+e.WD+'|NB'+e.NB+'|B'+e.B+'|LB'+e.LB);
  var pt = buildPenTxt(); sd('lb-pen', pt?'block':'none'); if(pt) tx('lb-pen', pt);

  if (G.cur===2) {
    var a1 = adjS(G.inn[1]), tgt = a1+1, bl = G.overs*6-inn.legalBalls, need = tgt-a;
    var rrr = bl>0 ? (need/(bl/6)).toFixed(2) : '—';
    sd('lb-tgt','block');
    tx('tgt-n','Target '+tgt); tx('tgt-rrr','RRR: '+rrr);
    tx('tgt-need','Need '+Math.max(0,need)+' off '+Math.max(0,bl)+' balls');
  } else {
    sd('lb-tgt','none');
  }

  if (inn.striker) {
    tx('sn', inn.striker.name); tx('sr', inn.striker.runs+'*');
    tx('sd', inn.striker.balls+'b·'+inn.striker.fours+'×4·'+inn.striker.sixes+'×6');
    tx('ssr','SR:'+srFn(inn.striker.runs,inn.striker.balls)+' D:'+inn.striker.dots);
  }
  if (inn.nonStriker) {
    tx('nsn', inn.nonStriker.name); tx('nsr', inn.nonStriker.runs);
    tx('nsd', inn.nonStriker.balls+'b·'+inn.nonStriker.fours+'×4·'+inn.nonStriker.sixes+'×6');
    tx('nssr','SR:'+srFn(inn.nonStriker.runs,inn.nonStriker.balls)+' D:'+inn.nonStriker.dots);
    sd('ns-card','block');
  } else {
    tx('nsn','—'); tx('nsr',''); tx('nsd',''); tx('nssr',''); sd('ns-card','block');
  }

  tx('partval', inn.curPart.runs+'r · '+inn.curPart.balls+'b');

  if (inn.bowler) {
    var bw = inn.bowler;
    tx('bwln', bw.name);
    tx('bwld', getOv(bw.bBalls)+'-'+bw.bMaidens+'-'+bw.bRuns+'-'+bw.bWkts+'|Eco:'+ecoFn(bw.bRuns,bw.bBalls)+'|D:'+bw.bDots);
  }

  tx('ovn', 'Over '+inn.overNum);
  var curR = 0;
  inn.curBalls.forEach(function(b) {
    if (b==='W') return;
    if (b==='WD') { curR++; return; }
    if (String(b).indexOf('WD+')===0) { var m=String(b).match(/WD\+(\d)/); curR+=(m?parseInt(m[1]):0)+1; return; }
    if (String(b).indexOf('NB')===0) { var m=String(b).match(/\+(\d)/); curR+=(m?parseInt(m[1]):0)+1; return; }
    if (String(b).indexOf('LB')===0) { var m2=String(b).match(/LB(\d+)/); curR+=(m2?parseInt(m2[1]):1); return; }
    if (b==='B' || String(b).indexOf('B')===0) { var m3=String(b).match(/B(\d+)/); curR+=(m3?parseInt(m3[1]):1); return; }
    if (typeof b==='number') curR += b;
  });
  tx('ovr', curR+'r');

  var cbH = inn.curBalls.length
    ? inn.curBalls.map(function(b){return bub(b);}).join('')
    : '<span style="font-size:10px;color:var(--t2)">No balls yet</span>';
  ih('curballs', cbH);

  // Match code display
  var code = G.joinCode || '----';
  tx('matchcode', code);

  tx('hlbl', 'Over history ('+inn.completedOvers.length+')');
  if (histOpen) renderHist(inn);
}

function buildPenTxt() {
  var l = [];
  if (G.penBonus.A) l.push(G.tA+' +'+G.penBonus.A);
  if (G.penBonus.B) l.push(G.tB+' +'+G.penBonus.B);
  if (G.penMinus.A) l.push(G.tA+' -'+G.penMinus.A);
  if (G.penMinus.B) l.push(G.tB+' -'+G.penMinus.B);
  return l.join(' | ');
}

function togHist() {
  histOpen = !histOpen;
  E('hdraw').style.display = histOpen ? 'block' : 'none';
  E('harr').style.transform = histOpen ? 'rotate(180deg)' : '';
  if (histOpen) renderHist(G.inn[G.cur]);
}
function renderHist(inn) {
  if (!inn || !inn.completedOvers.length) { ih('hdraw','<div style="font-size:10px;color:var(--t2)">None yet</div>'); return; }
  var h = '';
  inn.completedOvers.slice().reverse().forEach(function(ov, i) {
    var idx = inn.completedOvers.length - i;
    var w = ov.balls.filter(function(b){return b==='W';}).length;
    h += '<div style="margin-bottom:4px;padding-bottom:4px;border-bottom:1px solid rgba(255,255,255,.05)">';
    h += '<div style="display:flex;justify-content:space-between;font-size:9px;color:var(--t2);margin-bottom:2px"><span>Ov '+idx+' — '+ov.bowler+'</span><span style="color:'+(w?'#ff3b3b':'#39ff7a')+'">'+ov.runs+'r'+(w?' '+w+'w':'')+'</span></div>';
    h += '<div style="display:flex;flex-wrap:wrap;gap:2px">'+ov.balls.map(function(b){return bub(b,true);}).join('')+'</div></div>';
  });
  ih('hdraw', h);
}

// ── Scorecard builders ───────────────────────────
function scBat(inn, n) {
  var bp = batPl(inn).filter(function(p){return p.battingOrder>=0||p.batting||p.out||p.retiredHurt;});
  var h = '<div class="card" style="margin-bottom:8px">';
  h += '<div style="font-weight:700;font-size:12px;margin-bottom:8px;color:var(--g)">'+esc(tname(inn.bat))+' — Inn '+n+'</div>';
  h += '<div class="sw"><table class="sc"><tr><th>Batter</th><th>How out</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr>';
  bp.forEach(function(p) {
    h += '<tr><td>'+esc(p.name)+(p.batting&&!p.out?'<span style="color:var(--g);font-size:8px"> *</span>':'')+'</td>';
    h += '<td style="font-size:9px;color:var(--t2);text-align:left;max-width:80px;white-space:normal">'+(p.out?(esc(p.dismissal)||'out'):p.retiredHurt?'retired hurt':'not out')+'</td>';
    h += '<td>'+p.runs+'</td><td>'+p.balls+'</td><td>'+p.fours+'</td><td>'+p.sixes+'</td><td>'+srFn(p.runs,p.balls)+'</td></tr>';
  });
  h += '</table></div>';
  h += '<div style="font-size:10px;color:var(--t2);margin-top:6px">Extras: '+extTot(inn)+' (WD '+inn.extras.WD+' NB '+inn.extras.NB+' B '+inn.extras.B+' LB '+inn.extras.LB+')</div>';
  h += '<div style="font-size:12px;font-weight:700;margin-top:6px;padding-top:5px;border-top:1px solid rgba(255,255,255,.07)">Total: '+adjS(inn)+'/'+inn.wickets+' ('+getOv(inn.legalBalls)+' ov)</div></div>';
  return h;
}

function scBwl(inn, n) {
  var bwp = bwlPl(inn).filter(function(p){return p.bBalls>0;});
  var h = '<div class="card" style="margin-bottom:8px">';
  h += '<div style="font-weight:700;font-size:12px;margin-bottom:8px;color:var(--r)">'+esc(tname(inn.bowl))+' bowling — Inn '+n+'</div>';
  h += '<div class="sw"><table class="sc"><tr><th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Eco</th><th>Dots</th></tr>';
  bwp.forEach(function(p) {
    h += '<tr><td>'+esc(p.name)+(p.bHatrick?'<span style="color:var(--y);font-size:8px"> HT</span>':'')+'</td>';
    h += '<td>'+getOv(p.bBalls)+'</td><td>'+p.bMaidens+'</td><td>'+p.bRuns+'</td><td>'+p.bWkts+'</td><td>'+ecoFn(p.bRuns,p.bBalls)+'</td><td>'+p.bDots+'</td></tr>';
  });
  h += '</table></div></div>';
  return h;
}

function scFow(inn, n) {
  var h = '<div class="card" style="margin-bottom:8px"><div style="font-weight:700;font-size:12px;margin-bottom:8px;color:var(--p)">'+esc(tname(inn.bat))+' — FOW Inn '+n+'</div>';
  if (!inn.fowLog.length) { h += '<div style="font-size:11px;color:var(--t2)">No wickets</div>'; }
  inn.fowLog.forEach(function(f, i) {
    h += '<div class="row"><div><span style="color:var(--p);font-weight:700">'+(i+1)+'.</span> '+esc(f.player)+'<br><span style="font-size:9px;color:var(--t2)">'+esc(f.dismissal||'')+'</span></div>';
    h += '<div style="text-align:right;font-size:10px">'+f.score+'<br><span style="font-size:9px;color:var(--t2)">ov '+f.over+'</span></div></div>';
  });
  h += '</div>';
  return h;
}

function scPart(inn, n) {
  var h = '<div class="card" style="margin-bottom:8px"><div style="font-weight:700;font-size:12px;margin-bottom:8px;color:var(--p)">'+esc(tname(inn.bat))+' — Partnerships Inn '+n+'</div>';
  if (!inn.partnerships.length) { h += '<div style="font-size:11px;color:var(--t2)">No data</div></div>'; return h; }
  h += '<div class="sw"><table class="sc"><tr><th>Wkt</th><th>Batters</th><th>Runs</th><th>Balls</th><th>Ended by</th></tr>';
  inn.partnerships.forEach(function(p) {
    h += '<tr><td>'+p.wkt+'</td><td>'+esc(p.b1)+(p.b2?' & '+esc(p.b2):'')+'</td><td>'+p.runs+'</td><td>'+p.balls+'</td><td style="color:var(--r);font-size:9px">'+esc(p.endedBy)+'</td></tr>';
  });
  h += '</table></div></div>';
  return h;
}

function buildAllSC(targetIds) {
  var batH='', bwlH='', fowH='', partH='';
  for (var n=1;n<=G.innings;n++) {
    var inn = G.inn[n]; if (!inn) continue;
    batH += scBat(inn,n); bwlH += scBwl(inn,n); fowH += scFow(inn,n); partH += scPart(inn,n);
  }
  ih(targetIds[0], batH||'<div style="font-size:12px;color:var(--t2);padding:8px">No data</div>');
  ih(targetIds[1], bwlH||'<div style="font-size:12px;color:var(--t2);padding:8px">No data</div>');
  ih(targetIds[2], fowH||'<div style="font-size:12px;color:var(--t2);padding:8px">No wickets</div>');
  ih(targetIds[3], partH||'<div style="font-size:12px;color:var(--t2);padding:8px">No data</div>');
}

function showSC() { buildAllSC(['sc-bat','sc-bwl','sc-fow','sc-part']); showOv('ov-sc'); }
function scTab(t) {
  document.querySelectorAll('#sc-tabs .tab').forEach(function(el,i){el.classList.toggle('on',i===t);});
  ['sc-bat','sc-bwl','sc-fow','sc-part'].forEach(function(id,i){sd(id,i===t?'block':'none');});
}
function rTab(t) {
  document.querySelectorAll('#rtabs .tab').forEach(function(el,i){el.classList.toggle('on',i===t);});
  ['r-bat','r-bwl','r-fow','r-part'].forEach(function(id,i){sd(id,i===t?'block':'none');});
}

// ── Leaderboard ───────────────────────────────────
function renderLBAll() {
  var lb = getLB(), pl = Object.values(lb);
  if (!pl.length) {
    ih('lb-at','<div style="font-size:13px;color:var(--t2);text-align:center;padding:20px">Save a match first.</div>');
    return;
  }
  var cats = [
    {l:'Most Runs',k:'runs',c:'var(--g)',s:'runs'},
    {l:'Most Wickets',k:'wkts',c:'var(--r)',s:'wkts'},
    {l:'Most Sixes',k:'sixes',c:'var(--p)',s:'sixes'},
    {l:'Most Fours',k:'fours',c:'var(--b)',s:'fours'},
    {l:'Dot Balls',k:'dots',c:'var(--t2)',s:'dots'},
    {l:'MOM Awards',k:'mom',c:'var(--y)',s:'awards'}
  ];
  var medals = ['🥇','🥈','🥉'], h = '';
  cats.forEach(function(cat) {
    var s = pl.slice().sort(function(a,b){return (b[cat.k]||0)-(a[cat.k]||0);}).slice(0,3);
    h += '<div class="card" style="margin-bottom:8px"><h3>'+cat.l+'</h3>';
    s.forEach(function(p,i) {
      h += '<div class="lbi"><div style="font-size:14px;font-weight:800;color:var(--y);width:24px">'+medals[i]+'</div>';
      h += '<div style="flex:1;font-size:12px;font-weight:700;margin-left:8px">'+esc(p.name)+'</div>';
      // FIX: show the actual stat value (was broken before due to wrong key)
      h += '<div style="font-size:12px;color:'+cat.c+';font-weight:700">'+(p[cat.k]||0)+' '+cat.s+'</div></div>';
    });
    h += '</div>';
  });
  ih('lb-at', h);
}

function lbTab(t) {
  document.querySelectorAll('#lb-tabs .tab').forEach(function(el,i){el.classList.toggle('on',i===t);});
  sd('lb-at', t===0?'block':'none'); sd('lb-tr', t===1?'block':'none');
  if (t===0) renderLBAll();
}

// ── Saved matches ────────────────────────────────
function renderSaved() {
  var matches = getSav();
  if (!matches.length) {
    ih('saved-list','<div style="font-size:13px;color:var(--t2);text-align:center;padding:20px">No saved matches yet</div>');
    return;
  }
  var h = '';
  matches.forEach(function(m, i) {
    h += '<div class="scard" onclick="loadSaved('+i+')">';
    h += '<div style="display:flex;justify-content:space-between;margin-bottom:4px">';
    h += '<span style="font-size:13px;font-weight:700">'+esc(m.tA||'?')+' vs '+esc(m.tB||'?')+'</span>';
    h += '<span style="font-size:10px;color:var(--t2)">'+m.date+'</span></div>';
    h += '<div style="font-size:11px;color:var(--g);margin-bottom:2px">'+esc(m.result||'')+'</div>';
    h += '<div style="font-size:10px;color:var(--y)">MOM: '+esc(m.motm||'—')+'</div></div>';
  });
  ih('saved-list', h);
}

function loadSaved(i) {
  var matches = getSav(), m = matches[i];
  if (!m) return;
  try {
    G = JSON.parse(m.snap); G.done = true;
    buildBtns(); goPage('pg-result');
    tx('res-hl', G.headline||m.result);
    tx('motm-n', G.motm?G.motm.name:'—');
    tx('motm-r', G.motm?G.motm.reason:'');
    var i1=G.inn[1], i2=G.inn[2], sc='';
    if(i1) sc+='<div class="row"><span style="font-weight:700">'+esc(tname(i1.bat))+'</span><span>'+adjS(i1)+'/'+i1.wickets+'</span></div>';
    if(i2) sc+='<div class="row"><span style="font-weight:700">'+esc(tname(i2.bat))+'</span><span>'+adjS(i2)+'/'+i2.wickets+'</span></div>';
    ih('res-sc', sc); buildFunStats(); buildAllSC(['r-bat','r-bwl','r-fow','r-part']);
  } catch(e) { toast('Error loading match'); }
}

// ── Tournament ────────────────────────────────────
function createTrn() {
  var nm = E('trname').value.trim();
  if (!nm) { toast('Enter name'); return; }
  var ts = getTrns();
  if (ts.find(function(t){return t.name===nm;})) { toast('Already exists'); return; }
  ts.push({name:nm, ids:[]});
  setTrns(ts); E('trname').value = ''; renderTrnList(); toast('Tournament created');
}
function renderTrnList() {
  var ts = getTrns();
  if (!ts.length) { ih('trn-list','<div style="font-size:12px;color:var(--t2);margin-bottom:8px">No tournaments yet</div>'); return; }
  ih('trn-list', ts.map(function(t,i){
    return '<div class="scard" onclick="viewTrn('+i+')"><div style="font-size:13px;font-weight:700">'+esc(t.name)+'</div><div style="font-size:10px;color:var(--t2)">'+t.ids.length+' match'+(t.ids.length!==1?'es':'')+'</div></div>';
  }).join(''));
}
function viewTrn(i) {
  var ts=getTrns(), t=ts[i], saved=getSav();
  var matches = saved.filter(function(m){return t.ids.indexOf(m.id)>=0;});
  var lb={};
  matches.forEach(function(m) {
    try {
      var sn=JSON.parse(m.snap);
      (sn.pA||[]).concat(sn.pB||[]).forEach(function(p){
        if(!lb[p.name])lb[p.name]={name:p.name,runs:0,wkts:0};
        lb[p.name].runs+=p.runs; lb[p.name].wkts+=p.bWkts;
      });
      if(sn.motm&&sn.motm.name){
        if(!lb[sn.motm.name])lb[sn.motm.name]={name:sn.motm.name,runs:0,wkts:0,mom:0};
        lb[sn.motm.name].mom=(lb[sn.motm.name].mom||0)+1;
      }
    } catch(e){}
  });
  var pl=Object.values(lb).sort(function(a,b){return b.runs-a.runs;}).slice(0,3), medals=['🥇','🥈','🥉'];
  var h='<div class="card" style="margin-bottom:8px"><h3>'+esc(t.name)+' — Top Performers</h3>';
  if (!pl.length) h+='<div style="font-size:11px;color:var(--t2)">Add matches below</div>';
  else h+=pl.map(function(p,i){return '<div class="lbi"><div style="font-size:14px;font-weight:800;color:var(--y);width:24px">'+medals[i]+'</div><div style="flex:1;font-size:12px;font-weight:700;margin-left:8px">'+esc(p.name)+'</div><div style="font-size:12px;color:var(--g);font-weight:700">'+p.runs+'r '+p.wkts+'w</div></div>';}).join('');
  h+='</div>';
  var un=saved.filter(function(m){return t.ids.indexOf(m.id)<0;});
  if(un.length) h+='<div class="card" style="margin-bottom:8px"><h3>Add match to '+esc(t.name)+'</h3>'+un.map(function(m){return '<div class="scard" style="margin-bottom:4px" onclick="addToTrn('+i+',\''+m.id+'\')"><div style="font-size:12px;font-weight:700">'+esc(m.tA)+' vs '+esc(m.tB)+'</div><div style="font-size:10px;color:var(--g)">'+esc(m.result)+'</div></div>';}).join('')+'</div>';
  ih('trn-detail', h);
}
function addToTrn(i, mid) {
  var ts=getTrns(); if(ts[i].ids.indexOf(mid)<0)ts[i].ids.push(mid);
  setTrns(ts); viewTrn(i); toast('Added');
}

// ── Viewer renders ───────────────────────────────
var vTabIdx = 0;
function vTab(t) {
  vTabIdx = t;
  document.querySelectorAll('#pg-viewer .tab').forEach(function(el,i){el.classList.toggle('on',i===t);});
  ['vt-live','vt-sc','vt-saved','vt-lb'].forEach(function(id,i){sd(id,i===t?'block':'none');});
}

function renderVLive(vG) {
  var n = vG.cur, inn = vG.inn[n];
  if (!inn) { ih('vt-live','<div style="font-size:13px;color:var(--t2);text-align:center;padding:20px">Match not started yet</div>'); return; }
  function aS(i) { return Math.max(0, i.totalRuns+(vG.penBonus[i.bat]||0)-(vG.penMinus[i.bat]||0)); }
  var a = aS(inn), i1=vG.inn[1], i2=vG.inn[2];
  var h = '<div style="background:rgba(255,255,255,.06);border:1px solid var(--bdr);border-radius:12px;padding:10px 14px;margin-bottom:8px;margin-top:4px">';
  h += '<div style="font-size:11px;color:var(--t2);margin-bottom:2px">'+esc(vG.tA)+' vs '+esc(vG.tB)+' · '+vG.overs+' overs</div>';
  h += '<div style="font-size:42px;font-weight:800;letter-spacing:-2px">'+a+'/'+inn.wickets+'</div>';
  h += '<div style="font-size:13px;color:var(--t2)">'+getOv(inn.legalBalls)+' ov · '+esc(tname_v(vG,inn.bat))+' batting</div>';
  if (n===2&&i1) {
    var tgt=aS(i1)+1, bl=vG.overs*6-inn.legalBalls, need=tgt-a, rrr=bl>0?(need/(bl/6)).toFixed(2):'—';
    h+='<div style="background:rgba(168,85,247,.1);border:1px solid rgba(168,85,247,.25);border-radius:9px;padding:6px 9px;margin-top:6px">';
    h+='<div style="font-size:14px;color:var(--p);font-weight:800">Target: '+tgt+'</div>';
    h+='<div style="font-size:12px;color:var(--o);font-weight:700">RRR: '+rrr+'</div>';
    h+='<div style="font-size:12px;color:var(--t);font-weight:600">Need '+Math.max(0,need)+' off '+Math.max(0,bl)+' balls</div></div>';
  }
  h += '</div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">';
  if (inn.striker) h+='<div class="bc sk"><div style="font-size:10px;font-weight:700;margin-bottom:2px">'+esc(inn.striker.name)+' *</div><div style="font-size:20px;font-weight:800">'+inn.striker.runs+'*</div><div style="font-size:9px;color:var(--t2)">'+inn.striker.balls+'b '+inn.striker.fours+'×4 '+inn.striker.sixes+'×6</div></div>';
  if (inn.nonStriker) h+='<div class="bc"><div style="font-size:10px;font-weight:700;margin-bottom:2px">'+esc(inn.nonStriker.name)+'</div><div style="font-size:20px;font-weight:800">'+inn.nonStriker.runs+'</div><div style="font-size:9px;color:var(--t2)">'+inn.nonStriker.balls+'b '+inn.nonStriker.fours+'×4 '+inn.nonStriker.sixes+'×6</div></div>';
  h += '</div>';
  if (inn.bowler) {
    h+='<div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,59,59,.22);border-radius:10px;padding:7px 10px;margin-bottom:8px">';
    h+='<div style="font-size:10px;color:var(--r);font-weight:700">'+esc(inn.bowler.name)+'</div>';
    h+='<div style="font-size:9px;color:var(--t2);margin-top:2px">'+getOv(inn.bowler.bBalls)+'-'+inn.bowler.bMaidens+'-'+inn.bowler.bRuns+'-'+inn.bowler.bWkts+' Eco:'+ecoFn(inn.bowler.bRuns,inn.bowler.bBalls)+'</div>';
    h+='<div style="display:flex;flex-wrap:wrap;gap:2px;margin-top:5px">'+inn.curBalls.map(function(b){return bub(b);}).join('')+'</div></div>';
  }
  if (inn.completedOvers.length) {
    h+='<div class="card"><h3>Recent overs</h3>';
    inn.completedOvers.slice(-3).reverse().forEach(function(ov,i) {
      var idx=inn.completedOvers.length-i;
      var w=ov.balls.filter(function(b){return b==='W';}).length;
      h+='<div style="margin-bottom:5px"><div style="font-size:9px;color:var(--t2);margin-bottom:2px">Ov '+idx+' — '+ov.bowler+' ('+ov.runs+'r'+(w?' '+w+'w':'')+')</div>';
      h+='<div style="display:flex;flex-wrap:wrap;gap:2px">'+ov.balls.map(function(b){return bub(b,true);}).join('')+'</div></div>';
    });
    h+='</div>';
  }
  var isHost = FB && FB.isHost;
  h+='<div style="font-size:10px;color:var(--t2);text-align:center;margin-top:8px">🔴 Live · updates every 1.5s · Code: <b style="color:var(--b)">'+esc(vG.joinCode||FB.joinCode||'—')+'</b>'+(isHost?' · <span class="host-badge">HOST</span>':'')+'</div>';
  ih('vt-live', h);
}

function tname_v(vG, t) { return t==='A' ? vG.tA : vG.tB; }

function renderVSC(vG) {
  var oldG = G; G = vG;
  var h = '<div class="tabs" style="margin-top:4px"><div class="tab on" onclick="vsct(0)">Bat</div><div class="tab" onclick="vsct(1)">Bowl</div><div class="tab" onclick="vsct(2)">FOW</div><div class="tab" onclick="vsct(3)">Part</div></div>';
  var batH='', bwlH='', fowH='', partH='';
  for (var n=1;n<=vG.innings;n++) {
    var inn=vG.inn[n]; if(!inn) continue;
    batH+=scBat(inn,n); bwlH+=scBwl(inn,n); fowH+=scFow(inn,n); partH+=scPart(inn,n);
  }
  G = oldG;
  h+='<div id="vsc0">'+batH+'</div><div id="vsc1" style="display:none">'+bwlH+'</div><div id="vsc2" style="display:none">'+fowH+'</div><div id="vsc3" style="display:none">'+partH+'</div>';
  ih('vt-sc', h);
}
window.vsct = function(t) {
  document.querySelectorAll('#vt-sc .tab').forEach(function(el,i){el.classList.toggle('on',i===t);});
  [0,1,2,3].forEach(function(i){var el=E('vsc'+i);if(el)el.style.display=i===t?'block':'none';});
};

function renderVLB(data) {
  if (!data) { ih('vt-lb','<div style="font-size:13px;color:var(--t2);text-align:center;padding:20px">No leaderboard data</div>'); return; }
  var pl = Array.isArray(data) ? data : Object.values(data);
  var cats = [
    {l:'Most Runs',k:'runs',c:'var(--g)',s:'runs'},
    {l:'Most Wickets',k:'wkts',c:'var(--r)',s:'wkts'},
    {l:'Most Sixes',k:'sixes',c:'var(--p)',s:'sixes'},
    {l:'Most Fours',k:'fours',c:'var(--b)',s:'fours'},
    {l:'MOM Awards',k:'mom',c:'var(--y)',s:'awards'}
  ];
  var medals=['🥇','🥈','🥉'], h='<div style="margin-top:4px">';
  cats.forEach(function(cat) {
    var s = pl.slice().sort(function(a,b){return(b[cat.k]||0)-(a[cat.k]||0);}).slice(0,3);
    h+='<div class="card" style="margin-bottom:8px"><h3>'+cat.l+'</h3>';
    s.forEach(function(p,i) {
      h+='<div class="lbi"><div style="font-size:14px;font-weight:800;color:var(--y);width:24px">'+medals[i]+'</div>';
      h+='<div style="flex:1;font-size:12px;font-weight:700;margin-left:8px">'+esc(p.name)+'</div>';
      h+='<div style="font-size:12px;color:'+cat.c+';font-weight:700">'+(p[cat.k]||0)+' '+cat.s+'</div></div>';
    });
    h+='</div>';
  });
  h+='</div>';
  ih('vt-lb', h);
}

// ── Fun stats & result ────────────────────────────
function buildFunStats() {
  var all = G.pA.concat(G.pB);
  function best(k){return all.reduce(function(a,p){return(p[k]||0)>(a[k]||0)?p:a;},all[0]);}
  var mr=best('runs'),mw=best('bWkts'),mf=best('fours'),ms=best('sixes'),md=best('bDots');
  var ht=null; all.forEach(function(p){if(p.bHatrick)ht=p;});
  var mo=all.filter(function(p){return p.bMaidens>0;});
  var mrr=all.reduce(function(a,p){var r=Math.max(0,p.runs-p.fours*4-p.sixes*6);return r>a.r?{r:r,name:p.name}:a;},{r:-1,name:'—'});
  function row(l,v,c){return '<div class="row"><span>'+l+'</span><span style="color:'+(c||'var(--g)')+';font-weight:700">'+v+'</span></div>';}
  var h='';
  if(mr)h+=row('Most runs',mr.name+' ('+mr.runs+')');
  if(mw)h+=row('Most wickets',mw.name+' ('+mw.bWkts+')','var(--r)');
  if(mf)h+=row('Most fours',mf.name+' ('+mf.fours+')','var(--b)');
  if(ms)h+=row('Most sixes',ms.name+' ('+ms.sixes+')','var(--p)');
  h+=row('Most runs (running)',mrr.name+' ('+mrr.r+')','var(--o)');
  if(md)h+=row('Most dot balls',md.name+' ('+md.bDots+')','var(--t2)');
  if(mo.length)h+=row('Maiden'+(mo.length>1?'s':''),mo.map(function(p){return p.name+'('+p.bMaidens+')'}).join(', '),'var(--y)');
  if(ht)h+=row('Hat-trick! 🎩',ht.name,'var(--y)');
  ih('fun-stats', h||'<div style="font-size:11px;color:var(--t2)">—</div>');
}

function computeMOTM(wt) {
  var all=G.pA.concat(G.pB),i1=G.inn[1],i2=G.inn[2];
  var totR=(i1?adjS(i1):0)+(i2?adjS(i2):0),totW=all.reduce(function(a,p){return a+p.bWkts;},0);
  var best=null,bestSc=-1;
  all.forEach(function(p){
    var team=G.pA.indexOf(p)>=0?'A':'B',mul=(wt&&team===wt)?1.4:0.7;
    var sv=p.balls>0?(p.runs/p.balls*100):0,cPct=totR>0?(p.runs/totR*100):0;
    var bat=cPct*1.8+p.runs*1.2+p.fours*1.5+p.sixes*3+sv*0.06+(p.runs>=50?25:0)+(p.runs>=100?50:0);
    if(i2&&team===i2.bat)bat*=1.1;
    var bowl=0;
    if(p.bBalls>=6){var ev=p.bRuns/(p.bBalls/6),wPct=totW>0?(p.bWkts/totW*100):0;bowl=wPct*2+p.bWkts*30+p.bMaidens*15+Math.max(0,15-ev)*3+p.bDots*0.6+(p.bWkts>=3?20:0)+(p.bWkts>=5?40:0)+(p.bHatrick?70:0);}
    var ar=(p.runs>=20&&p.bWkts>=2)?35:0;
    var tot=(bat+bowl+ar)*mul; if(tot>bestSc){bestSc=tot;best=p;}
  });
  if (!best) return null;
  var team=G.pA.indexOf(best)>=0?'A':'B',sv=srFn(best.runs,best.balls),ev=ecoFn(best.bRuns,best.bBalls);
  var reason='';
  if(best.runs>0&&best.bBalls>=6&&best.bWkts>0)reason='All-round: '+best.runs+' runs (SR '+sv+') & '+best.bWkts+' wkts (Eco '+ev+').';
  else if(best.bBalls>=6&&best.bWkts*20>=best.runs)reason=best.bWkts+' wkts for '+best.bRuns+' runs (Eco '+ev+(best.bHatrick?', HAT-TRICK!':'')+').';
  else reason=best.runs+' runs off '+best.balls+' balls (SR '+sv+', '+best.fours+'×4, '+best.sixes+'×6).';
  if(wt&&team!==wt)reason+=' Outstanding from the losing side.';
  return {name:best.name, reason:reason};
}

function showResult() {
  clearInterval(iT); clearInterval(oT); clearInterval(bT);
  var i1=G.inn[1],i2=G.inn[2],a1=adjS(i1),a2=i2?adjS(i2):0;
  var hl='',wt=null;
  if(!i2){hl=tname(i1.bat)+' won';wt=i1.bat;}
  else if(a1>a2){var d=a1-a2;hl=tname(i1.bat)+' won by '+d+' run'+(d!==1?'s':'');wt=i1.bat;}
  else if(a2>a1){var wl=batPl(i2).length-i2.wickets;hl=tname(i2.bat)+' won by '+wl+' wicket'+(wl!==1?'s':'');wt=i2.bat;}
  else hl='Match tied!';
  G.headline=hl; G.winTeam=wt; G.motm=computeMOTM(wt); G.done=true; G.pg='pg-result';
  fbEndMatch(); syncNow(); goPage('pg-result');
  tx('res-hl',hl); tx('motm-n',G.motm?G.motm.name:'—'); tx('motm-r',G.motm?G.motm.reason:'');
  var sc='';
  var i1d=G.inn[1],i2d=G.inn[2];
  if(i1d)sc+='<div class="row"><span style="font-weight:700">'+esc(tname(i1d.bat))+'</span><span>'+adjS(i1d)+'/'+i1d.wickets+' ('+getOv(i1d.legalBalls)+' ov)</span></div>';
  if(i2d)sc+='<div class="row"><span style="font-weight:700">'+esc(tname(i2d.bat))+'</span><span>'+adjS(i2d)+'/'+i2d.wickets+' ('+getOv(i2d.legalBalls)+' ov)</span></div>';
  ih('res-sc',sc); buildFunStats(); buildAllSC(['r-bat','r-bwl','r-fow','r-part']);
}

// ── Save match ────────────────────────────────────
function saveMatch() {
  var matches=getSav(), lb=getLB(), all=G.pA.concat(G.pB);
  all.forEach(function(p){
    if(!lb[p.name])lb[p.name]={name:p.name,runs:0,wkts:0,fours:0,sixes:0,dots:0,mom:0,matches:0};
    lb[p.name].runs+=p.runs;
    lb[p.name].wkts+=p.bWkts;
    lb[p.name].fours+=p.fours;
    lb[p.name].sixes+=p.sixes;
    lb[p.name].dots+=p.bDots;
    lb[p.name].matches++;
  });
  if(G.motm&&G.motm.name){
    if(!lb[G.motm.name])lb[G.motm.name]={name:G.motm.name,runs:0,wkts:0,fours:0,sixes:0,dots:0,mom:0,matches:0};
    lb[G.motm.name].mom++;
  }
  setLB(lb);
  fbSaveLeaderboard(lb); // push to Firestore
  var entry={
    id:G.joinCode||G.firestoreDocId||('m'+Date.now()),
    date:new Date().toLocaleDateString(),
    tA:G.tA, tB:G.tB, overs:G.overs,
    result:G.headline||'',
    s1:G.inn[1]?adjS(G.inn[1])+'/'+G.inn[1].wickets+' ('+getOv(G.inn[1].legalBalls)+' ov)':'—',
    s2:G.inn[2]?adjS(G.inn[2])+'/'+G.inn[2].wickets+' ('+getOv(G.inn[2].legalBalls)+' ov)':'—',
    motm:G.motm?G.motm.name:'—',
    snap:JSON.stringify(G)
  };
  var idx=matches.findIndex(function(m){return m.id===entry.id;});
  if(idx>=0)matches[idx]=entry; else matches.unshift(entry);
  setSav(matches);
  fbSaveMatch(entry);
  toast('Match saved! Leaderboard updated.');
}

// ── Export ────────────────────────────────────────
function exportCSV() {
  hideOv('ov-export');
  var csv='CricScore Pro Export\n"Date","'+new Date().toLocaleString()+'"\n"Match","'+G.tA+' vs '+G.tB+'"\n"Result","'+(G.headline||'')+'"\n"MOM","'+(G.motm?G.motm.name:'—')+'"\n\n';
  for(var n=1;n<=G.innings;n++){
    var inn=G.inn[n]; if(!inn) continue;
    csv+=tname(inn.bat)+' Inn '+n+' Batting\nBatter,How Out,R,B,4s,6s,SR,Dots\n';
    batPl(inn).filter(function(p){return p.battingOrder>=0||p.batting||p.out||p.retiredHurt;}).forEach(function(p){
      csv+='"'+p.name+'",'+(p.out?('"'+(p.dismissal||'out')+'"'):p.retiredHurt?'"retired hurt"':'"not out"')+','+p.runs+','+p.balls+','+p.fours+','+p.sixes+','+srFn(p.runs,p.balls)+','+p.dots+'\n';
    });
    csv+='Extras,'+extTot(inn)+',WD,'+inn.extras.WD+',NB,'+inn.extras.NB+',B,'+inn.extras.B+',LB,'+inn.extras.LB+'\nTotal,'+adjS(inn)+'/'+inn.wickets+' ('+getOv(inn.legalBalls)+' ov)\n\n';
    csv+=tname(inn.bowl)+' Inn '+n+' Bowling\nBowler,O,M,R,W,Eco,Dots\n';
    bwlPl(inn).filter(function(p){return p.bBalls>0;}).forEach(function(p){
      csv+='"'+p.name+'",'+getOv(p.bBalls)+','+p.bMaidens+','+p.bRuns+','+p.bWkts+','+ecoFn(p.bRuns,p.bBalls)+','+p.bDots+'\n';
    });
    csv+='\n';
  }
  var blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url; a.download='CricScore_'+G.tA.replace(/\s/g,'_')+'_vs_'+G.tB.replace(/\s/g,'_')+'_'+new Date().toISOString().slice(0,10)+'.csv';
  document.body.appendChild(a); a.click(); setTimeout(function(){document.body.removeChild(a);URL.revokeObjectURL(url);},300);
  toast('CSV saved to Downloads');
}

function exportTxt() {
  hideOv('ov-export');
  var t='═══════════════════════\n   CricScore Pro\n═══════════════════════\n'+G.tA+' vs '+G.tB+' | '+G.overs+' overs\nDate: '+new Date().toLocaleString()+'\n\nResult: '+(G.headline||'')+'\nMOM: '+(G.motm?G.motm.name:'—')+'\n'+(G.motm?'  '+G.motm.reason+'\n':'')+'\n';
  for(var n=1;n<=G.innings;n++){
    var inn=G.inn[n]; if(!inn) continue;
    t+='── '+tname(inn.bat)+' Inn '+n+': '+adjS(inn)+'/'+inn.wickets+' ('+getOv(inn.legalBalls)+' ov) ──\n';
    batPl(inn).filter(function(p){return p.battingOrder>=0||p.batting||p.out||p.retiredHurt;}).forEach(function(p){
      t+='  '+(p.name+'                  ').slice(0,20)+('   '+p.runs).slice(-4)+'('+p.balls+') ['+p.fours+'×4 '+p.sixes+'×6]\n';
      if(p.out||p.retiredHurt)t+='  '+'                    '+(p.dismissal||'out')+'\n';
    });
    t+='  Extras: '+extTot(inn)+'\nBowling:\n';
    bwlPl(inn).filter(function(p){return p.bBalls>0;}).forEach(function(p){
      t+='  '+(p.name+'                  ').slice(0,20)+' '+getOv(p.bBalls)+'-'+p.bMaidens+'-'+p.bRuns+'-'+p.bWkts+' Eco:'+ecoFn(p.bRuns,p.bBalls)+'\n';
    });
    t+='\n';
  }
  t+='═══════════════════════\n';
  E('sum-txt').value=t; showOv('ov-sum');
}

function copySummary() {
  var txt=E('sum-txt').value;
  if(navigator.clipboard){navigator.clipboard.writeText(txt).then(function(){toast('Copied!');}).catch(function(){E('sum-txt').select();document.execCommand('copy');toast('Copied!');});}
  else{E('sum-txt').select();document.execCommand('copy');toast('Copied!');}
}
