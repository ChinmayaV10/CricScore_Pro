/* ════════════════════════════════════════════════
CricScore Pro — firebase.js (UPDATED)
Uses Firebase SDK + Anonymous Auth (NO REST)
════════════════════════════════════════════════ */

// ── Firebase config ─────────────────────────────
var FB = {
apiKey: '',
projectId: '',
initialized: false,
matchDocRef: null,
isHost: false,
deviceId: getDeviceId(),
joinCode: null
};

function loadFBCfg() {
  try {
    var c = JSON.parse(localStorage.getItem('cs6fbcfg2') || 'null');
    if (c && c.apiKey && c.projectId) {
      FB.apiKey = c.apiKey;
      FB.projectId = c.projectId;
      initFirebase();
    }
  } catch (e) {}
}

var app, db, auth;

// ── Device ID ───────────────────────────────────
function getDeviceId() {
var id = localStorage.getItem('cs6did');
if (!id) {
id = 'dev_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
localStorage.setItem('cs6did', id);
}
return id;
}

// ── Init Firebase ───────────────────────────────
async function initFirebase() {
if (!FB.apiKey || !FB.projectId) return;

const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
const { getAuth, signInAnonymously } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");

app = initializeApp({
apiKey: FB.apiKey,
projectId: FB.projectId
});

db = getFirestore(app);
auth = getAuth(app);

try {
await signInAnonymously(auth);
FB.initialized = true;
updateFBStatusUI();
toast('Firebase connected ✓');
} catch (e) {
  console.error(e);
  toast('Auth failed: ' + e.message);
}
}

// ── Save config ─────────────────────────────────
function saveFBCfg() {
var apiKey = (document.getElementById('fb-apikey') || {}).value;
var projectId = (document.getElementById('fb-projectid') || {}).value;

if (!apiKey || !projectId) {
toast('Enter API Key & Project ID');
return;
}

FB.apiKey = apiKey.trim();
FB.projectId = projectId.trim();

localStorage.setItem('cs6fbcfg2', JSON.stringify({
apiKey: FB.apiKey,
projectId: FB.projectId
}));

initFirebase();
}

// ── Create Match Room ───────────────────────────
async function createMatchRoom(onCreated) {
if (!FB.initialized) return;

const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");

var code = Math.random().toString(36).substring(2, 8).toUpperCase();

var matchData = {
joinCode: code,
hostId: FB.deviceId,
teams: G.tA + ' vs ' + G.tB,
score: '0/0',
overs: '0.0',
status: 'live',
createdAt: new Date().toISOString(),
gameState: JSON.stringify(G)
};

const ref = await addDoc(collection(db, "matches"), matchData);

FB.matchDocRef = ref.id;
FB.isHost = true;
FB.joinCode = code;

if (onCreated) onCreated(code);
}

// ── Sync Score (Host only) ──────────────────────
async function syncToFirestore() {
if (!FB.initialized || !FB.isHost || !FB.matchDocRef) return;

const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");

var inn = G.inn[G.cur];

var scoreStr = inn ? (inn.totalRuns + '/' + inn.wickets) : '0/0';
var oversStr = inn ? getOv(inn.legalBalls) : '0.0';

await updateDoc(doc(db, "matches", FB.matchDocRef), {
score: scoreStr,
overs: oversStr,
gameState: JSON.stringify(G),
lastUpdate: new Date().toISOString()
});
}

// ── Join Match ──────────────────────────────────
async function joinMatchByCode(code, onFound, onNotFound) {
if (!FB.initialized) return;

const { collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");

const q = query(collection(db, "matches"), where("joinCode", "==", code));
const snap = await getDocs(q);

if (snap.empty) {
if (onNotFound) onNotFound();
return;
}

const docSnap = snap.docs[0];

FB.matchDocRef = docSnap.id;
FB.isHost = (docSnap.data().hostId === FB.deviceId);

if (onFound) onFound(docSnap.data(), docSnap.id);

startRealtimeListener();
}

// ── Realtime Listener (SDK) ─────────────────────
var unsubscribe = null;

async function startRealtimeListener() {
const { doc, onSnapshot } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");

if (unsubscribe) unsubscribe();

unsubscribe = onSnapshot(doc(db, "matches", FB.matchDocRef), (docSnap) => {
const data = docSnap.data();

```
if (!FB.isHost && data) {
  try {
    var vG = JSON.parse(data.gameState);
    renderVLive(vG);
    renderVSC(vG);
  } catch (e) {}
}
```

});
}
