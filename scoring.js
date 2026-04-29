/* ════════════════════════════════════════════════
   CricScore Pro — scoring.js
   Delivery processing, dismissals, over/innings logic
   ════════════════════════════════════════════════ */

// ── Score buttons ────────────────────────────────
function buildBtns() {
  // NOTE: 'B' button replaced by 'SC' (strike change)
  var d = [
    {l:'0',  s:'background:#1c2030;color:#f0f2f8;border:1px solid rgba(255,255,255,.1)', f:'sb(0)'},
    {l:'1',  s:'background:#1c2030;color:#f0f2f8;border:1px solid rgba(255,255,255,.1)', f:'sb(1)'},
    {l:'2',  s:'background:#1c2030;color:#f0f2f8;border:1px solid rgba(255,255,255,.1)', f:'sb(2)'},
    {l:'3',  s:'background:#1c2030;color:#f0f2f8;border:1px solid rgba(255,255,255,.1)', f:'sb(3)'},
    {l:'4',  s:'background:#0d3d1a;color:#39ff7a;border:1px solid rgba(57,255,122,.35)',  f:'sb(4)'},
    {l:'6',  s:'background:#2a1060;color:#a855f7;border:1px solid rgba(168,85,247,.35)', f:'sb(6)'},
    {l:'5',  s:'background:#1c2030;color:#f0f2f8;border:1px solid rgba(255,255,255,.1)', f:'sb(5)'},
    {l:'W',  s:'background:#3d0d0d;color:#ff3b3b;border:1px solid rgba(255,59,59,.4)',   f:"sb('W')"},
    {l:'WD', s:'background:#3a2200;color:#ff8c00;border:1px solid rgba(255,140,0,.35)',  f:"sb('WD')", sm:1},
    {l:'NB', s:'background:#3a2200;color:#ff8c00;border:1px solid rgba(255,140,0,.35)',  f:"sb('NB')", sm:1},
    // Strike change replaces the old 'B' (bye) button
    {l:'⇄SC',s:'background:rgba(59,158,255,.15);color:#3b9eff;border:1px solid rgba(59,158,255,.3)', f:'strikeCh()', sm:1},
    {l:'LB', s:'background:#2d2400;color:#f5c518;border:1px solid rgba(245,197,24,.35)', f:"sb('LB')", sm:1},
    {l:'Undo',s:'background:#1a1d2a;color:#8a90a8;border:1px solid rgba(255,255,255,.08)',f:'undoLast()', sm:1},
    {l:'Pen', s:'background:rgba(255,59,59,.12);color:#ff3b3b;border:1px solid rgba(255,59,59,.28)', f:'openPen()', sm:1},
    {l:'Card',s:'background:rgba(59,158,255,.12);color:#3b9eff;border:1px solid rgba(59,158,255,.28)',f:'showSC()', sm:1}
  ];
  var h = '';
  d.forEach(function(x) {
    h += '<button class="sB' + (x.sm?' sm':'') + '" style="font-size:' + (x.sm?'10':'13') + 'px;' + x.s + '" onclick="' + x.f + '">' + x.l + '</button>';
  });
  ih('btns', h);
}

// ── Strike change (manual) ───────────────────────
function strikeCh() {
  var inn = G.inn[G.cur]; if (!inn) return;
  savH(); swapS(inn);
  renderScore(); syncNow();
  toast('Strike changed ⇄');
}

// ── Main ball handler ────────────────────────────
function sb(val) {
  var inn = G.inn[G.cur]; if (!inn || !inn.striker || inn.done) return;
  if (val==='NB') { showOv('ov-nb'); return; }
  if (val==='LB') { showOv('ov-lb2'); return; }
  if (val==='WD') { showOv('ov-wd'); return; }  // Wide popup
  savH(); processD(val, 0);
}

// Confirm no-ball runs
function cfNB(r) { hideOv('ov-nb'); savH(); processD('NB', r); }
// Confirm leg bye runs
function cfLB(r) { hideOv('ov-lb2'); savH(); processD('LB', r); }
// Confirm wide runs (0–4)
function cfWD(r) { hideOv('ov-wd'); savH(); processD('WD', r); }
// Confirm bowled bonus runs (runs off bat after being bowled — rare edge)
function cfBowledExtra(r) { hideOv('ov-bowled-extra'); savH(); processD('BE', r); }

// ── Core delivery processor ──────────────────────
function processD(val, extra) {
  var inn = G.inn[G.cur], bw = inn.bowler, legal = true;

  if (val==='W') {
    // Wicket
    inn.wickets++; inn.legalBalls++;
    inn.striker.balls++; inn.striker.dots++;
    if (bw) {
      bw.bBalls++; bw.bDots++;
      // Hat-trick check: 3 consecutive W across all balls
      var allb = [];
      inn.completedOvers.forEach(function(o) { allb = allb.concat(o.balls); });
      allb = allb.concat(inn.curBalls);
      if (allb.slice(-3).length===3 && allb.slice(-3).every(function(x){return x==='W';})) bw.bHatrick = true;
    }
    var sc = adjS(inn) + '/' + inn.wickets, ov2 = getOv(inn.legalBalls);
    if (inn.curPart.runs>0||inn.curPart.balls>0) {
      inn.partnerships.push({runs:inn.curPart.runs, balls:inn.curPart.balls, b1:inn.curPart.b1, b2:inn.curPart.b2, endedBy:inn.striker.name, wkt:inn.wickets});
    }
    inn.fowLog.push({player:inn.striker.name, score:sc, over:ov2, partRuns:inn.curPart.runs, partBalls:inn.curPart.balls, partner:inn.nonStriker?inn.nonStriker.name:'—', dismissal:''});
    inn.curPart = {runs:0, balls:0, b1:inn.nonStriker?inn.nonStriker.name:'', b2:''};
    inn.striker.out = true; inn.striker.batting = false;
    inn.curBalls.push('W');
    pendWkt = {inn:inn, fowIdx:inn.fowLog.length-1, batter:inn.striker};
    disPick = '';
    document.querySelectorAll('.db').forEach(function(b){b.classList.remove('sel');});
    E('dis-fw').style.display = 'none';
    tx('dis-nm', inn.striker.name);
    showOv('ov-dis');
    return;
  }
  else if (val==='WD') {
    // Wide: extra param = runs off wide (0 by default, but can be 1–4 for overthrows etc)
    var r = extra || 0;
    inn.totalRuns += 1 + r;
    inn.extras.WD++;
    if (bw) { bw.bRuns += 1 + r; bw.bWD++; }
    if (r > 0) inn.curPart.runs += r; // overthrow runs on wide
    inn.curBalls.push(r > 0 ? 'WD+'+r : 'WD');
    legal = false;
  }
  else if (val==='NB') {
    var r = extra || 0;
    inn.totalRuns += 1 + r;
    inn.extras.NB++;
    if (r>0) inn.striker.runs += r;
    if (r===4) inn.striker.fours++;
    if (r===6) inn.striker.sixes++;
    if (bw) { bw.bRuns += 1+r; bw.bNB++; }
    if (r%2===1) swapS(inn);
    inn.curPart.runs += 1+r;
    inn.curBalls.push('NB' + (r>0?'+'+r:''));
    legal = false;
  }
  else if (val==='LB') {
    var r = extra || 1;
    inn.totalRuns += r; inn.extras.LB += r;
    inn.legalBalls++; inn.striker.balls++;
    inn.curPart.runs += r; inn.curPart.balls++;
    if (bw) bw.bBalls++;
    if (r%2===1) swapS(inn);
    inn.curBalls.push('LB'+(r>1?r:''));
  }
  else if (val==='BE') {
    // Bye (replaces old 'B' button flow — via bowled extra popup)
    var r = extra || 0;
    inn.totalRuns += r; inn.extras.B += r;
    inn.legalBalls++; inn.striker.balls++; inn.striker.dots++;
    inn.curPart.runs += r; inn.curPart.balls++;
    if (bw) { bw.bBalls++; bw.bDots++; }
    if (r > 0 && r%2===1) swapS(inn);
    inn.curBalls.push(r>0?'B'+r:'B');
  }
  else {
    // Normal runs
    var r = parseInt(val);
    inn.totalRuns += r; inn.striker.runs += r; inn.striker.balls++;
    inn.legalBalls++; inn.curPart.runs += r; inn.curPart.balls++;
    if (r===0) inn.striker.dots++;
    if (r===4) inn.striker.fours++;
    if (r===6) inn.striker.sixes++;
    if (bw) { bw.bRuns += r; bw.bBalls++; if(r===0) bw.bDots++; }
    if (r%2===1) swapS(inn);
    inn.curBalls.push(r);
  }

  if (G.cur===2) chaseChk(inn);
  if (legal) chkOvEnd(inn, false);
  else { renderScore(); syncNow(); }
}

// ── Dismissal handling ───────────────────────────
function pickDis(el, type) {
  disPick = type;
  document.querySelectorAll('.db').forEach(function(b){b.classList.remove('sel');});
  el.classList.add('sel');
  var nf = ['Caught','Stumped','Run Out'].indexOf(type) >= 0;
  E('dis-fw').style.display = nf ? 'block' : 'none';
  if (nf) {
    var bwp = bwlPl(G.inn[G.cur]);
    E('dis-fs').innerHTML = bwp.map(function(p){return'<option>'+esc(p.name)+'</option>';}).join('');
    E('dis-fl').textContent = type==='Caught'?'Caught by':type==='Stumped'?'Stumped by':'Run out by';
  }
  // Bowled: show popup for runs off bat (usually 0)
  // This is handled by confirmDis which checks disPick
}

function confirmDis() {
  if (!disPick) { toast('Select dismissal type'); return; }
  var inn = pendWkt.inn, bw = inn.bowler, bwName = bw ? bw.name : '?';
  var dis = disPick;
  if (dis==='Caught') dis = 'c '+E('dis-fs').value+' b '+bwName;
  else if (dis==='Stumped') dis = 'st '+E('dis-fs').value+' b '+bwName;
  else if (dis==='Run Out') dis = 'run out ('+E('dis-fs').value+')';
  else if (dis==='Bowled') dis = 'b '+bwName;
  else if (dis==='LBW') dis = 'lbw b '+bwName;
  else if (dis==='Hit Wicket') dis = 'hit wkt b '+bwName;

  if (disPick==='Retired Hurt') {
    inn.wickets--;
    pendWkt.batter.out = false;
    pendWkt.batter.retiredHurt = true;
    pendWkt.batter.batting = false;
    pendWkt.batter.dismissal = 'retired hurt';
    if (inn.fowLog[pendWkt.fowIdx]) inn.fowLog.splice(pendWkt.fowIdx, 1);
    tx('wktinfo', pendWkt.batter.name + ' retired hurt — can return later');
  } else {
    var bowlerWkt = ['Bowled','Caught','Stumped','LBW','Hit Wicket'].indexOf(disPick) >= 0;
    if (bw && bowlerWkt) bw.bWkts++;
    pendWkt.batter.dismissal = dis;
    if (inn.fowLog[pendWkt.fowIdx]) inn.fowLog[pendWkt.fowIdx].dismissal = dis;
    tx('wktinfo', pendWkt.batter.name + ' — ' + dis);
  }
  hideOv('ov-dis');

  // Check if bowled — show runs-off-bat popup
  if (disPick === 'Bowled') {
    showOv('ov-bowled-extra');
    return;
  }

  proceedAfterDis(inn);
}

function proceedAfterDis(inn) {
  var bp = batPl(inn);
  var fresh = bp.filter(function(p){return !p.batting&&p.battingOrder===-1&&!p.out&&!p.retiredHurt;});
  var retHurt = bp.filter(function(p){return p.retiredHurt&&!p.out;});
  var rem = fresh.concat(retHurt);

  if (disPick !== 'Retired Hurt') {
    if (rem.length===0) {
      if (inn.nonStriker && !inn.nonStriker.out) {
        inn.striker = inn.nonStriker; inn.nonStriker = null;
        chkOvEnd(inn, true); return;
      } else { endInnings(); return; }
    }
  } else {
    if (rem.length===0) {
      if (inn.nonStriker && !inn.nonStriker.out) { inn.striker=inn.nonStriker; inn.nonStriker=null; chkOvEnd(inn,true); return; }
      else { endInnings(); return; }
    }
  }

  E('nb-sel').innerHTML = rem.map(function(p){
    return '<option value="'+esc(p.name)+'">'+(p.retiredHurt?'↩ ':'')+esc(p.name)+'</option>';
  }).join('');
  chkOvEnd(inn, true);
}

// ── Over end check ───────────────────────────────
function chkOvEnd(inn, afterWkt) {
  var lg = inn.curBalls.filter(function(b){
    return b!=='WD' && String(b).indexOf('NB')!==0;
  }).length;
  if (lg >= 6) doEndOv(inn, afterWkt);
  else {
    if (afterWkt) showOv('ov-newbat');
    else { renderScore(); syncNow(); }
  }
}

function doEndOv(inn, afterWkt) {
  var bw = inn.bowler;
  var rovRuns = 0;
  inn.curBalls.forEach(function(b) {
    if (b==='W' || b==='B' || String(b).indexOf('LB')===0) return;
    if (b==='WD') { rovRuns++; return; }
    if (String(b).indexOf('WD+')===0) { var m=String(b).match(/WD\+(\d)/); rovRuns+=(m?parseInt(m[1]):0)+1; return; }
    if (String(b).indexOf('NB')===0) { var m=String(b).match(/\+(\d)/); rovRuns+=(m?parseInt(m[1]):0)+1; return; }
    if (typeof b==='number') rovRuns += b;
    if (String(b).match(/^[0-9]+$/)) rovRuns += parseInt(b);
  });
  if (bw && rovRuns===0) bw.bMaidens++;
  if (T.exp) { G.penBonus[inn.bat]=(G.penBonus[inn.bat]||0)+3; toast('+3 bonus to '+tname(inn.bat)+' (overtime over)'); }
  inn.completedOvers.push({balls:inn.curBalls.slice(), bowler:bw?bw.name:'?', runs:rovRuns});
  inn.curBalls = []; inn.overNum++; swapS(inn); resetOvT();
  if (inn.overNum > G.overs || checkAllOut(inn)) { endInnings(); return; }
  if (G.cur===2) chaseChk(inn);
  var bwp = bwlPl(inn).filter(function(p){return !bw||p.name!==bw.name;});
  E('nbwl-sel').innerHTML = bwp.map(function(p){return'<option value="'+esc(p.name)+'">'+esc(p.name)+'</option>';}).join('');
  E('nbwl-title').textContent = 'Over '+(inn.overNum-1)+' done — New Bowler';
  renderScore(); syncNow();
  if (afterWkt) showOv('ov-newbat'); else showOv('ov-newbwl');
}

function checkAllOut(inn) {
  var bp = batPl(inn);
  var active = bp.filter(function(p){return p.batting&&!p.out;});
  var canCome = bp.filter(function(p){return (!p.batting&&p.battingOrder===-1&&!p.out&&!p.retiredHurt)||p.retiredHurt;});
  if (active.length===0) return true;
  if (active.length===1 && canCome.length===0 && !inn.nonStriker) return true;
  return false;
}

function confirmNewBat() {
  savH();
  var inn = G.inn[G.cur], name = E('nb-sel').value;
  var bp = batPl(inn), pl = null;
  for (var i=0;i<bp.length;i++) { if(bp[i].name===name){pl=bp[i];break;} }
  if (!pl) { toast('Player not found'); return; }
  if (pl.retiredHurt) { pl.retiredHurt=false; pl.batting=true; }
  else { pl.batting=true; pl.battingOrder=inn.batterIdx++; }
  inn.striker = pl; inn.curPart.b2 = pl.name;
  hideOv('ov-newbat');
  var lg = inn.curBalls.filter(function(b){return b!=='WD'&&String(b).indexOf('NB')!==0;}).length;
  if (lg>=6) doEndOv(inn, false); else { renderScore(); syncNow(); }
}

function confirmNewBwl() {
  savH();
  var inn = G.inn[G.cur], name = E('nbwl-sel').value;
  var bwp = bwlPl(inn), pl = null;
  for (var i=0;i<bwp.length;i++) { if(bwp[i].name===name){pl=bwp[i];break;} }
  inn.bowler = pl; hideOv('ov-newbwl'); renderScore(); syncNow();
}

function swapS(inn) { var t=inn.striker; inn.striker=inn.nonStriker; inn.nonStriker=t; }
function chaseChk(inn) { if (adjS(inn) >= adjS(G.inn[1])+1) endInnings(); }

// ── Innings end ───────────────────────────────────
function endInnings() {
  clearInterval(iT); clearInterval(oT);
  var inn = G.inn[G.cur]; inn.done = true;
  if (inn.curPart.runs>0||inn.curPart.balls>0) {
    inn.partnerships.push({runs:inn.curPart.runs, balls:inn.curPart.balls, b1:inn.curPart.b1, b2:inn.curPart.b2, endedBy:'not out', wkt:inn.wickets});
  }
  if (G.cur===1) {
    var a = adjS(inn);
    tx('brk-sc', tname(inn.bat)+' '+a+'/'+inn.wickets+' ('+getOv(inn.legalBalls)+' ov)');
    tx('brk-tgt', 'Target: '+(a+1));
    tx('brk-msg', 'Initial RRR: '+((a+1)/G.overs).toFixed(2)+' | '+tname(inn.bowl)+' to bat');
    E('pen-A-btn').textContent = G.tA+' not ready (-3)';
    E('pen-B-btn').textContent = G.tB+' not ready (-3)';
    T.brkSec = G.brkMins * 60;
    startBrkTimer(); showOv('ov-break'); syncNow();
  } else {
    G.done = true; syncNow(); showResult();
  }
}

// ── Penalty ──────────────────────────────────────
function openPen() {
  E('pen-sel').innerHTML = '<option value="A">'+esc(G.tA)+'</option><option value="B">'+esc(G.tB)+'</option>';
  showOv('ov-pen');
}
function cfPen() {
  savH(); var inn=G.inn[G.cur], t=E('pen-sel').value;
  if (t===inn.bat) { G.penMinus[t]=(G.penMinus[t]||0)+3; toast('-3 on batting team '+tname(t)); }
  else { G.penBonus[inn.bat]=(G.penBonus[inn.bat]||0)+3; toast('+3 bonus to batting team '+tname(inn.bat)); }
  hideOv('ov-pen'); renderScore(); syncNow();
}

// ── Undo ──────────────────────────────────────────
function savH() {
  G.hist.push(JSON.stringify({inn:G.inn, pA:G.pA, pB:G.pB, penBonus:G.penBonus, penMinus:G.penMinus}));
  if (G.hist.length>80) G.hist.shift();
}
function undoLast() {
  if (!G.hist.length) { toast('Nothing to undo'); return; }
  var p = JSON.parse(G.hist.pop());
  G.inn=p.inn; G.pA=p.pA; G.pB=p.pB; G.penBonus=p.penBonus; G.penMinus=p.penMinus;
  relinkInn(1); relinkInn(2);
  hideAllOv(); renderScore(); syncNow(); toast('Undone ↩');
}
