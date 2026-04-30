/* ═══════════════════════════════════════════════════════
   CricScore Pro — firebase.js
   Hardcoded Firebase config · REST API · Real-time sync
   Admin code system · No UI config exposed
   ═══════════════════════════════════════════════════════ */

// ── ⚠️  REPLACE THESE VALUES WITH YOUR FIREBASE PROJECT ──
var _FB_API_KEY    = 'AIzaSyCLCEne8x6emwB5RSeDWOHlFENxbIYXFZo';
var _FB_PROJECT_ID = 'cricscore-pro-61bce';
// ─────────────────────────────────────────────────────────

// ── Device identity (UUID, never changes) ────────────────
var _deviceId = (function() {
  var k = 'cs_deviceId';
  var id = localStorage.getItem(k);
  if (!id) {
    id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    localStorage.setItem(k, id);
  }
  return id;
})();

// ── Firebase state ────────────────────────────────────────
var FB = {
  initialized: false,
  baseURL: 'https://firestore.googleapis.com/v1/projects/' + _FB_PROJECT_ID + '/databases/(default)/documents',
  runQueryURL: 'https://firestore.googleapis.com/v1/projects/' + _FB_PROJECT_ID + '/databases/(default)/documents:runQuery',
  isHost: false,
  deviceId: _deviceId,
  joinCode: null,
  matchDocRef: null
};

// ── Auto-init on load ─────────────────────────────────────
(function initFirebase() {
  try {
    var testURL = FB.baseURL + '/matches?pageSize=1&key=' + _FB_API_KEY;
    fetch(testURL).then(function(r) {
      if (r.ok || r.status === 400) {
        FB.initialized = true;
        var dot = document.getElementById('fb-dot');
        if (dot) { dot.style.background = '#39ff7a'; dot.title = 'Firebase live'; }
        console.log('[CricScore] Firebase ready · device:', _deviceId);
      }
    }).catch(function() {});
  } catch(e) {}
})();

// ═══════════════════════════════════════════════════════
// Firestore REST helpers
// ═══════════════════════════════════════════════════════

function _fsGet(path, cb) {
  fetch(FB.baseURL + '/' + path + '?key=' + _FB_API_KEY)
    .then(function(r) { return r.json(); })
    .then(function(d) { cb(d && !d.error ? d : null); })
    .catch(function() { cb(null); });
}

function _fsPatch(path, fields, cb) {
  var mask = Object.keys(fields).map(function(k) { return 'updateMask.fieldPaths=' + encodeURIComponent(k); }).join('&');
  var url = FB.baseURL + '/' + path + '?key=' + _FB_API_KEY + (mask ? '&' + mask : '');
  fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: _toFSFields(fields) })
  }).then(function(r) { return r.json(); })
    .then(function(d) { if (cb) cb(d && !d.error ? d : null); })
    .catch(function() { if (cb) cb(null); });
}

function _fsCreate(collection, fields, cb) {
  fetch(FB.baseURL + '/' + collection + '?key=' + _FB_API_KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: _toFSFields(fields) })
  }).then(function(r) { return r.json(); })
    .then(function(d) { if (cb) cb(d && !d.error ? d : null); })
    .catch(function() { if (cb) cb(null); });
}

function _fsDelete(path, cb) {
  fetch(FB.baseURL + '/' + path + '?key=' + _FB_API_KEY, { method: 'DELETE' })
    .then(function() { if (cb) cb(true); })
    .catch(function() { if (cb) cb(false); });
}

function _fsQuery(collection, field, op, value, limit, cb) {
  op = op || 'EQUAL';
  var valObj = typeof value === 'boolean' ? { booleanValue: value }
             : typeof value === 'number'  ? { doubleValue: value }
             : { stringValue: value };
  var body = {
    structuredQuery: {
      from: [{ collectionId: collection }],
      where: { fieldFilter: { field: { fieldPath: field }, op: op, value: valObj } }
    }
  };
  if (limit) body.structuredQuery.limit = limit;
  fetch(FB.runQueryURL + '?key=' + _FB_API_KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).then(function(r) { return r.json(); })
    .then(function(d) { cb(d); })
    .catch(function() { cb(null); });
}

function _fsQueryAll(collection, cb) {
  fetch(FB.baseURL + '/' + collection + '?key=' + _FB_API_KEY + '&pageSize=200')
    .then(function(r) { return r.json(); })
    .then(function(d) { cb(d && d.documents ? d.documents : []); })
    .catch(function() { cb([]); });
}

// ── Type conversion: JS → Firestore ──────────────────────
function _toFSFields(obj) {
  var out = {};
  Object.keys(obj).forEach(function(k) { out[k] = _toFSVal(obj[k]); });
  return out;
}
function _toFSVal(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number')  return { doubleValue: v };
  if (typeof v === 'string')  return { stringValue: v };
  if (Array.isArray(v))       return { arrayValue: { values: v.map(_toFSVal) } };
  if (typeof v === 'object')  return { mapValue: { fields: _toFSFields(v) } };
  return { stringValue: String(v) };
}

// ── Type conversion: Firestore → JS ──────────────────────
function _fromFSDoc(doc) {
  if (!doc || !doc.fields) return null;
  return _fromFSFields(doc.fields);
}
function _fromFSFields(fields) {
  if (!fields) return null;
  var out = {};
  Object.keys(fields).forEach(function(k) { out[k] = _fromFSVal(fields[k]); });
  return out;
}
function _fromFSVal(v) {
  if (!v) return null;
  if ('nullValue'      in v) return null;
  if ('booleanValue'   in v) return v.booleanValue;
  if ('integerValue'   in v) return parseInt(v.integerValue);
  if ('doubleValue'    in v) return v.doubleValue;
  if ('stringValue'    in v) return v.stringValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('arrayValue'     in v) return (v.arrayValue.values || []).map(_fromFSVal);
  if ('mapValue'       in v) return _fromFSFields(v.mapValue.fields);
  return null;
}

// ═══════════════════════════════════════════════════════
// Real-time polling (simulates onSnapshot via REST)
// ═══════════════════════════════════════════════════════
var _pollInterval = null;
var _lastHash = '';

function startRealtimeListener(docId) {
  stopRealtimeListener();
  _pollInterval = setInterval(function() {
    _fsGet('matches/' + docId, function(doc) {
      var data = _fromFSDoc(doc);
      if (!data) return;
      var hash = (data.lastUpdated || '') + (data.score || '') + (data.overs || '');
      if (hash === _lastHash) return;
      _lastHash = hash;
      if (!FB.isHost && data.gameState) {
        try {
          var vG = JSON.parse(data.gameState);
          if (typeof renderVLive === 'function') renderVLive(vG);
          if (typeof renderVSC   === 'function') renderVSC(vG);
        } catch(e) {}
      }
    });
  }, 1500);
}

function stopRealtimeListener() {
  if (_pollInterval) { clearInterval(_pollInterval); _pollInterval = null; }
  _lastHash = '';
}

// ═══════════════════════════════════════════════════════
// Join-code generation (unique)
// ═══════════════════════════════════════════════════════
function _generateCode(cb) {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function attempt() {
    var code = '';
    for (var i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    _fsQuery('matches', 'joinCode', 'EQUAL', code, 1, function(res) {
      var taken = res && res[0] && res[0].document;
      if (taken) attempt(); else cb(code);
    });
  }
  attempt();
}

// ═══════════════════════════════════════════════════════
// Host: create room
// ═══════════════════════════════════════════════════════
function createMatchRoom(onCreated) {
  if (!FB.initialized) {
    var fallback = 'L' + Math.floor(10000 + Math.random() * 90000);
    FB.isHost = true; FB.joinCode = fallback; G.joinCode = fallback;
    if (onCreated) onCreated(fallback);
    return;
  }
  _generateCode(function(code) {
    FB.joinCode = code; FB.isHost = true;
    var inn = G.inn[G.cur];
    _fsCreate('matches', {
      joinCode:    code,
      hostId:      FB.deviceId,
      teams:       G.tA + ' vs ' + G.tB,
      score:       '0/0',
      overs:       '0.0',
      status:      'live',
      createdAt:   new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      gameState:   JSON.stringify(G)
    }, function(doc) {
      if (doc && doc.name) {
        var id = doc.name.split('/').pop();
        FB.matchDocRef = id;
        G.joinCode = code; G.firestoreDocId = id;
        saveLocal();
        if (onCreated) onCreated(code);
      } else {
        // Firestore failed — still proceed offline
        G.joinCode = code;
        if (onCreated) onCreated(code);
      }
    });
  });
}

// ═══════════════════════════════════════════════════════
// Sync state to Firestore (host only, throttled)
// ═══════════════════════════════════════════════════════
var _syncThrottle = null;
function syncToFirestore() {
  if (!FB.initialized || !FB.isHost || !FB.matchDocRef) return;
  clearTimeout(_syncThrottle);
  _syncThrottle = setTimeout(function() {
    var inn = G.inn[G.cur];
    var scoreStr = inn ? (adjS(inn) + '/' + inn.wickets) : '0/0';
    var oversStr = inn ? getOv(inn.legalBalls) : '0.0';
    _fsPatch('matches/' + FB.matchDocRef, {
      score:       scoreStr,
      overs:       oversStr,
      teams:       G.tA + ' vs ' + G.tB,
      status:      G.done ? 'completed' : 'live',
      gameState:   JSON.stringify(G),
      lastUpdated: new Date().toISOString()
    });
  }, 400); // batch rapid clicks into one write
}

// ═══════════════════════════════════════════════════════
// Viewer: join by code
// ═══════════════════════════════════════════════════════
function joinMatchByCode(code, onFound, onNotFound) {
  code = code.trim().toUpperCase();
  if (!code) { toast('Enter a join code'); return; }
  _fsQuery('matches', 'joinCode', 'EQUAL', code, 1, function(res) {
    if (!res || !res[0] || !res[0].document) {
      if (onNotFound) onNotFound(); return;
    }
    var doc  = res[0].document;
    var docId = doc.name.split('/').pop();
    var data  = _fromFSDoc(doc);
    FB.joinCode    = code;
    FB.isHost      = (data.hostId === FB.deviceId);
    FB.matchDocRef = docId;
    if (onFound) onFound(data, docId);
    startRealtimeListener(docId);
  });
}

// ═══════════════════════════════════════════════════════
// Misc helpers
// ═══════════════════════════════════════════════════════
function fbEndMatch() {
  if (!FB.initialized || !FB.isHost || !FB.matchDocRef) return;
  _fsPatch('matches/' + FB.matchDocRef, { status: 'completed', lastUpdated: new Date().toISOString() });
}
function fbSaveLeaderboard(lb) {
  if (!FB.initialized) return;
  _fsPatch('globals/leaderboard', { data: JSON.stringify(lb) });
}
function fbSaveMatch(entry) {
  if (!FB.initialized) return;
  _fsPatch('savedMatches/' + entry.id, {
    id: entry.id, date: entry.date, tA: entry.tA, tB: entry.tB,
    result: entry.result || '', motm: entry.motm || '', snap: entry.snap
  });
}
function fbLoadViewerExtras(_, onLB) {
  if (!FB.initialized) return;
  _fsGet('globals/leaderboard', function(doc) {
    var d = _fromFSDoc(doc);
    if (d && d.data) { try { if (onLB) onLB(JSON.parse(d.data)); } catch(e) {} }
  });
}

// ═══════════════════════════════════════════════════════
// ADMIN SYSTEM
// ═══════════════════════════════════════════════════════
function openAdminPrompt() {
  var el = document.getElementById('ov-admin');
  if (el) {
    document.getElementById('admin-inp').value = '';
    document.getElementById('admin-err').style.display = 'none';
    el.style.display = 'flex';
  }
}
function closeAdminPrompt() {
  var el = document.getElementById('ov-admin');
  if (el) el.style.display = 'none';
}
function submitAdminCode() {
  var entered = (document.getElementById('admin-inp') || {}).value || '';
  entered = entered.trim();
  if (!entered) { toast('Enter admin code'); return; }
  var errEl = document.getElementById('admin-err');
  // Fetch code from Firestore config/admin
  _fsGet('config/admin', function(doc) {
    var data = _fromFSDoc(doc);
    if (!data || !data.code) {
      if (errEl) { errEl.textContent = 'Admin not configured in Firestore'; errEl.style.display = 'block'; }
      return;
    }
    if (entered === data.code) {
      sessionStorage.setItem('cs_admin_auth', '1');
      sessionStorage.setItem('cs_admin_ts', Date.now().toString());
      closeAdminPrompt();
      window.location.href = 'admin-login.html';
    } else {
      if (errEl) { errEl.textContent = 'Access Denied — incorrect code'; errEl.style.display = 'block'; }
    }
  });
}
// Allow Enter in admin input
document.addEventListener('DOMContentLoaded', function() {
  var inp = document.getElementById('admin-inp');
  if (inp) inp.addEventListener('keydown', function(e) { if (e.key === 'Enter') submitAdminCode(); });
});

// Backward-compat aliases
function loadFBCfg() {}           // no-op — config is hardcoded
function updateFBStatusUI() {}    // no-op — no setup UI
function getDeviceId() { return _deviceId; }
var extractDocData = _fromFSDoc;
