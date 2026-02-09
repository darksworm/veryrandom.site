const fs = require('node:fs');
const path = require('node:path');

const USED_PATH = path.join(__dirname, '..', 'cache', 'used-ideas.json');

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

// Bold declarative premises — absurd statements played totally straight
const PREMISES = [
  'Dust is a financial liability',
  'Chairs have been lying to us for decades',
  'Sleep is a scam invented by mattress companies',
  'Clouds are just sky litter and someone has to clean them',
  'Stairs are an outdated technology',
  'Silence is a luxury commodity',
  'Doors are a form of oppression',
  'Gravity is a subscription service and you are behind on payments',
  'Shadows are intellectual property',
  'Leftovers are an asset class',
  'Socks disappear because they are migrating',
  'Boredom is a treatable medical condition',
  'Pigeons are government employees and they deserve a union',
  'Every puddle is a potential business opportunity',
  'Yawning is contagious because it is a virus',
  'Beige is a cry for help',
  'Lunch breaks are a human rights violation against productivity',
  'Sneezing is the body trying to communicate with the dead',
  'Lawns are a cult and suburbia knows it',
  'The alphabet is in the wrong order',
  'Knees are a design flaw',
  'Tuesday has no reason to exist',
  'Parking lots are America\'s greatest architectural achievement',
  'Elevators are just tiny rooms that kidnap you briefly',
  'Condiments are the only honest form of self-expression',
  'Forks are just tiny aggressive rakes',
  'Humidity is a personality trait',
  'Blinking is just your eyes clapping',
  'Every bathroom mirror is a portal we are too afraid to use',
  'Paper cuts are a message from the trees',
  'Roundabouts are just car ballet and it is time we respected the art form',
  'Pillows know too much',
  'Wind is just the earth sighing',
  'Carpet is a lie we walk on every day',
  'The moon is a lamp that no one pays the electric bill for',
  'Toast is bread that has been through something traumatic',
  'Escalators are just stairs with ambition',
  'Coat hangers reproduce when you are not looking',
  'Curtains are walls in denial',
  'Receipts are the autobiography of your worst decisions',
  'Bread ties are a forgotten form of ancient currency',
  'Ice is just water with commitment issues',
  'Speed bumps are the earth\'s way of saying slow down',
  'Clocks are just circles with anxiety',
  'Every voicemail is a tiny hostage situation',
  'Calendars are just guilt spreadsheets',
  'Dental floss is a weapon we use on ourselves twice a day',
  'Gravel is just sand that got its life together',
  'Shampoo bottles in the shower are your only real audience',
  'Wi-Fi is just invisible leashes for humans',
];

const STYLES = [
  'brutalist carnival finance','retrofuturist municipal opera','biohazard luxury minimalism',
  'evangelical cyberpunk folklore','bureaucratic dreamcore logistics',
  'pastel corporate wellness dystopia','glitchcore Y2K government portal',
  'art deco space colony tourism board','vaporwave dental insurance',
  'soviet constructivist SaaS platform','tropical noir detective agency',
  'cottagecore military logistics','Memphis Group pharmaceutical catalog',
  'Swiss International Style alien embassy','psychedelic 1970s tax preparation',
  'Windows 95 luxury fashion house','neon noir public library system',
  'maximalist Victorian data center','grunge zine cryptocurrency exchange',
  'geocities-era astral projection academy','minimalist brutalist wedding planner',
];

const COLORS = [
  'monochrome with one violent accent color','warm earth tones like terracotta sand and olive',
  'neon on pitch black','pastel rainbow gradient everywhere',
  'newspaper black and white with red highlights','deep ocean blues and bioluminescent greens',
  'sunset palette: coral gold purple deep blue','clinical white with surgical green accents',
  'candy colors: hot pink electric blue lime green','sepia and aged parchment tones',
  'toxic: acid green warning yellow hazard orange','ice cold: pale blue silver white frost',
  'retrowave: magenta cyan chrome dark purple',
];

const LAYOUTS = [
  'single column with massive typography','dense dashboard grid with many small panels',
  'asymmetric magazine layout with overlapping sections','full-screen sections that scroll like slides',
  'sidebar-heavy admin panel aesthetic','chaotic overlapping windows like a cluttered desktop',
  'card-based masonry layout','split screen with contrasting halves',
  'terminal/console aesthetic with monospace everything','newspaper multi-column with headlines',
];

function random(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function takeRandom(arr, n) {
  const copy = [...arr], out = [];
  while (copy.length && out.length < n) {
    const i = Math.floor(Math.random() * copy.length);
    out.push(copy[i]);
    copy.splice(i, 1);
  }
  return out;
}

function loadUsed() {
  try { return new Set(JSON.parse(fs.readFileSync(USED_PATH, 'utf8'))); }
  catch { return new Set(); }
}

function markUsed(idea) {
  let used;
  try { used = JSON.parse(fs.readFileSync(USED_PATH, 'utf8')); }
  catch { used = []; }
  used.push(idea);
  fs.writeFileSync(USED_PATH, JSON.stringify(used, null, 2));
}

const used = loadUsed();
let idea;

function generateCombo() {
  return `${random(SUBJECTS)} ${random(ACTIONS)}, ${takeRandom(MODIFIERS, 2).join(', ')}`;
}

function generatePremise() {
  const premise = random(PREMISES);
  const framings = [
    `A company that genuinely believes: "${premise}." Build their corporate website.`,
    `A startup whose entire product is based on the fact that ${premise.toLowerCase()}. They have funding.`,
    `A government agency formed because ${premise.toLowerCase()}. This is their official .gov site.`,
    `A nonprofit advocacy group fighting for awareness because ${premise.toLowerCase()}.`,
    `A consulting firm that helps businesses adapt to the reality that ${premise.toLowerCase()}.`,
    `A subscription service built around the premise that ${premise.toLowerCase()}.`,
    `A lifestyle brand for people who understand that ${premise.toLowerCase()}.`,
    `A scientific institute dedicated to researching why ${premise.toLowerCase()}.`,
    `A law firm that specializes in cases involving the fact that ${premise.toLowerCase()}.`,
    `A wellness retreat centered on accepting that ${premise.toLowerCase()}.`,
  ];
  return random(framings);
}

for (let i = 0; i < 200; i++) {
  const candidate = Math.random() < 0.5 ? generatePremise() : generateCombo();
  if (!used.has(candidate)) { idea = candidate; break; }
}
if (!idea) { idea = Math.random() < 0.5 ? generatePremise() : generateCombo(); }

markUsed(idea);

const DENSITIES = [
  {
    name: 'atmospheric',
    prompt: 'This page should be a MOOD PIECE. Prioritize atmosphere, whitespace, typography, and subtle animation over interactivity. Think art installation, not dashboard. One or two elegant interactions at most — a hover effect that reveals something, a slow transition, a single meaningful click. Let the text and visuals breathe. Long pauses, cinematic pacing. The writing should be poetic and strange. Fewer elements, each one considered. CSS animations should be slow and hypnotic. No counters, no dashboards, no busy grids.',
  },
  {
    name: 'narrative',
    prompt: 'This page should be CONTENT-RICH. The writing is the star — witty, detailed, immersive. Fake articles, employee bios, customer testimonials, FAQ sections, blog posts, press releases. Make it feel like a real website with too much content that someone spent way too long writing. 2-3 interactive moments (tabs, expandable sections, hover reveals). The design supports the reading. No dashboards or stat counters.',
  },
  {
    name: 'dense',
    prompt: 'This page should be a MAXIMALIST EXPERIENCE — dense, layered, overwhelming in the best way. Multiple interactive elements (6+): buttons that change content, counters, toggles, live-updating data, things that respond to clicks. Fake dashboards, stats, tickers, charts made from CSS. Tables of absurd data. Grids packed with panels. Humorous disclaimers and footnotes everywhere. Auto-updating timers and counters. Make it feel alive and busy.',
  },
  {
    name: 'showcase',
    prompt: 'This page should be a CSS ART SHOWCASE. Push visual boundaries — complex gradients, layered pseudo-elements, clip-paths, CSS shapes, creative use of borders and shadows to draw illustrations. Interactions should be visual treats: hover animations, color shifts, morphing shapes. 3-4 interactive moments that transform the visuals. The page itself is the art. Minimal text, maximum visual impact. Think generative art meets web design.',
  },
  {
    name: 'editorial',
    prompt: 'This page should feel like a MAGAZINE or NEWSPAPER. Strong typography hierarchy, columns, pull quotes, bylines, fake ads in the margins. The content is king — 15+ pieces of witty writing: articles, opinion pieces, classifieds, letters to the editor, corrections. 3-4 interactive elements: toggle between sections, expand articles, filter by category. The design should serve the reading experience. Sophisticated and typographically rich.',
  },
];

const style = random(STYLES);
const color = random(COLORS);
const layout = random(LAYOUTS);
const density = random(DENSITIES);
const catMode = Math.random() < 0.1;
const chaosMode = Math.random() < 0.2;

console.log(JSON.stringify({ idea, style, color, layout, density: density.name, densityPrompt: density.prompt, catMode, chaosMode }));
