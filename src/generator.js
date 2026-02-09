const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const dotenv = require('dotenv');
const { chromium } = require('playwright');
const { getCacheCount, savePage } = require('./cache');

dotenv.config({ override: true });

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Composable idea fragments — SUBJECTS, ACTIONS, and MODIFIERS get mixed randomly
const IDEA_SUBJECTS = [
  // animals & cats
  'a cat',  'a very old cat', 'a committee of cats', 'a cat who is also a lawyer',
  'a cat landlord', 'a cat restaurant critic', 'a cat financial advisor', 'a cat therapist',
  'a cat who runs a nightclub', 'a cat detective agency', 'a cat-operated airline',
  'a council of pigeons', 'a dog who thinks it is a CEO', 'a parrot HR department',
  'raccoons in business suits', 'a hamster day-trading operation', 'a fish think tank',
  'a goose consulting firm', 'a crow judicial system', 'an octopus architect',
  // people & roles
  'a retired astronaut', 'a confused wizard', 'a suburban dad', 'a bored librarian',
  'a rogue dentist', 'an overly enthusiastic intern', 'a passive-aggressive neighbor',
  'a grandma who is a hacker', 'a toddler dictator', 'a mime union leader',
  'a disgraced weatherman', 'a sleep-deprived nurse', 'a paranoid accountant',
  'a cheerful undertaker', 'a competitive knitter', 'a monk with WiFi',
  'a sentient HR manual', 'twin rival bakers', 'a barista philosopher',
  'a plumber who speaks only in riddles',
  // objects & concepts
  'a haunted spreadsheet', 'a sentient IKEA shelf', 'a self-aware to-do list',
  'a passive-aggressive smart fridge', 'a printer with opinions', 'a GPS with trust issues',
  'a microwave that judges you', 'a roomba with ambition', 'a thermostat cult',
  'a vending machine with feelings', 'a traffic light support group',
  'an elevator with a podcast', 'a doorbell with anxiety', 'a lamp with a manifesto',
  'a clock that lies', 'a toilet that gives TED talks', 'a blender going through a phase',
  // organizations
  'a DMV for ghosts', 'a hospital for feelings', 'a post office for secrets',
  'a library of smells', 'a museum of failures', 'a bank that trades in favors',
  'a school for inanimate objects', 'a gym for emotional muscles',
  'a church of mild inconvenience', 'a prison for bad fonts',
  'a zoo where humans are the exhibit', 'a spa for burnt-out AIs',
  'a fire department for mixtapes', 'a kindergarten for retired supervillains',
  'a laundromat that washes memories', 'a pharmacy for existential dread',
];

const IDEA_ACTIONS = [
  // services
  'launches a subscription service', 'opens an online store', 'starts a podcast',
  'runs a dating app', 'operates a delivery service', 'manages a hotel chain',
  'publishes a newspaper', 'hosts a game show', 'runs for mayor',
  'starts a crowdfunding campaign', 'launches a cryptocurrency',
  'opens a theme park', 'starts an airline', 'runs a cooking show',
  'offers financial advice', 'creates a fitness program', 'opens a law firm',
  'starts a religion', 'launches a space program on a budget',
  'organizes a music festival', 'runs a tech startup', 'opens a casino',
  'starts a fashion label', 'creates a social network', 'builds a city',
  'runs a reality TV show', 'offers therapy sessions', 'starts a revolution',
  'writes self-help books', 'runs a bed and breakfast', 'opens a detective agency',
  'manages a boy band', 'runs a funeral home with a twist', 'starts a book club',
  'launches a weather service', 'runs a talent show', 'opens a tattoo parlor',
  'starts an insurance company', 'runs a pawn shop', 'creates a language',
];

const IDEA_MODIFIERS = [
  // constraints
  'but everything is upside down', 'but all communication is through interpretive dance',
  'but the currency is compliments', 'but it only operates during full moons',
  'but all reviews are written as haiku', 'but the staff are all ghosts',
  'but everything must rhyme', 'but the building keeps moving',
  'but customers must solve a riddle to enter', 'but all transactions happen underwater',
  'but everything is miniature', 'but it exists only in dreams',
  'but all documents are written in crayon', 'but the wifi password is a dance move',
  'but it is from the year 3000', 'but in a world where gravity is optional',
  'but everyone has amnesia', 'but all meetings happen in a hot air balloon',
  'but cats are in charge of quality control', 'but the soundtrack never stops',
  'but everything is cake', 'but time runs backwards on Tuesdays',
  'but the entire thing is run from a bathtub', 'but nothing is allowed to be beige',
  'but the dress code is medieval armor', 'but payment is accepted in soup',
  'but every surface is covered in moss', 'but it smells incredible for no reason',
  'but there is a live jazz band at all times', 'but the founder is a very confident goldfish',
  'but all employees are different versions of the same person',
  'but the menu changes based on the tides', 'but complaints are handled by a ouija board',
  'but the whole thing is inside a snow globe', 'but mascots roam freely and cannot be stopped',
  'but cats keep knocking everything off the shelves',
  'but a cat sits on the keyboard and alters every transaction',
  'but there is always a cat sleeping on the most important document',
];

function composeSeed(chaos) {
  const subject = randomOf(IDEA_SUBJECTS);
  const action = randomOf(IDEA_ACTIONS);
  const modCount = chaos >= 0.75 ? 2 : chaos >= 0.45 ? 1 : 0;
  const mods = takeRandom(IDEA_MODIFIERS, modCount);
  const parts = [`${subject} ${action}`];
  for (const mod of mods) parts.push(mod);
  return parts.join(', ');
}

const STYLE_AXES = [
  'brutalist carnival finance',
  'retrofuturist municipal opera',
  'biohazard luxury minimalism',
  'evangelical cyberpunk folklore',
  'bureaucratic dreamcore logistics',
  'desert maximalist weather-tech',
  'nautical posthuman infomercial',
  'esoteric industrial civic branding',
  'interdimensional late-night shopping channel',
  'neo-medieval UX cult handbook',
  'pastel corporate wellness dystopia',
  'glitchcore Y2K government portal',
  'art deco space colony tourism board',
  'vaporwave dental insurance',
  'soviet constructivist SaaS platform',
  'tropical noir detective agency',
  'cottagecore military logistics',
  'Memphis Group pharmaceutical catalog',
  'Swiss International Style alien embassy',
  'psychedelic 1970s tax preparation',
  'Windows 95 luxury fashion house',
  'Bauhaus underwater real estate',
  'neon noir public library system',
  'maximalist Victorian data center',
  'flat design occult supply shop',
  'skeuomorphic cloud kingdom passport office',
  'grunge zine cryptocurrency exchange',
  'corporate Memphis existential crisis hotline',
  'geocities-era astral projection academy',
  'minimalist brutalist wedding planner',
];

const COLOR_DIRECTIONS = [
  'monochrome with one violent accent color',
  'warm earth tones like terracotta, sand, and olive',
  'neon on pitch black',
  'pastel rainbow gradient everywhere',
  'newspaper black and white with red highlights',
  'deep ocean blues and bioluminescent greens',
  'sunset palette: coral, gold, purple, deep blue',
  'clinical white with surgical green accents',
  'burnt orange and midnight purple',
  'candy colors: hot pink, electric blue, lime green',
  'sepia and aged parchment tones',
  'toxic: acid green, warning yellow, hazard orange',
  'ice cold: pale blue, silver, white, frost',
  'forest: dark green, moss, bark brown, mushroom beige',
  'retrowave: magenta, cyan, chrome, dark purple',
];

const LAYOUT_TYPES = [
  'single column with massive typography',
  'dense dashboard grid with many small panels',
  'asymmetric magazine layout with overlapping sections',
  'full-screen sections that scroll like slides',
  'sidebar-heavy admin panel aesthetic',
  'centered narrow column like a legal document',
  'chaotic overlapping windows like a cluttered desktop',
  'card-based masonry layout',
  'split screen with contrasting halves',
  'terminal/console aesthetic with monospace everything',
  'newspaper multi-column with headlines',
  'single giant scrolling table',
];

const SITE_LAWS = [
  'All buttons must negotiate before being clicked.',
  'The footer is legally allowed to predict personal weather.',
  'Product cards must include one impossible warranty clause.',
  'Navigation links can move while the user reads them.',
  'At least one section must be authored by a nonhuman committee.',
  'Pricing tiers must include exactly one metaphysical payment method.',
  'A/B tests are run by folklore creatures with no statistical training.',
  'The hero statement must be both credible and absurd.',
  'The FAQ should contain one answer that is only a ritual.',
  'Trust badges are issued by fictional departments.',
];

const ARTIFACTS = [
  'ghost cookie banner',
  'self-updating legal disclaimer',
  'hyperactive breadcrumb trail',
  'cart abandonment prophecy',
  'animated zoning permit',
  'sentient uptime graph',
  'decomposing design token registry',
  'shapeshifting search bar',
  'haunted onboarding checklist',
  'reversible terms-of-service accordion',
];

const TABOO_WORDS = [
  'innovative',
  'cutting-edge',
  'revolutionary',
  'seamless',
  'next-gen',
  'user-centric',
  'synergy',
  'disruptive',
  'state-of-the-art',
  'future-proof',
];

const LOCAL_COLORS = [
  { bg: '#0a0014', fg: '#f2f1ff', accent: '#ff6a00', card: '#22063d' },
  { bg: '#00151f', fg: '#dcfff8', accent: '#f97316', card: '#012a36' },
  { bg: '#140b00', fg: '#ffe9c9', accent: '#53f59f', card: '#2d1c03' },
  { bg: '#18101f', fg: '#fbe9ff', accent: '#00e1ff', card: '#2f1d3a' },
];

function getArg(name, fallback) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  const next = process.argv[idx + 1];
  if (!next || next.startsWith('--')) return fallback;
  return next;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function parseBool(value, fallback = false) {
  if (value == null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp01(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function randomOf(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function takeRandom(list, count) {
  const copy = [...list];
  const out = [];
  while (copy.length && out.length < count) {
    const idx = randomInt(0, copy.length - 1);
    out.push(copy[idx]);
    copy.splice(idx, 1);
  }
  return out;
}

function hashShort(input, size = 12) {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, size);
}

function parseContent(content) {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item.text === 'string') return item.text;
        return '';
      })
      .join('\n');
  }
  return '';
}

function extractJsonObject(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('No JSON object found in model output');
  }

  return text.slice(firstBrace, lastBrace + 1);
}

function extractLikelyHtml(text) {
  if (typeof text !== 'string') return null;
  const stripped = stripCodeFence(text);
  const lower = stripped.toLowerCase();

  let start = lower.indexOf('<!doctype html');
  if (start === -1) start = lower.indexOf('<html');
  if (start === -1) return null;

  let end = lower.lastIndexOf('</html>');
  if (end !== -1) {
    end += '</html>'.length;
  } else {
    end = stripped.length;
  }

  return stripped.slice(start, end).trim();
}

function entropySymbolString() {
  const chars = '!@#$%^&*+=?/|~<>[]{}';
  let out = '';
  const len = randomInt(9, 18);
  for (let i = 0; i < len; i += 1) {
    out += chars[randomInt(0, chars.length - 1)];
  }
  return out;
}

function buildEntropyCapsule(chaos) {
  const now = new Date();
  const nonce = crypto.randomBytes(10).toString('hex');
  const hrTick = process.hrtime.bigint().toString().slice(-8);
  const pidSalt = hashShort(`${process.pid}:${os.hostname()}:${process.cwd()}`, 10);
  const memory = process.memoryUsage();

  const lawCount = 1 + Math.round(chaos * 2);
  const artifactCount = 2 + Math.round(chaos * 2.5);
  const tabooCount = 1 + Math.round(chaos * 2);

  const style = randomOf(STYLE_AXES);
  const colorDirection = randomOf(COLOR_DIRECTIONS);
  const layoutType = randomOf(LAYOUT_TYPES);
  const laws = takeRandom(SITE_LAWS, lawCount);
  const artifacts = takeRandom(ARTIFACTS, artifactCount);
  const taboo = takeRandom(TABOO_WORDS, tabooCount);
  const jitterMs = randomInt(7, 997);
  const symbolFlux = entropySymbolString();

  const entropyFingerprint = hashShort(
    [
      now.toISOString(),
      nonce,
      hrTick,
      process.pid,
      memory.rss,
      memory.heapUsed,
      os.uptime(),
      jitterMs,
      symbolFlux,
      style,
    ].join('|'),
    18
  );

  return {
    chaos,
    nonce,
    hrTick,
    pidSalt,
    jitterMs,
    style,
    colorDirection,
    layoutType,
    laws,
    artifacts,
    taboo,
    symbolFlux,
    entropyFingerprint,
    timestamp: now.toISOString(),
  };
}


function stripCodeFence(text) {
  const match = text.match(/```(?:html|json)?\s*([\s\S]*?)```/i);
  return match ? match[1].trim() : text.trim();
}

function hasNetworkCall(html) {
  return /\b(fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|navigator\.sendBeacon)\b/i.test(html);
}

function stripThinkingTags(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

let _browser = null;

async function getBrowser() {
  if (!_browser) {
    _browser = await chromium.launch({ headless: true });
  }
  return _browser;
}

async function validateHtmlRenders(html) {
  const tmpFile = path.join(os.tmpdir(), `hallucination-check-${Date.now()}.html`);
  fs.writeFileSync(tmpFile, html);
  let page;
  try {
    const browser = await getBrowser();
    const context = await browser.newContext();
    page = await context.newPage();

    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(`file://${tmpFile}`, { waitUntil: 'load', timeout: 5000 });

    // Check that there's visible content
    const bodyText = await page.evaluate(() => document.body?.innerText?.trim() || '');
    const hasVisibleContent = bodyText.length > 20;

    // Check for critical JS errors (ignore minor ones)
    const hasCriticalErrors = errors.some(
      (e) => e.includes('SyntaxError') || e.includes('is not defined') || e.includes('Cannot read')
    );

    await context.close();

    if (!hasVisibleContent) {
      return { ok: false, reason: `No visible content (body text: ${bodyText.length} chars)` };
    }
    if (hasCriticalErrors) {
      return { ok: false, reason: `JS errors: ${errors[0]}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: `Render failed: ${err.message}` };
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

function normalizeHtmlDocument(html) {
  if (typeof html !== 'string') return null;
  let stripped = stripCodeFence(stripThinkingTags(html));

  // Must have at least some HTML-like content
  const lower = stripped.toLowerCase();
  if (!lower.includes('<html') && !lower.includes('<body') && !lower.includes('<div') && !lower.includes('<!doctype')) return null;

  // Only hard reject: network calls (the one rule we actually care about)
  if (hasNetworkCall(stripped)) return null;

  // Trim junk after </html> if present
  const closingIdx = lower.lastIndexOf('</html>');
  if (closingIdx !== -1) {
    stripped = stripped.slice(0, closingIdx + '</html>'.length);
  }

  // Browsers handle the rest — just ensure doctype
  if (!/^<!doctype html>/i.test(stripped.trim())) {
    stripped = `<!doctype html>\n${stripped}`;
  }

  return stripped;
}

function parseModelOutput(content) {
  // 1. Try the full response as HTML
  const htmlDirect = normalizeHtmlDocument(content);
  if (htmlDirect) {
    return { html: htmlDirect };
  }

  // 2. Extract HTML from surrounding junk (thinking tags, markdown, etc.)
  const likelyHtml = extractLikelyHtml(content);
  if (likelyHtml) {
    const normalized = normalizeHtmlDocument(likelyHtml);
    if (normalized) {
      return { html: normalized };
    }
  }

  // 3. Maybe the model wrapped HTML in JSON despite being told not to
  try {
    const jsonText = extractJsonObject(content);
    const parsed = JSON.parse(jsonText);
    if (parsed && typeof parsed === 'object' && parsed.html) {
      const htmlFromJson = normalizeHtmlDocument(parsed.html) || normalizeHtmlDocument(extractLikelyHtml(parsed.html));
      if (htmlFromJson) {
        return { html: htmlFromJson };
      }
    }
  } catch {
    // Not JSON either, fall through.
  }

  // 4. Last resort: if there's ANY html-ish content, just wrap it and let the browser deal with it
  const trimmed = stripCodeFence(stripThinkingTags(content)).trim();
  if (trimmed.length > 100 && (trimmed.includes('<') && trimmed.includes('>'))) {
    console.warn('[generator] Saving raw response as-is (browser will handle broken HTML)');
    return { html: `<!doctype html>\n<html><body>\n${trimmed}\n</body></html>` };
  }

  throw new Error('Model returned no parseable standalone HTML document');
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderLocalFallbackPage(seed, entropy) {
  const c = randomOf(LOCAL_COLORS);
  const cards = takeRandom(ARTIFACTS, 4).map((artifact, idx) => {
    return `<button class="artifact" data-artifact="${escapeHtml(artifact)}">Artifact ${idx + 1}: ${escapeHtml(artifact)}</button>`;
  });

  const laws = entropy.laws.map((law) => `<li>${escapeHtml(law)}</li>`).join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Fallback Hallucination Terminal</title>
  <style>
    :root {
      --bg: ${c.bg};
      --fg: ${c.fg};
      --accent: ${c.accent};
      --card: ${c.card};
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--fg);
      background:
        radial-gradient(circle at 10% 10%, color-mix(in oklab, var(--accent), transparent 76%), transparent 45%),
        radial-gradient(circle at 84% 92%, color-mix(in oklab, var(--fg), transparent 88%), transparent 55%),
        linear-gradient(150deg, var(--bg), #020202);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      display: grid;
      place-items: center;
      padding: 24px;
    }
    .frame {
      width: min(1100px, 100%);
      border: 1px solid color-mix(in oklab, var(--fg), transparent 82%);
      border-radius: 16px;
      background: color-mix(in oklab, var(--bg), black 20%);
      padding: 20px;
      backdrop-filter: blur(6px);
      box-shadow: 0 20px 70px color-mix(in oklab, var(--accent), transparent 84%);
    }
    h1 {
      margin: 0 0 8px;
      line-height: 1.2;
      font-size: clamp(1.5rem, 4vw, 2.4rem);
    }
    .muted { opacity: 0.84; }
    .row { display: flex; gap: 12px; flex-wrap: wrap; margin: 16px 0; }
    .artifact {
      border: 1px solid color-mix(in oklab, var(--accent), white 20%);
      background: color-mix(in oklab, var(--accent), transparent 76%);
      color: var(--fg);
      border-radius: 999px;
      padding: 10px 14px;
      cursor: pointer;
    }
    .artifact:hover { transform: translateY(-1px); }
    .panel {
      border: 1px solid color-mix(in oklab, var(--fg), transparent 84%);
      background: var(--card);
      border-radius: 12px;
      padding: 12px;
      margin-top: 12px;
    }
    .log {
      margin-top: 12px;
      min-height: 160px;
      white-space: pre-wrap;
      line-height: 1.45;
      font-size: 0.95rem;
    }
  </style>
</head>
<body>
  <main class="frame">
    <h1>Fallback Hallucination Interface</h1>
    <div class="muted">Seed: ${escapeHtml(seed)}</div>
    <div class="muted">Entropy fingerprint: ${entropy.entropyFingerprint}</div>
    <div class="row">${cards.join('')}</div>
    <section class="panel">
      <strong>Site laws</strong>
      <ul>${laws}</ul>
    </section>
    <section class="panel">
      <button id="mutate" class="artifact">Mutate Narrative</button>
      <button id="compliance" class="artifact">Fake Compliance Check</button>
      <button id="forecast" class="artifact">Invent Forecast</button>
      <pre class="log" id="log"></pre>
    </section>
  </main>
  <script>
    const seed = ${JSON.stringify(seed)};
    const entropy = ${JSON.stringify(entropy.entropyFingerprint)};
    const laws = ${JSON.stringify(entropy.laws)};

    const lines = [
      'Rendering impossible navbar variants...',
      'Converting legal text to ritual poetry...',
      'A testimonial from a sentient escalator was approved.',
      'Cataloging user intent as migratory weather.',
      'Repricing premium plan in moonlight credits.',
      'Onboarding now asks for your least favorite prophecy.',
      'Graph axis changed from revenue to myth density.',
      'Product roadmap rerouted through a dream tribunal.'
    ];

    const log = document.getElementById('log');
    const random = (arr) => arr[Math.floor(Math.random() * arr.length)];

    function writeLine(prefix) {
      const law = random(laws);
      log.textContent += '[' + new Date().toLocaleTimeString() + '] ' + prefix + ' ' + random(lines) + ' | law=' + law + '\\n';
      if (log.textContent.length > 5000) log.textContent = log.textContent.slice(-3000);
    }

    document.querySelectorAll('.artifact').forEach((btn) => {
      btn.addEventListener('click', () => writeLine('artifact-trigger:'));
    });

    document.getElementById('mutate').addEventListener('click', () => {
      writeLine('mutation:');
      document.title = 'Mutated ' + Math.floor(Math.random() * 999) + ' :: ' + entropy;
    });

    document.getElementById('compliance').addEventListener('click', () => {
      const ok = Math.random() > 0.32;
      writeLine(ok ? 'compliance: pass (fictional)' : 'compliance: fail (the moon objected)');
    });

    document.getElementById('forecast').addEventListener('click', () => {
      const weather = ['fog of invoices', 'clear skies with rogue metaphors', 'hail made of microcopy'];
      writeLine('forecast for ' + seed.slice(0, 24) + '... ' + random(weather));
    });

    let ticks = 0;
    setInterval(() => {
      ticks += 1;
      if (ticks % 3 === 0) writeLine('ambient:');
    }, 1200);
  </script>
</body>
</html>`;
}

function normalizePayload(payload, seed, entropy) {
  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  const description = typeof payload.description === 'string' ? payload.description.trim() : '';
  const html = normalizeHtmlDocument(payload?.html);

  if (!html) {
    return {
      title: title || `Hallucination: ${seed.slice(0, 55)}`,
      description: description || 'Generated with local fallback HTML',
      seed,
      entropy,
      html: renderLocalFallbackPage(seed, entropy),
      mode: 'fallback-local-html',
    };
  }

  return {
    title: title || `Hallucination: ${seed.slice(0, 55)}`,
    description: description || `Entropy mode ${entropy.entropyFingerprint}`,
    seed,
    entropy,
    html,
    mode: 'openrouter-html',
  };
}

function splitCsv(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function uniqueStrings(items) {
  const out = [];
  for (const item of items) {
    if (!item) continue;
    if (!out.includes(item)) out.push(item);
  }
  return out;
}

function getModelCandidates() {
  const primary = process.env.OPENROUTER_MODEL || 'openrouter/auto';
  const fallbacksFromEnv = splitCsv(process.env.OPENROUTER_MODEL_FALLBACKS);
  const all = uniqueStrings([primary, ...fallbacksFromEnv]);
  // Shuffle so each page gets a random model first, with others as fallback
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all;
}

function getRequestTimeoutMs() {
  const raw = Number(process.env.OPENROUTER_TIMEOUT_MS || 120000);
  if (Number.isNaN(raw) || raw < 5000) return 120000;
  return raw;
}

function isAuthError(status, bodyText) {
  if (status === 401) return true;
  const text = String(bodyText || '').toLowerCase();
  return text.includes('user not found') || text.includes('invalid api key');
}

function formatHttpError(status, bodyText, context) {
  const prefix = context ? `${context}. ` : '';
  return `${prefix}OpenRouter error ${status}: ${String(bodyText).slice(0, 400)}`;
}

async function generateWithOpenRouter(seed, entropy) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not set');
  }

  const modelCandidates = getModelCandidates();

  const systemPrompt = [
    'You create wildly imaginative fake product websites.',
    'Return ONLY a complete standalone HTML document.',
    'No markdown. No code fences. No JSON. No explanation text.',
    'Rules:',
    '1) Start with <!doctype html> and include <html>, <head>, <body>.',
    '2) Include inline <style> and inline <script>.',
    '3) No external assets, no CDN, no network calls (no fetch/XHR/WebSocket/EventSource).',
    '4) All functionality is fake client-side only.',
    '5) Include at least 3 interactive controls with event handlers.',
    '6) Visual style should be bold and non-generic.',
    '7) Keep output under 120 KB.',
  ].join('\n');

  const userPrompt = [
    `Seed concept: ${seed}`,
    `Entropy fingerprint: ${entropy.entropyFingerprint}`,
    `Style axis: ${entropy.style}`,
    `Color palette direction: ${entropy.colorDirection}`,
    `Layout approach: ${entropy.layoutType}`,
    `Do not use these words: ${entropy.taboo.join(', ')}`,
    `Include these UI artifacts: ${entropy.artifacts.join(', ')}`,
    `Site law constraints: ${entropy.laws.join(' | ')}`,
    `Glitch token stream: ${entropy.symbolFlux}`,
    ...(Math.random() < 0.1 ? ['SPECIAL DIRECTIVE: The entire site must be cat-themed. All icons are cats, all metaphors involve cats, the UI has subtle paw prints, and at least one section is written from a cat\'s perspective.'] : []),
    'Generate a bizarre but coherent single-page experience that looks like a fake startup/public-service portal from an alternate timeline.',
    'It should feel alive: auto-updating widgets, nonsense dashboards, fake transactions, and performative legal notices.',
    'Final output requirement: respond with HTML document text only, starting at <!doctype html> and ending at </html>, with no additional commentary.',
  ].join('\n');

  // Keep temperature sane — creativity comes from the prompt, not broken syntax.
  // chaos 0→1 maps to temperature 0.8→1.3 (not 2.0 which produces garbage HTML)
  const temperature = Number((0.8 + entropy.chaos * 0.5).toFixed(2));
  const topP = Number((0.85 + entropy.chaos * 0.14).toFixed(2));
  const presencePenalty = Number((0.2 + entropy.chaos * 0.4).toFixed(2));
  const frequencyPenalty = Number((0.1 + entropy.chaos * 0.3).toFixed(2));

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
  const variants = [
    {
      name: 'creative',
      params: {
        temperature,
        top_p: topP,
        presence_penalty: presencePenalty,
        frequency_penalty: frequencyPenalty,
        max_tokens: 16000,
      },
    },
    {
      name: 'compat',
      params: {
        temperature: 0.9,
        top_p: 0.95,
        max_tokens: 12000,
      },
    },
    {
      name: 'safe',
      params: {
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 10000,
      },
    },
  ];

  let lastError = null;

  for (const model of modelCandidates) {
    for (const variant of variants) {
      console.log(`[generator] Requesting ${model} (${variant.name})...`);
      let response;
      try {
        response = await fetch(OPENROUTER_URL, {
          method: 'POST',
          signal: AbortSignal.timeout(getRequestTimeoutMs()),
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost',
            'X-Title': process.env.OPENROUTER_APP_NAME || 'Hallucinated Web Cache',
          },
          body: JSON.stringify({
            model,
            ...variant.params,
            messages,
          }),
        });
      } catch (error) {
        lastError = new Error(`model=${model} variant=${variant.name} request failed: ${error.message}`);
        console.warn(`[generator] OpenRouter retry after request failure: ${lastError.message}`);
        await wait(250);
        continue;
      }

      if (!response.ok) {
        const bodyText = await response.text();
        const context = `model=${model} variant=${variant.name}`;
        if (isAuthError(response.status, bodyText)) {
          throw new Error(formatHttpError(response.status, bodyText, context));
        }
        lastError = new Error(formatHttpError(response.status, bodyText, context));
        console.warn(`[generator] OpenRouter retry after failure: ${lastError.message}`);
        await wait(250);
        continue;
      }

      let data;
      try {
        data = await response.json();
      } catch (error) {
        lastError = new Error(`model=${model} variant=${variant.name} response parse failed: ${error.message}`);
        console.warn(`[generator] OpenRouter retry after response parse failure: ${lastError.message}`);
        await wait(250);
        continue;
      }
      const content = parseContent(data?.choices?.[0]?.message?.content);
      console.log(`[generator] Got response from ${model} (${variant.name}), ${content.length} chars`);

      try {
        const result = parseModelOutput(content);
        console.log(`[generator] Parsed HTML ok from ${model} (${variant.name})`);
        return result;
      } catch (error) {
        lastError = new Error(
          `model=${model} variant=${variant.name} returned unparsable HTML payload: ${error.message}`
        );
        console.warn(`[generator] OpenRouter retry after parse failure: ${lastError.message}`);
        console.warn(`[generator] Response preview: ${content.slice(0, 300)}`);
        await wait(250);
      }
    }
  }

  throw lastError || new Error('OpenRouter failed with unknown error');
}

async function createPage(options) {
  const seed = composeSeed(options.chaos);
  const entropy = buildEntropyCapsule(options.chaos);

  try {
    const aiPayload = await generateWithOpenRouter(seed, entropy);
    return normalizePayload(aiPayload, seed, entropy);
  } catch (error) {
    if (options.strictOpenrouter) {
      throw new Error(`Strict OpenRouter mode enabled. ${error.message}`);
    }
    console.error(`[generator] Skipping (no fallback): ${error.message}`);
    return null;
  }
}

async function generateBatch({ count, concurrency, chaos, strictOpenrouter }) {
  let current = 0;
  const total = Math.max(0, count);

  async function worker() {
    while (true) {
      const idx = current;
      current += 1;
      if (idx >= total) break;

      const page = await createPage({ chaos, strictOpenrouter });
      if (!page) continue;

      console.log(`[generator] Validating render...`);
      const check = await validateHtmlRenders(page.html);
      if (!check.ok) {
        console.warn(`[generator] Discarded (render check failed): ${check.reason}`);
        continue;
      }

      const saved = await savePage(page);
      console.log(
        `[generator] Saved ${saved.id} | ${saved.title} | mode=${saved.mode} | entropy=${saved.entropy?.entropyFingerprint || 'none'}`
      );
      await wait(180 + Math.floor(Math.random() * 820));
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, total || 1));
  const workers = Array.from({ length: workerCount }, () => worker());
  await Promise.all(workers);
}

async function run() {
  const loop = hasFlag('--loop');
  const count = Number(getArg('--count', '20'));
  const targetSize = Number(getArg('--target-size', '120'));
  const batchSize = Number(getArg('--batch-size', '6'));
  const concurrency = Number(getArg('--concurrency', '2'));
  const intervalMs = Number(getArg('--interval-ms', '4000'));
  const chaos = clamp01(getArg('--chaos', process.env.CHAOS_LEVEL || '0.88'));
  const strictOpenrouter =
    hasFlag('--strict-openrouter') || parseBool(process.env.OPENROUTER_STRICT, false);

  console.log(`[generator] chaos=${chaos}`);
  console.log(`[generator] strict_openrouter=${strictOpenrouter}`);

  if (!loop) {
    await generateBatch({ count, concurrency, chaos, strictOpenrouter });
    return;
  }

  console.log(`[generator] Loop mode on. Target cache size: ${targetSize}`);

  while (true) {
    const cacheCount = await getCacheCount();
    if (cacheCount < targetSize) {
      const toCreate = Math.min(batchSize, targetSize - cacheCount);
      console.log(`[generator] Cache size ${cacheCount}. Generating ${toCreate} page(s)...`);
      await generateBatch({ count: toCreate, concurrency, chaos, strictOpenrouter });
    } else {
      console.log(`[generator] Cache healthy (${cacheCount}/${targetSize})`);
    }

    await wait(intervalMs);
  }
}

run()
  .catch((error) => {
    console.error('[generator] Fatal:', error);
    process.exit(1);
  })
  .finally(async () => {
    if (_browser) await _browser.close();
  });
