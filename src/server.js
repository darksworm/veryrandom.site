const dotenv = require('dotenv');
const express = require('express');
const fs = require('fs');
const { loadPages } = require('./cache');

dotenv.config({ override: true });

const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use('/assets', express.static(path.join(__dirname, '..', 'public', 'assets'), { maxAge: '7d' }));
app.get('/favicon.svg', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'favicon.svg')));
app.use(express.json());

let pages = [];

// --- Votes ---
const VOTES_PATH = path.join(__dirname, '..', 'cache', 'votes.json');

function loadVotes() {
  try { return JSON.parse(fs.readFileSync(VOTES_PATH, 'utf8')); }
  catch { return {}; }
}
function saveVotes(votes) {
  fs.writeFileSync(VOTES_PATH, JSON.stringify(votes, null, 2));
}

let votes = loadVotes(); // { [pageId]: { up: number, down: number } }

// --- IP rate limit: 30 votes per hour ---
const ipVotes = new Map(); // ip -> [timestamps]
const RATE_WINDOW = 60 * 60 * 1000;
const RATE_MAX = 30;

function checkRateLimit(ip) {
  const now = Date.now();
  let timestamps = ipVotes.get(ip) || [];
  timestamps = timestamps.filter(t => now - t < RATE_WINDOW);
  ipVotes.set(ip, timestamps);
  if (timestamps.length >= RATE_MAX) return false;
  timestamps.push(now);
  return true;
}

function getIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
}

// --- Extract h1 from HTML for titles ---
function extractH1(html) {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!m) return null;
  return m[1].replace(/<[^>]+>/g, '').trim().slice(0, 120);
}

// --- Better randomizer: shuffle bag, no repeats ---
let shuffleBag = [];
function pickRandom() {
  if (!pages.length) return null;
  if (shuffleBag.length === 0) {
    shuffleBag = [...pages].sort(() => Math.random() - 0.5);
  }
  return shuffleBag.pop();
}

function injectOverlay(html, pageId) {
  const v = votes[pageId] || { up: 0, down: 0 };
  const favicon = `<link rel="icon" href="/favicon.svg" type="image/svg+xml">`;
  const snippet = `${html.includes('<head>') ? '' : favicon}<div id="__overlay-host"></div>
<script>
(function(){
  var pid='${pageId}';
  var host=document.getElementById('__overlay-host');
  var shadow=host.attachShadow({mode:'closed'});
  shadow.innerHTML='<style>:host{position:fixed;bottom:16px;right:16px;z-index:99999;}*{margin:0;padding:0;box-sizing:border-box;font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1;}#bar{display:flex;gap:8px;align-items:center;background:rgba(0,0,0,0.88);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);padding:10px 14px;border-radius:12px;border:1px solid rgba(255,255,255,0.15);}button{all:unset;display:inline-flex;align-items:center;gap:5px;background:#222;color:#ddd;border:1px solid #555;padding:10px 16px;border-radius:8px;cursor:pointer;font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1;box-shadow:0 2px 6px rgba(0,0,0,0.4);transition:border-color 0.15s;}button:hover{background:#333;}</style><div id="bar"><button id="up">&#9650; <span id="uc">${v.up}</span></button><button id="dn">&#9660; <span id="dc">${v.down}</span></button><button id="sh">Share</button><button id="tp">Top</button><button id="nx">Next slop &#8594;</button></div>';
  var upBtn=shadow.getElementById('up'),dnBtn=shadow.getElementById('dn'),shBtn=shadow.getElementById('sh');
  var uc=shadow.getElementById('uc'),dc=shadow.getElementById('dc');
  var voted=JSON.parse(localStorage.getItem('__votes')||'{}');
  function hl(){
    var v=voted[pid];
    upBtn.style.borderColor=v==='up'?'#4f4':'#555';
    dnBtn.style.borderColor=v==='down'?'#f44':'#555';
  }
  hl();
  function vote(dir){
    var prev=voted[pid];
    if(prev===dir)return;
    var x=new XMLHttpRequest();
    x.open('POST','/api/vote');
    x.setRequestHeader('Content-Type','application/json');
    x.onload=function(){
      if(x.status===200){
        var r=JSON.parse(x.responseText);
        uc.textContent=r.up;dc.textContent=r.down;
        voted[pid]=dir;
        localStorage.setItem('__votes',JSON.stringify(voted));
        hl();
      } else {
        var b=dir==='up'?upBtn:dnBtn;var old=b.innerHTML;
        b.textContent='Limit hit';setTimeout(function(){b.innerHTML=old},1200);
      }
    };
    x.send(JSON.stringify({pageId:pid,dir:dir,prev:prev||null}));
  }
  upBtn.addEventListener('click',function(){vote('up')});
  dnBtn.addEventListener('click',function(){vote('down')});
  shadow.getElementById('tp').addEventListener('click',function(){location.href='/top';});
  shadow.getElementById('nx').addEventListener('click',function(){location.href='/random';});
  shBtn.addEventListener('click',function(){
    var u=location.origin+'/page/'+pid;
    navigator.clipboard.writeText(u).then(function(){
      shBtn.textContent='Copied!';
      setTimeout(function(){shBtn.textContent='Share'},1200);
    });
  });
})();
</script>`;
  let out = html;
  if (out.includes('<head>')) {
    out = out.replace('<head>', '<head>' + favicon);
  }
  if (out.includes('</body>')) {
    return out.replace('</body>', snippet + '</body>');
  }
  return out + snippet;
}

async function refreshCache() {
  const raw = await loadPages();
  pages = raw.filter((page) => typeof page?.html === 'string' && page.html.trim().length > 0);
  shuffleBag = []; // reset so new pages get shuffled in
  console.log(`[server] Loaded ${pages.length} cached HTML page(s)`);
}

function renderNoCachePage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>No Cached Pages</title>
  <style>
    body {
      margin: 0;
      font-family: ui-monospace, Menlo, Consolas, monospace;
      background: #090909;
      color: #f4f4f4;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
    }
    .box {
      max-width: 780px;
      border: 1px solid #333;
      border-radius: 12px;
      padding: 18px;
      background: #111;
    }
    code { color: #79f4c0; }
  </style>
</head>
<body>
  <main class="box">
    <h1>No cached hallucinations yet</h1>
    <p>Start generator in a separate process, then refresh:</p>
    <p><code>npm run generate:daemon</code></p>
    <p>or one-time:</p>
    <p><code>npm run generate -- --count 20 --chaos 0.95</code></p>
  </main>
</body>
</html>`;
}

// --- Landing page ---
const LANDING_PATH = path.join(__dirname, '..', 'public', 'landing.html');
let landingHtml = fs.readFileSync(LANDING_PATH, 'utf8');

// Hot-reload landing page in dev
fs.watch(LANDING_PATH, () => {
  try { landingHtml = fs.readFileSync(LANDING_PATH, 'utf8'); } catch {}
});

app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.type('html').send(landingHtml);
});

app.get('/random', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (!pages.length) {
    res.status(503).type('html').send(renderNoCachePage());
    return;
  }

  const page = pickRandom();
  res
    .status(200)
    .type('html')
    .setHeader('X-Hallucination-Id', page.id)
    .setHeader('X-Hallucination-Mode', page.mode || 'unknown')
    .send(injectOverlay(page.html, page.id));
});

app.get('/page/:id', (req, res) => {
  const page = pages.find((item) => item.id === req.params.id);
  if (!page) {
    res.status(404).json({ error: 'Page not found in cache' });
    return;
  }

  res
    .status(200)
    .type('html')
    .setHeader('Cache-Control', 'no-store, max-age=0')
    .setHeader('X-Hallucination-Id', page.id)
    .setHeader('X-Hallucination-Mode', page.mode || 'unknown')
    .send(injectOverlay(page.html, page.id));
});

app.get('/top', (req, res) => {
  const ranked = pages
    .map(p => {
      const v = votes[p.id] || { up: 0, down: 0 };
      return { id: p.id, title: extractH1(p.html) || p.title || p.id, up: v.up, down: v.down, score: v.up - v.down };
    })
    .sort((a, b) => b.score - a.score || b.up - a.up)
    .slice(0, 50);

  const rows = ranked.map((p, i) => `
    <tr>
      <td class="rank">${i + 1}</td>
      <td><a href="/page/${p.id}">${p.title}</a></td>
      <td class="up">${p.up}</td>
      <td class="down">${p.down}</td>
      <td class="score">${p.score > 0 ? '+' : ''}${p.score}</td>
    </tr>`).join('');

  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>top slop</title>
  <link rel="stylesheet" href="/assets/css/fonts.css" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0a0a0a;
      color: #e8e8e8;
      font-family: 'Space Grotesk', system-ui, sans-serif;
      min-height: 100vh;
      padding: 40px 20px;
    }
    .wrap { max-width: 700px; margin: 0 auto; }
    h1 {
      font-size: 2.2rem;
      font-weight: 700;
      margin-bottom: 8px;
      letter-spacing: -0.02em;
    }
    .sub {
      color: #555;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 13px;
      margin-bottom: 32px;
    }
    .sub a { color: #888; text-decoration: none; border-bottom: 1px solid #333; }
    .sub a:hover { color: #ccc; }
    table { width: 100%; border-collapse: collapse; }
    th {
      text-align: left;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #555;
      padding: 8px 12px;
      border-bottom: 1px solid #222;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #151515;
      font-size: 0.95rem;
    }
    td a {
      color: #e8e8e8;
      text-decoration: none;
      border-bottom: 1px solid #333;
      transition: border-color 0.15s;
    }
    td a:hover { border-color: #a78bfa; color: #a78bfa; }
    .rank { color: #444; font-family: 'IBM Plex Mono', monospace; font-size: 13px; width: 40px; }
    .up { color: #4f4; font-family: 'IBM Plex Mono', monospace; font-size: 14px; width: 60px; }
    .down { color: #f44; font-family: 'IBM Plex Mono', monospace; font-size: 14px; width: 60px; }
    .score { color: #a78bfa; font-family: 'IBM Plex Mono', monospace; font-size: 14px; font-weight: 700; width: 60px; }
    tr:first-child td { padding-top: 16px; }
    tr:first-child .rank { font-size: 16px; color: #ffd700; }
    .empty { color: #444; padding: 40px; text-align: center; font-style: italic; }
    .actions { margin-bottom: 32px; display: flex; gap: 12px; }
    .btn {
      display: inline-block;
      font-family: 'Space Grotesk', sans-serif;
      font-size: 0.95rem;
      font-weight: 600;
      color: #000;
      background: #fff;
      padding: 10px 24px;
      border-radius: 99px;
      text-decoration: none;
      transition: transform 0.1s;
    }
    .btn:hover { transform: scale(1.04); }
    .btn.ghost { background: none; color: #888; border: 1px solid #333; }
    .btn.ghost:hover { color: #ccc; border-color: #555; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>top slop</h1>
    <p class="sub">ranked by votes &middot; <a href="/">home</a></p>
    <div class="actions">
      <a href="/random" class="btn">slop me</a>
      <a href="/" class="btn ghost">home</a>
    </div>
    ${ranked.length ? `<table>
      <thead><tr><th>#</th><th>page</th><th>up</th><th>down</th><th>score</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>` : '<div class="empty">no votes yet. go slop some pages first.</div>'}
  </div>
</body>
</html>`);
});

app.post('/api/vote', (req, res) => {
  const { pageId, dir, prev } = req.body;
  if (!pageId || !['up', 'down'].includes(dir)) {
    return res.status(400).json({ error: 'Bad request' });
  }

  const ip = getIp(req);
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  if (!votes[pageId]) votes[pageId] = { up: 0, down: 0 };

  // undo previous vote if switching
  if (prev === 'up') votes[pageId].up = Math.max(0, votes[pageId].up - 1);
  if (prev === 'down') votes[pageId].down = Math.max(0, votes[pageId].down - 1);

  votes[pageId][dir]++;
  saveVotes(votes);

  res.json(votes[pageId]);
});

app.get('/api/stats', (req, res) => {
  res.json({
    count: pages.length,
    newest: pages[0]?.createdAt || null,
    sample: pages[0]
      ? {
          id: pages[0].id,
          title: pages[0].title,
          mode: pages[0].mode,
        }
      : null,
  });
});

app.listen(PORT, async () => {
  await refreshCache();
  setInterval(refreshCache, 3000);
  console.log(`[server] Listening on http://localhost:${PORT}`);
});
