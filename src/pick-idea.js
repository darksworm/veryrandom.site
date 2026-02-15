// Creative pipeline Phase 1: generate sparks + quality gate.
//
// 1. Four micro-prompts via random creative model (Trinity / Mistral Creative)
// 2. Grok critic: scores 1-10, must hit 8+ — retry with new seeds if below threshold (up to 10 attempts)
//
// Outputs approved sparks to stdout. Phases 2-4 happen in run.sh via Claude CLI.
// Usage: node src/pick-idea.js

const dotenv = require('dotenv');
dotenv.config({ override: true });

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// ── Entropy word pools ─────────────────────────────────────────────

const TEXTURES = [
  'wet concrete','faded receipt paper','chrome and glass','peeling wallpaper',
  'velvet curtain','rusted iron','sun-bleached plastic','mossy stone',
  'cracked leather','bubble wrap','corrugated cardboard','wax seal',
  'frosted glass','damp newspaper','polished marble','chipped enamel',
  'copper patina','raw denim','melted candle wax','vinyl flooring',
  'sandpaper','silk ribbon','burnt toast','aluminum foil','packing peanuts',
];

const PLACES = [
  'a gas station at 3am','an abandoned mall food court','a hospital waiting room',
  'a hotel lobby in 1987','the back of a laundromat','a ferry terminal in fog',
  'a government basement','a rooftop in summer rain','a dentist office hallway',
  'a bus stop in rural nowhere','an airport chapel','a parking garage stairwell',
  'a library after hours','a strip mall nail salon','a rest stop vending area',
  'a boat show convention floor','a DMV on a Friday','a church basement potluck',
  'a closed swimming pool','an elevator stuck between floors','a highway overpass',
  'the back room of a pawn shop','a motel ice machine alcove','a train station bench',
  'a warehouse rave at dawn',
];

const DECADES = [
  '1947','1953','1962','1968','1971','1976','1979','1983','1987','1991',
  '1994','1997','1999','2001','2003','2006','2009','2012','2017','2024',
  'the 1890s','the 1920s','the 1930s','the 1950s','the 1960s','the 1970s',
  'the 1980s','the late 1990s','the early 2000s','the near future',
];

const EMOTIONS = [
  'quiet desperation','manic enthusiasm','bureaucratic sincerity',
  'aggressive hospitality','melancholy optimism','paranoid cheerfulness',
  'resigned amusement','unearned confidence','polite rage',
  'nostalgic dread','tender absurdity','clinical warmth',
  'defiant whimsy','exhausted ambition','serene chaos',
  'theatrical indifference','anxious pride','gentle menace',
  'wistful competitiveness','cheerful nihilism',
];

const MATERIALS = [
  'wet concrete','faded receipt paper','chrome and glass','crumpled tinfoil',
  'laminated cardstock','magnetic poetry tiles','dry-erase board',
  'overhead projector slides','carbon copy forms','perforated ticket stubs',
  'polaroid photos','microfiche','dot matrix printout','a cork board',
  'masking tape and sharpie','graph paper','a chalkboard','neon tubing',
  'stained glass','poured resin','duct tape','string and thumbtacks',
  'post-it notes','a whiteboard covered in equations','embossed letterhead',
];

const WEATHER = [
  'permanent overcast','blinding noon sun','first snow of the year',
  'humid and still','wind that won\'t stop','thunderstorm approaching',
  'fog so thick you can touch it','a perfect 72 degrees','desert heat shimmer',
  'drizzle that\'s been going for three days','the golden hour before sunset',
  'a cold snap in April','balmy midnight','ice storm warning','hazy wildfire sky',
];

const WILD_CARDS = [
  'dial-up internet sounds','a fax machine that won\'t stop','the smell of chlorine',
  'fluorescent lights humming','a broken escalator','hold music from 1996',
  'a motivational poster that\'s slightly wrong','a clock that\'s 7 minutes fast',
  'a filing cabinet with one sticky drawer','carpet that\'s seen too much',
  'a vending machine with only one option left','a revolving door',
  'an intercom that crackles','a water cooler conversation','a fire exit sign',
  'someone else\'s lunch in the fridge','a badge that doesn\'t scan',
  'a plant that might be fake','a chair with one short leg',
  'a thermostat war','a password on a sticky note','a mandatory fun event',
  'a suggestion box that\'s never opened','a printer jam',
  'an out-of-order sign','a company newsletter nobody reads',
];

// ~30% chance the concept gets a format nudge toward interactive/simulator
const FORMATS = [
  'an interactive simulator you can actually use (buttons, state, feedback)',
  'a working dashboard with live-updating numbers and controls',
  'a tool or calculator that does something absurd but functional',
  'a machine or device you interact with directly (insert coins, press buttons, pull levers)',
  'a filing system or bureaucratic form you can actually fill out',
  'a monitoring console with gauges, alerts, and status indicators',
  'a configurator or builder where you customize something ridiculous',
  'a chat interface or terminal where something talks back to you',
  'a mesmerizing generative art piece with an interactive 3D background',
  'a page where the entire background is a living, breathing WebGL shader',
];

const VERBOSE = process.argv.includes('--verbose');
function log(msg) { if (VERBOSE) process.stderr.write(msg + '\n'); }

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

function buildEntropySeeds() {
  const allWords = [...TEXTURES, ...PLACES, ...DECADES, ...EMOTIONS, ...MATERIALS, ...WEATHER, ...WILD_CARDS];
  return {
    words: takeRandom(allWords, 5),
    decade: random(DECADES),
    emotion: random(EMOTIONS),
    material: random(MATERIALS),
    format: Math.random() < 0.3 ? random(FORMATS) : null,
  };
}

// ── LLM call helper ────────────────────────────────────────────────

async function ask(apiKey, model, system, user, { maxTokens = 300, temperature = 1.25 } = {}) {
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(90000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost',
      'X-Title': process.env.OPENROUTER_APP_NAME || 'Idea Generator',
    },
    body: JSON.stringify({
      model,
      temperature,
      top_p: 0.95,
      presence_penalty: 0.7,
      frequency_penalty: 0.5,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content || content.length < 10) throw new Error('Response too short');
  return content;
}

// ── Phase 1: Sparks (Gemini Flash) ─────────────────────────────────

const TERSE = 'Output ONLY what is asked. No preamble, no "Sure!", no markdown headers. Just the raw text.';

async function getConcept(apiKey, model, seeds) {
  const formatNudge = seeds.format
    ? `\n\nFORMAT DIRECTION: This should be ${seeds.format}. Not a marketing page ABOUT the thing — the actual thing itself that visitors interact with directly.`
    : '';
  return ask(apiKey, model,
    `You invent absurd fake website concepts. You always reply with exactly ONE concept in 1-2 sentences. Never two concepts. Never bullet points. ${TERSE}`,
    `Entropy seeds (absorb the vibe, don't use literally): ${seeds.words.join(', ')} / ${seeds.decade} / ${seeds.emotion} / ${seeds.material}

Invent ONE fake website concept. The concept must be INSTANTLY graspable — if someone needs more than one sentence to "get" the joke, it's too convoluted. Think: a real thing taken to an absurd extreme, or a mundane service delivered with unhinged sincerity. The humor should be obvious from the name alone.

BAD: layered meta-concepts that require explanation ("a blockchain-based archive of emotional debts converted into weather patterns")
GOOD: simple premises committed to fully ("a funeral home for discontinued snack foods" or "a law firm that only represents houseplants")

Not a real business. Played totally straight. ONE concept, 1-2 sentences, nothing else.${formatNudge}`,
    { maxTokens: 150 }
  );
}

async function getCharacter(apiKey, model, concept) {
  return ask(apiKey, model,
    `You flesh out fictional website founders. ${TERSE}`,
    `Website concept: ${concept}

Who made this website? Give them a name, a founding year, and an emotional reason they built this at 3am. What's their deal? What happened to them? What's their rival?

2-3 sentences. Specific and deadpan.`,
    { maxTokens: 250 }
  );
}

async function getDetails(apiKey, model, concept) {
  return ask(apiKey, model,
    `You invent hyper-specific fake details that make fictional websites feel alive. Every website is different — a dating app needs different details than a government bureau or a conspiracy theory blog. ${TERSE}`,
    `Website concept: ${concept}

What specific details would make THIS particular website feel real and lived-in? Not a template — think about what's unique to THIS concept. Invent 5-8 concrete details that only THIS website would have.`,
    { maxTokens: 400 }
  );
}

async function getVisual(apiKey, model, concept, seeds) {
  return ask(apiKey, model,
    `You are a web design director. ${TERSE}`,
    `Website concept: ${concept}
Vibe seeds: ${seeds.emotion} / ${seeds.material} / ${seeds.decade}

Describe the visual direction for this website in 2-3 sentences. Be specific about: color palette (name exact colors), layout style, typography mood, and one unexpected visual detail. Don't be generic.`,
    { maxTokens: 200 }
  );
}

async function generateSparks(apiKey, sparkModels) {
  const seeds = buildEntropySeeds();
  const pick = () => sparkModels[Math.floor(Math.random() * sparkModels.length)];

  const conceptModel = pick();
  log(`[pick-idea]   concept model: ${conceptModel}`);
  if (seeds.format) log(`[pick-idea]   format nudge: ${seeds.format}`);
  const concept = await getConcept(apiKey, conceptModel, seeds);
  log(`[pick-idea]   concept: ${concept.slice(0, 80)}...`);

  const charModel = pick(), detailModel = pick(), visualModel = pick();
  log(`[pick-idea]   character model: ${charModel}`);
  log(`[pick-idea]   details model: ${detailModel}`);
  log(`[pick-idea]   visual model: ${visualModel}`);

  const [character, details, visual] = await Promise.all([
    getCharacter(apiKey, charModel, concept),
    getDetails(apiKey, detailModel, concept),
    getVisual(apiKey, visualModel, concept, seeds),
  ]);

  const formatLine = seeds.format ? `\n\nFORMAT: ${seeds.format}` : '';
  return `CONCEPT: ${concept}

CHARACTER: ${character}

DETAILS:
${details}

VISUAL DIRECTION: ${visual}${formatLine}`;
}

// ── Phase 2: Grok critic ───────────────────────────────────────────

async function criticize(apiKey, criticModel, sparks) {
  const response = await ask(apiKey, criticModel,
    `You are the harshest comedy editor alive. You have seen ten thousand "lol random" website concepts and you are TIRED.

Score low (1-4) for:
- Random noun + random noun humor ("a dentist who is also a DJ" — so what?)
- "Quirky" without a point — weirdness that doesn't satirize anything real
- Concepts that sound funny in summary but wouldn't sustain an actual webpage
- Anything you've seen before or that feels like a Mad Libs output
- Overly convoluted premises that need a paragraph to explain why they're funny

Score high (8-10) for:
- Concepts with a real comedic TARGET (bureaucracy, hustle culture, nostalgia, tech, etc.)
- Ideas where the humor is STRUCTURAL — it's funny because of the commitment, not the randomness
- Premises that could generate 5+ genuinely different funny sections on a webpage
- Concepts that make you think "I would actually browse this site"

Your response format:
1. What is the single biggest weakness of this concept? (1-2 sentences — be specific)
2. If you have a NOTE that would make this concept land better (a sharper angle, a detail to emphasize, something to avoid), write it on a line starting with "NOTE:" — only if you have something genuinely useful
3. Final line: SCORE: X/10`,
    `Rate this satirical website concept on a scale of 1-10. State the biggest weakness first, then score.

${sparks}`,
    { maxTokens: 300, temperature: 0.7 }
  );

  const scoreMatch = response.match(/SCORE:\s*(\d+)/i);
  const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;
  const passed = score >= 8;

  // Extract NOTE lines if any
  const lines = response.trim().split('\n');
  const notes = lines
    .filter(l => l.trim().startsWith('NOTE:'))
    .map(l => l.trim().replace(/^NOTE:\s*/, ''))
    .join(' ');

  return { passed, score, feedback: response, notes };
}

// ── Phase 3: Grok enhancement pass ────────────────────────────────

async function enhance(apiKey, criticModel, sparks, feedback) {
  return ask(apiKey, criticModel,
    `You are a comedy writer refining a satirical website concept. You have the original concept and a critic's feedback. Your job is to REWRITE the concept — same format, same sections — but sharper, funnier, and with the critic's notes addressed.

Keep the same structure:
CONCEPT: ...
CHARACTER: ...
DETAILS: ...
VISUAL DIRECTION: ...

Rules:
- Fix weaknesses the critic identified
- Lean harder into whatever makes this concept funny
- Add specificity — real-sounding names, dates, prices, procedures
- Keep the deadpan tone — never wink at the audience
- Don't water it down or make it safer
- Output ONLY the rewritten concept in the exact format above, nothing else`,
    `ORIGINAL CONCEPT:
${sparks}

CRITIC FEEDBACK:
${feedback}

Rewrite and enhance this concept based on the feedback.`,
    { maxTokens: 800, temperature: 1.1 }
  );
}

// ── Main ───────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 10;

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    process.stderr.write('[pick-idea] No OPENROUTER_API_KEY set\n');
    process.exit(1);
  }

  const sparkModels = (process.env.OPENROUTER_SPARK_MODELS || 'deepseek/deepseek-v3.2').split(',').map(s => s.trim());
  const criticModel = process.env.OPENROUTER_CRITIC_MODEL || 'x-ai/grok-3-mini-beta';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      log(`[pick-idea] Attempt ${attempt}/${MAX_ATTEMPTS}: generating sparks...`);
      const sparks = await generateSparks(apiKey, sparkModels);

      log('[pick-idea] Asking Grok for quality check...');
      const { passed, score, feedback, notes } = await criticize(apiKey, criticModel, sparks);
      process.stderr.write(`[grok] ${feedback}\n`);
      process.stderr.write(`[pick-idea] Score: ${score}/10${passed ? ' — PASSED' : ' — below threshold (8+)'}\n`);

      if (passed) {
        log('[pick-idea] Passed! Running Grok enhancement pass...');
        const enhanced = await enhance(apiKey, criticModel, sparks, feedback);
        log(`[pick-idea] Enhanced output ready (${enhanced.length} chars)`);
        process.stdout.write(enhanced);
        return;
      }

      if (attempt < MAX_ATTEMPTS) {
        process.stderr.write(`[pick-idea] Retrying with new seeds...\n`);
      }
    } catch (err) {
      process.stderr.write(`[pick-idea] Attempt ${attempt} failed: ${err.message}\n`);
      if (attempt < MAX_ATTEMPTS) {
        process.stderr.write(`[pick-idea] Retrying...\n`);
      }
    }
  }

  process.stderr.write('[pick-idea] No idea scored 8+ after 10 attempts. Giving up.\n');
  process.exit(1);
}

main().catch(err => {
  process.stderr.write(`[pick-idea] Fatal: ${err.message}\n`);
  process.exit(1);
});
