
let deferredPrompt;
const installBtn = document.getElementById('installBtn');
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.hidden = false;
});
installBtn?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.hidden = true;
});

// Image Library (local, in-memory + persisted metadata)
const fileInput = document.getElementById('fileInput');
const addSamplesBtn = document.getElementById('addSamplesBtn');
const clearBtn = document.getElementById('clearBtn');
const grid = document.getElementById('grid');
const targetImg = document.getElementById('targetImg');
const startBtn = document.getElementById('startBtn');
const timeLeft = document.getElementById('timeLeft');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const hintEl = document.getElementById('hint');

let library = []; // { url, id }
let roundImages = [];
let targetIndex = -1;
let timer = null;
let time = 60;
let score = 0;
let playing = false;

bestEl.textContent = localStorage.getItem('bestScore') || '0';

function saveLibraryMeta() {
  // Persist only data URLs (for uploaded images) with a cap to prevent overgrowth
  const saved = library.filter(x => x.url.startsWith('data:')).slice(0, 60);
  localStorage.setItem('library', JSON.stringify(saved));
}

function loadLibraryMeta() {
  try {
    const saved = JSON.parse(localStorage.getItem('library') || '[]');
    if (Array.isArray(saved)) {
      library = saved.map((x,i) => ({ url: x.url, id: x.id ?? ('saved-'+i+'-'+Date.now()) }));
    }
  } catch {}
}

function fileToDataURL(file) {
  return new Promise((resolve,reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

fileInput?.addEventListener('change', async (e) => {
  const files = [...(e.target.files || [])].slice(0, 60);
  for (const f of files) {
    const url = await fileToDataURL(f);
    library.push({ url, id: crypto.randomUUID() });
  }
  saveLibraryMeta();
  renderGrid();
  resetTarget();
});

clearBtn?.addEventListener('click', () => {
  if (!confirm('Clear your local image library?')) return;
  library = [];
  localStorage.removeItem('library');
  URL.revokeObjectURL(targetImg.src);
  targetImg.src = '';
  renderGrid();
});

addSamplesBtn?.addEventListener('click', async () => {
  // Load bundled samples (low-detail textures), cache via service worker
  const sampleNames = ['sample1.png','sample2.png','sample3.png','sample4.png','sample5.png','sample6.png'];
  for (const n of sampleNames) {
    const res = await fetch('/assets/samples/'+n);
    const blob = await res.blob();
    const url = await new Promise((resolve)=>{
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.readAsDataURL(blob);
    });
    library.push({ url, id: crypto.randomUUID() });
  }
  saveLibraryMeta();
  renderGrid();
  resetTarget();
});

function choice(arr, n) {
  const copy = arr.slice();
  const out = [];
  while (copy.length && out.length < n) {
    const i = Math.floor(Math.random()*copy.length);
    out.push(copy.splice(i,1)[0]);
  }
  return out;
}

function renderGrid() {
  grid.innerHTML = '';
  const imgs = library.slice();
  for (const item of imgs) {
    const div = document.createElement('div');
    div.className = 'tile';
    const img = document.createElement('img');
    img.src = item.url;
    img.alt = 'candidate';
    const btn = document.createElement('button');
    btn.addEventListener('click', () => onPick(item));
    div.appendChild(img);
    div.appendChild(btn);
    grid.appendChild(div);
  }
  if (imgs.length === 0) {
    hintEl.textContent = 'Add images with the button above, or load samples.';
  } else {
    hintEl.textContent = '';
  }
}

function resetTarget() {
  if (library.length < 1) { targetImg.src = ''; return; }
  // Select a round of up to 9 random images; pick a random target among them
  roundImages = choice(library, Math.min(9, library.length));
  const t = roundImages[Math.floor(Math.random()*roundImages.length)];
  targetIndex = t.id;
  targetImg.src = t.url;
}

function onPick(item) {
  if (!playing) return;
  if (item.id === targetIndex) {
    score++;
    scoreEl.textContent = String(score);
    resetTarget();
    // small flash or vibration
    if (window.navigator.vibrate) navigator.vibrate(30);
  } else {
    // penalty: brief time loss
    time = Math.max(0, time - 2);
    timeLeft.textContent = String(time);
    if (window.navigator.vibrate) navigator.vibrate([40, 40, 40]);
  }
}

function start() {
  if (library.length < 1) { alert('Load images first.'); return; }
  playing = true;
  score = 0;
  time = 60;
  scoreEl.textContent = '0';
  timeLeft.textContent = '60';
  resetTarget();
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    time--;
    timeLeft.textContent = String(time);
    if (time <= 0) {
      clearInterval(timer);
      playing = false;
      const best = parseInt(localStorage.getItem('bestScore') || '0', 10);
      if (score > best) {
        localStorage.setItem('bestScore', String(score));
        bestEl.textContent = String(score);
        alert('Time! New best score: '+score);
      } else {
        alert('Time! Score: '+score+'  (Best: '+best+')');
      }
    }
  }, 1000);
}

startBtn?.addEventListener('click', start);

// Boot
loadLibraryMeta();
renderGrid();
resetTarget();

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(console.error);
  });
}
