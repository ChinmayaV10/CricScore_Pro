/* ════════════════════════════════════════════════
   CricScore Pro — firebase.js
   Firebase Firestore room-based sync system
   ════════════════════════════════════════════════ */

// ── Firebase config (user fills via UI) ──────────
var FB = {
  apiKey: '',
  projectId: '',
  initialized: false,
  db: null,
  unsubscribe: null,       // onSnapshot listener cleanup
  matchDocRef: null,       // current match document reference
  isHost: false,
  deviceId: getDeviceId(),
  joinCode: null,
  viewerCount: 0
};

var LS_FB_CFG = 'cs6fbcfg2';  // key for Firestore config

// ── Device ID ────────────────────────────────────
function getDeviceId() {
  var id = localStorage.getItem('cs6did');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    localStorage.setItem('cs6did', id);
  }
  return id;
}

// ── Load & save config ───────────────────────────
function loadFBCfg() {
  try {
    var c = JSON.parse(localStorage.getItem(LS_FB_CFG) || 'null');
    if (c && c.apiKey && c.projectId) {
      FB.apiKey = c.apiKey;
      FB.projectId = c.projectId;
      initFirebase();
    }
  } catch(e) {}
  updateFBStatusUI();
}

function saveFBCfg() {
  var apiKey = (document.getElementById('fb-apikey') || {}).value || '';
  var projectId = (document.getElementById('fb-projectid') || {}).value || '';
  apiKey = apiKey.trim(); projectId = projectId.trim();
  if (!apiKey || !projectId) { toast('Enter both API Key and Project ID'); return; }
  FB.apiKey = apiKey; FB.projectId = projectId;
  try { localStorage.setItem(LS_FB_CFG, JSON.stringify({ apiKey: apiKey, projectId: projectId })); } catch(e) {}
  initFirebase();
  toast('Firebase configured! Testing connection...');
}

function clearFBCfg() {
  FB.apiKey = ''; FB.projectId = ''; FB.initialized = false; FB.db = null;
  localStorage.removeItem(LS_FB_CFG);
  var ak = document.getElementById('fb-apikey'), pi = document.getElementById('fb-projectid');
  if (ak) ak.value = ''; if (pi) pi.value = '';
  updateFBStatusUI();
  toast('Firebase config cleared');
}

// ── Initialize Firestore SDK ─────────────────────
function initFirebase() {
  if (!FB.apiKey || !FB.projectId) return;
  // Use Firestore REST API — no SDK needed
  FB.initialized = true;
  FB.db = {
    baseURL: 'https://firestore.googleapis.com/v1/projects/' + FB.projectId + '/databases/(default)/documents'
  };
  // Test connection
  fbFirestoreGet('matches', function(ok) {
    updateFBStatusUI();
    if (ok !== null) toast('Firebase connected ✓');
    else { toast('Firebase error — check API key & Project ID'); FB.initialized = false; updateFBStatusUI(); }
  });
}

// ── UI status ────────────────────────────────────
function updateFBStatusUI() {
  var ok = FB.initialized;
  var el = document.getElementById('fb-home-status');
  if (el) { el.style.display = ok ? 'block' : 'none'; }
  var msg = document.getElementById('fb-msg');
  if (msg) {
    msg.style.color = ok ? 'var(--g)' : 'var(--t2)';
    msg.textContent = ok ? '✓ Connected to project: ' + FB.projectId : 'Not configured.';
  }
  var ak = document.getElementById('fb-apikey'), pi = document.getElementById('fb-projectid');
  if (ak && FB.apiKey) ak.value = FB.apiKey;
  if (pi && FB.projectId) pi.value = FB.projectId;
}

// ── Firestore REST helpers ───────────────────────
function fbFirestoreGet(collectionPath, cb) {
  if (!FB.db) { cb(null); return; }
  fetch(FB.db.baseURL + '/' + collectionPath + '?key=' + FB.apiKey)
    .then(function(r) { return r.json(); })
    .then(function(d) { cb(d); })
    .catch(function() { cb(null); });
}

function fbFirestoreGetDoc(docPath, cb) {
  if (!FB.db) { cb(null); return; }
  fetch(FB.db.baseURL + '/' + docPath + '?key=' + FB.apiKey)
    .then(function(r) { return r.json(); })
    .then(function(d) { cb(d && !d.error ? d : null); })
    .catch(function() { cb(null); });
}

function fbFirestorePatch(docPath, fields, cb) {
  if (!FB.db) { if(cb) cb(null); return; }
  var url = FB.db.baseURL + '/' + docPath + '?key=' + FB.apiKey;
  var updateMask = Object.keys(fields).map(function(k) { return 'updateMask.fieldPaths=' + k; }).join('&');
  if (updateMask) url += '&' + updateMask;
  fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFirestoreFields(fields) })
  }).then(function(r) { return r.json(); })
    .then(function(d) { if(cb) cb(d); })
    .catch(function() { if(cb) cb(null); });
}

function fbFirestoreCreate(collectionPath, fields, cb) {
  if (!FB.db) { if(cb) cb(null); return; }
  fetch(FB.db.baseURL + '/' + collectionPath + '?key=' + FB.apiKey, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFirestoreFields(fields) })
  }).then(function(r) { return r.json(); })
    .then(function(d) { if(cb) cb(d); })
    .catch(function() { if(cb) cb(null); });
}

function fbFirestoreQuery(collectionPath, field, value, cb) {
  if (!FB.db) { cb(null); return; }
  var body = {
    structuredQuery: {
      from: [{ collectionId: collectionPath }],
      where: {
        fieldFilter: {
          field: { fieldPath: field },
          op: 'EQUAL',
          value: { stringValue: value }
        }
      },
      limit: 1
    }
  };
  var url = 'https://firestore.googleapis.com/v1/projects/' + FB.projectId + '/databases/(default)/documents:runQuery?key=' + FB.apiKey;
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(function(r) { return r.json(); })
    .then(function(d) { cb(d); })
    .catch(function() { cb(null); });
}

// ── Firestore type conversion ────────────────────
function toFirestoreFields(obj) {
  var fields = {};
  Object.keys(obj).forEach(function(k) {
    fields[k] = toFirestoreValue(obj[k]);
  });
  return fields;
}

function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } };
  if (typeof v === 'object') return { mapValue: { fields: toFirestoreFields(v) } };
  return { stringValue: String(v) };
}

function fromFirestoreFields(fields) {
  if (!fields) return null;
  var obj = {};
  Object.keys(fields).forEach(function(k) {
    obj[k] = fromFirestoreValue(fields[k]);
  });
  return obj;
}

function fromFirestoreValue(v) {
  if (!v) return null;
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return parseInt(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFirestoreValue);
  if ('mapValue' in v) return fromFirestoreFields(v.mapValue.fields);
  return null;
}

function extractDocData(doc) {
  if (!doc || !doc.fields) return null;
  return fromFirestoreFields(doc.fields);
}

// ── Join code generation ─────────────────────────
function generateJoinCode(cb) {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function tryCode() {
    var code = '';
    for (var i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    // Check uniqueness
    fbFirestoreQuery('matches', 'joinCode', code, function(results) {
      var taken = results && results[0] && results[0].document;
      if (taken) tryCode();
      else cb(code);
    });
  }
  tryCode();
}

// ── Host: Create match room ──────────────────────
function createMatchRoom(onCreated) {
  if (!FB.initialized) {
    // Offline mode — generate local code
    var localCode = 'L' + Math.floor(10000 + Math.random() * 90000);
    FB.isHost = true;
    FB.joinCode = localCode;
    G.joinCode = localCode;
    if (onCreated) onCreated(localCode);
    return;
  }
  generateJoinCode(function(code) {
    FB.joinCode = code;
    FB.isHost = true;
    var matchData = {
      joinCode: code,
      hostId: FB.deviceId,
      teams: G.tA + ' vs ' + G.tB,
      score: '0/0',
      overs: '0.0',
      status: 'live',
      createdAt: new Date().toISOString(),
      gameState: JSON.stringify(G),
      timerState: JSON.stringify({ iSec: T.iSec, oSec: T.oSec, ts: T.ts }),
      viewerCount: 0
    };
    fbFirestoreCreate('matches', matchData, function(doc) {
      if (doc && doc.name) {
        var docId = doc.name.split('/').pop();
        FB.matchDocRef = docId;
        G.joinCode = code;
        G.firestoreDocId = docId;
        saveLocal();
        if (onCreated) onCreated(code);
      } else {
        toast('Could not create room — check Firebase config');
      }
    });
  });
}

// ── Sync game state to Firestore (host only) ─────
function syncToFirestore() {
  if (!FB.initialized || !FB.isHost || !FB.matchDocRef) return;
  var inn = G.inn[G.cur];
  var scoreStr = inn ? (function(){
    var a = Math.max(0, inn.totalRuns + (G.penBonus[inn.bat]||0) - (G.penMinus[inn.bat]||0));
    return a + '/' + inn.wickets;
  })() : '0/0';
  var oversStr = inn ? getOv(inn.legalBalls) : '0.0';
  var updateData = {
    score: scoreStr,
    overs: oversStr,
    teams: G.tA + ' vs ' + G.tB,
    status: G.done ? 'completed' : 'live',
    gameState: JSON.stringify(G),
    timerState: JSON.stringify({ iSec: T.iSec, oSec: T.oSec, ts: Date.now() }),
    lastUpdate: new Date().toISOString()
  };
  fbFirestorePatch('matches/' + FB.matchDocRef, updateData);
}

// ── Viewer: Join by code ─────────────────────────
function joinMatchByCode(code, onFound, onNotFound) {
  if (!FB.initialized) {
    toast('Firebase not configured');
    return;
  }
  code = code.trim().toUpperCase();
  if (!code) { toast('Enter a join code'); return; }
  fbFirestoreQuery('matches', 'joinCode', code, function(results) {
    if (!results || !results[0] || !results[0].document) {
      if (onNotFound) onNotFound();
      return;
    }
    var doc = results[0].document;
    var docId = doc.name.split('/').pop();
    var data = extractDocData(doc);
    FB.joinCode = code;
    FB.isHost = (data.hostId === FB.deviceId);
    FB.matchDocRef = docId;
    if (onFound) onFound(data, docId);
    // Start real-time listener
    startRealtimeListener(docId);
  });
}

// ── Real-time listener (polling since REST API) ──
// Firestore REST doesn't support onSnapshot, so we use
// efficient polling (1s interval, only re-render on change)
var _listenerInterval = null;
var _lastStateHash = '';

function startRealtimeListener(docId) {
  stopRealtimeListener();
  _listenerInterval = setInterval(function() {
    fbFirestoreGetDoc('matches/' + docId, function(doc) {
      if (!doc) return;
      var data = extractDocData(doc);
      if (!data) return;
      var hash = data.lastUpdate || data.score + data.overs;
      if (hash !== _lastStateHash) {
        _lastStateHash = hash;
        onRealtimeUpdate(data);
      }
    });
  }, 1500); // poll every 1.5s — fast enough for live scoring
}

function stopRealtimeListener() {
  if (_listenerInterval) { clearInterval(_listenerInterval); _listenerInterval = null; }
  _lastStateHash = '';
}

function onRealtimeUpdate(data) {
  // If viewer — update the viewer UI
  if (!FB.isHost) {
    try {
      var vG = JSON.parse(data.gameState || 'null');
      if (vG) {
        renderVLive(vG);
        renderVSC(vG);
      }
    } catch(e) {}
  }
}

// ── Save leaderboard/saved to Firestore ─────────
function fbSaveLeaderboard(lb) {
  if (!FB.initialized) return;
  fbFirestorePatch('globals/leaderboard', { data: JSON.stringify(lb) });
}

function fbSaveMatch(entry) {
  if (!FB.initialized) return;
  fbFirestorePatch('savedMatches/' + entry.id, {
    id: entry.id, date: entry.date,
    tA: entry.tA, tB: entry.tB,
    result: entry.result || '',
    motm: entry.motm || '',
    snap: entry.snap
  });
}

// ── Mark match complete ──────────────────────────
function fbEndMatch() {
  if (!FB.initialized || !FB.isHost || !FB.matchDocRef) return;
  fbFirestorePatch('matches/' + FB.matchDocRef, { status: 'completed' });
}

// ── Viewer: load saved + LB from Firestore ───────
function fbLoadViewerExtras(onSaved, onLB) {
  if (!FB.initialized) return;
  fbFirestoreGetDoc('globals/leaderboard', function(doc) {
    if (doc) {
      var d = extractDocData(doc);
      if (d && d.data) { try { onLB(JSON.parse(d.data)); } catch(e) {} }
    }
  });
}
