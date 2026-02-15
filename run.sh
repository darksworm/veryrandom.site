#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

eval "$(fnm env)"

AGENT="${1:-claude}"

FONT_LIST="'Space Grotesk' (modern geometric sans), 'Playfair Display' (elegant high-contrast serif), 'IBM Plex Mono' (clean monospace), 'Crimson Pro' (editorial serif), 'Inter' (neutral UI sans), 'Archivo Black' (heavy blocky display), 'Caveat' (handwritten/casual), 'DM Serif Display' (elegant display serif), 'Fira Code' (monospace with ligatures), 'Josefin Sans' (geometric art-deco sans), 'Libre Baskerville' (classic book serif), 'Oswald' (tall condensed sans), 'Permanent Marker' (graffiti/marker), 'Rubik' (rounded geometric sans), 'Source Serif 4' (editorial serif), 'Unbounded' (futuristic/techy display), 'Work Sans' (clean neutral sans)"

# ── Phase 1+2: Sparks + Grok quality gate ──────────────────────────
echo "⏳ Phase 1: Generating sparks + quality gate..."
SPARKS=$(node src/pick-idea.js)
echo "━━━ Sparks ━━━"
echo "$SPARKS" | head -15
echo "━━━━━━━━━━━━━━"

# ── Phase 3: Synthesize identity (Claude CLI) ──────────────────────
echo "⏳ Phase 2: Synthesizing identity via Claude..."
IDENTITY=$(echo "Here are raw creative sparks about a fake website someone built:

${SPARKS}

Now become this person. Write in first person. Tell me:
- Who you are (name, background, one sentence)
- What your website does and why it matters to you personally
- What emotional truth your website is really about (under the absurdity)
- How you want visitors to feel when they land on your site
- What your website is trying to say to the world

Stay in character. Be specific and sincere. 1-2 short paragraphs. No preamble. No markdown." | claude -p --dangerously-skip-permissions)

echo "━━━ Identity ━━━"
echo "$IDENTITY" | head -10
echo "━━━━━━━━━━━━━━━━"

# ── Phase 4: Blueprint (Claude CLI) ────────────────────────────────
echo "⏳ Phase 3: Creating build blueprint via Claude..."
BLUEPRINT=$(echo "You are a wildly creative director planning a single-page website. Look things up online for inspiration if you need — real weird corners of the internet, design trends, obscure references, anything that sparks ideas for THIS specific site.

WEBSITE IDENTITY:
${IDENTITY}

RAW CREATIVE MATERIAL:
${SPARKS}

AVAILABLE FONTS (pick 1-3):
${FONT_LIST}

Now plan this website. There is no template — every site is different. Maybe this one is a single giant interactive thing. Maybe it's a long scroll of dense text. Maybe it's a grid of cards. Maybe it's something that reacts to how long you've been staring at it. You decide what THIS site needs.

Your blueprint must include:
- FONTS: Which fonts and where
- COLORS: Exact hex codes (4-6 colors)
- A concrete description of what to build — structure, content, interactions, animations, vibe. Be as specific as possible so a developer can execute it without guessing.

Any interactive elements must ACTUALLY WORK client-side (no backend). Alpine.js state, localStorage, CSS tricks, timers, randomization, canvas — whatever fits. But only add interactivity if it serves the site. Not every site needs a quiz.

Be decisive. Be weird. If your first instinct feels familiar, throw it away and go deeper. No \"could\" or \"maybe\". No preamble. No markdown headers." | claude -p --dangerously-skip-permissions)

echo "━━━ Blueprint ━━━"
echo "$BLUEPRINT" | head -20
echo "━━━━━━━━━━━━━━━━━"

# ── Phase 5: Build the page ────────────────────────────────────────
ID="$(date +%s)$(printf '%04x' $RANDOM)"
TARGET="cache/pages/${ID}.html"

echo "⏳ Phase 4: Building page via ${AGENT}..."

PROMPT="Write the file using: cat > ${TARGET} << 'HTMLEOF' ... HTMLEOF. Build a single-page website and write it to the file: ${TARGET}. Custom CSS in a style tag, custom JS in a script tag. No fetch/XMLHttpRequest/WebSocket. Zero JS errors.

DO NOT OPEN THE WEBPAGE FOR ME TO VIEW.

LOCAL ASSETS (already hosted, use freely):
- /assets/css/pico.min.css — Pico CSS classless framework
- /assets/css/fonts.css — All web fonts below (link this to use them)
- /assets/js/alpine.min.js — Alpine.js (x-data, x-show, x-on:click, x-text, x-for, etc.)
- /assets/js/gsap.min.js — GSAP (gsap.to, gsap.fromTo, gsap.timeline). NEVER use gsap.from() — always gsap.fromTo() with explicit start AND end values.
- /assets/js/lucide.min.js — Lucide icons (call lucide.createIcons(), use <i data-lucide=\"icon-name\"></i>)

AVAILABLE FONTS (via /assets/css/fonts.css):
${FONT_LIST}

Do NOT use any external resources. Pick only what the blueprint specifies.

═══ WHO I AM ═══
${IDENTITY}

═══ BUILD BLUEPRINT ═══
${BLUEPRINT}

Execute this blueprint. Build the ACTUAL website — not a page ABOUT the concept. You ARE this business/person/entity. The visitor stumbled onto a real (but unhinged) website.

Follow the blueprint closely — it specifies fonts, colors, layout, sections, and interactions. Every interactive element the blueprint specifies must ACTUALLY WORK — no dead buttons or fake forms. Bring your own writing craft: every sentence SHARP, SPECIFIC, and FUNNY. Short punchy copy > walls of text.

MANDATORY — BOTTOM-RIGHT CLEAR: No fixed/sticky elements in the bottom-right corner. Reserved for external overlay.

MANDATORY — RESPONSIVE: Must work on mobile (375px), tablet (768px), desktop (1440px+). Viewport meta, fluid widths, min 16px body text, min 44px tap targets, no horizontal scroll.

MANDATORY — TEXT CONTRAST: All text clearly readable. No rgba() text colors — solid hex only. No opacity below 0.9 on text. Min 4.5:1 contrast ratio everywhere.

Write the complete HTML to ${TARGET} and nothing else.
"

case "$AGENT" in
  claude)
    echo "$PROMPT" | CLAUDE_CODE_MAX_OUTPUT_TOKENS=128000 claude -p --dangerously-skip-permissions
    ;;
  codex)
    echo "$PROMPT" | codex exec --skip-git-repo-check -s workspace-write
    ;;
  gemini)
    echo "$PROMPT" | gemini --yolo
    ;;
  *)
    echo "❌ Unknown agent: $AGENT (use claude, codex, or gemini)"
    exit 1
    ;;
esac

# Check file was created
if [ ! -f "$TARGET" ]; then
  echo "❌ Agent did not create the file"
  exit 1
fi

SIZE=$(wc -c < "$TARGET")
echo "✓ Agent wrote $SIZE bytes to $TARGET"

if [ "$SIZE" -lt 3000 ]; then
  echo "Too small ($SIZE bytes), skipping — need at least 3KB"
  rm "$TARGET"
  exit 1
fi

# ── Rename to slug-based filename ─────────────────────────────────
RAW_TITLE=$(sed -n 's/.*<title>\([^<]*\)<\/title>.*/\1/Ip' "$TARGET" | head -1)
if [ -z "$RAW_TITLE" ]; then
  RAW_TITLE=$(sed -n 's/.*<h1[^>]*>\([^<]*\).*/\1/Ip' "$TARGET" | head -1)
fi

if [ -n "$RAW_TITLE" ]; then
  SLUG=$(echo "$RAW_TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g; s/--*/-/g; s/^-//; s/-$//' | cut -c1-60)
fi

if [ -n "$SLUG" ] && [ ${#SLUG} -gt 2 ]; then
  HEX=$(printf '%04x' $RANDOM)
  NEW_ID="${SLUG}-${HEX}"
  NEW_TARGET="cache/pages/${NEW_ID}.html"
  mv "$TARGET" "$NEW_TARGET"
  TARGET="$NEW_TARGET"
  ID="$NEW_ID"
fi

echo "✅ Saved: ${ID} ($SIZE bytes)"
