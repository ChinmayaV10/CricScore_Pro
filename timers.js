/* ════════════════════════════════════════════════
   CricScore Pro — timers.js
   Innings timer, over timer, break timer
   ════════════════════════════════════════════════ */

function startTimers() {
  clearInterval(iT); clearInterval(oT);
  // Innings countdown
  iT = setInterval(function() {
    if (T.iSec > 0) T.iSec--;
    else if (!T.exp) {
      T.exp = true;
      toast('Innings time up! +3 bonus per over bowled beyond this.');
    }
    updT();
  }, 1000);
  // Over timer — visual only, no penalty, resets fresh each over
  oT = setInterval(function() {
    if (T.oSec > 0) T.oSec--;
    updT();
  }, 1000);
}

function resetOvT() {
  // Called at end of each over — ALWAYS reset over timer
  // This also fixes the "timer resets on refresh" issue since T.oSec
  // is always reset to 4*60 when loaded from storage (see state.js)
  T.oSec = 4 * 60;
}

function updT() {
  var im = Math.floor(T.iSec/60), is = T.iSec%60;
  tx('tl', T.exp ? 'OVERTIME' : pad(im)+':'+pad(is)+' left');
  var tl = document.getElementById('tl');
  if (tl) tl.style.color = T.iSec<60?'#ff3b3b':T.iSec<300?'#ff8c00':'#8a90a8';
  var pct = T.iSec / (G.overs*4*60) * 100;
  var tf = document.getElementById('tf');
  if (tf) {
    tf.style.width = Math.max(0, pct) + '%';
    tf.style.background = pct<20?'#ff3b3b':pct<40?'#ff8c00':'#39ff7a';
  }
  var om = Math.floor(T.oSec/60), os = T.oSec%60;
  tx('otl', 'Over:'+pad(om)+':'+pad(os));
}

function startBrkTimer() {
  clearInterval(bT); updBrk();
  bT = setInterval(function() {
    if (T.brkSec > 0) { T.brkSec--; updBrk(); }
    else { clearInterval(bT); }
  }, 1000);
}

function updBrk() {
  tx('brk-timer', pad(Math.floor(T.brkSec/60))+':'+pad(T.brkSec%60));
}

// ── Innings break actions ────────────────────────
function endBreak() {
  clearInterval(bT); hideOv('ov-break');
  G.innings = 2;
  var bat2 = G.inn[1].bat==='A' ? 'B' : 'A';
  G.inn[2] = mkInn(bat2);
  T.iSec = G.overs*4*60; T.oSec = 4*60; T.exp = false; T.brkSec = 0;
  goPage('pg-score'); renderScore(); syncNow(); openInnModal(2);
}

function penaliseBreak(t) {
  G.penMinus[t] = (G.penMinus[t]||0) + 3;
  toast('-3 penalty on '+tname(t)+' for not being ready');
  endBreak();
}
