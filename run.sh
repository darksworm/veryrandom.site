#!/usr/bin/env bash
set -euox pipefail
cd "$(dirname "$0")"

eval "$(fnm env)"

# Pick a fresh idea
PARAMS=$(node src/pick-idea.js)
IDEA=$(echo "$PARAMS" | jq -r '.idea')
STYLE=$(echo "$PARAMS" | jq -r '.style')
COLOR=$(echo "$PARAMS" | jq -r '.color')
LAYOUT=$(echo "$PARAMS" | jq -r '.layout')
CAT=$(echo "$PARAMS" | jq -r '.catMode')

DENSITY=$(echo "$PARAMS" | jq -r '.density')
DENSITY_PROMPT=$(echo "$PARAMS" | jq -r '.densityPrompt')

CHAOS=$(echo "$PARAMS" | jq -r '.chaosMode')

CAT_LINE=""
if [ "$CAT" = "true" ]; then
  CAT_LINE="SPECIAL: The entire site must be cat-themed. Cat puns everywhere, paw prints, everything through feline eyes."
  echo "🐱 CAT MODE"
fi

CHAOS_LINE=""
if [ "$CHAOS" = "true" ]; then
  CHAOS_LINE="WILDCARD: Be very creative and break the rules of common web design, in an artistic way. Surprise me."
  echo "🎨 CHAOS MODE"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Idea:    $IDEA"
echo "Style:   $STYLE"
echo "Color:   $COLOR"
echo "Layout:  $LAYOUT"
echo "Density: $DENSITY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

ID="$(date +%s)$(printf '%04x' $RANDOM)"
TARGET="cache/pages/${ID}.html"

echo "⏳ Generating via agent..."

echo "Write the file using: cat > ${TARGET} << 'HTMLEOF' ... HTMLEOF. Build a single-page website and write it to the file: ${TARGET}. Custom CSS in a style tag, custom JS in a script tag. No fetch/XMLHttpRequest/WebSocket. Zero JS errors.

You have these LOCAL assets available on the webserver (use them freely, they are already hosted):
- /assets/css/pico.min.css — Pico CSS classless framework (makes bare HTML look polished)
- /assets/css/fonts.css — Web fonts (link this to use them)
- /assets/js/alpine.min.js — Alpine.js (reactive UI via HTML attributes: x-data, x-show, x-on:click, x-text, x-for, etc.)
- /assets/js/gsap.min.js — GSAP animation library (gsap.to, gsap.from, gsap.timeline, ScrollTrigger not included)
- /assets/js/lucide.min.js — Lucide icon library (after including, call lucide.createIcons() and use <i data-lucide=\"icon-name\"></i>)
Available fonts (via /assets/css/fonts.css): 'Space Grotesk' (modern sans), 'Playfair Display' (elegant serif), 'IBM Plex Mono' (monospace), 'Crimson Pro' (editorial serif), 'Inter' (clean sans). Pick 1-2 that fit the style.

You do NOT have to use all of them — pick what fits the creative direction. Do NOT use any other external resources.

THE WORLD: ${IDEA}.

CRITICAL: Do NOT build a page that explains or showcases this concept. Do NOT make a meta page ABOUT the idea. Instead, build the ACTUAL website as if you ARE this business/organization/entity. The visitor should feel like they stumbled onto a real (but unhinged) website. Give it a believable name, real-sounding navigation, fake testimonials, plausible pricing, earnest copy — the humor comes from playing it straight. Think The Onion, not a joke explainer. No fourth wall breaking. No 'welcome to our absurd website'. Just BE the thing.

STRUCTURE: Do NOT use a formulaic beginning/middle/end structure. Do NOT label sections like 'Chapter 1' or 'The Journey'. This is a WEBSITE, not a story. Structure it like a real website would be structured — nav, hero, features, pricing, testimonials, FAQ, footer, whatever fits. Mix it up. Some pages should be simple landing pages, some should be dense content sites, some should be app-like. Vary the structure every time. Never be predictable.

Visual style: ${STYLE}. Color palette: ${COLOR}. Layout: ${LAYOUT}. ${CAT_LINE} ${CHAOS_LINE} CREATIVE DIRECTION: ${DENSITY_PROMPT}

MANDATORY — KEEP BOTTOM-RIGHT CORNER CLEAR: Do not place any fixed/sticky elements, popups, toasts, chat widgets, or important text in the bottom-right corner of the screen. That area is reserved for an external overlay.

MANDATORY — TEXT CONTRAST: Every single piece of text must be clearly readable. Dark text on light backgrounds OR light text on dark backgrounds. NEVER use gray text on gray backgrounds, light text on light backgrounds, or low-opacity text. If your background is dark, text must be white or near-white. If your background is light, text must be black or near-black. Check EVERY element including small text, labels, captions, and placeholder text. This is the #1 most common failure — do not fail at this.

Write the complete HTML to ${TARGET} and nothing else." | codex exec --skip-git-repo-check -s workspace-write

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

echo "✅ Saved: ${ID} ($SIZE bytes)"
