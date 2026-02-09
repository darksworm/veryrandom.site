const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const dotenv = require('dotenv');
const { chromium } = require('playwright');
const { savePage } = require('./cache');

dotenv.config({ override: true });

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const USED_IDEAS_PATH = path.join(__dirname, '..', 'cache', 'used-ideas.json');

// ── Idea fragments ──────────────────────────────────────────────────────────

const SUBJECTS = [
  'a cat','a very old cat','a committee of cats','a cat who is also a lawyer',
  'a cat landlord','a cat restaurant critic','a cat financial advisor','a cat therapist',
  'a cat who runs a nightclub','a cat detective agency','a cat-operated airline',
  'a council of pigeons','a dog who thinks it is a CEO','a parrot HR department',
  'raccoons in business suits','a hamster day-trading operation','a fish think tank',
  'a goose consulting firm','a crow judicial system','an octopus architect',
  'a retired astronaut','a confused wizard','a suburban dad','a bored librarian',
  'a rogue dentist','an overly enthusiastic intern','a passive-aggressive neighbor',
  'a grandma who is a hacker','a toddler dictator','a mime union leader',
  'a disgraced weatherman','a sleep-deprived nurse','a paranoid accountant',
  'a cheerful undertaker','a competitive knitter','a monk with WiFi',
  'a sentient HR manual','twin rival bakers','a barista philosopher',
  'a plumber who speaks only in riddles',
  'a haunted spreadsheet','a sentient IKEA shelf','a self-aware to-do list',
  'a passive-aggressive smart fridge','a printer with opinions','a GPS with trust issues',
  'a microwave that judges you','a roomba with ambition','a thermostat cult',
  'a vending machine with feelings','a traffic light support group',
  'an elevator with a podcast','a doorbell with anxiety','a lamp with a manifesto',
  'a clock that lies','a toilet that gives TED talks','a blender going through a phase',
  'a DMV for ghosts','a hospital for feelings','a post office for secrets',
  'a library of smells','a museum of failures','a bank that trades in favors',
  'a school for inanimate objects','a gym for emotional muscles',
  'a church of mild inconvenience','a prison for bad fonts',
  'a zoo where humans are the exhibit','a spa for burnt-out AIs',
  'a fire department for mixtapes','a kindergarten for retired supervillains',
  'a laundromat that washes memories','a pharmacy for existential dread',
];

const ACTIONS = [
  'launches a subscription service','opens an online store','starts a podcast',
  'runs a dating app','operates a delivery service','manages a hotel chain',
  'publishes a newspaper','hosts a game show','runs for mayor',
  'starts a crowdfunding campaign','launches a cryptocurrency',
  'opens a theme park','starts an airline','runs a cooking show',
  'offers financial advice','creates a fitness program','opens a law firm',
  'starts a religion','launches a space program on a budget',
  'organizes a music festival','runs a tech startup','opens a casino',
  'starts a fashion label','creates a social network','builds a city',
  'runs a reality TV show','offers therapy sessions','starts a revolution',
  'writes self-help books','runs a bed and breakfast','opens a detective agency',
  'manages a boy band','runs a funeral home with a twist','starts a book club',
  'launches a weather service','runs a talent show','opens a tattoo parlor',
  'starts an insurance company','runs a pawn shop','creates a language',
];

const MODIFIERS = [
  'but everything is upside down','but all communication is through interpretive dance',
  'but the currency is compliments','but it only operates during full moons',
  'but all reviews are written as haiku','but the staff are all ghosts',
  'but everything must rhyme','but the building keeps moving',
  'but customers must solve a riddle to enter','but all transactions happen underwater',
  'but everything is miniature','but it exists only in dreams',
  'but all documents are written in crayon','but the wifi password is a dance move',
  'but it is from the year 3000','but in a world where gravity is optional',
  'but everyone has amnesia','but all meetings happen in a hot air balloon',
  'but cats are in charge of quality control','but the soundtrack never stops',
  'but everything is cake','but time runs backwards on Tuesdays',
  'but the entire thing is run from a bathtub','but nothing is allowed to be beige',
  'but the dress code is medieval armor','but payment is accepted in soup',
  'but every surface is covered in moss','but it smells incredible for no reason',
  'but there is a live jazz band at all times','but the founder is a very confident goldfish',
  'but all employees are different versions of the same person',
  'but the menu changes based on the tides','but complaints are handled by a ouija board',
  'but the whole thing is inside a snow globe','but mascots roam freely and cannot be stopped',
  'but cats keep knocking everything off the shelves',
  'but a cat sits on the keyboard and alters every transaction',
  'but there is always a cat sleeping on the most important document',
];

const STYLE_AXES = [
  'brutalist carnival finance','retrofuturist municipal opera','biohazard luxury minimalism',
  'evangelical cyberpunk folklore','bureaucratic dreamcore logistics','desert maximalist weather-tech',
  'nautical posthuman infomercial','esoteric industrial civic branding',
  'interdimensional late-night shopping channel','neo-medieval UX cult handbook',
  'pastel corporate wellness dystopia','glitchcore Y2K government portal',
  'art deco space colony tourism board','vaporwave dental insurance',
  'soviet constructivist SaaS platform','tropical noir detective agency',
  'cottagecore military logistics','Memphis Group pharmaceutical catalog',
  'Swiss International Style alien embassy','psychedelic 1970s tax preparation',
  'Windows 95 luxury fashion house','Bauhaus underwater real estate',
  'neon noir public library system','maximalist Victorian data center',
  'flat design occult supply shop','skeuomorphic cloud kingdom passport office',
  'grunge zine cryptocurrency exchange','corporate Memphis existential crisis hotline',
  'geocities-era astral projection academy','minimalist brutalist wedding planner',
];

const COLOR_DIRECTIONS = [
  'monochrome with one violent accent color','warm earth tones like terracotta sand and olive',
  'neon on pitch black','pastel rainbow gradient everywhere',
  'newspaper black and white with red highlights','deep ocean blues and bioluminescent greens',
  'sunset palette: coral gold purple deep blue','clinical white with surgical green accents',
  'burnt orange and midnight purple','candy colors: hot pink electric blue lime green',
  'sepia and aged parchment tones','toxic: acid green warning yellow hazard orange',
  'ice cold: pale blue silver white frost','forest: dark green moss bark brown mushroom beige',
  'retrowave: magenta cyan chrome dark purple',
];

const LAYOUT_TYPES = [
  'single column with massive typography','dense dashboard grid with many small panels',
  'asymmetric magazine layout with overlapping sections','full-screen sections that scroll like slides',
  'sidebar-heavy admin panel aesthetic','centered narrow column like a legal document',
  'chaotic overlapping windows like a cluttered desktop','card-based masonry layout',
  'split screen with contrasting halves','terminal/console aesthetic with monospace everything',
  'newspaper multi-column with headlines','single giant scrolling table',
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function random(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function takeRandom(arr, n) {
  const copy = [...arr];
  const out = [];
  while (copy.length && out.length < n) {
    const i = Math.floor(Math.random() * copy.length);
    out.push(copy[i]);
    copy.splice(i, 1);
  }
  return out;
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Idea tracking ───────────────────────────────────────────────────────────

function loadUsedIdeas() {
  try {
    return JSON.parse(fs.readFileSync(USED_IDEAS_PATH, 'utf8'));
  } catch {
    return [];
  }
}

function saveUsedIdea(idea) {
  const used = loadUsedIdeas();
  used.push(idea);
  fs.writeFileSync(USED_IDEAS_PATH, JSON.stringify(used, null, 2));
}

function pickFreshIdea() {
  const used = new Set(loadUsedIdeas());
  for (let attempt = 0; attempt < 200; attempt++) {
    const subject = random(SUBJECTS);
    const action = random(ACTIONS);
    const mods = takeRandom(MODIFIERS, 2);
    const idea = `${subject} ${action}, ${mods.join(', ')}`;
    if (!used.has(idea)) return idea;
  }
  // If somehow all combos are used (unlikely with millions), just pick one
  const subject = random(SUBJECTS);
  const action = random(ACTIONS);
  const mods = takeRandom(MODIFIERS, 2);
  return `${subject} ${action}, ${mods.join(', ')}`;
}

// ── Prompt builder ──────────────────────────────────────────────────────────

function buildPrompt(idea) {
  const style = random(STYLE_AXES);
  const color = random(COLOR_DIRECTIONS);
  const layout = random(LAYOUT_TYPES);
  const catMode = Math.random() < 0.1;

  return {
    style, color, layout, catMode,
    system: `You are an expert web developer and creative designer. You build stunning, fully self-contained single-page websites. You write clean, valid HTML with inline CSS and JavaScript. Your code ALWAYS works — no syntax errors, no broken tags, no invalid CSS.

OUTPUT RULES (MANDATORY):
- Output ONLY the HTML document. No markdown, no code fences, no explanation, no commentary.
- Start with <!doctype html> and end with </html>
- ALL CSS must be in a <style> tag in <head>
- ALL JavaScript must be in a <script> tag before </body>
- NO external resources: no CDN links, no Google Fonts URLs, no images from the web
- NO network calls: no fetch(), no XMLHttpRequest, no WebSocket, no EventSource
- Use system fonts only (serif, sans-serif, monospace, or specific OS fonts)
- Keep total output under 100KB

QUALITY REQUIREMENTS:
- The page must be visually striking and unique — not a generic template
- Use CSS animations, gradients, shadows, and creative layouts
- Include at least 4 interactive elements with JavaScript event handlers
- The page should feel alive: auto-updating content, timers, dynamic elements
- Text content should be witty, detailed, and in-character for the concept
- Include fake but convincing data: names, numbers, dates, quotes, reviews
- The page should work perfectly in a modern browser with zero errors`,

    user: `BUILD THIS WEBSITE:

Concept: ${idea}
${catMode ? '\nSPECIAL: The entire site must be cat-themed. Cat puns everywhere, paw print decorations, everything viewed through feline eyes.' : ''}

VISUAL DIRECTION:
- Design style: ${style}
- Color palette: ${color}
- Layout: ${layout}

REQUIREMENTS:
- Create a complete, immersive single-page experience for this concept
- The site should look like it actually exists in some alternate reality
- Write at least 15-20 pieces of unique text content (headlines, descriptions, reviews, notices, fine print)
- Include interactive features: buttons that do things, counters, fake live feeds, toggleable sections
- Add subtle animations and micro-interactions
- Include humorous fine print or disclaimers at the bottom
- Make it feel like a real website someone would stumble upon, not a demo

Remember: output ONLY the raw HTML document, nothing else.`,
  };
}

// ── Validation ──────────────────────────────────────────────────────────────

let _browser = null;

async function getBrowser() {
  if (!_browser) _browser = await chromium.launch({ headless: true });
  return _browser;
}

async function validatePage(html) {
  const tmp = path.join(os.tmpdir(), `handcraft-check-${Date.now()}.html`);
  fs.writeFileSync(tmp, html);
  try {
    const browser = await getBrowser();
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`file://${tmp}`, { waitUntil: 'load', timeout: 8000 });
    const bodyText = await page.evaluate(() => document.body?.innerText?.trim() || '');
    await ctx.close();
    if (bodyText.length < 50) return { ok: false, reason: `Too little visible content (${bodyText.length} chars)` };
    const critical = errors.filter(e => /SyntaxError|is not defined|Cannot read/.test(e));
    if (critical.length) return { ok: false, reason: `JS error: ${critical[0]}` };
    return { ok: true, textLength: bodyText.length };
  } catch (e) {
    return { ok: false, reason: e.message };
  } finally {
    fs.unlinkSync(tmp);
  }
}

// ── HTML extraction ─────────────────────────────────────────────────────────

function extractHtml(content) {
  // Strip thinking tags
  let text = content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  // Strip code fences
  const fenceMatch = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fenceMatch) text = fenceMatch[1].trim();
  // Find HTML boundaries
  const lower = text.toLowerCase();
  let start = lower.indexOf('<!doctype html');
  if (start === -1) start = lower.indexOf('<html');
  if (start === -1) return null;
  let end = lower.lastIndexOf('</html>');
  if (end !== -1) end += '</html>'.length;
  else end = text.length;
  let html = text.slice(start, end).trim();
  if (!/^<!doctype html>/i.test(html)) html = '<!doctype html>\n' + html;
  // Reject if it has network calls
  if (/\b(fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|navigator\.sendBeacon)\b/i.test(html)) return null;
  return html;
}

// ── API call ────────────────────────────────────────────────────────────────

async function callModel(prompt) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');

  // Pick a random model from the pool
  const primary = process.env.OPENROUTER_MODEL || 'google/gemini-2.5-flash';
  const fallbacks = (process.env.OPENROUTER_MODEL_FALLBACKS || '').split(',').map(s => s.trim()).filter(Boolean);
  const models = [primary, ...fallbacks];
  const model = random(models);

  console.log(`[handcraft] Using model: ${model}`);

  const resp = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost',
      'X-Title': process.env.OPENROUTER_APP_NAME || 'Hallucinated Web Cache',
    },
    body: JSON.stringify({
      model,
      temperature: 0.9,
      top_p: 0.95,
      max_tokens: 16000,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`API ${resp.status}: ${body.slice(0, 300)}`);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content || '';
  return { content, model };
}

// ── Main loop ───────────────────────────────────────────────────────────────

async function handcraftOne() {
  const idea = pickFreshIdea();
  console.log(`\n[handcraft] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`[handcraft] Idea: ${idea}`);

  const prompt = buildPrompt(idea);
  console.log(`[handcraft] Style: ${prompt.style}`);
  console.log(`[handcraft] Color: ${prompt.color}`);
  console.log(`[handcraft] Layout: ${prompt.layout}`);
  if (prompt.catMode) console.log(`[handcraft] 🐱 CAT MODE ACTIVATED`);

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[handcraft] Generating (attempt ${attempt}/${maxAttempts})...`);

    let result;
    try {
      result = await callModel(prompt);
    } catch (e) {
      console.warn(`[handcraft] API error: ${e.message}`);
      await wait(1000);
      continue;
    }

    console.log(`[handcraft] Got ${result.content.length} chars from ${result.model}`);

    const html = extractHtml(result.content);
    if (!html) {
      console.warn(`[handcraft] Could not extract valid HTML, retrying...`);
      await wait(500);
      continue;
    }

    console.log(`[handcraft] Extracted ${html.length} chars of HTML, validating...`);

    const check = await validatePage(html);
    if (!check.ok) {
      console.warn(`[handcraft] Validation failed: ${check.reason}, retrying...`);
      await wait(500);
      continue;
    }

    console.log(`[handcraft] ✓ Validation passed (${check.textLength} chars visible text)`);

    const page = {
      title: idea.slice(0, 80),
      description: idea,
      seed: idea,
      entropy: {
        style: prompt.style,
        color: prompt.color,
        layout: prompt.layout,
        catMode: prompt.catMode,
        model: result.model,
      },
      html,
      mode: 'handcrafted',
    };

    const saved = await savePage(page);
    saveUsedIdea(idea);
    console.log(`[handcraft] ✓ Saved ${saved.id}`);
    return true;
  }

  console.warn(`[handcraft] ✗ Failed after ${maxAttempts} attempts, skipping idea`);
  return false;
}

async function run() {
  const count = Number(process.argv[2] || '0');
  const infinite = count === 0;
  const delayMs = Number(process.argv[3] || '2000');

  console.log(`[handcraft] Starting ${infinite ? 'infinite' : count + ' page'} generation`);
  console.log(`[handcraft] Delay between pages: ${delayMs}ms`);
  console.log(`[handcraft] Used ideas so far: ${loadUsedIdeas().length}`);

  let generated = 0;
  let i = 0;

  while (infinite || i < count) {
    const ok = await handcraftOne();
    if (ok) generated++;
    i++;
    console.log(`[handcraft] Progress: ${generated} saved / ${i} attempted`);
    await wait(delayMs);
  }

  console.log(`\n[handcraft] Done. Generated ${generated} pages in ${i} attempts.`);
}

run()
  .catch(e => { console.error('[handcraft] Fatal:', e); process.exit(1); })
  .finally(async () => { if (_browser) await _browser.close(); });
